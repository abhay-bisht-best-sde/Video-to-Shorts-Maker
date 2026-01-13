"use server";

import { prisma } from "@/app/(core)/helpers/prisma";
import { ProcessingStatus } from "@prisma/client";
import { logger } from "@/app/(core)/helpers/logger";

export async function processVideoTrimming(
  videoId: string,
  videoUuid: string,
  traceId?: string
): Promise<void> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  
  try {
    log.info("Starting video trimming/clips generation", { videoId, videoUuid });

    await prisma.video.update({
      where: { id: videoId },
      data: { clipsGenerationStatus: ProcessingStatus.Generating },
    });

    log.debug("Updated clips generation status to Generating", { videoId });

    // TODO: Implement actual video trimming/clips generation logic
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await prisma.video.update({
      where: { id: videoId },
      data: { clipsGenerationStatus: ProcessingStatus.Generated },
    });

    log.info("Video trimming/clips generation completed successfully", { videoId, videoUuid });
  } catch (error) {
    log.error("Video trimming/clips generation failed", error as Error, { videoId, videoUuid });
    
    await prisma.video.update({
      where: { id: videoId },
      data: { clipsGenerationStatus: ProcessingStatus.Error },
    });
    
    throw error;
  }
}
