"use client";

import Link from "next/link";
import { Button } from "@/app/ui/button";
import { TableCell, TableRow } from "@/app/ui/table";
import { formatFileSize, formatDuration, formatDate } from "@/app/helpers/utils/format";
import { getStatusBadge } from "@/app/ui/status";
import { ProcessingStatus } from "@prisma/client";
import { SerializedVideo } from "@/app/hooks/apis/types";

interface VideoTableRowProps {
  video: SerializedVideo;
}

export function VideoTableRow({ video }: VideoTableRowProps) {
  const isReady =
    video.transcriptStatus === ProcessingStatus.Generated &&
    video.videoAnalysisStatus === ProcessingStatus.Generated &&
    video.clipsGenerationStatus === ProcessingStatus.Generated;

  return (
    <TableRow className="border-b transition-colors hover:bg-muted/30">
      <TableCell className="font-medium">{video.originalName}</TableCell>
      <TableCell>{formatFileSize(video.size)}</TableCell>
      <TableCell>{formatDuration(video.duration)}</TableCell>
      <TableCell>{getStatusBadge({ status: video.transcriptStatus })}</TableCell>
      <TableCell>{getStatusBadge({ status: video.videoAnalysisStatus })}</TableCell>
      <TableCell>{getStatusBadge({ status: video.clipsGenerationStatus })}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(video.createdAt)}</TableCell>
      <TableCell>
        {isReady ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/video/${video.videoUuid}`}>View</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            View
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
