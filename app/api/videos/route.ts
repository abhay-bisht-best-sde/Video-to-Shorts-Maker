import { NextRequest, NextResponse } from "next/server";

import { ALLOWED_MIME_TYPE, MAX_DURATION_SECONDS, VIDEO_BUCKET_NAME } from "@/app/config/constants";
import { logger } from "@/app/helpers/logger";
import { prisma } from "@/app/lib/prisma";
import { publishToTranscriptQueue } from "@/app/lib/aws/queues/publishers/transcript-publisher";
import { randomUUID } from "crypto";
import { uploadFileToBucket } from "@/app/lib/r2/storage";

export async function POST(request: NextRequest) {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);
  log.info("Received video upload request");

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      log.warn("Video upload request missing file");
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const {name : fileName , type : fileType, size : fileSize} = file;

    log.debug("Validating file", { fileName, fileType, fileSize });

    if (fileType !== ALLOWED_MIME_TYPE) {
      log.warn("Invalid file type provided", { fileType: fileType, allowedType: ALLOWED_MIME_TYPE });
      return NextResponse.json(
        { error: `Invalid file type. Only ${ALLOWED_MIME_TYPE} is allowed.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const durationParam = formData.get("duration");
    
    let duration: number | null = null;

    if (durationParam) {
      duration = parseFloat(durationParam as string);
      if (isNaN(duration) || duration < 0) {
        duration = null;
        return NextResponse.json(
          { error: "Invalid duration provided" },
          { status: 400 }
        );
      }

      if (duration > MAX_DURATION_SECONDS) {
        log.warn("Video duration exceeds maximum", {
          duration,
          maxDuration: MAX_DURATION_SECONDS
        });
        return NextResponse.json(
          { error: `Video duration exceeds maximum allowed duration of 35 minutes. Your video is ${Math.round(duration / 60)} minutes.` },
          { status: 400 }
        );
      }
    }

    log.debug("Video duration", { duration });

    const fileExtension = fileName.split(".").pop() || "mp4";

    const {uuid, key} = await uploadFileToBucket({
      fileBuffer: buffer,
      bucketName: VIDEO_BUCKET_NAME,
      fileType: fileExtension,
      mimeType: fileType,
      traceId,
    });

    log.info("Video uploaded to R2 bucket", {
      videoUuid: uuid,
      key,
    });

    const {id, videoUuid} = await prisma.video.create({
      data: {
        videoUuid: uuid,
        originalName: fileName,
        mimeType: fileType,
        size: fileSize,
        duration,
        videoKey: key,
      },
    });

    log.info("Video saved to database", { videoId: id, videoUuid: videoUuid });

    try {
      await publishToTranscriptQueue(id, videoUuid, traceId);
      log.info("Published video to transcript queue", { videoId: id });
    } catch (error) {
      log.error("Error publishing to transcript queue", error as Error, {
        videoId: id,
        videoUuid,
      });
    }

    log.info("Video upload completed successfully", { videoId: id, videoUuid: videoUuid });

    return NextResponse.json(
      { message: "Video uploaded successfully" },
      { status: 201 }
    );
  } catch (error) {
    log.error("Error uploading video", error as Error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);
  log.info("Received request to fetch videos");

  try {
    const videos = await prisma.video.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    log.info("Successfully fetched videos", { videoCount: videos.length });

    return NextResponse.json({ videos: videos ?? [] }, { status: 200 });
  } catch (error) {
    log.error("Error fetching videos", error as Error);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
