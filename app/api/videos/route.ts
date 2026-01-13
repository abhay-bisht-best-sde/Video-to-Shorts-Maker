import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/app/(core)/lib/prisma";
import { publishToTranscriptQueue } from "@/app/(core)/lib/queues/publishers/transcript-publisher";
import { logger } from "@/app/(core)/lib/logger";
import { uploadFileToBucket } from "@/app/(core)/lib/utils/storage";

const MAX_DURATION_SECONDS = 35 * 60;
export const runtime = "nodejs";
const ALLOWED_MIME_TYPE = "video/mp4";
const VIDEO_BUCKET_NAME = "videos";

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

    log.debug("Validating file", { fileName: file.name, fileType: file.type, fileSize: file.size });

    if (file.type !== ALLOWED_MIME_TYPE) {
      log.warn("Invalid file type provided", { fileType: file.type, allowedType: ALLOWED_MIME_TYPE });
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

    const videoUuid = randomUUID();
    log.debug("Generated video UUID", { videoUuid });

    const fileExtension = file.name.split(".").pop() || "mp4";
    const uploadResult = await uploadFileToBucket({
      file: buffer,
      bucketName: VIDEO_BUCKET_NAME,
      fileType: fileExtension,
      mimeType: file.type,
      traceId,
    });

    log.info("Video uploaded to R2 bucket", {
      videoUuid: uploadResult.uuid,
      key: uploadResult.key,
    });

    const video = await prisma.video.create({
      data: {
        videoUuid: uploadResult.uuid,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        duration,
        videoKey: uploadResult.key,
      },
    });

    log.info("Video saved to database", { videoId: video.id, videoUuid: video.videoUuid });

    try {
      await publishToTranscriptQueue(video.id, video.videoUuid, traceId);
      log.info("Published video to transcript queue", { videoId: video.id });
    } catch (error) {
      log.error("Error publishing to transcript queue", error as Error, {
        videoId: video.id,
        videoUuid: video.videoUuid,
      });
    }

    log.info("Video upload completed successfully", { videoId: video.id, videoUuid: video.videoUuid });

    return NextResponse.json(
      { message: "Video uploaded successfully", video },
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
