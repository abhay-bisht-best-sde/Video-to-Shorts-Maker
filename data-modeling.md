# Data Modeling Document

This document describes the PostgreSQL database schema design for this platform.

## Overview

The database uses **PostgreSQL** with **Prisma ORM** for type-safe database access. The schema is designed to support the video processing pipeline from upload to clip generation.

## Schema Design

### Entity Relationship Diagram

```
Video
  ├── VideoMoment (1:N)
  │     └── ClipMetadata (1:N)
  │
  └── (Direct fields for transcripts)
```

## Models

### 1. Video Model

**Purpose**: Stores metadata for uploaded videos and tracks processing status.

**Schema**:
```prisma
model Video {
  id                    String           @id @default(uuid()) @db.Uuid
  videoUuid             String      @db.Uuid @unique
  originalName          String
  mimeType              String
  size                  Int
  duration              Float?
  videoKey              String
  transcriptUuid        String? @db.Uuid
  transcriptPath        String?
  vttUuid               String? @db.Uuid
  vttPath               String?
  moments VideoMoment[]
  transcriptStatus      ProcessingStatus @default(NotStarted)
  videoAnalysisStatus   ProcessingStatus @default(NotStarted)
  clipsGenerationStatus ProcessingStatus @default(NotStarted)
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  @@map("videos")
  @@index([id, videoUuid])
}
```

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key, internal ID |
| `videoUuid` | UUID | Public-facing UUID, unique identifier |
| `originalName` | String | Original filename from upload |
| `mimeType` | String | MIME type (e.g., "video/mp4") |
| `size` | Int | File size in bytes |
| `duration` | Float? | Video duration in seconds (nullable) |
| `videoKey` | String | R2 storage key (e.g., "videos/{uuid}.mp4") |
| `transcriptUuid` | UUID? | UUID for transcript file in Supabase |
| `transcriptPath` | String? | Path to transcript file in Supabase |
| `vttUuid` | UUID? | UUID for VTT file in Supabase |
| `vttPath` | String? | Path to VTT file in Supabase |
| `transcriptStatus` | ProcessingStatus | Status of transcript generation |
| `videoAnalysisStatus` | ProcessingStatus | Status of moment detection |
| `clipsGenerationStatus` | ProcessingStatus | Status of clip generation |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

#### Design Decisions

