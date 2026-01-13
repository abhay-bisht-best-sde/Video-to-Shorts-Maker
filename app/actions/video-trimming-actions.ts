"use server";

import { prisma } from "@/app/lib/prisma";
import { ProcessingStatus } from "@prisma/client";
import { logger } from "@/app/helpers/logger";
import { ffmpegVideoTrimmer } from "../helpers/video-trimming/ffmpeg-video-trimmer";
import { fetchVideoWithMoments } from "../helpers/video-trimming/video-fetcher";
import { DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "@/app/lib/aws/queues/sqs-client";
import { env } from "@/app/config/env";

export interface ProcessVideoTrimmingParams {
  videoId: string;
  videoUuid: string;
  traceId: string;
  receiptHandle?: string;
}

export async function processVideoTrimming(
  params: ProcessVideoTrimmingParams
): Promise<void> {
  const { videoId, videoUuid, traceId, receiptHandle } = params;

  const log = logger.withTraceId(traceId);
  
  try {
    log.info("Starting video trimming/clips generation", { videoId, videoUuid });

    await prisma.video.update({
      where: { id: videoId },
      data: { clipsGenerationStatus: ProcessingStatus.Generating },
    });

    log.debug("Updated clips generation status to Generating", { videoId });

    const { video, moments } = await fetchVideoWithMoments(videoId, videoUuid, traceId);

    await ffmpegVideoTrimmer({ videoId, videoUuid, video, moments, traceId });

    await prisma.video.update({
      where: { id: videoId },
      data: { clipsGenerationStatus: ProcessingStatus.Generated },
    });

    log.info("Video trimming/clips generation completed", { videoId, videoUuid });

    if (receiptHandle) {
      const deleteCommand = new DeleteMessageCommand({
        QueueUrl: env.VIDEO_TRIMMING!,
        ReceiptHandle: receiptHandle,
      });

      await sqsClient.send(deleteCommand);
      log.info("Successfully deleted AWS message", { videoId, videoUuid });
    }
  } catch (error) {
    log.error("Video trimming/clips generation failed", error as Error, { videoId, videoUuid });
    await prisma.video.update({
      where: { id: videoId },
      data: { clipsGenerationStatus: ProcessingStatus.Generated },
    });
    throw error;
  }
}