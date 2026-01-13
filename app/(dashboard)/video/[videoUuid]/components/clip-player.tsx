"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/app/ui/sheet";
import { useSupabasePresignedUrl } from "@/app/hooks/apis/queries/use-supabase-presigned-url";

interface ClipPlayerProps {
  clipPath: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ClipPlayer({ clipPath, title, isOpen, onClose }: ClipPlayerProps) {
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
          <SheetTitle className="flex items-center gap-2">
            <Play className="size-5 text-primary" />
            {title}
          </SheetTitle>
        </SheetHeader>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-6"
        >
          {videoUrl ? (
            <video src={videoUrl} controls className="w-full rounded-lg shadow-lg" autoPlay>
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-2">
                <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground">Loading video...</p>
              </div>
            </div>
          )}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
