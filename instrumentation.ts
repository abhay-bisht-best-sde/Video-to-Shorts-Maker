export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startQueuePolling } = await import("./app/lib/aws/queues/poll-queues");
    startQueuePolling(5000);
  }
}
