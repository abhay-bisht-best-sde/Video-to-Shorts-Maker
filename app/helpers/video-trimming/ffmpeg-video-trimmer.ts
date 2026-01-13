import { logger } from "@/app/helpers/logger";
import { VideoMoment, ClipOrientation, Video, ClipStatus } from "@prisma/client";
import { downloadVideoFromR2 } from "./video-downloader";
import { extractClip } from "./clip-extractor";
import { uploadClipAndCreateMetadata } from "./clip-uploader";
import { rm, readdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/app/lib/prisma";
import { chunkArray } from "@/app/helpers/utils/array";
import { SQS_MESSAGE_BATCH_SIZE } from "@/app/config/constants";

interface IFfmpegVideoTrimmerProps {
  videoId: string;
  videoUuid: string;
  video: Video;
  moments: VideoMoment[];
  traceId: string;
}

const ORIENTATIONS = [
  { type: ClipOrientation.Horizontal, aspectRatio: "16:9" as const, suffix: "h" },
  { type: ClipOrientation.Vertical, aspectRatio: "9:16" as const, suffix: "v" },
] as const;

async function processMoment(
  moment: VideoMoment,
  tempVideoPath: string,
  tempDir: string,
  traceId: string
): Promise<void> {
  const log = logger.withTraceId(traceId);
  
  log.debug("Processing moment", {
    momentId: moment.id,
    startTime: moment.start_time,
    endTime: moment.end_time,
    title: moment.title,
  });

  const clipPromises = ORIENTATIONS.map(async ({ type, aspectRatio, suffix }) => {
    try {
      const { tempClipPath, clipUuid } = await extractClip({
        tempVideoPath,
        tempDir,
        moment,
        orientation: type,
        aspectRatio,
        suffix,
        traceId,
      });

      await uploadClipAndCreateMetadata({
        tempClipPath,
        clipUuid,
        suffix,
        videoMomentId: moment.id,
        orientation: type,
        traceId,
      });
    } catch (error) {
      log.error("Error processing clip", error as Error, {
        momentId: moment.id,
        orientation: type,
      });

      const existingClip = await prisma.clipMetadata.findFirst({
        where: {
          videoMomentId: moment.id,
          orientation: type,
        },
      });

      if (existingClip) {
        await prisma.clipMetadata.update({
          where: { id: existingClip.id },
          data: { status: ClipStatus.Error },
        }).catch((updateError: unknown) => {
          log.error("Failed to update clip status to Error", updateError as Error, {
            clipMetadataId: existingClip.id,
          });
        });
      } else {
        await prisma.clipMetadata.create({
          data: {
            videoMomentId: moment.id,
            orientation: type,
            status: ClipStatus.Error,
          },
        }).catch((createError: unknown) => {
          log.error("Failed to create clip metadata with Error status", createError as Error, {
            videoMomentId: moment.id,
            orientation: type,
          });
        });
      }
    }
  });

  await Promise.allSettled(clipPromises);
}

async function cleanupTempDirectory(
  tempDir: string,
  log: { debug: (message: string, context?: Record<string, unknown>) => void; warn: (message: string, context?: Record<string, unknown>) => void },
  retries = 3
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const files = await readdir(tempDir).catch(() => []);
      for (const file of files) {
        await rm(join(tempDir, file), { recursive: true, force: true }).catch(() => {});
      }
      await rm(tempDir, { recursive: true, force: true });
      log.debug("Temp directory cleaned up successfully", { tempDir });
      return;
    } catch (err) {
      if (i === retries - 1) {
        log.warn("Failed to clean up temp directory after retries", { tempDir, error: err, retries });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}

export async function ffmpegVideoTrimmer(props: IFfmpegVideoTrimmerProps): Promise<void> {
  const { videoId, videoUuid, video, moments, traceId } = props;

  if (!video) {
    throw new Error("Video not found");
  }

  const log = logger.withTraceId(traceId)
  let tempDir: string | null = null;
  let tempVideoPath: string | null = null;

  try {
    log.info("Starting video trimming process", {
      videoId,
      videoUuid,
      momentsCount: moments.length,
    });

    const downloaded = await downloadVideoFromR2(video.videoKey, videoUuid, traceId);

    tempVideoPath = downloaded.tempVideoPath;
    tempDir = downloaded.tempDir;

    if (!tempDir || !tempVideoPath) {
      throw new Error("Temp directory or video path not created");
    }

    const momentBatches = chunkArray(moments, SQS_MESSAGE_BATCH_SIZE );
    
    log.debug("Processing moments in batches", {
      totalMoments: moments.length,
      batchSize: SQS_MESSAGE_BATCH_SIZE,
      totalBatches: momentBatches.length,
    });

    for (const batch of momentBatches) {
      await Promise.allSettled(
        batch.map((moment) => processMoment(moment, tempVideoPath!, tempDir!, traceId))
      );
    }

    log.info("Video trimming process completed", {
      videoId,
      videoUuid,
      momentsProcessed: moments.length,
    });
  } catch (error) {
    log.error("Error in video trimming process", error as Error, {
      videoId,
      videoUuid,
    });
    throw error;
  } finally {
    if (tempDir) {
      log.debug("Cleaning up temp directory", { tempDir });
      await cleanupTempDirectory(tempDir, log);
    }
  }
}
