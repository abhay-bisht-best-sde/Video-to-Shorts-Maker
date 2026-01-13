"use client";

import { useMemo } from "react";
import { Button } from "@/app/(core)/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/(core)/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/(core)/ui/card";
import { Upload, Video } from "lucide-react";
import Link from "next/link";
import { useVideos } from "@/app/(core)/hooks/use-videos";
import { useVideoUpload } from "@/app/(core)/hooks/use-video-upload";
import { QueryBoundary } from "@/app/(core)/components/query-boundary";
import { formatFileSize, formatDuration, formatDate } from "@/app/(core)/helpers/utils/format";
import { getStatusBadge } from "@/app/(core)/helpers/utils/status";

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
              <>
              <Upload className="size-4" />
              Upload Video
              </>
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
                        <TableCell>{getStatusBadge(video.transcriptStatus)}</TableCell>
                        <TableCell>{getStatusBadge(video.videoAnalysisStatus)}</TableCell>
                        <TableCell>{getStatusBadge(video.clipsGenerationStatus)}</TableCell>
                        <TableCell>{formatDate(video.createdAt)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/video/${video.videoUuid}`}>
                              View
                            </Link>
                          </Button>
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
