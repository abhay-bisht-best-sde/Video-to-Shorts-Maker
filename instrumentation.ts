export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startQueuePolling } = await import("./app/(core)/lib/queues/poll-queues");
    startQueuePolling(5000);
  }
}
