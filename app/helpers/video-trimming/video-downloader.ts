import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "@/app/lib/r2/client";
import { env } from "@/app/config/env";
import { logger } from "@/app/helpers/logger";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export interface DownloadedVideo {
  tempVideoPath: string;
  tempDir: string;
}

export async function downloadVideoFromR2(
  videoKey: string,
  videoUuid: string,
  traceId: string
): Promise<DownloadedVideo> {
  const log = logger.withTraceId(traceId);

  log.debug("Fetching video from R2", { videoKey });

  const getCommand = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: videoKey,
  });

  const videoResponse = await r2Client.send(getCommand);

  if (!videoResponse.Body) {
    throw new Error("Video not found in R2");
  }

  const tempDir = join(process.cwd(), "tmp", "videos" , videoUuid);
  await mkdir(tempDir, { recursive: true });

  const tempVideoPath = join(tempDir, `${videoUuid}.mp4`);

  const videoBuffer = await videoResponse.Body.transformToByteArray();
  await writeFile(tempVideoPath, Buffer.from(videoBuffer));

  log.debug("Video downloaded to temp file", { tempVideoPath });

  return {
    tempVideoPath,
    tempDir,
  };
}
