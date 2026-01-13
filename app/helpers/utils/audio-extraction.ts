import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "@/app/lib/r2/client";
import { env } from "@/app/config/env";
import { logger } from "@/app/helpers/logger";
import { mkdir, unlink } from "fs/promises";
import { join, resolve } from "path";
import { Worker } from "worker_threads";

interface IExtractAudioParams {
  videoKey: string;
  traceId?: string;
  transcriptUuid: string;
  tempVideoUuid: string;
}

function getWorkerPath(): string {
  if (process.env.NODE_ENV === "production") {
    return resolve(process.cwd(), ".next/server/app/(core)/lib/utils/audio-extraction-worker.js");
  }
  return resolve(process.cwd(), "app/(core)/lib/utils/audio-extraction-worker.ts");
}

export async function extractAudioFromVideo({
  videoKey,
  traceId,
  transcriptUuid,
  tempVideoUuid
}: IExtractAudioParams): Promise<Buffer> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  
  log.debug("Fetching video from R2", { videoKey });

  const getCommand = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: videoKey,
  });

  const videoResponse = await r2Client.send(getCommand);
  
  if (!videoResponse.Body) {
    throw new Error("Video not found in R2");
  }

  const videoBuffer = await videoResponse.Body.transformToByteArray();

  const tempDir = join(process.cwd(), "tmp");
  await mkdir(tempDir, { recursive: true });
  

  const tempVideoPath = join(tempDir, `${tempVideoUuid}.mp4`);
  const tempAudioPath = join(tempDir, `${transcriptUuid}.mp3`);

  return new Promise<Buffer>((resolvePromise, reject) => {
    const workerPath = getWorkerPath();
    
    log.debug("Starting worker thread for audio extraction", { workerPath });

    const worker = new Worker(workerPath, {
      workerData: {
        videoBuffer: Array.from(videoBuffer),
        tempVideoPath,
        tempAudioPath,
      },
    });

    const timeout = setTimeout(async () => {
      // Cleanup temp files using the UUIDs on timeout
      try {
        await unlink(tempVideoPath).catch(() => {});
        await unlink(tempAudioPath).catch(() => {});
      } catch {
        log.debug("Error cleaning up temp files on timeout", { tempVideoUuid, transcriptUuid });
      }
      
      log.error("Worker thread timeout", new Error("Audio extraction timeout"));
      worker.terminate();
      reject(new Error("Audio extraction timeout"));
    }, 300000);

    worker.on("message", async (result: { 
      success: boolean; 
      audioBuffer?: number[]; 
      error?: string;
    }) => {
      clearTimeout(timeout);
      
      // Cleanup temp files using the UUIDs
      try {
        await unlink(tempVideoPath).catch(() => {});
        await unlink(tempAudioPath).catch(() => {});
      } catch {
        log.debug("Error cleaning up temp files", { tempVideoUuid, transcriptUuid });
      }
      
      if (result.success && result.audioBuffer) {
        const buffer = Buffer.from(result.audioBuffer);
        log.info("Audio extracted successfully", { 
          audioSize: buffer.length 
        });
        resolvePromise(buffer);
      } else {
        const error = new Error(result.error || "Unknown error in worker thread");
        log.error("Worker thread error", error);
        reject(error);
      }
      worker.terminate();
    });

    worker.on("error", async (error) => {
      clearTimeout(timeout);
      
      // Cleanup temp files using the UUIDs
      try {
        await unlink(tempVideoPath).catch(() => {});
        await unlink(tempAudioPath).catch(() => {});
      } catch {
        log.debug("Error cleaning up temp files on error", { tempVideoUuid, transcriptUuid });
      }
      
      log.error("Worker thread error", error);
      reject(error);
      worker.terminate();
    });

    worker.on("exit", async (code) => {
      clearTimeout(timeout);
      
      // Cleanup temp files using the UUIDs if worker exited unexpectedly
      if (code !== 0) {
        try {
          await unlink(tempVideoPath).catch(() => {});
          await unlink(tempAudioPath).catch(() => {});
        } catch {
          log.debug("Error cleaning up temp files on exit", { tempVideoUuid, transcriptUuid });
        }
        
        log.error("Worker thread exited with code", new Error(`Worker exited with code ${code}`));
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
