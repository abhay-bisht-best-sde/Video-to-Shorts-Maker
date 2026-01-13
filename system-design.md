# System Design Document

## Overview

This is a video processing platform that automatically extracts engaging short-form clips (reels) from long-form videos. The system processes videos through a multi-stage pipeline: transcription, AI-powered moment detection, and automated clip generation in multiple orientations.

## Architecture

### High-Level Architecture

```
┌─────────────┐
│   Client    │
│  (Next.js)  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Next.js API Routes             │
│  - Video Upload                     │
│  - Video Management                 │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   PostgreSQL (Prisma)               │
│   - Video Metadata                  │
│   - Moments                         │
│   - Clip Metadata                   │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   AWS SQS Queues                    │
│   ┌──────────────────────────────┐  │
│   │ 1. Transcript Queue          │  │
│   │ 2. LLM Analysis Queue        │  │
│   │ 3. Video Trimming Queue      │  │
│   └──────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Background Workers                │
│   - Queue Pollers                   │
│   - Concurrent Event Processing     | 
│   - Worker Threads                  │ 
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   External Services                 │
│   - ElevenLabs (Transcription)      │
│   - OpenAI (Moment Detection)       │
│   - Cloudflare R2 (Video Storage)   │
│   - Supabase (Transcripts/Clips)    │
└─────────────────────────────────────┘
```

## Processing Pipeline

### Stage 1: Video Upload & Transcription
1. **Upload**: Client uploads video → Next.js API route
2. **Storage**: Video stored in Cloudflare R2
3. **Queue**: Message published to Transcript Queue
4. **Processing**:
   - Audio extraction from video (Worker Thread)
   - ElevenLabs API for transcription
   - Store transcript & VTT in Supabase
5. **Next Stage**: Auto-publish to LLM Analysis Queue

### Stage 2: AI-Powered Moment Detection
1. **Queue**: Message consumed from LLM Analysis Queue
2. **Processing**:
   - Download plain text transcript from Supabase (uses transcriptPath, not vttPath)
   - OpenAI GPT-4o-mini analyzes plain text transcript
   - Extract 3-5 key moments (10-30 seconds each)
   - Store moments in PostgreSQL
3. **Next Stage**: Auto-publish to Video Trimming Queue

**Note**: The system uses the plain text transcript format (`.text` file) for LLM analysis, not the VTT format. VTT files are stored separately for subtitle display purposes but are not used for moment detection.

### Stage 3: Clip Generation
1. **Queue**: Message consumed from Video Trimming Queue
2. **Processing**:
   - Download video from R2
   - For each moment:
     - Extract horizontal clip (16:9) using Worker Thread
     - Extract vertical clip (9:16) using Worker Thread
     - Upload clips to Supabase
     - Update clip metadata in PostgreSQL

## Technical Choices & Trade-offs

### 1. AWS SQS for Async Processing

**Choice**: Use AWS SQS queues for decoupled, asynchronous processing.

**Rationale**:
- **Decoupling**: Each stage is independent and can scale separately
- **Reliability**: SQS provides message durability and retry mechanisms
- **Scalability**: Workers can process messages in parallel
- **Error Handling**: Failed messages can be retried or moved to DLQ

**Alternative Considered**: Direct function calls
- Rejected because: Synchronous processing would block API responses and limit scalability

### 2. Batch Message Processing

**Choice**: Process SQS messages in batches of 4 (`SQS_MESSAGE_BATCH_SIZE = 4`).

**Rationale**:
- **Throughput**: Process multiple messages concurrently
- **Resource Efficiency**: Balance between parallelism and resource usage
- **Cost Optimization**: Reduce SQS API calls

**Implementation**:
```typescript
const batches = chunkArray(validMessages, SQS_MESSAGE_BATCH_SIZE);
for (const batch of batches) {
  await Promise.allSettled(batch.map((message) => processMessage(message)));
}
```

### 3. Worker Threads for Video Processing

**Choice**: Use Node.js Worker Threads for FFmpeg operations (audio extraction, clip trimming).

