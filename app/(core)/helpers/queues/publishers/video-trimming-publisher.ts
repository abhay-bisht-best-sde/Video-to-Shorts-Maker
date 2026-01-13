import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/(core)/config/env";
import { logger } from "@/app/(core)/helpers/logger";

export interface VideoTrimmingQueueMessage {
  videoId: string;
  videoUuid: string;
}

export async function publishToVideoTrimmingQueue(
  videoId: string,
  videoUuid: string,
  traceId?: string
): Promise<void> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  
  log.info("Publishing message to video trimming queue", { videoId, videoUuid });

  const message: VideoTrimmingQueueMessage = {
    videoId,
    videoUuid,
  };

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