"use client";

import { motion } from "framer-motion";
import { Video, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { formatFileSize, formatDuration, formatDate } from "@/app/helpers/utils/format";
import { SerializedVideoDetails } from "@/app/hooks/apis/types";
import { itemVariants } from "./variants";

interface VideoInfoCardProps {
  video: SerializedVideoDetails;
}

export function VideoInfoCard({ video }: VideoInfoCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow duration-300 p-0!">
        <CardHeader className="bg-linear-to-r from-primary/5 to-primary/10 border-b pt-8!">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Video className="size-6 text-primary" />
            </motion.div>
            <span>{video.originalName}</span>
            <Sparkles className="size-5 text-primary/60 ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pb-8!">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-muted/30 border border-dashed"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-1">File Size</h3>
              <p className="text-base font-semibold">{formatFileSize(video.size)}</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-muted/30 border border-dashed"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Duration</h3>
              <p className="text-base font-semibold">{formatDuration(video.duration)}</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-muted/30 border border-dashed"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Uploaded</h3>
              <p className="text-base font-semibold">{formatDate(video.createdAt)}</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-muted/30 border border-dashed"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Format</h3>
              <p className="text-base font-semibold">{video.mimeType}</p>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
