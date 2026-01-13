import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/config/env";
import { getPollingConfig } from "../polling-config";
import { processLLMAnalysis } from "@/app/actions/llm-analysis-actions";
import { logger } from "@/app/helpers/logger";
import { publishToVideoTrimmingQueue } from "../publishers";
import { SQS_MESSAGE_BATCH_SIZE } from "@/app/config/constants";
import { chunkArray } from "@/app/helpers/utils/array";

export interface LLMAnalysisQueueMessage {
  videoId: string;
  videoUuid: string;
}

async function processMessage(message: Message): Promise<void> {
  if (!message.Body || !message.ReceiptHandle) {
    return;
  }

  const messageTraceId = logger.generateTraceId();
  const messageLog = logger.withTraceId(messageTraceId);

  try {
    const data: LLMAnalysisQueueMessage = JSON.parse(message.Body);

    if (!data.videoId || !data.videoUuid) {
      messageLog.error("Invalid message format", new Error("Missing videoId or videoUuid"), {
        body: message.Body,
      });
      return;
    }

    messageLog.info("Processing LLM analysis queue message", {
      videoId: data.videoId,
      videoUuid: data.videoUuid,
    });

    await processLLMAnalysis(data.videoId, data.videoUuid, messageTraceId);

    if (message.ReceiptHandle) {  
      const deleteCommand = new DeleteMessageCommand({
        QueueUrl: env.LLM_ANALYSIS!,
        ReceiptHandle: message.ReceiptHandle,
      });

      await sqsClient.send(deleteCommand);
    }

    messageLog.info("Successfully processed and deleted LLM analysis queue message", {
      videoId: data.videoId,
    });

    await publishToVideoTrimmingQueue(data.videoId, data.videoUuid, messageTraceId);

    messageLog.info("Successfully published message to video trimming queue", {
      videoId: data.videoId,
      videoUuid: data.videoUuid,
    });
  } catch (error) {
    let videoId = "unknown";
    try {
      if (message.Body) {
        const parsed = JSON.parse(message.Body) as LLMAnalysisQueueMessage;
        videoId = parsed.videoId || "unknown";
      }
    } catch {
    }

    messageLog.error("Error processing LLM analysis message", error as Error, {
      videoId,
    });
  }
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
        messageCount: response.Messages.length,
      });

      const validMessages = response.Messages.filter(
        (msg) => msg.Body && msg.ReceiptHandle
      );

      if (validMessages.length === 0) {
        log.warn("No valid messages found in queue response");
        return;
      }

      const batches = chunkArray(validMessages, SQS_MESSAGE_BATCH_SIZE);

      for (const batch of batches) {
        await Promise.allSettled(batch.map((message) => processMessage(message)));
      }
    } else {
      log.debug("No messages received from LLM analysis queue");
    }
  } catch (error) {
    log.error("Error polling LLM analysis queue", error as Error);
  }
}

