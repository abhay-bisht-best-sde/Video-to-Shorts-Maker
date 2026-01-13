import { pollTranscriptQueue } from "./consumers/transcript-consumer";
import { logger } from "@/app/(core)/lib/logger";

export async function pollAllQueues(): Promise<void> {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);
  log.debug("Starting to poll all queues");
  await Promise.all([
    pollTranscriptQueue(),
  ]);
  log.debug("Completed polling all queues");
}

export function startQueuePolling(intervalMs: number = 5000): void {
  const log = logger;
  log.info("Starting queue polling service", { intervalMs });
  const poll = async () => {
    try {
      await pollAllQueues();
    } catch (error) {
      log.error("Error in queue polling", error as Error);
    }
    setTimeout(poll, intervalMs);
  };
  poll();
}
