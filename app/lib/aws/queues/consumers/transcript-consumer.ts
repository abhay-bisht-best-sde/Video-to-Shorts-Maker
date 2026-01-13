import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/config/env";
import { getPollingConfig } from "../polling-config";
import { processTranscript } from "@/app/actions/transcript-actions";
import { logger } from "@/app/helpers/logger";
import { publishToLLMAnalysisQueue } from "../publishers";
import { chunkArray } from "@/app/helpers/utils/array";
import { SQS_MESSAGE_BATCH_SIZE } from "@/app/config/constants";

export interface ITranscriptQueueMessage {
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
    const data: ITranscriptQueueMessage = JSON.parse(message.Body);

    if (!data.videoId || !data.videoUuid) {
      messageLog.error("Invalid message format", new Error("Missing videoId or videoUuid"), {
        body: message.Body,
      });
      return;
    }

    messageLog.info("Processing transcript queue message", {
      videoId: data.videoId,
      videoUuid: data.videoUuid,
    });

    await processTranscript(data.videoId, data.videoUuid, messageTraceId);

    if (message.ReceiptHandle) {
    const deleteCommand = new DeleteMessageCommand({
      QueueUrl: env.TRANSCRIPT_QUEUE!,
      ReceiptHandle: message.ReceiptHandle,
      });

      await sqsClient.send(deleteCommand);
    }

    messageLog.info("Successfully processed and deleted transcript queue message", {
      videoId: data.videoId,
    });

    await publishToLLMAnalysisQueue(data.videoId, data.videoUuid, messageTraceId);

    messageLog.info("Successfully published message to LLM analysis queue", {
      videoId: data.videoId,
      videoUuid: data.videoUuid,
      messageTraceId: messageTraceId,
    });
  } catch (error) {
    let videoId = "unknown";
    try {
      if (message.Body) {
        const parsed = JSON.parse(message.Body) as ITranscriptQueueMessage;
        videoId = parsed.videoId || "unknown";
      }
    } catch {
      // Ignore parse errors in error handler
    }

    messageLog.error("Error processing transcript message", error as Error, {
      videoId,
    });
  }
}

export async function pollTranscriptQueue(): Promise<void> {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);

  log.debug("Polling transcript queue", { queueUrl: env.TRANSCRIPT_QUEUE });

  const command = new ReceiveMessageCommand(
    getPollingConfig(env.TRANSCRIPT_QUEUE!)
  );

  try {
    const response = await sqsClient.send(command);
    if (response.Messages && response.Messages.length > 0) {
      log.info("Received messages from transcript queue", {
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
      log.debug("No messages received from transcript queue");
    }
  } catch (error) {
    log.error("Error polling transcript queue", error as Error);
  }
}
