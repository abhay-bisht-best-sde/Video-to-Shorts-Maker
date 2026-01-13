"use client";

import Link from "next/link";
import { ArrowLeft, Video } from "lucide-react";
import { ClipOrientation, ProcessingStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/app/ui/breadcrumb";
import { Button } from "@/app/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { IEmptyConfig, ILoadingConfig, IErrorConfig } from "./types";
import { QueryBoundary } from "@/app/ui/query-boundary";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/app/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/ui/table";
import { formatFileSize, formatDuration, formatDate } from "@/app/helpers/utils/format";
import { getStatusBadge } from "@/app/ui/status";
import { useR2PresignedUrl } from "@/app/hooks/apis/queries/use-r2-presigned-url";
import { useSupabasePresignedUrl } from "@/app/hooks/apis/queries/use-supabase-presigned-url";
import { useVideoDetails } from "@/app/hooks/apis/queries/use-video-details";

interface IProps {
  clipPath: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

function ClipPlayer(props: IProps) {
  const { clipPath, title, isOpen, onClose } = props;
  
  const bucketName = process.env.NEXT_PUBLIC_SB_CLIPS_MOMENTS_NAME || "";
  const { data: videoUrl } = useSupabasePresignedUrl({
    bucket: bucketName,
    path: clipPath,
    enabled: isOpen && !!clipPath && !!bucketName,
  });
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              autoPlay
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading video...</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const videoUuid = params.videoUuid as string;
  const videoDetailsQuery = useVideoDetails({ videoUuid });
  const [selectedClip, setSelectedClip] = useState<{ path: string; title: string } | null>(null);
  const loadingConfig = useMemo<ILoadingConfig>(() => ({
    message: "Loading video...",
  }), []);
  const errorConfig = useMemo<IErrorConfig>(() => ({
    title: "Failed to load video",
    description: "The video you're looking for could not be found or loaded.",
    onRetry: () => {
      router.push("/");
    },
  }), [router]);
  const emptyConfig = useMemo<IEmptyConfig>(() => ({
    title: "Video not found",
    description: "The video you're looking for does not exist.",
  }), []);
  const { data: mainVideoUrl } = useR2PresignedUrl({
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
  return (
    <div className="container mx-auto py-8 px-4">
      <QueryBoundary
        query={videoDetailsQuery}
        loading={loadingConfig}
        error={errorConfig}
        empty={emptyConfig}
      >
        {(video) => (
          <div className="space-y-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/">Videos</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{video.originalName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="size-5" />
                  {video.originalName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      File Size
                    </h3>
                    <p className="text-base">{formatFileSize(video.size)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Duration
                    </h3>
                    <p className="text-base">{formatDuration(video.duration)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Uploaded
                    </h3>
                    <p className="text-base">{formatDate(video.createdAt)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      Format
                    </h3>
                    <p className="text-base">{video.mimeType}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {mainVideoUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Main Video</CardTitle>
                </CardHeader>
                <CardContent>
                  <video
                    src={mainVideoUrl}
                    controls
                    className="w-full rounded-lg"
                  >
                    Your browser does not support the video tag.
                  </video>
                </CardContent>
              </Card>
            )}
            {horizontalClips.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Horizontal Clips (16:9)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {horizontalClips.map((clip) => (
                          <TableRow key={clip.id}>
                            <TableCell className="font-medium">
                              {clip.momentTitle}
                            </TableCell>
                            <TableCell>{formatDuration(clip.startTime)}</TableCell>
                            <TableCell>{formatDuration(clip.endTime)}</TableCell>
                            <TableCell>
                              {formatDuration(clip.endTime - clip.startTime)}
                            </TableCell>
                            <TableCell>{getStatusBadge({ status: clip.status })}</TableCell>
                            <TableCell>
                              {clip.status === ProcessingStatus.Generated && clip.filePath ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setSelectedClip({ path: clip.filePath!, title: clip.momentTitle })
                                  }
                                >
                                  View
                                </Button>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {clip.status === ProcessingStatus.Generating
                                    ? "Processing..."
                                    : clip.status === ProcessingStatus.Error
                                    ? "Error"
                                    : "Not Started"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
            {verticalClips.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vertical Clips (9:16)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {verticalClips.map((clip) => (
                          <TableRow key={clip.id}>
                            <TableCell className="font-medium">
                              {clip.momentTitle}
                            </TableCell>
                            <TableCell>{formatDuration(clip.startTime)}</TableCell>
                            <TableCell>{formatDuration(clip.endTime)}</TableCell>
                            <TableCell>
                              {formatDuration(clip.endTime - clip.startTime)}
                            </TableCell>
                            <TableCell>{getStatusBadge({ status: clip.status })}</TableCell>
                            <TableCell>
                              {clip.status === ProcessingStatus.Generated && clip.filePath ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setSelectedClip({ path: clip.filePath!, title: clip.momentTitle })
                                  }
                                >
                                  View
                                </Button>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {clip.status === ProcessingStatus.Generating
                                    ? "Processing..."
                                    : clip.status === ProcessingStatus.Error
                                    ? "Error"
                                    : "Not Started"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
            {selectedClip && (
              <ClipPlayer
                clipPath={selectedClip.path}
                title={selectedClip.title}
                isOpen={!!selectedClip}
                onClose={() => setSelectedClip(null)}
              />
            )}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
