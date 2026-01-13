import { supabaseStorageClient } from "@/app/lib/supabase/storage-client";
import { env } from "@/app/config/env";
import { prisma } from "@/app/lib/prisma";
import { ClipOrientation, ClipStatus } from "@prisma/client";
import { logger } from "@/app/helpers/logger";
import { readFile } from "fs/promises";
import { validateVideoFile } from "./video-validator";

export interface ClipUploadParams {
  tempClipPath: string;
  clipUuid: string;
  suffix: string;
  videoMomentId: string;
  orientation: ClipOrientation;
  traceId: string;
}

export interface UploadedClip {
  filePath: string;
  orientation: ClipOrientation;
}

export async function uploadClipAndCreateMetadata(
  params: ClipUploadParams
): Promise<UploadedClip> {
  const { tempClipPath, clipUuid, suffix, videoMomentId, orientation, traceId } = params;

  const log = logger.withTraceId(traceId);

  log.debug("Validating clip before upload", { tempClipPath });
  const validation = await validateVideoFile(tempClipPath, traceId);
  
  if (!validation.isValid) {
    log.error("Clip validation failed", new Error(validation.error || "Unknown validation error"), {
      tempClipPath,
      videoMomentId,
      orientation,
    });
    
    throw new Error(`Clip validation failed: ${validation.error || "Unknown error"}`);
  }

  log.debug("Clip validation passed", {
    tempClipPath,
    duration: validation.duration,
    size: validation.size,
  });

  const clipBuffer = await readFile(tempClipPath);

  const fileName = `${clipUuid}_${suffix}.mp4`;

  const { data: uploadData, error: uploadError } =
    await supabaseStorageClient.storage
      .from(env.SB_CLIPS_MOMENTS_NAME!)
      .upload(fileName, clipBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

  if (uploadError || !uploadData) {
    throw new Error(
      `Failed to upload clip: ${uploadError?.message || "Unknown error"}`
    );
  }

  log.debug("Clip uploaded to Supabase", {
    fileName,
    path: uploadData.path,
    orientation,
  });

  const existingClip = await prisma.clipMetadata.findFirst({
    where: {
      videoMomentId,
      orientation,
    },
  });

  if (existingClip) {
    await prisma.clipMetadata.update({
      where: { id: existingClip.id },
      data: {
        filePath: uploadData.path,
        status: ClipStatus.Success,
      },
    });
    log.debug("ClipMetadata updated to Success", {
      clipMetadataId: existingClip.id,
      videoMomentId,
      orientation,
      filePath: uploadData.path,
    });
  } else {
    await prisma.clipMetadata.create({
      data: {
        videoMomentId,
        orientation,
        filePath: uploadData.path,
        status: ClipStatus.Success,
      },
    });
    log.debug("ClipMetadata created with Success status", {
      videoMomentId,
      orientation,
      filePath: uploadData.path,
    });
  }

  return {
    filePath: uploadData.path,
    orientation,
  };
}