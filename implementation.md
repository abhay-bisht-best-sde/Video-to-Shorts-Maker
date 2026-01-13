# Implementation Document

## End-to-End Pipeline: Upload → Clips

This document describes the complete implementation flow from video upload to clip generation.

## Pipeline Overview

```
Upload → R2 Storage → Transcript Queue → Audio Extraction → ElevenLabs → Supabase Storage → LLM Queue → OpenAI Analysis → Moments DB → Trimming Queue → Video Download → Clip Extraction → Supabase Storage → Complete
```

## Stage 1: Video Upload

### Entry Point
**File**: `app/api/videos/route.ts`

### Flow
1. **Request Validation**
   ```typescript
   - Validate MIME type (must be video/mp4)
   - Validate duration (max 35 minutes)
   - Extract file buffer
   ```

2. **Upload to R2**
   ```typescript
   uploadFileToBucket({
     fileBuffer: buffer,
     bucketName: VIDEO_BUCKET_NAME,
     fileType: fileExtension,
     mimeType: fileType,
   })
   ```
   - Generates UUID for video
   - Stores in R2: `videos/{uuid}.mp4`
   - Returns `{ uuid, key }`

3. **Database Record**
   ```typescript
   prisma.video.create({
     data: {
       videoUuid: uuid,
       originalName: fileName,
       mimeType: fileType,
       size: fileSize,
       duration,
       videoKey: key,
       transcriptStatus: NotStarted,
       videoAnalysisStatus: NotStarted,
       clipsGenerationStatus: NotStarted,
     }
   })
   ```

4. **Queue Publication**
   ```typescript
   publishToTranscriptQueue(videoId, videoUuid, traceId)
   ```
   - Publishes message to AWS SQS Transcript Queue
   - Message: `{ videoId, videoUuid }`

### Key Files
- `app/api/videos/route.ts` - Upload endpoint
- `app/lib/r2/storage.ts` - R2 upload logic
- `app/lib/aws/queues/publishers/transcript-publisher.ts` - Queue publisher

---

## Stage 2: Transcript Generation

### Queue Consumer
**File**: `app/lib/aws/queues/consumers/transcript-consumer.ts`

### Polling Configuration
```typescript
getPollingConfig(queueUrl, {
  maxMessages: 10,
  waitTimeSeconds: 10, // Long polling
})
```

### Batch Processing
```typescript
const batches = chunkArray(validMessages, SQS_MESSAGE_BATCH_SIZE); // Batch size: 4
for (const batch of batches) {
  await Promise.allSettled(batch.map((message) => processMessage(message)));
}
```

### Processing Flow

#### 2.1 Audio Extraction
**File**: `app/helpers/utils/audio-extraction.ts`

1. **Download Video from R2**
   ```typescript
   const videoBuffer = await downloadVideoFromR2(videoKey, traceId);
   ```

2. **Worker Thread for Audio Extraction**
   ```typescript
   const worker = new Worker(workerPath, {
     workerData: { tempVideoPath, tempAudioPath }
   });
   ```
   - Uses `fluent-ffmpeg` library to extract audio from video
   - Extracts audio as MP3 format (equivalent to: `ffmpeg -i video.mp4 -vn -acodec libmp3lame audio.mp3`)
   - Timeout: 300 seconds
   - Runs in isolated worker thread to avoid blocking the main process

3. **Return Audio Buffer**
   - Audio extracted as MP3 buffer
   - Temporary files cleaned up

#### 2.2 Transcription via ElevenLabs
**File**: `app/lib/elevenlabs/client.ts`

```typescript
const transcription = await elevenlabs.speechToText.convert({
  file: audioBlob,
  modelId: "scribe_v2",
  tagAudioEvents: true,
  languageCode: "eng",
  diarize: true,
  additionalFormats: [{ format: "srt" }],
});
```

**Features**:
- Speaker diarization
- Audio event tagging
- SRT format for subtitles
- Returns both text transcript and VTT content

#### 2.3 Store Transcripts in Supabase
**File**: `app/lib/supabase/supabase-storage.ts`

```typescript
await Promise.all([
  uploadTranscriptToSupabase({
    content: vttContent,
    bucketName: env.SB_TRANSCRIPT_BUCKET_NAME,
    fileExtension: "vtt",
    transcriptUuid: vttUuid
  }),
  uploadTranscriptToSupabase({
    content: transcriptContent,
    bucketName: env.SB_TRANSCRIPT_BUCKET_NAME,
    fileExtension: "text",
    transcriptUuid: transcriptUuid
  }),
])
```

- Stores VTT file: `{vttUuid}.vtt`
- Stores text transcript: `{transcriptUuid}.text`
- Both stored in Supabase Storage bucket

