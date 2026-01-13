"use client";

import { Button } from "@/app/ui/button";
import { Upload } from "lucide-react";

interface VideoUploadSectionProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function VideoUploadSection({ fileInputRef, isUploading, onFileSelect }: VideoUploadSectionProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg bg-muted/30 border border-dashed shrink-0 mb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4"
        onChange={onFileSelect}
        className="hidden"
        id="video-upload"
        disabled={isUploading}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        isLoading={isUploading}
        className="flex items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
        size="lg"
      >
        <Upload className="size-4" />
        Upload Video
      </Button>
      <p className="text-sm text-muted-foreground">
        Max duration: 30 minutes | Format: MP4 only
      </p>
    </div>
  );
}
