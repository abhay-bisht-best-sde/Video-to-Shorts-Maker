import { useRef, useCallback } from "react";
import { toast } from "sonner";
import { getVideoDuration } from "@/app/(core)/helpers/get-video-duration";
import { useUploadVideo } from "./use-videos";

const MAX_DURATION_SECONDS = 35 * 60;
const ALLOWED_MIME_TYPE = "video/mp4";

export function useVideoUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadVideo();

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    try {
      let duration: number | null = null;
      try {
        duration = await getVideoDuration(file);
        if (duration > MAX_DURATION_SECONDS) {
          toast.error(
            `Video duration exceeds maximum allowed duration of 35 minutes. Your video is ${Math.round(duration / 60)} minutes.`
          );
          resetFileInput();
          return;
        }
      } catch (error) {
        console.error("Error getting video duration:", error);
      }
      const uploadPromise = uploadMutation.mutateAsync(
        { file, duration },
        {
          onSuccess: () => {
            resetFileInput();
          },
        }
      );
      toast.promise(uploadPromise, {
        loading: "Uploading video...",
        success: "Video uploaded successfully!",
        error: (error: Error) => error.message || "Failed to upload video",
      });
    } catch (error) {
      console.error("Error uploading video:", error);
    }
  }, [uploadMutation, resetFileInput]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== ALLOWED_MIME_TYPE) {
      toast.error("Invalid file type. Only MP4 videos are allowed.");
      resetFileInput();
      return;
    }
    await handleUpload(file);
  }, [handleUpload, resetFileInput]);

  return {
    fileInputRef,
    isUploading: uploadMutation.isPending,
    handleFileSelect,
    handleUpload,
  };
}
