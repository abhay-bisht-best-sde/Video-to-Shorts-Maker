# Video Processing Platform

This is a video processing platform that automatically extracts engaging short-form clips (reels) from long-form videos. The system uses AI-powered analysis to identify key moments and generates clips in multiple orientations (horizontal and vertical) optimized for social media.

## Features

- **Automated Transcription**: Converts video audio to text using ElevenLabs speech-to-text API
- **AI-Powered Moment Detection**: Uses OpenAI GPT-4o-mini to identify 3-5 key moments (10-30 seconds each) suitable for short-form content
- **Multi-Orientation Clip Generation**: Automatically generates clips in both horizontal (16:9) and vertical (9:16) formats
- **Async Processing Pipeline**: Decoupled architecture using AWS SQS for scalable, fault-tolerant processing
- **Worker Thread Optimization**: Uses Node.js worker threads for CPU-intensive FFmpeg operations
- **Batch Processing**: Efficient batch message processing for improved throughput

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: AWS SQS
- **Storage**: Cloudflare R2 (videos), Supabase Storage (transcripts/clips)
- **AI Services**: ElevenLabs (transcription), OpenAI (moment detection)
- **Video Processing**: FFmpeg via fluent-ffmpeg
- **Language**: TypeScript

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Documentation

This project includes comprehensive documentation covering system design, implementation details, AI integrations, and data modeling:

### 📐 [System Design Document](./system-design.md)
A detailed explanation of how the solution is architected, including:
- High-level architecture and component interactions
- Technical choices and trade-offs
- Performance optimizations (SQS async processing, batch message processing, worker threads)
- Scalability considerations
- Error handling strategies
- Security considerations

### 🔧 [Implementation Document](./implementation.md)
Complete end-to-end pipeline documentation from upload → clips:
- Stage-by-stage processing flow
- Code examples and file references
- Queue polling implementation
- Error handling and status tracking
- Performance optimizations

### 🤖 [AI Integration Document](./ai-integration.md)
Clear documentation of AI services used and how they're called:
- **ElevenLabs**: Speech-to-text transcription with speaker diarization
- **OpenAI**: GPT-4o-mini for moment detection with structured output
- API configurations and parameters
- Error handling and cost optimization strategies

### 💾 [Data Modeling Document](./data-modeling.md)
Well-designed PostgreSQL schema documentation:
- Complete database schema with Prisma models
- Entity relationships and design decisions
- Enum types and their usage
- Query patterns and data flow
- Indexes and performance considerations

## Key Optimizations

### 1. AWS SQS for Async Processing
- Decoupled pipeline stages for independent scaling
- Message durability and retry mechanisms
- Fault tolerance with isolated failures

### 2. Batch Message Processing
- Messages processed in batches of 4 (`SQS_MESSAGE_BATCH_SIZE`)
- Uses `Promise.allSettled` for error isolation
- Reduces API calls and improves throughput

### 3. Worker Thread Implementation
- FFmpeg operations run in isolated worker threads using `fluent-ffmpeg` library
- Prevents blocking the main event loop
- Enables parallel clip processing
- Uses re-encoding approach (not stream copy) to enable aspect ratio conversion
- Applies scale and pad filters to convert between 16:9 and 9:16 formats
- Timeout protection (300 seconds)

### 4. Efficient Queue Polling
- Long polling (10 seconds wait time)
- Max 10 messages per poll
- Reduces empty poll responses

### 5. Parallel Clip Generation
- Each moment generates 2 clips (horizontal + vertical) in parallel
- Worker threads enable true parallelism for CPU-intensive tasks

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
