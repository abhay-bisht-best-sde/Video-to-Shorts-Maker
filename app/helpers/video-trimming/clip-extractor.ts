import { VideoMoment, ClipOrientation } from "@prisma/client";
import { logger } from "@/app/helpers/logger";
import { join, resolve } from "path";
import { randomUUID } from "crypto";
import { Worker } from "worker_threads";
import { VIDEO_TRIM_TIMEOUT_SECONDS } from "@/app/config/constants";

export interface IClipExtractionParams {
  tempVideoPath: string;
  tempDir: string;
  moment: VideoMoment;
  orientation: ClipOrientation;
  aspectRatio: "16:9" | "9:16";
  suffix: string;
  traceId: string;
}

export interface IExtractedClip {
  tempClipPath: string;
  clipUuid: string;
}

function getWorkerPath(): string {
  if (process.env.NODE_ENV === "production") {
    return resolve(process.cwd(), ".next/server/app/helpers/video-trimming/clip-extraction-worker.mjs");
  }
  return resolve(process.cwd(), "app/helpers/video-trimming/clip-extraction-worker.mjs");
}

export async function extractClip(params: IClipExtractionParams): Promise<IExtractedClip> {
  const { tempVideoPath, tempDir, moment, orientation, aspectRatio, suffix, traceId } = params;

  const log = logger.withTraceId(traceId);
  const duration = moment.end_time - moment.start_time;

  const clipUuid = randomUUID();
  const tempClipPath = join(tempDir, `${clipUuid}_${suffix}.mp4`);
  
  log.debug("Extracting clip", {
    momentId: moment.id,
    orientation,
    startTime: moment.start_time,
    duration,
  });

  return new Promise<IExtractedClip>((resolvePromise, reject) => {
    const workerPath = getWorkerPath();
    const worker = new Worker(workerPath, {
      workerData: {
        tempVideoPath,
        tempClipPath,
        startTime: moment.start_time,
        duration,
        aspectRatio,
      },
    });

    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        log.error("Worker thread timeout", new Error("Clip extraction timeout"), { tempClipPath });
        worker.terminate();
        reject(new Error("Clip extraction timeout"));
      }
    }, VIDEO_TRIM_TIMEOUT_SECONDS);

    worker.on("message", (result: {
      success: boolean;
      tempClipPath?: string;
      error?: string;
    }) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeout);
      
      if (result.success && result.tempClipPath) {
        log.debug("Clip extracted successfully", {
          clipPath: result.tempClipPath,
          orientation,
        });
        resolvePromise({
          tempClipPath: result.tempClipPath,
          clipUuid,
        });
      } else {
        const error = new Error(result.error || "Unknown error in worker thread");
        log.error("Worker thread error", error);
        reject(error);
      }
      worker.terminate();
    });

    worker.on("error", (error) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(timeout);
      log.error("Worker thread error", error, { tempClipPath });
      worker.terminate();
      reject(error);
    });

    worker.on("exit", (code) => {
      if (isResolved) return;
      clearTimeout(timeout);
      if (code !== 0) {
        isResolved = true;
        log.error("Worker thread exited with code", new Error(`Worker exited with code ${code}`), { tempClipPath });
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