#### 2.4 Update Database
```typescript
await prisma.video.update({
  where: { id: videoId },
  data: {
    transcriptStatus: ProcessingStatus.Generated,
    vttUuid: vttUuid,
    vttPath: uploadVttResult.key,
    transcriptUuid: transcriptUuid,
    transcriptPath: uploadTranscriptResult.key,
  },
});
```

#### 2.5 Publish to Next Queue
```typescript
await publishToLLMAnalysisQueue(videoId, videoUuid, messageTraceId);
```

### Key Files
- `app/actions/transcript-actions.ts` - Main processing logic
- `app/helpers/utils/audio-extraction.ts` - Audio extraction
- `app/helpers/utils/audio-extraction-worker.ts` - Worker thread
- `app/lib/elevenlabs/client.ts` - ElevenLabs integration
- `app/lib/supabase/supabase-storage.ts` - Supabase storage

---

## Stage 3: AI-Powered Moment Detection

### Queue Consumer
**File**: `app/lib/aws/queues/consumers/llm-analysis-consumer.ts`

### Processing Flow

#### 3.1 Download Transcript
```typescript
const { data: transcriptData } = await supabaseStorageClient.storage
  .from(env.SB_TRANSCRIPT_BUCKET_NAME)
  .download(videoInfo.transcriptPath);

const transcriptContent = await transcriptData.text();
```

**Note**: The system downloads the **plain text transcript** (`.text` file), not the VTT file. The VTT file is stored separately for subtitle display purposes, but the LLM uses the plain text format which is cleaner and more suitable for moment detection.

#### 3.2 OpenAI Analysis
**File**: `app/lib/llm-ops/moments-detector.ts`

**Prompt Engineering**:
- System prompt: Expert video editor specializing in viral reels
- Instructions: Extract 3-5 key moments (10-30 seconds each)
- Focus: Engaging, shareable, reel-worthy content

**Structured Output**:
```typescript
const VideoMomentSchema = z.object({
  start_time: z.number(),
  end_time: z.number(),
  title: z.string(),
});

const structuredLLM = openai_client.withStructuredOutput<MomentsResponseType>(
  MomentsResponseSchema
);
```

**Model**: GPT-4o-mini (cost-effective, fast)

**Validation**:
- Duration: 10-30 seconds
- No overlaps
- start_time < end_time

#### 3.3 Store Moments
```typescript
await prisma.videoMoment.createMany({
  data: validMoments.map((moment) => ({
    videoId,
    videoUuid,
    start_time: moment.start_time,
    end_time: moment.end_time,
    title: moment.title,
  })),
});
```

#### 3.4 Update Status
```typescript
await prisma.video.update({
  where: { id: videoId },
  data: { videoAnalysisStatus: ProcessingStatus.Generated },
});
```

#### 3.5 Publish to Next Queue
```typescript
await publishToVideoTrimmingQueue(videoId, videoUuid, traceId);
```

### Key Files
- `app/actions/llm-analysis-actions.ts` - Main processing logic
- `app/lib/llm-ops/moments-detector.ts` - OpenAI integration
- `app/lib/llm-ops/openai.ts` - OpenAI client setup

---

## Stage 4: Clip Generation

### Queue Consumer
**File**: `app/lib/aws/queues/consumers/video-trimming-consumer.ts`

### Processing Flow

#### 4.1 Fetch Video & Moments
```typescript
const { video, moments } = await fetchVideoWithMoments(videoId, videoUuid, traceId);
```

#### 4.2 Download Video from R2
**File**: `app/helpers/video-trimming/video-downloader.ts`

```typescript
const downloaded = await downloadVideoFromR2(video.videoKey, videoUuid, traceId);
// Returns: { tempVideoPath, tempDir }
```

#### 4.3 Process Moments in Batches
**File**: `app/helpers/video-trimming/ffmpeg-video-trimmer.ts`

```typescript
const momentBatches = chunkArray(moments, SQS_MESSAGE_BATCH_SIZE); // Batch size: 4

for (const batch of momentBatches) {
  await Promise.allSettled(
    batch.map((moment) => processMoment(moment, tempVideoPath, tempDir, traceId))
  );
}
```

#### 4.4 Process Each Moment
For each moment, generate 2 clips (horizontal + vertical):

```typescript
const ORIENTATIONS = [
  { type: ClipOrientation.Horizontal, aspectRatio: "16:9", suffix: "h" },
  { type: ClipOrientation.Vertical, aspectRatio: "9:16", suffix: "v" },
];

await Promise.allSettled(
  ORIENTATIONS.map(async ({ type, aspectRatio, suffix }) => {
    // Extract clip
    // Upload clip
    // Update metadata
  })
);
```

