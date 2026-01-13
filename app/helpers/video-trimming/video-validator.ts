import ffmpeg from "fluent-ffmpeg";
import { logger } from "@/app/helpers/logger";
import { statSync } from "fs";

interface IVideoValidationResult {
  isValid: boolean;
  error?: string;
  duration?: number;
  size?: number;
}

export async function validateVideoFile(
  videoPath: string,
  traceId: string
): Promise<IVideoValidationResult> {
  const log = logger.withTraceId(traceId);
  
  try {
    const fileStats = statSync(videoPath);
    if (fileStats.size === 0) {
      return {
        isValid: false,
        error: "Video file is empty",
        size: 0,
      };
    }
    if (fileStats.size < 1024) {
      return {
        isValid: false,
        error: "Video file is too small to be valid",
        size: fileStats.size,
      };
    }
    
    return new Promise<IVideoValidationResult>((resolve) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          log.error("FFprobe error during validation", err as Error, { videoPath });
          resolve({
            isValid: false,
            error: err.message || "Failed to probe video file",
            size: fileStats.size,
          });
          return;
        }
        if (!metadata || !metadata.format) {
          resolve({
            isValid: false,
            error: "Invalid video metadata",
            size: fileStats.size,
          });
          return;
        }
        const duration = metadata.format.duration;
        if (!duration || duration <= 0) {
          resolve({
            isValid: false,
            error: "Invalid video duration",
            duration,
            size: fileStats.size,
          });
          return;
        }
        const hasVideoStream = metadata.streams?.some(
          (stream) => stream.codec_type === "video"
        );
        if (!hasVideoStream) {
          resolve({
            isValid: false,
            error: "Video file has no video stream",
            duration,
            size: fileStats.size,
          });
          return;
        }
        resolve({
          isValid: true,
          duration,
          size: fileStats.size,
        });
      });
    });
  } catch (error) {
    log.error("Error validating video file", error as Error, { videoPath });
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}