**Rationale**:
- **Non-blocking**: FFmpeg operations are CPU-intensive and can block the event loop
- **Isolation**: Worker failures don't crash the main process
- **Parallelism**: Multiple clips can be processed simultaneously
- **Timeout Handling**: Workers can be terminated if they hang

**Implementation**:
- Audio extraction: `audio-extraction-worker.ts`
- Clip extraction: `clip-extraction-worker.mjs`
- Uses `fluent-ffmpeg` library for video processing
- Timeout: 300 seconds (`VIDEO_TRIM_TIMEOUT_SECONDS`)

**Video Processing Approach**:
- Uses re-encoding (not stream copy) to ensure consistent quality and enable aspect ratio conversion
- Applies scale and pad filters to convert between 16:9 and 9:16 aspect ratios
- Preserves full frame content with letterboxing/pillarboxing instead of cropping
- Optimized encoding settings (H.264, AAC) for web delivery

**Trade-offs**:
- ✅ Pros: Non-blocking, isolated, parallelizable, consistent output quality
- ❌ Cons: Memory overhead, complexity in error handling, slower than stream copy (but necessary for aspect ratio conversion)

**Alternative Considered**: Child processes
- Rejected because: Worker threads share memory space and are more efficient for this use case

### 4. Dual Storage Strategy

**Choice**: Use Cloudflare R2 for videos, Supabase Storage for transcripts and clips.

**Rationale**:
- **R2 for Videos**: Cost-effective for large binary files, S3-compatible API
- **Supabase for Text/Clips**: Better integration with PostgreSQL, easier CDN access
- **Separation of Concerns**: Different storage tiers for different data types

**Trade-offs**:
- ✅ Pros: Cost optimization, appropriate tool for each use case
- ❌ Cons: Two storage systems to manage

### 5. Status Tracking with Enums

**Choice**: Use Prisma enums (`ProcessingStatus`, `ClipStatus`) for state management.

**Rationale**:
- **Type Safety**: TypeScript enums prevent invalid states
- **Database Constraints**: Database enforces valid values
- **Clear States**: `NotStarted`, `Generating`, `Generated`, `Error`

**Trade-offs**:
- ✅ Pros: Type safety, clear state machine
- ❌ Cons: Schema changes require migrations

### 6. Structured Logging with Trace IDs

**Choice**: Implement trace ID-based logging throughout the system.

**Rationale**:
- **Observability**: Track requests across async boundaries
- **Debugging**: Correlate logs from different stages
- **Monitoring**: Identify bottlenecks and failures

**Implementation**: 
- Trace ID generated for each queue message using logger utility
- Trace ID passed through all processing stages (transcript, LLM analysis, video trimming)
- All log entries include trace ID for correlation
- Enables tracking a single video through the entire pipeline

### 7. Promise.allSettled for Error Isolation

**Choice**: Use `Promise.allSettled` instead of `Promise.all` for batch processing.

**Rationale**:
- **Fault Tolerance**: One failure doesn't stop the entire batch
- **Partial Success**: Some clips can succeed even if others fail
- **Better UX**: Users see progress even with partial failures

**Trade-offs**:
- ✅ Pros: Resilient to individual failures
- ❌ Cons: Need to handle partial failures in UI

## Performance Optimizations

### 1. Batch Processing
- Messages processed in batches of 4 (configured via `SQS_MESSAGE_BATCH_SIZE`)
- Moments processed in batches during clip generation (same batch size)
- `chunkArray` utility function divides messages into batches
- Sequential batch processing with parallel execution within each batch
- Reduces overhead and improves throughput

### 2. Parallel Clip Generation
- Each moment generates 2 clips (horizontal + vertical) in parallel
- Worker threads enable true parallelism for CPU-intensive tasks

### 3. Efficient Queue Polling
- Long polling implemented with 10 seconds wait time (`WaitTimeSeconds: 10`)
- Maximum 10 messages retrieved per poll (`MaxNumberOfMessages: 10`)
- Configured via `getPollingConfig` function
- Reduces empty poll responses and API calls
- Applied to all three queues (Transcript, LLM Analysis, Video Trimming)

