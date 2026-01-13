import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/helpers/logger";

export async function GET(
  { params }: { params: Promise<{ videoUuid: string }> }
) {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);

  try {
    const { videoUuid } = await params;

    log.info("Received request to fetch video with moments", { videoUuid });

    const video = await prisma.video.findUnique({
      where: {
        videoUuid,
      },
      include: {
        moments: {
          include: {
            clips: true,
          },
          orderBy: {
            start_time: "asc",
          },
        },
      },
    });
    
    if (!video) {
      log.warn("Video not found", { videoUuid });
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    log.info("Successfully fetched video with moments", { videoId: video.id, videoUuid });
    return NextResponse.json({ message: "Video fetched successfully", video }, { status: 200 });
  } catch (error) {
    log.error("Error fetching video", error as Error);
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}
