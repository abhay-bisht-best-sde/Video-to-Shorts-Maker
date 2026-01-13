import { prisma } from "@/app/lib/prisma";
import { Video, VideoMoment } from "@prisma/client";
import { logger } from "@/app/helpers/logger";

export interface VideoWithMoments {
  video: Video;
  moments: VideoMoment[];
}

export async function fetchVideoWithMoments(
  videoId: string,
  videoUuid: string,
  traceId?: string
): Promise<VideoWithMoments> {
  const log = traceId ? logger.withTraceId(traceId) : logger;

  log.debug("Fetching video with moments", { videoId, videoUuid });

  const video = await prisma.video.findUnique({
    where: {
      id: videoId,
      videoUuid: videoUuid,
    },
    include: {
      moments: {
        where: {
          videoId: videoId,
          videoUuid: videoUuid,
        },
      },
    },
  });

  if (!video) {
    throw new Error("Video not found");
  }

  log.debug("Video and moments fetched successfully", {
    videoId,
    videoUuid,
    momentsCount: video.moments.length,
  });

  return {
    video,
    moments: video.moments,
  };
}
