"use client";

import { Play } from "lucide-react";
import { Button } from "@/app/ui/button";
import { TableCell, TableRow } from "@/app/ui/table";
import { formatDuration } from "@/app/helpers/utils/format";
import { getClipStatusBadge } from "@/app/ui/status";
import { ClipStatus } from "@prisma/client";

interface ClipTableRowProps {
  clip: {
    id: string;
    momentTitle: string;
    startTime: number;
    endTime: number;
    status: ClipStatus;
    filePath: string | null;
  };
  onView: (path: string, title: string) => void;
}

export function ClipTableRow({ clip, onView }: ClipTableRowProps) {
  const isReady = clip.status === ClipStatus.Success && clip.filePath;

  return (
    <TableRow className="border-b transition-colors hover:bg-muted/30">
      <TableCell className="font-medium">{clip.momentTitle}</TableCell>
      <TableCell>{formatDuration(clip.startTime)}</TableCell>
      <TableCell>{formatDuration(clip.endTime)}</TableCell>
      <TableCell>{formatDuration(clip.endTime - clip.startTime)}</TableCell>
      <TableCell>{getClipStatusBadge({ status: clip.status })}</TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          disabled={!isReady}
          onClick={() => isReady && onView(clip.filePath!, clip.momentTitle)}
          className="hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="size-3 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
