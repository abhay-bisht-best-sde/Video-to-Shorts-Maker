"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { ClipOrientation } from "@prisma/client";
import { ILoadingConfig, IErrorConfig } from "./types";
import { QueryBoundary } from "@/app/ui/query-boundary";
import { useR2PresignedUrl } from "@/app/hooks/apis/queries/use-r2-presigned-url";
import { useVideoDetails } from "@/app/hooks/apis/queries/use-video-details";
import { containerVariants } from "./components/variants";
import { VideoHeader } from "./components/video-header";
import { VideoInfoCard } from "./components/video-info-card";
import { MainVideoCard } from "./components/main-video-card";
import { ClipsTable } from "./components/clips-table";
import { ClipPlayer } from "./components/clip-player";

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const videoUuid = params.videoUuid as string;

  const videoDetailsQuery = useVideoDetails({ videoUuid });

  const [selectedClip, setSelectedClip] = useState<{
    path: string;
    title: string;
  } | null>(null);

  const loadingConfig = useMemo<ILoadingConfig>(
    () => ({
      message: "Loading video...",
    }),
    []
  );

  const errorConfig = useMemo<IErrorConfig>(
    () => ({
      title: "Failed to load video",
      description: "The video you're looking for could not be found or loaded.",
      onRetry: () => {
        router.push("/");
      },
    }),
    [router]
  );

  const presignedUrlQuery = useR2PresignedUrl({
    key: videoDetailsQuery.data?.videoKey || "",
    enabled: !!videoDetailsQuery.data?.videoKey,
  });

  const horizontalClips = useMemo(() => {
    if (!videoDetailsQuery.data?.moments) return [];
    return videoDetailsQuery.data.moments.flatMap((moment) =>
      moment.clips
        .filter((clip) => clip.orientation === ClipOrientation.Horizontal)
        .map((clip) => ({
          ...clip,
          momentTitle: moment.title,
          startTime: moment.start_time,
          endTime: moment.end_time,
        }))
    );
  }, [videoDetailsQuery.data]);

  const verticalClips = useMemo(() => {
    if (!videoDetailsQuery.data?.moments) return [];
    return videoDetailsQuery.data.moments.flatMap((moment) =>
      moment.clips
        .filter((clip) => clip.orientation === ClipOrientation.Vertical)
        .map((clip) => ({
          ...clip,
          momentTitle: moment.title,
          startTime: moment.start_time,
          endTime: moment.end_time,
        }))
    );
  }, [videoDetailsQuery.data]);

  const handleViewClip = (path: string, title: string) => {
    setSelectedClip({ path, title });
  };

  return (
    <QueryBoundary
      query={[videoDetailsQuery, presignedUrlQuery]}
      loading={loadingConfig}
      error={errorConfig}
    >
      {(video) => (
        <motion.div
          key={video.id}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="container mx-auto py-8 px-4 max-w-7xl"
        >
          <div className="space-y-6" >
            <VideoHeader
              videoName={video.originalName}
              onBack={() => router.back()}
            />
            <VideoInfoCard video={video} />
            {presignedUrlQuery.data && (
              <MainVideoCard videoUrl={presignedUrlQuery.data} />
            )}
            <ClipsTable
              title="Horizontal Clips (16:9)"
              clips={horizontalClips}
              onView={handleViewClip}
            />
            <ClipsTable
              title="Vertical Clips (9:16)"
              clips={verticalClips}
              onView={handleViewClip}
            />
            {selectedClip && (
              <ClipPlayer
                clipPath={selectedClip.path}
                title={selectedClip.title}
                isOpen={!!selectedClip}
                onClose={() => setSelectedClip(null)}
              />
            )}
          </div>
        </motion.div>
      )}
    </QueryBoundary>
  );
}
