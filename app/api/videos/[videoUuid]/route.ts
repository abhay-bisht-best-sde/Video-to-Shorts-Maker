import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/(core)/lib/prisma";
import { logger } from "@/app/(core)/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoUuid: string }> }
) {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);
  
  try {
    const { videoUuid } = await params;
    
    log.info("Received request to fetch video", { videoUuid });

    const video = await prisma.video.findUnique({
      where: {
        videoUuid,
      },
    });

    if (!video) {
      log.warn("Video not found", { videoUuid });
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    log.info("Successfully fetched video", { videoId: video.id, videoUuid });

    return NextResponse.json({ video }, { status: 200 });
  } catch (error) {
    log.error("Error fetching video", error as Error);
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}
