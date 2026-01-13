"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/app/(core)/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/(core)/ui/card";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/app/(core)/ui/breadcrumb";
import { ArrowLeft, Video} from "lucide-react";
import Link from "next/link";
import { useVideo } from "@/app/(core)/hooks/use-video";
import { QueryBoundary } from "@/app/(core)/components/query-boundary";
import { formatFileSize, formatDuration, formatDate } from "@/app/(core)/helpers/utils/format";


export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const videoUuid = params.videoUuid as string;
  const videoQuery = useVideo(videoUuid);

  const loadingConfig = useMemo(() => ({
    message: "Loading video...",
  }), []);

  const errorConfig = useMemo(() => ({
    title: "Failed to load video",
    description: "The video you're looking for could not be found or loaded.",
    onRetry: () => {
      router.push("/");
    },
  }), [router]);

  const emptyConfig = useMemo(() => ({
    title: "Video not found",
    description: "The video you're looking for does not exist.",
  }), []);

  return (
    <div className="container mx-auto py-8 px-4">
      <QueryBoundary
        query={videoQuery}
        loading={loadingConfig}
        error={errorConfig}
        empty={emptyConfig}
      >
        {(video) => {
          return (
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
                <>
                <ArrowLeft className="size-4" />
                Back
                </>
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
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
