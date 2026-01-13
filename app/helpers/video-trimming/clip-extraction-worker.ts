import { parentPort, workerData } from "worker_threads";
import ffmpeg from "fluent-ffmpeg";
import { statSync } from "fs";

interface IWorkerData {
  tempVideoPath: string;
  tempClipPath: string;
  startTime: number;
  duration: number;
  aspectRatio: "16:9" | "9:16";
}

async function processClipExtraction(): Promise<void> {
  if (!parentPort) {
    throw new Error("parentPort is not available");
  }
  const { tempVideoPath, tempClipPath, startTime, duration, aspectRatio }: IWorkerData = workerData;
  
  try {
    const scaleFilter =
      aspectRatio === "16:9"
        ? "scale=1920:1080:force_original_aspect_ratio=decrease"
        : "scale=1080:1920:force_original_aspect_ratio=decrease";
    const padFilter =
      aspectRatio === "16:9"
        ? "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black"
        : "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black";
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .videoFilters([scaleFilter, padFilter])
        .outputOptions([
          "-c:v libx264",
          "-preset medium",
          "-crf 23",
          "-c:a aac",
          "-b:a 128k",
          "-movflags +faststart",
        ])
        .output(tempClipPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    const fileStats = statSync(tempClipPath);
    if (fileStats.size === 0) {
      throw new Error("Generated video file is empty");
    }
    if (fileStats.size < 1024) {
      throw new Error("Generated video file is too small to be valid");
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg.ffprobe(tempClipPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Video validation failed: ${err.message}`));
          return;
        }
        if (!metadata || !metadata.format) {
          reject(new Error("Video validation failed: Invalid metadata"));
          return;
        }
        const videoDuration = metadata.format.duration;
        if (!videoDuration || videoDuration <= 0) {
          reject(new Error("Video validation failed: Invalid duration"));
          return;
        }
        const hasVideoStream = metadata.streams?.some(
          (stream) => stream.codec_type === "video"
        );
        if (!hasVideoStream) {
          reject(new Error("Video validation failed: No video stream found"));
          return;
        }
        resolve();
      });
    });

    parentPort.postMessage({
      success: true,
      tempClipPath,
    });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

processClipExtraction();
