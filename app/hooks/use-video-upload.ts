import { useRef, useCallback } from "react";
import toast from "react-hot-toast";

import { getVideoDuration } from "@/app/helpers/get-video-duration";
import { useUploadVideo } from "./apis/mutations/use-upload-video";
import { ALLOWED_MIME_TYPE, MAX_DURATION_SECONDS } from "@/app/config/constants";

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
            `Video duration exceeds maximum allowed duration of ${MAX_DURATION_SECONDS / 60} minutes. Your video is ${Math.round(duration / 60)} minutes.`
          );
          resetFileInput();
          return;
        }

      } catch (error) {
        console.error("Error getting video duration:", error);
      }

      const toastId = toast.loading("Uploading video...");
      try {
        await uploadMutation.mutateAsync(
          { file, duration },
          {
            onSuccess: () => {
              resetFileInput();
            },
          }
        );
        toast.success("Video uploaded successfully!", { id: toastId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to upload video";
        toast.error(errorMessage, { id: toastId });
        throw error;
      }

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
