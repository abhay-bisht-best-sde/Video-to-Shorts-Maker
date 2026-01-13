import { SendMessageCommand } from "@aws-sdk/client-sqs";

import { sqsClient } from "../sqs-client";
import { env } from "@/app/config/env";
import { logger } from "@/app/helpers/logger";

export interface VideoTrimmingQueueMessage {
  videoId: string;
  videoUuid: string;
}

export async function publishToVideoTrimmingQueue(
  videoId: string,
  videoUuid: string,
  traceId: string
): Promise<void> {
  const log = logger.withTraceId(traceId);
  log.info("Publishing message to video trimming queue", { videoId, videoUuid });

  const message: VideoTrimmingQueueMessage = {
    videoId,
    videoUuid,
  };

  if (!videoId){
    log.error("Video ID is required");
    throw new Error("Video ID is required");
  }

  if (!videoUuid){
    log.error("Video UUID is required");
    throw new Error("Video UUID is required");
  }

  try {
    const command = new SendMessageCommand({
      QueueUrl: env.VIDEO_TRIMMING!,
      MessageBody: JSON.stringify(message),
      MessageGroupId: videoUuid,
      MessageDeduplicationId: videoUuid,
    });

    await sqsClient.send(command);
    
    log.info("Successfully published message to video trimming queue", { videoId, videoUuid });
  } catch (error) {
    log.error("Failed to publish message to video trimming queue", error as Error, {
      videoId,
      videoUuid,
    });
    throw error;
  }
}