import { parentPort, workerData } from "worker_threads";
import { readFile, unlink } from "fs/promises";
import ffmpeg from "fluent-ffmpeg";

interface IWorkerData {
  tempVideoPath: string;
  tempAudioPath: string;
}

async function processAudioExtraction(): Promise<void> {
  if (!parentPort) {
    throw new Error("parentPort is not available");
  }

  const { tempVideoPath, tempAudioPath }: IWorkerData = workerData;

  try {
    // Video file is already written to tempVideoPath by the main thread
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .toFormat("mp3")
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .save(tempAudioPath);
    });

    // Don't delete tempAudioPath yet - main thread will read it and clean up
    await unlink(tempVideoPath).catch(() => {});

    parentPort.postMessage({
      success: true,
      tempAudioPath,
    });
  } catch (error) {
    try {
      await unlink(tempVideoPath).catch(() => {});
      await unlink(tempAudioPath).catch(() => {});
    } catch {}

    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

processAudioExtraction();