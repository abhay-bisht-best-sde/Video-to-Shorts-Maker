# AI Integration Document

This document describes the AI services integrated into the project and how they are used.

## Overview
It uses two AI services:
1. **ElevenLabs** - Speech-to-text transcription
2. **OpenAI** - Moment detection and analysis

---

## ElevenLabs Integration

### Purpose
Convert video audio to text transcript with timestamps and speaker diarization.

### API Details
- **Service**: ElevenLabs Speech-to-Text API
- **Model**: `scribe_v2`
- **SDK**: `@elevenlabs/elevenlabs-js` v2.30.0

### Implementation

**File**: `app/lib/elevenlabs/client.ts`


### Configuration Options

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `modelId` | `"scribe_v2"` | Latest transcription model |
| `tagAudioEvents` | `true` | Detect non-speech events |
| `languageCode` | `"eng"` | English language |
| `diarize` | `true` | Speaker identification |
| `additionalFormats` | `[{ format: "srt" }]` | Generate SRT subtitles |

### Response Format

The API returns a transcription response that can be:
- **String**: Plain text transcript
- **Object**: Structured response with:
  - `text`: Transcript text
  - `additionalFormats`: Array of format objects containing:
    - `requestedFormat`: Format type (e.g., "srt")
    - `fileExtension`: File extension (e.g., "srt")
    - `content`: Format content (e.g., VTT content)
    - `isBase64Encoded`: Encoding flag

### Response Processing

**File**: `app/lib/elevenlabs/transcript-parser.ts`

```typescript
// Extract plain text transcript
const transcriptText = extractTranscriptText(normalizedTranscription);

// Extract VTT content from SRT format
const vttContent = extractVTTContent(normalizedTranscription, transcriptText);
```

### Integration Flow

1. **Audio Extraction** (Worker Thread)
   - Video downloaded from R2
   - FFmpeg extracts audio as MP3
   - Audio buffer passed to ElevenLabs

2. **API Call**
   - Audio sent as Blob
   - Returns transcript + SRT format

3. **Response Processing**
   - Extract text transcript
   - Convert SRT to VTT format
   - Both stored in Supabase Storage

4. **Storage**
   - Text transcript: `{transcriptUuid}.text`
   - VTT file: `{vttUuid}.vtt`
   - Paths stored in PostgreSQL

### Error Handling

```typescript
try {
  const transcription = await elevenlabs.speechToText.convert({...});
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  log.error("ElevenLabs API error", new Error(errorMessage));
  throw new Error(`ElevenLabs API error: ${errorMessage}`);
}
```

- Errors logged with trace ID
- Database status updated to `Error`
- Exception propagated to queue consumer

### Usage Context

**Called from**: `app/actions/transcript-actions.ts`

```typescript
const audioBuffer = await extractAudioFromVideo({...});
const transcriptResult = await generateTranscript({
  audioBuffer,
  traceId,
});
```

---

## OpenAI Integration

### Purpose
Analyze transcript to identify key moments suitable for short-form content (reels).

### API Details
- **Service**: OpenAI Chat API
- **Model**: `gpt-4o-mini`
- **SDK**: `@langchain/openai` v1.2.1
- **Framework**: LangChain

### Implementation

**File**: `app/lib/llm-ops/openai.ts`

#### Client Setup
```typescript
import { ChatOpenAI } from "@langchain/openai";

export const openai_client = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.5,
  apiKey: env.OPENAI_API_KEY,
});
```

**Model Selection Rationale**:
- **gpt-4o-mini**: Cost-effective, fast, sufficient for structured extraction
- **Temperature 0.5**: Balanced creativity and consistency

### Moment Detection

**File**: `app/lib/llm-ops/moments-detector.ts`

#### Prompt Engineering

**System Prompt**:
```
You are an expert video content editor and analyst specializing in creating viral reels and short-form content.

Your primary goal is to extract the most engaging, shareable, and reel-worthy moments from a long-form video transcript.

A "key moment" for reel creation is a short continuous time segment that:
- Contains a clear, compelling idea, insight, story, or hook
- Has high engagement potential
- Delivers value or entertainment quickly (within 10-30 seconds)
- Has a strong opening that captures attention
- Has a clear beginning and end
- Is visually or narratively interesting
- Contains punchy, quotable, or memorable content

You must:
- Return exactly 3 to 5 key moments optimized for reel creation
- Use only timestamps that exist in the transcript
- Ensure no moments overlap in time
- Ensure start_time < end_time
- Ensure each moment is at least 10 seconds long
- Ensure each moment is at most 30 seconds long
- Ensure each moment has a specific, engaging, reel-optimized title
```

**Human Prompt Template**:
```
### CONTEXT
You will be given a video transcript with timestamps.
Each transcript entry follows this format:

[timestamp_in_seconds] text spoken at that time

Example:
[12.5] Today we're going to talk about how startups fail
[45.2] The first mistake founders make is hiring too early

Here is the transcript:
"""
{transcriptContent}
"""

Extract the key moments from this transcript.
```

#### Structured Output Schema

```typescript
const VideoMomentSchema = z.object({
  start_time: z.number().describe("Start time in seconds"),
  end_time: z.number().describe("End time in seconds"),
  title: z.string().describe("Concise, descriptive, specific title for the moment"),
});

const MomentsResponseSchema = z.object({
  moments: z.array(VideoMomentSchema).describe("Array of key video moments"),
});
```

#### API Call with Structured Output

