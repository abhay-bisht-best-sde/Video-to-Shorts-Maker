import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/(core)/config/env";
import { logger } from "@/app/(core)/lib/logger";

export interface LLMAnalysisQueueMessage {
  videoId: string;
  videoUuid: string;
}

export async function publishToLLMAnalysisQueue(
  videoId: string,
  videoUuid: string,
  traceId?: string
): Promise<void> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  
  log.info("Publishing message to LLM analysis queue", { videoId, videoUuid });

  const message: LLMAnalysisQueueMessage = {
    videoId,
    videoUuid,
  };

  try {
    const command = new SendMessageCommand({
      QueueUrl: env.LLM_ANALYSIS!,
      MessageBody: JSON.stringify(message),
      MessageGroupId: videoUuid,
      MessageDeduplicationId: videoUuid,
    });

    await sqsClient.send(command);
    
    log.info("Successfully published message to LLM analysis queue", { videoId, videoUuid });
  } catch (error) {
    log.error("Failed to publish message to LLM analysis queue", error as Error, {
      videoId,
      videoUuid,
    });
    throw error;
  }
}
