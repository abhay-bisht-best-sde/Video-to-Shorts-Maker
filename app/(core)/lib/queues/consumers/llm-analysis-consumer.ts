import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/(core)/config/env";
import { getPollingConfig } from "../polling-config";
import { processLLMAnalysis } from "@/app/(core)/actions/llm-analysis-actions";
import { logger } from "@/app/(core)/lib/logger";

export interface LLMAnalysisQueueMessage {
  videoId: string;
  videoUuid: string;
}

export async function pollLLMAnalysisQueue(): Promise<void> {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);
  
  log.debug("Polling LLM analysis queue", { queueUrl: env.LLM_ANALYSIS });
  
  const command = new ReceiveMessageCommand(
    getPollingConfig(env.LLM_ANALYSIS!)
  );

  try {
    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      log.info("Received messages from LLM analysis queue", { 
        messageCount: response.Messages.length 
      });

      for (const message of response.Messages) {
        if (message.Body && message.ReceiptHandle) {
          const messageTraceId = logger.generateTraceId();
          const messageLog = logger.withTraceId(messageTraceId);
          
          try {
            const data: LLMAnalysisQueueMessage = JSON.parse(message.Body);
            
            messageLog.info("Processing LLM analysis queue message", { 
              videoId: data.videoId, 
              videoUuid: data.videoUuid 
            });

            // Process LLM analysis using server action
            // Status updates are handled within the server action
            await processLLMAnalysis(data.videoId, data.videoUuid, messageTraceId);

            // Delete message from queue after successful processing
            const deleteCommand = new DeleteMessageCommand({
              QueueUrl: env.LLM_ANALYSIS!,
              ReceiptHandle: message.ReceiptHandle,
            });
            await sqsClient.send(deleteCommand);
            
            messageLog.info("Successfully processed and deleted LLM analysis queue message", {
              videoId: data.videoId,
            });
          } catch (error) {
            messageLog.error("Error processing LLM analysis message", error as Error, {
              videoId: message.Body ? JSON.parse(message.Body).videoId : "unknown",
            });
            // Status is already set to Error by the server action
          }
        }
      }
    } else {
      log.debug("No messages received from LLM analysis queue");
    }
  } catch (error) {
    log.error("Error polling LLM analysis queue", error as Error);
  }
}