#### 4.5 Clip Extraction (Worker Thread)
**File**: `app/helpers/video-trimming/clip-extractor.ts`

```typescript
const worker = new Worker(workerPath, {
  workerData: {
    tempVideoPath,
    tempClipPath,
    startTime: moment.start_time,
    duration: moment.end_time - moment.start_time,
    aspectRatio, // "16:9" or "9:16"
  },
});
```

**Worker Implementation** (`clip-extraction-worker.mjs`):
```javascript
// FFmpeg filters
const scaleFilter = aspectRatio === "16:9"
  ? "scale=1920:1080:force_original_aspect_ratio=decrease"
  : "scale=1080:1920:force_original_aspect_ratio=decrease";

const padFilter = aspectRatio === "16:9"
  ? "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black"
  : "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black";

ffmpeg(tempVideoPath)
  .setStartTime(startTime)
  .setDuration(duration)
  .videoFilters([scaleFilter, padFilter])
  .outputOptions([
    "-c:v libx264",
    "-preset medium",
    "-crf 23",
    "-c:a aac",
    "-b:a 128k",
    "-movflags +faststart",
  ])
  .output(tempClipPath)
  .run();
```

**Features**:
- Uses `fluent-ffmpeg` library (not raw FFmpeg command-line)
- Extracts clip using `.setStartTime()` and `.setDuration()` methods
- Re-encodes video (not stream copy) to ensure consistent quality and format
- Scales video to target aspect ratio using `scale` filter
- Pads with black bars using `pad` filter to maintain aspect ratio (preserves full frame content)
- H.264 video encoding with optimized settings (libx264, preset medium, CRF 23)
- AAC audio encoding at 128k bitrate
- Fast start flag for web streaming optimization
- Timeout: 300 seconds

**Implementation Approach**:
Unlike simple FFmpeg commands that use `-c copy` (stream copy) for fast extraction, this implementation re-encodes the video. This approach:
- Ensures consistent video format and quality across all clips
- Enables aspect ratio conversion (scale + pad) which requires re-encoding
- Produces web-optimized output with fast start flag
- Maintains full frame content with letterboxing/pillarboxing instead of cropping

#### 4.6 Upload Clip to Supabase
**File**: `app/helpers/video-trimming/clip-uploader.ts`

1. **Validate Clip**
   ```typescript
   const validation = await validateVideoFile(tempClipPath, traceId);
   // Checks: file exists, size > 0, valid video format
   ```

2. **Upload**
   ```typescript
   await supabaseStorageClient.storage
     .from(env.SB_CLIPS_MOMENTS_NAME)
     .upload(`${clipUuid}_${suffix}.mp4`, clipBuffer, {
       contentType: "video/mp4",
       upsert: false,
     });
   ```

3. **Update/Create Metadata**
   ```typescript
   await prisma.clipMetadata.upsert({
     where: { videoMomentId_orientation: { videoMomentId, orientation } },
     create: {
       videoMomentId,
       orientation,
       filePath: uploadData.path,
       status: ClipStatus.Success,
     },
     update: {
       filePath: uploadData.path,
       status: ClipStatus.Success,
     },
   });
   ```

#### 4.7 Error Handling
- If clip extraction fails: Status set to `ClipStatus.Error`
- If upload fails: Status set to `ClipStatus.Error`
- Other clips continue processing (isolated failures)

#### 4.8 Cleanup
```typescript
await cleanupTempDirectory(tempDir, log);
// Removes all temporary files with retry logic
```

#### 4.9 Update Final Status
```typescript
await prisma.video.update({
  where: { id: videoId },
  data: { clipsGenerationStatus: ProcessingStatus.Generated },
});
```

### Key Files
- `app/actions/video-trimming-actions.ts` - Main processing logic
- `app/helpers/video-trimming/ffmpeg-video-trimmer.ts` - Trimming orchestrator
- `app/helpers/video-trimming/clip-extractor.ts` - Clip extraction
- `app/helpers/video-trimming/clip-extraction-worker.mjs` - Worker thread
- `app/helpers/video-trimming/clip-uploader.ts` - Clip upload
- `app/helpers/video-trimming/video-downloader.ts` - Video download

---

## Queue Polling Implementation

### Polling Strategy
**File**: `app/lib/aws/queues/polling-config.ts`

```typescript
{
  QueueUrl: queueUrl,
  MaxNumberOfMessages: 10,
  WaitTimeSeconds: 10, // Long polling
}
```

**Benefits**:
- Long polling reduces empty responses
- Max 10 messages per poll balances throughput and memory
- Configurable per queue

### Consumer Pattern
Each consumer follows this pattern:

