import {
  ReceiveMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../sqs-client";
import { env } from "@/app/config/env";
import { getPollingConfig } from "../polling-config";
import { processVideoTrimming } from "@/app/actions/video-trimming-actions";
import { logger } from "@/app/helpers/logger";
import { chunkArray } from "@/app/helpers/utils/array";
import { SQS_MESSAGE_BATCH_SIZE } from "@/app/config/constants";

export interface VideoTrimmingQueueMessage {
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

    await processVideoTrimming({
      videoId: data.videoId,
      videoUuid: data.videoUuid,
      traceId: messageTraceId,
      receiptHandle: message.ReceiptHandle,
    });

    messageLog.info("Successfully processed video trimming queue message", {
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
    }

    messageLog.error("Error processing video trimming message", error as Error, {
      videoId,
    });
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

      const batches = chunkArray(validMessages, SQS_MESSAGE_BATCH_SIZE);

      for (const batch of batches) {
        await Promise.allSettled(batch.map((message) => processMessage(message)));
      }
    } else {
      log.debug("No messages received from video trimming queue");
    }
  } catch (error) {
    log.error("Error polling video trimming queue", error as Error);
  }
}