### 4. Temporary File Management
- Videos downloaded once per trimming job to temporary directory
- Temporary directories created with unique paths per job
- Automatic cleanup implemented with retry logic (3 retries)
- Cleanup runs in finally block to ensure execution
- File size validation before processing

### 5. Database Indexing
- Indexes on `videoId`, `videoUuid` for fast lookups
- Composite indexes for common query patterns

## Scalability Considerations

### Horizontal Scaling
- **Stateless Workers**: Queue consumers implemented as stateless functions that can run on multiple instances
- **SQS**: AWS SQS automatically handles message distribution across multiple consumer instances
- **Database**: PostgreSQL connection pooling implemented via Prisma

### Vertical Scaling
- **Worker Threads**: Multiple worker threads can process clips concurrently within a single instance
- **Batch Size**: Batch size is configurable via `SQS_MESSAGE_BATCH_SIZE` constant (currently set to 4)
- **Parallel Processing**: Each moment generates 2 clips in parallel using Promise.allSettled

### Bottlenecks & Mitigations
1. **FFmpeg Processing**: Implemented worker threads to prevent blocking, with timeout protection (300 seconds)
2. **API Rate Limits**: Error handling implemented for rate limit scenarios, with status tracking in database
3. **Database Connections**: Prisma connection pooling configured for efficient database access
4. **Storage I/O**: Parallel clip uploads implemented using Promise.allSettled for concurrent Supabase uploads

## Error Handling Strategy

### 1. Queue-Level Errors
- Messages that fail processing remain in queue (SQS visibility timeout)
- Messages automatically return to queue if not deleted within visibility timeout
- Retry logic implemented in queue consumers
- Failed messages can be reprocessed when consumer retries

### 2. Processing Errors
- Status updated to `Error` in database
- Errors logged with trace IDs
- Partial failures handled gracefully (e.g., some clips succeed, others fail)

### 3. Worker Thread Errors
- Timeout protection (300 seconds)
- Worker termination on errors
- Error status stored in database

### 4. API Errors
- Error handling implemented for ElevenLabs and OpenAI API calls
- Errors logged with trace IDs for debugging
- Database status updated to `Error` when API calls fail
- Processing stops at failed stage (no partial results continue)

## Security Considerations

### 1. File Validation
- MIME type validation (only `video/mp4`)
- Duration limits (max 35 minutes)
- File size validation

### 2. Access Control
- Signed URLs for video access (2-hour expiry)
- Supabase signed URLs for clips (1-hour expiry)

### 3. API Keys
- Environment variables for sensitive keys
- No keys exposed in client-side code

## Implemented Features

### Queue Processing
- Three-stage queue pipeline (Transcript → LLM Analysis → Video Trimming)
- Batch message processing with configurable batch size (4 messages)
- Long polling for efficient queue consumption
- Message validation and error handling

### Video Processing
- Audio extraction from video files using FFmpeg
- Video clip extraction with time-based trimming
- Aspect ratio conversion (16:9 horizontal and 9:16 vertical)
- Re-encoding with optimized settings for web delivery
- Worker thread isolation for CPU-intensive operations

### AI Integration
- ElevenLabs speech-to-text transcription with speaker diarization
- OpenAI GPT-4o-mini for moment detection
- Structured output parsing for reliable data extraction
- Transcript and VTT file generation

### Storage & Database
- Cloudflare R2 for original video storage
- Supabase Storage for transcripts and generated clips
- PostgreSQL database with Prisma ORM
- Status tracking for all pipeline stages
- Metadata storage for videos, moments, and clips

### Error Handling
- Status-based error tracking in database
- Trace ID logging throughout the system
- Worker thread timeout protection
- Partial failure handling with Promise.allSettled
- Automatic cleanup of temporary files

### Security
- File type and duration validation
- Signed URL generation for secure access
- Environment variable-based API key management
- No sensitive data exposed to client

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: AWS SQS
- **Storage**: Cloudflare R2 (videos), Supabase Storage (transcripts/clips)
- **AI Services**: ElevenLabs (transcription), OpenAI (moment detection)
- **Video Processing**: FFmpeg via fluent-ffmpeg
- **Language**: TypeScript
- **Runtime**: Node.js with Worker Threads
