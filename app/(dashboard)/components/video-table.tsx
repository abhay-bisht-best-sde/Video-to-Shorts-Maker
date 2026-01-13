"use client";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/app/ui/table";
import { SerializedVideo } from "@/app/hooks/apis/types";
import { VideoTableRow } from "./video-table-row";

interface VideoTableProps {
  videos: SerializedVideo[];
}

export function VideoTable({ videos }: VideoTableProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden shadow-sm">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Original Name</TableHead>
              <TableHead className="font-semibold">Size</TableHead>
              <TableHead className="font-semibold">Duration</TableHead>
              <TableHead className="font-semibold">Transcript</TableHead>
              <TableHead className="font-semibold">Analysis</TableHead>
              <TableHead className="font-semibold">Clips</TableHead>
              <TableHead className="font-semibold">Uploaded</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => (
              <VideoTableRow key={video.id} video={video} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
