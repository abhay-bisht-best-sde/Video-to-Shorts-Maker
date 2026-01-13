"use server";

import { prisma } from "@/app/lib/prisma";
import { ProcessingStatus } from "@prisma/client";
import { logger } from "@/app/helpers/logger";
import { extractAudioFromVideo } from "@/app/helpers/utils/audio-extraction";
import { generateTranscript } from "@/app/lib/elevenlabs/client";
import { uploadTranscriptToSupabase } from "@/app/lib/supabase/supabase-storage";
import { env } from "@/app/config/env";
import { randomUUID } from "crypto";

export async function processTranscript(
  videoId: string,
  videoUuid: string,
  traceId: string
): Promise<void> {
  const log = logger.withTraceId(traceId);
  
  try {
    log.info("Starting transcript processing", { videoId, videoUuid });

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { videoKey: true },
    });

    if (!video) {
      throw new Error("Video not found");
    }

    const transcriptUuid = randomUUID();
    const vttUuid = randomUUID();
    const tempVideoUuid = randomUUID();

    await prisma.video.update({
      where: { id: videoId },
      data: { transcriptStatus: ProcessingStatus.Generating },
    });

    log.debug("Updated transcript status to Generating", { videoId });

    log.info("Extracting audio from video", { videoKey: video.videoKey });
    const audioBuffer = await extractAudioFromVideo({
      videoKey: video.videoKey,
      traceId,
      transcriptUuid,
      tempVideoUuid
    });

    log.info("Generating transcript from audio", { audioSize: audioBuffer.length });
    const transcriptResult = await generateTranscript({
      audioBuffer,
      traceId,
    });

    const vttContent = transcriptResult.vtt ;
    const transcriptContent = transcriptResult.text;
    if (!vttContent || !transcriptContent) {
      throw new Error("No transcript content received from ElevenLabs or no VTT content received");
    }

    log.info("Uploading transcript to Supabase", { 
      transcriptLength: transcriptResult.text.length,
      vttLength: transcriptResult.vtt?.length || 0,
    });
    
    const [uploadVttResult, uploadTranscriptResult] = await Promise.all([
        uploadTranscriptToSupabase({
          content: vttContent,
          bucketName: env.SB_TRANSCRIPT_BUCKET_NAME!,
          fileExtension: "vtt",
          traceId,
          transcriptUuid: vttUuid
        }),
        uploadTranscriptToSupabase({
          content: transcriptContent,
          bucketName: env.SB_TRANSCRIPT_BUCKET_NAME!,
          fileExtension: "text",
          traceId,
          transcriptUuid: transcriptUuid
        }),
    ])

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

    log.info("Transcript processing completed successfully", {
      videoId,
      videoUuid,
      transcriptUuid: transcriptUuid,
      vttUuid: vttUuid,
      transcriptPath: uploadTranscriptResult.key,
      vttPath: uploadVttResult.key,
    });
  } catch (error) {
    log.error("Transcript processing failed", error as Error, { videoId, videoUuid });
    
    await prisma.video.update({
      where: { id: videoId },
      data: { transcriptStatus: ProcessingStatus.Error },
    });
    
    throw error;
  }
}
