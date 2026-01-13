"use client";

import { motion } from "framer-motion";
import { Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/app/ui/table";
import { ClipStatus } from "@prisma/client";
import { itemVariants } from "./variants";
import { ClipTableRow } from "./clip-table-row";

interface Clip {
  id: string;
  momentTitle: string;
  startTime: number;
  endTime: number;
  status: ClipStatus;
  filePath: string | null;
}

interface ClipsTableProps {
  title: string;
  clips: Clip[];
  onView: (path: string, title: string) => void;
}

export function   ClipsTable({ title, clips, onView }: ClipsTableProps) {
  if (clips.length === 0) return null;

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow duration-300 p-0!">
        <CardHeader className="bg-linear-to-r from-primary/5 to-primary/10 border-b pt-8!">
          <CardTitle className="flex items-center gap-2">
            <Video className="size-5 text-primary" />
            {title} 
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-10!">
          <div className="border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Start Time</TableHead>
                    <TableHead className="font-semibold">End Time</TableHead>
                    <TableHead className="font-semibold">Duration</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clips.map((clip) => (
                    <ClipTableRow key={clip.id} clip={clip} onView={onView} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
