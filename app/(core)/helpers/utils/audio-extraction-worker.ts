import { parentPort, workerData } from "worker_threads";
import { writeFile, readFile, unlink } from "fs/promises";
import ffmpeg from "fluent-ffmpeg";

interface IWorkerData {
  videoBuffer: Uint8Array;
  tempVideoPath: string;
  tempAudioPath: string;
}

async function processAudioExtraction(): Promise<void> {
  if (!parentPort) {
    throw new Error("parentPort is not available");
  }

  const { videoBuffer, tempVideoPath, tempAudioPath }: IWorkerData = workerData;

  try {
    const nodeBuffer = Buffer.from(videoBuffer);

    await writeFile(tempVideoPath, nodeBuffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .toFormat("mp3")
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .save(tempAudioPath);
    });

    const audioBuffer = await readFile(tempAudioPath);

    await unlink(tempVideoPath).catch(() => {});
    await unlink(tempAudioPath).catch(() => {});

    parentPort.postMessage({
      success: true,
      audioBuffer: Array.from(audioBuffer),
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