```typescript
export async function pollQueue(): Promise<void> {
  const command = new ReceiveMessageCommand(getPollingConfig(queueUrl));
  const response = await sqsClient.send(command);
  
  if (response.Messages && response.Messages.length > 0) {
    const validMessages = response.Messages.filter(
      (msg) => msg.Body && msg.ReceiptHandle
    );
    
    const batches = chunkArray(validMessages, SQS_MESSAGE_BATCH_SIZE);
    
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map((message) => processMessage(message))
      );
    }
  }
}
```

**Chunk Pattern Explanation**:

The chunk pattern divides incoming messages into smaller groups (batches) before processing them. Here's how it works:

1. **Message Validation**: First, all received messages are filtered to ensure they have both a message body and a receipt handle. Invalid messages are discarded.

2. **Chunking**: Valid messages are divided into batches using the `chunkArray` function. The batch size is controlled by `SQS_MESSAGE_BATCH_SIZE` constant, which is set to 4 messages per batch.

3. **Sequential Batch Processing**: Batches are processed one at a time (sequentially). This prevents overwhelming the system with too many concurrent operations.

4. **Parallel Message Processing Within Batch**: Within each batch, all messages are processed in parallel using `Promise.allSettled`. This means up to 4 messages are processed simultaneously.

5. **Error Isolation**: Using `Promise.allSettled` instead of `Promise.all` ensures that if one message in a batch fails, the other messages in that batch continue processing. This provides fault tolerance at the batch level.

**Benefits of This Pattern**:
- **Controlled Concurrency**: Limits the number of simultaneous operations to prevent resource exhaustion
- **Balanced Throughput**: Processes multiple messages concurrently while maintaining system stability
- **Fault Tolerance**: Individual message failures don't stop the entire batch from processing
- **Scalability**: Can handle varying message volumes efficiently
- **Resource Management**: Prevents memory and CPU overload by processing in manageable chunks

**Example Flow**:
If 12 messages are received from the queue:
- They are divided into 3 batches of 4 messages each
- Batch 1 processes 4 messages in parallel, then completes
- Batch 2 processes the next 4 messages in parallel, then completes
- Batch 3 processes the final 4 messages in parallel, then completes
- Each batch waits for all its messages to finish (or fail) before moving to the next batch

### Message Deletion
Messages are deleted after successful processing:
```typescript
const deleteCommand = new DeleteMessageCommand({
  QueueUrl: queueUrl,
  ReceiptHandle: message.ReceiptHandle,
});
await sqsClient.send(deleteCommand);
```

---

## Constants & Configuration

**File**: `app/config/constants.ts`

```typescript
export const MAX_DURATION_SECONDS = 35 * 60; // 35 minutes
export const ALLOWED_MIME_TYPE = "video/mp4";
export const VIDEO_BUCKET_NAME = "videos";
export const MOMENTS_BUCKET_NAME = "moments";
export const SQS_MESSAGE_BATCH_SIZE = 4;
export const VIDEO_TRIM_TIMEOUT_SECONDS = 300000; // 5 minutes
export const SIGNED_URL_EXPIRY_HOURS = 2;
export const SUPABASE_SIGNED_URL_EXPIRY_SECONDS = 3600;
```

---

## Error Handling & Status Tracking

### Status Flow
```
NotStarted → Generating → Generated/Error
```

### Error Scenarios

1. **Transcript Generation Fails**
   - Status: `transcriptStatus = Error`
   - Pipeline stops (no transcript for analysis)

2. **LLM Analysis Fails**
   - Status: `videoAnalysisStatus = Error`
   - Pipeline stops (no moments to trim)

3. **Clip Generation Fails**
   - Status: `clipsGenerationStatus = Error` (or `Generated` if partial success)
   - Individual clips: `ClipStatus.Error`
   - Other clips continue processing

### Retry Strategy
- SQS visibility timeout: Messages return to queue if not deleted
- Worker timeouts: 300 seconds, then terminate
- Database updates: Retry logic in cleanup operations

---

## Performance Optimizations

1. **Batch Processing**: Messages and moments processed in batches of 4
2. **Parallel Execution**: `Promise.allSettled` for concurrent processing
3. **Worker Threads**: Isolated FFmpeg operations
4. **Long Polling**: Reduces empty SQS responses
5. **Efficient Storage**: Videos downloaded once per trimming job
6. **Automatic Cleanup**: Temporary files removed after processing

---

## Monitoring & Observability

### Trace IDs
Every operation includes a trace ID for log correlation:
```typescript
const traceId = logger.generateTraceId();
const log = logger.withTraceId(traceId);
```

### Logging Points
- Queue message received/processed
- External API calls (ElevenLabs, OpenAI)
- File operations (upload/download)
- Database operations
- Errors with full context

### Status Tracking
Database status fields enable:
- Progress monitoring
- Error detection
- Pipeline state queries