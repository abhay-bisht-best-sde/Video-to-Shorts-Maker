import { ReceiveMessageCommandInput } from "@aws-sdk/client-sqs";

export function getPollingConfig(
  queueUrl: string,
  options?: {
    maxMessages?: number;
    waitTimeSeconds?: number;
  }
): ReceiveMessageCommandInput {
  return {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: options?.maxMessages ?? 10,
    WaitTimeSeconds: options?.waitTimeSeconds ?? 10, 
  };
}