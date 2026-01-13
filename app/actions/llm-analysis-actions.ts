"use server";

import { prisma } from "@/app/lib/prisma";
import { ProcessingStatus } from "@prisma/client";
import { logger } from "@/app/helpers/logger";
import { detectMomementsAndUpdateStatus } from "../lib/llm-ops/moments-detector";
import { supabaseStorageClient } from "@/app/lib/supabase/storage-client";
import { env } from "@/app/config/env";
import { publishToVideoTrimmingQueue } from "../lib/aws/queues/publishers";

export async function processLLMAnalysis(
  videoId: string,
  videoUuid: string,
  traceId: string
): Promise<void> {
  const log = logger.withTraceId(traceId);
  
  try {
    log.info("Starting LLM analysis processing", { videoId, videoUuid });

    await prisma.video.update({
      where: { id: videoId },
      data: { videoAnalysisStatus: ProcessingStatus.Generating },
    });

    log.debug("Updated video analysis status to Generating", { videoId });

    const videoInfo = await prisma.video.findUnique({
      where : {
        id : videoId,
        videoUuid : videoUuid,
      }
    })

    if (!videoInfo?.transcriptPath ){
      throw new Error("Transcript not found or not generated");
    }

    if (videoInfo?.transcriptStatus !== ProcessingStatus.Generated){
      throw new Error("Transcript not generated");
    }

    log.debug("Downloading transcript from Supabase", { transcriptPath: videoInfo.transcriptPath });

    const { data: transcriptData, error: downloadError } = await supabaseStorageClient.storage
      .from(env.SB_TRANSCRIPT_BUCKET_NAME!)
      .download(videoInfo.transcriptPath);

    if (downloadError || !transcriptData) {
      log.error("Error downloading transcript from Supabase", downloadError as Error, {
        transcriptPath: videoInfo.transcriptPath,
      });
      throw new Error(`Failed to download transcript: ${downloadError?.message || "Unknown error"}`);
    }

    const transcriptContent = await transcriptData.text();

    log.debug("Transcript downloaded successfully", {
      transcriptPath: videoInfo.transcriptPath,
      contentLength: transcriptContent.length,
    });

    await detectMomementsAndUpdateStatus({ transcriptContent, videoId, videoUuid, traceId });
    log.info("LLM analysis processing completed successfully", { videoId, videoUuid });

    await publishToVideoTrimmingQueue(videoId, videoUuid, traceId);
    log.info("Published message to video trimming queue", { videoId, videoUuid });
  } catch (error) {
    log.error("LLM analysis processing failed", error as Error, { videoId, videoUuid });
    
    await prisma.video.update({
      where: { id: videoId },
      data: { videoAnalysisStatus: ProcessingStatus.Error },
    });
    
    throw error;
  }