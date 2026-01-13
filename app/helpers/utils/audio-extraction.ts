import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "@/app/lib/r2/client";
import { env } from "@/app/config/env";
import { logger } from "@/app/helpers/logger";
import { mkdir, unlink, writeFile, readFile } from "fs/promises";
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
    return resolve(process.cwd(), ".next/server/app/helpers/utils/audio-extraction-worker.js");
  }
  return resolve(process.cwd(), "app/helpers/utils/audio-extraction-worker.ts");
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

  // Write video buffer to file instead of passing as array to avoid "Invalid array length" error
  log.debug("Writing video buffer to temp file", { tempVideoPath, bufferSize: videoBuffer.length });
  await writeFile(tempVideoPath, videoBuffer);

  return new Promise<Buffer>((resolvePromise, reject) => {
    const workerPath = getWorkerPath();
    
    log.debug("Starting worker thread for audio extraction", { workerPath });

    const worker = new Worker(workerPath, {
      workerData: {
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
      tempAudioPath?: string; 
      error?: string;
    }) => {
      clearTimeout(timeout);
      
      if (result.success && result.tempAudioPath) {
        try {
          // Read the audio file that was created by the worker
          const audioBuffer = await readFile(result.tempAudioPath);
          
          // Cleanup temp files
          await unlink(tempVideoPath).catch(() => {});
          await unlink(result.tempAudioPath).catch(() => {});
          
          log.info("Audio extracted successfully", { 
            audioSize: audioBuffer.length 
          });
          resolvePromise(audioBuffer);
        } catch (error) {
          // Cleanup on error
          await unlink(tempVideoPath).catch(() => {});
          await unlink(result.tempAudioPath).catch(() => {});
          const err = error instanceof Error ? error : new Error("Failed to read audio file");
          log.error("Error reading audio file", err);
          reject(err);
        }
      } else {
        // Cleanup temp files on failure
        try {
          await unlink(tempVideoPath).catch(() => {});
          await unlink(tempAudioPath).catch(() => {});
        } catch {
          log.debug("Error cleaning up temp files", { tempVideoUuid, transcriptUuid });
        }
        
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