1. **Separate `id` and `videoUuid`**
   - `id`: Internal primary key
   - `videoUuid`: Public-facing identifier (used in URLs, APIs)
   - **Rationale**: Security (don't expose internal IDs), flexibility

2. **Nullable Transcript Fields**
   - `transcriptUuid`, `transcriptPath`, `vttUuid`, `vttPath` are nullable
   - **Rationale**: Transcripts generated asynchronously, may not exist initially

3. **Three Separate Status Fields**
   - `transcriptStatus`, `videoAnalysisStatus`, `clipsGenerationStatus`
   - **Rationale**: Independent pipeline stages, can fail/complete independently

4. **Index on `[id, videoUuid]`**
   - **Rationale**: Common query pattern, improves lookup performance

---

### 2. VideoMoment Model

**Purpose**: Stores key moments detected by AI analysis, representing segments suitable for short-form content.

**Schema**:
```prisma
model VideoMoment {
  id String @id @default(uuid()) @db.Uuid
  videoId String @db.Uuid
  video Video @relation(fields: [videoId], references: [id], onDelete: Cascade)
  videoUuid String @db.Uuid
  start_time Float
  end_time Float
  title String
  clips ClipMetadata[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("video_moments")
  @@index([videoId, videoUuid])
}
```

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `videoId` | UUID | Foreign key to Video |
| `video` | Video | Relation to Video model |
| `videoUuid` | UUID | Denormalized video UUID for queries |
| `start_time` | Float | Start time in seconds |
| `end_time` | Float | End time in seconds |
| `title` | String | AI-generated title for the moment |
| `clips` | ClipMetadata[] | Related clips (horizontal + vertical) |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

#### Design Decisions

1. **Denormalized `videoUuid`**
   - Stored in VideoMoment for easier queries
   - **Rationale**: Avoid joins when filtering by videoUuid

2. **Float for Timestamps**
   - `start_time` and `end_time` as Float (seconds)
   - **Rationale**: Precise enough for video timestamps, simpler than Time type

3. **Cascade Delete**
   - `onDelete: Cascade` - Deleting video deletes moments
   - **Rationale**: Data consistency, automatic cleanup

4. **No Unique Constraints**
   - Multiple moments can have same timestamps (edge case)
   - **Rationale**: Flexibility, validation handled in application layer

5. **Index on `[videoId, videoUuid]`**
   - **Rationale**: Common query: fetch all moments for a video

---

### 3. ClipMetadata Model

**Purpose**: Stores metadata for generated clips (horizontal and vertical versions of each moment).

**Schema**:
```prisma
model ClipMetadata {
  id String @id @default(uuid()) @db.Uuid
  videoMomentId String @db.Uuid
  videoMoment VideoMoment @relation(fields: [videoMomentId], references: [id], onDelete: Cascade)
  orientation ClipOrientation
  filePath String?
  status ClipStatus @default(NotStarted)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("clip_metadata")
  @@index([videoMomentId])
}
```

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `videoMomentId` | UUID | Foreign key to VideoMoment |
| `videoMoment` | VideoMoment | Relation to VideoMoment model |
| `orientation` | ClipOrientation | Horizontal or Vertical |
| `filePath` | String? | Path to clip file in Supabase Storage |
| `status` | ClipStatus | Processing status of clip |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

#### Design Decisions

1. **Separate Record per Orientation**
   - Each moment has 2 ClipMetadata records (Horizontal + Vertical)
   - **Rationale**: Independent processing, different file paths

2. **Nullable `filePath`**
   - Nullable until clip is successfully uploaded
   - **Rationale**: Clips generated asynchronously, may fail

3. **Status Field**
   - Tracks individual clip processing status
   - **Rationale**: Partial failures (one orientation succeeds, other fails)

4. **Cascade Delete**
   - `onDelete: Cascade` - Deleting moment deletes clips
   - **Rationale**: Data consistency

5. **Index on `videoMomentId`**
   - **Rationale**: Common query: fetch all clips for a moment

---

## Enums

### ProcessingStatus

**Purpose**: Tracks processing status for video pipeline stages.

```prisma
enum ProcessingStatus {
  NotStarted
  Generating
  Generated
  Error
}
```

**States**:
- `NotStarted`: Initial state, processing not yet started
- `Generating`: Processing in progress
- `Generated`: Processing completed successfully
- `Error`: Processing failed

**Usage**:
- `Video.transcriptStatus`
- `Video.videoAnalysisStatus`
- `Video.clipsGenerationStatus`

---

### ClipStatus

**Purpose**: Tracks processing status for individual clips.

```prisma
enum ClipStatus {
  Success
  Error
  NotStarted
}
```

**States**:
- `NotStarted`: Initial state, clip not yet generated
- `Success`: Clip generated and uploaded successfully
- `Error`: Clip generation or upload failed

**Usage**:
- `ClipMetadata.status`

---

### ClipOrientation

**Purpose**: Distinguishes between horizontal and vertical clip orientations.

```prisma
enum ClipOrientation {
  Horizontal
  Vertical
}
```

**Values**:
- `Horizontal`: 16:9 aspect ratio (1920x1080)
- `Vertical`: 9:16 aspect ratio (1080x1920)

**Usage**:
- `ClipMetadata.orientation`

---

## Relationships

### Video → VideoMoment (One-to-Many)
- One video can have multiple moments
- Foreign key: `VideoMoment.videoId` → `Video.id`
- Cascade delete: Deleting video deletes all moments

### VideoMoment → ClipMetadata (One-to-Many)
- One moment can have multiple clips (horizontal + vertical)
- Foreign key: `ClipMetadata.videoMomentId` → `VideoMoment.id`
- Cascade delete: Deleting moment deletes all clips

---

## Indexes

### Video Table
```prisma
@@index([id, videoUuid])
```
- **Purpose**: Fast lookups by ID or UUID
- **Usage**: Video retrieval queries

### VideoMoment Table
```prisma
@@index([videoId, videoUuid])
```
- **Purpose**: Fast lookups of moments by video
- **Usage**: Fetch all moments for a video

### ClipMetadata Table
```prisma
@@index([videoMomentId])
```
- **Purpose**: Fast lookups of clips by moment
- **Usage**: Fetch all clips for a moment

---

## Data Flow

### 1. Video Upload
```typescript
prisma.video.create({
  data: {
    videoUuid: uuid,
    originalName: fileName,
    mimeType: "video/mp4",
    size: fileSize,
    duration,
    videoKey: key,
    // All statuses default to NotStarted
  }
})
```

### 2. Transcript Generation
```typescript
prisma.video.update({
  where: { id: videoId },
  data: {
    transcriptStatus: ProcessingStatus.Generating,
    // ... later ...
    transcriptStatus: ProcessingStatus.Generated,
    transcriptUuid,
    transcriptPath,
    vttUuid,
    vttPath,
  }
})
```

### 3. Moment Detection
```typescript
// Delete existing moments
prisma.videoMoment.deleteMany({
  where: { videoId, videoUuid }
})

// Create new moments
prisma.videoMoment.createMany({
  data: moments.map(m => ({
    videoId,
    videoUuid,
    start_time: m.start_time,
    end_time: m.end_time,
    title: m.title,
  }))
})

// Update video status
prisma.video.update({
  where: { id: videoId },
  data: { videoAnalysisStatus: ProcessingStatus.Generated }
})
```

### 4. Clip Generation
```typescript
// Create clip metadata (before processing)
prisma.clipMetadata.create({
  data: {
    videoMomentId: moment.id,
    orientation: ClipOrientation.Horizontal,
    status: ClipStatus.NotStarted,
  }
})

// Update after successful upload
prisma.clipMetadata.update({
  where: { id: clipId },
  data: {
    filePath: uploadData.path,
    status: ClipStatus.Success,
  }
})

// Update video status
prisma.video.update({
  where: { id: videoId },
  data: { clipsGenerationStatus: ProcessingStatus.Generated }
})
```

---

## Query Patterns

### Fetch Video with Moments and Clips
```typescript
const video = await prisma.video.findUnique({
  where: { id: videoId },
  include: {
    moments: {
      include: {
        clips: true,
      },
    },
  },
});
```

### Fetch Moments for Video
```typescript
const moments = await prisma.videoMoment.findMany({
  where: { videoId, videoUuid },
  include: {
    clips: true,
  },
});
```

### Fetch Clips for Moment
```typescript
const clips = await prisma.clipMetadata.findMany({
  where: { videoMomentId: moment.id },
});
```

### Check Processing Status
```typescript
const video = await prisma.video.findUnique({
  where: { videoUuid },
  select: {
    transcriptStatus: true,
    videoAnalysisStatus: true,
    clipsGenerationStatus: true,
  },
});
```

---

## Migration History

Key migrations:
1. `20260112181129_videos/` - Initial Video model
2. `20260112184519_processing_status/` - Added ProcessingStatus enum
3. `20260112210019_supabase_transcript/` - Added transcript fields
4. `20260113053537_video_moments/` - Added VideoMoment model
5. `20260113071622_add_clip_metadata/` - Added ClipMetadata model
6. `20260113102010_add_clip_status/` - Added ClipStatus enum

---

## Design Principles

### 1. Normalization
- Normalized structure (separate tables for moments, clips)
- Denormalized `videoUuid` in VideoMoment for query efficiency

### 2. Status Tracking
- Separate status fields for independent pipeline stages
- Individual clip status for granular error handling

### 3. Flexibility
- Nullable fields for optional data (transcripts, clips)
- No strict unique constraints (allows edge cases)

### 4. Data Integrity
- Foreign key constraints
- Cascade deletes for consistency
- UUID primary keys for security

### 5. Performance
- Indexes on common query patterns
- Composite indexes for multi-field queries

---

## Future Enhancements

1. **Soft Deletes**
   - Add `deletedAt` field for soft deletion
   - Preserve data for analytics

2. **Audit Trail**
   - Track status changes with timestamps
   - Log processing history

3. **User Association**
   - Add user ownership to videos
   - Multi-tenant support

4. **Tags/Categories**
   - Add tagging system for videos
   - Category classification

5. **Analytics**
   - Track clip views/downloads
   - Performance metrics

6. **Versioning**
   - Support multiple transcript versions
   - A/B testing different moment detections
