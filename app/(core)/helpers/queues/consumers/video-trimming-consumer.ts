import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/(core)/config/env";
import { getPollingConfig } from "../polling-config";
import { processVideoTrimming } from "@/app/(core)/actions/video-trimming-actions";
import { logger } from "@/app/(core)/helpers/logger";

export interface VideoTrimmingQueueMessage {
  videoId: string;
  videoUuid: string;
}

const MESSAGE_BATCH_SIZE = 4;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function processMessage(message: Message): Promise<void> {
  if (!message.Body || !message.ReceiptHandle) {
    return;
  }

  const messageTraceId = logger.generateTraceId();
  const messageLog = logger.withTraceId(messageTraceId);

  try {
    const data: VideoTrimmingQueueMessage = JSON.parse(message.Body);

    if (!data.videoId || !data.videoUuid) {
      messageLog.error("Invalid message format", new Error("Missing videoId or videoUuid"), {
        body: message.Body,
      });
      return;
    }

    messageLog.info("Processing video trimming queue message", {
      videoId: data.videoId,
      videoUuid: data.videoUuid,
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
    let videoId = "unknown";
    try {
      if (message.Body) {
        const parsed = JSON.parse(message.Body) as VideoTrimmingQueueMessage;
        videoId = parsed.videoId || "unknown";
      }
    } catch {
      // Ignore parse errors in error handler
    }

    messageLog.error("Error processing video trimming message", error as Error, {
      videoId,
    });
    // Status is already set to Error by the server action
  }
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
        messageCount: response.Messages.length,
      });

      const validMessages = response.Messages.filter(
        (msg) => msg.Body && msg.ReceiptHandle
      );

      if (validMessages.length === 0) {
        log.warn("No valid messages found in queue response");
        return;
      }

      const batches = chunkArray(validMessages, MESSAGE_BATCH_SIZE);

      for (const batch of batches) {
        await Promise.all(batch.map((message) => processMessage(message)));
      }
    } else {
      log.debug("No messages received from video trimming queue");
    }
  } catch (error) {
    log.error("Error polling video trimming queue", error as Error);
  }
}

