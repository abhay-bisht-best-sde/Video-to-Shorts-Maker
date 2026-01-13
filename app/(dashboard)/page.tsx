"use client";

import { useMemo } from "react";
import { Button } from "@/app/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { Upload, Video } from "lucide-react";
import Link from "next/link";
import { useVideos } from "@/app/hooks/apis/queries/use-videos";
import { useVideoUpload } from "@/app/hooks/use-video-upload";
import { QueryBoundary } from "@/app/ui/query-boundary";
import { formatFileSize, formatDuration, formatDate } from "@/app/helpers/utils/format";
import { getStatusBadge } from "@/app/ui/status";
import { ProcessingStatus } from "@prisma/client";

export default function VideosPage() {
  const videosQuery = useVideos();
  const { fileInputRef, isUploading, handleFileSelect } = useVideoUpload();
  const emptyConfig = useMemo(() => ({
    title: "No videos uploaded yet",
    description: "Upload your first video to get started",
    icon: <Video className="size-6" />,
  }), []);
  const loadingConfig = useMemo(() => ({
    message: "Loading videos...",
  }), []);
  const errorConfig = useMemo(() => ({
    title: "Failed to load videos",
    description: "There was an error loading your videos. Please try again.",
  }), []);
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="size-5" />
            Video Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload"
              disabled={isUploading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              isLoading={isUploading}
              className="flex items-center gap-2"
            >
              <Upload className="size-4" />
              Upload Video
            </Button>
            <p className="text-sm text-muted-foreground">
              Max duration: 30 minutes | Format: MP4 only
            </p>
          </div>
          <QueryBoundary
            query={videosQuery}
            empty={emptyConfig}
            loading={loadingConfig}
            error={errorConfig}
          >
            {(videos) => (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Original Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Transcript</TableHead>
                      <TableHead>Analysis</TableHead>
                      <TableHead>Clips</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videos.map((video) => (
                      <TableRow key={video.id}>
                        <TableCell className="font-medium">
                          {video.originalName}
                        </TableCell>
                        <TableCell>{formatFileSize(video.size)}</TableCell>
                        <TableCell>{formatDuration(video.duration)}</TableCell>
                        <TableCell>{getStatusBadge({ status: video.transcriptStatus })}</TableCell>
                        <TableCell>{getStatusBadge({ status: video.videoAnalysisStatus })}</TableCell>
                        <TableCell>{getStatusBadge({ status: video.clipsGenerationStatus })}</TableCell>
                        <TableCell>{formatDate(video.createdAt)}</TableCell>
                        <TableCell>
                          {video.transcriptStatus === ProcessingStatus.Generated &&
                          video.videoAnalysisStatus === ProcessingStatus.Generated &&
                          video.clipsGenerationStatus === ProcessingStatus.Generated ? (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/video/${video.videoUuid}`}>
                                View
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">Processing...</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </QueryBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