```typescript
const prompt = getPromptTemplate();
const structuredLLM = openai_client.withStructuredOutput<MomentsResponseType>(
  MomentsResponseSchema
);
const chain = prompt.pipe(structuredLLM);

const result = await chain.invoke({
  transcriptContent,
});

const moments: VideoMoment[] = result?.moments || [];
```

**Benefits of Structured Output**:
- Type-safe responses
- Guaranteed schema compliance
- No manual parsing needed
- Automatic validation

### Response Validation

```typescript
const validMoments = moments.filter((moment) => {
  const duration = moment.end_time - moment.start_time;
  return duration > 10 && duration <= 30;
});
```

**Validation Rules**:
- Duration: 10-30 seconds
- No overlaps (handled by LLM prompt)
- Valid timestamps (within transcript range)

### Integration Flow

1. **Transcript Retrieval**
   - Download plain text transcript from Supabase Storage (uses `transcriptPath`, not `vttPath`)
   - Read as text content
   - **Note**: The system uses the plain text transcript (`.text` file) for LLM analysis, not the VTT format. VTT is stored separately for subtitle display but is not used for moment detection.

2. **LLM Analysis**
   - Transcript sent to OpenAI
   - Structured output returned

3. **Validation**
   - Filter moments by duration
   - Validate timestamps

4. **Database Storage**
   - Delete existing moments for video
   - Insert new moments
   - Update video analysis status

5. **Next Stage**
   - Publish to Video Trimming Queue

### Error Handling

```typescript
try {
  const result = await chain.invoke({ transcriptContent });
  // Process and store moments
} catch (error) {
  log.error("Error detecting moments", error as Error, { videoId, videoUuid });
  await prisma.video.update({
    where: { id: videoId },
    data: { videoAnalysisStatus: ProcessingStatus.Error },
  });
  throw error;
}
```

- Errors logged with trace ID
- Database status updated to `Error`
- Exception propagated to queue consumer

### Usage Context

**Called from**: `app/actions/llm-analysis-actions.ts`

```typescript
const transcriptContent = await transcriptData.text();
await detectMomementsAndUpdateStatus({
  vttContent,
  videoId,
  videoUuid,
  traceId,
});
```

---

## API Rate Limits & Costs

### ElevenLabs
- **Rate Limits**: Varies by plan (check ElevenLabs documentation)
- **Cost**: Pay-per-minute of audio transcribed
- **Optimization**: Single API call per video (audio extracted once)

### OpenAI
- **Rate Limits**: 
  - Requests per minute: Varies by tier
  - Tokens per minute: Varies by tier
- **Cost**: 
  - gpt-4o-mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
  - Typical transcript: ~1K-5K tokens input, ~200-500 tokens output
- **Optimization**: Single API call per video, structured output reduces retries

### Cost Optimization Strategies

1. **Model Selection**: Using gpt-4o-mini instead of gpt-4 (10x cheaper)
2. **Single Call**: One API call per video (no retries for formatting)
3. **Structured Output**: Reduces need for parsing/retry logic
4. **Prompt Optimization**: Clear instructions reduce token usage

---

## Error Scenarios & Handling

### ElevenLabs Errors

1. **API Key Invalid**
   - Error: Authentication failed
   - Handling: Log error, update status, throw exception

2. **Rate Limit Exceeded**
   - Error: 429 Too Many Requests
   - Handling: Should implement retry with exponential backoff (future enhancement)

3. **Invalid Audio Format**
   - Error: Unsupported format
   - Handling: Validate audio before sending (already done via FFmpeg)

4. **Network Errors**
   - Error: Connection timeout, network failure
   - Handling: Exception propagated, SQS will retry

### OpenAI Errors

1. **API Key Invalid**
   - Error: Authentication failed
   - Handling: Log error, update status, throw exception

2. **Rate Limit Exceeded**
   - Error: 429 Too Many Requests
   - Handling: Should implement retry with exponential backoff (future enhancement)

3. **Token Limit Exceeded**
   - Error: Context length exceeded
   - Handling: Should split transcript (future enhancement for very long videos)

4. **Invalid Response Format**
   - Error: Structured output validation fails
   - Handling: LangChain handles retries automatically

5. **Network Errors**
   - Error: Connection timeout, network failure
   - Handling: Exception propagated, SQS will retry

---

## Future Enhancements

1. **Retry Logic with Exponential Backoff**
   - Implement for rate limit errors
   - Configurable retry attempts

2. **Transcript Chunking**
   - Split very long transcripts for OpenAI
   - Merge results intelligently

3. **Caching**
   - Cache transcripts for reprocessing
   - Cache moment detection results

4. **Alternative Models**
   - Support for other transcription services
   - A/B testing different LLM models

5. **Cost Tracking**
   - Log API costs per video
   - Dashboard for cost monitoring

6. **Quality Metrics**
   - Measure transcription accuracy
   - Evaluate moment detection quality

---

## Environment Variables

```bash
# ElevenLabs
ELEVAN_LABS_API_KEY=your_api_key_here

# OpenAI
OPENAI_API_KEY=your_api_key_here
```

**Security**: API keys stored in environment variables, never exposed to client.

---

## Testing Considerations

### Mocking AI Services
- Use mock responses in tests
- Test error scenarios
- Validate prompt engineering

### Integration Tests
- Test with real API (staging environment)
- Monitor rate limits
- Validate response formats

### Performance Tests
- Measure API latency
- Test with various transcript lengths
- Monitor token usage