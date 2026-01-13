import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/(core)/config/env";
import { getPollingConfig } from "../polling-config";
import { processVideoTrimming } from "@/app/(core)/actions/video-trimming-actions";
import { logger } from "@/app/(core)/lib/logger";

export interface VideoTrimmingQueueMessage {
  videoId: string;
  videoUuid: string;
}

export async function pollVideoTrimmingQueue(): Promise<void> {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);
  
  log.debug("Polling video trimming queue", { queueUrl: env.VIDEO_TRIMMING });
  
  const command = new ReceiveMessageCommand(
    getPollingConfig(env.VIDEO_TRIMMING!)
  );

  try {
    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      log.info("Received messages from video trimming queue", { 
        messageCount: response.Messages.length 
      });

      for (const message of response.Messages) {
        if (message.Body && message.ReceiptHandle) {
          const messageTraceId = logger.generateTraceId();
          const messageLog = logger.withTraceId(messageTraceId);
          
          try {
            const data: VideoTrimmingQueueMessage = JSON.parse(message.Body);
            
            messageLog.info("Processing video trimming queue message", { 
              videoId: data.videoId, 
              videoUuid: data.videoUuid 
            });

            // Process video trimming/clips generation using server action
            // Status updates are handled within the server action
            await processVideoTrimming(data.videoId, data.videoUuid, messageTraceId);

            // Delete message from queue after successful processing
            const deleteCommand = new DeleteMessageCommand({
              QueueUrl: env.VIDEO_TRIMMING!,
              ReceiptHandle: message.ReceiptHandle,
            });
            await sqsClient.send(deleteCommand);
            
            messageLog.info("Successfully processed and deleted video trimming queue message", {
              videoId: data.videoId,
            });
          } catch (error) {
            messageLog.error("Error processing video trimming message", error as Error, {
              videoId: message.Body ? JSON.parse(message.Body).videoId : "unknown",
            });
            // Status is already set to Error by the server action
          }
        }
      }
    } else {
      log.debug("No messages received from video trimming queue");
    }
  } catch (error) {
    log.error("Error polling video trimming queue", error as Error);
  }
}

