"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Video } from "lucide-react";
import { Card, CardContent } from "@/app/ui/card";
import { useVideos } from "@/app/hooks/apis/queries/use-videos";
import { useVideoUpload } from "@/app/hooks/use-video-upload";
import { QueryBoundary } from "@/app/ui/query-boundary";
import { containerVariants, itemVariants } from "./components/variants";
import { VideoManagementHeader } from "./components/video-management-header";
import { VideoUploadSection } from "./components/video-upload-section";
import { VideoTable } from "./components/video-table";

export default function VideosPage() {
  const videosQuery = useVideos();
  const { fileInputRef, isUploading, handleFileSelect } = useVideoUpload();

  const emptyConfig = useMemo(
    () => ({
      title: "No videos uploaded yet",
      description: "Upload your first video to get started",
      icon: <Video className="size-6" />,
    }),
    []
  );

  const loadingConfig = useMemo(
    () => ({
      message: "Loading videos...",
    }),
    []
  );

  const errorConfig = useMemo(
    () => ({
      title: "Failed to load videos",
      description: "There was an error loading your videos. Please try again.",
    }),
    []
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-screen flex flex-col overflow-hidden"
    >
      <motion.div variants={itemVariants} className="flex-1 flex flex-col min-h-0 px-4 py-6">
        <Card className="flex-1 flex flex-col border-2 shadow-lg hover:shadow-xl transition-shadow duration-300 min-h-0 shrink-0 p-0!">
          <VideoManagementHeader />
          <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden pb-8!">
            <VideoUploadSection
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onFileSelect={handleFileSelect}
            />
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <QueryBoundary
                query={videosQuery}
                empty={emptyConfig}
                loading={loadingConfig}
                error={errorConfig}
              >
                {(videos) => <VideoTable videos={videos} />}  
              </QueryBoundary>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
