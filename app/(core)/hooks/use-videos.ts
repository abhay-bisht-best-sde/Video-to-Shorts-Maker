import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProcessingStatus } from "@prisma/client";

export interface IVideo {
  id: string;
  videoUuid: string;
  originalName: string;
  mimeType: string;
  size: number;
  duration: number | null;
  videoKey: string;
  transcriptStatus: ProcessingStatus;
  videoAnalysisStatus: ProcessingStatus;
  clipsGenerationStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

interface IVideosResponse {
  videos: IVideo[];
}

interface IUploadVideoResponse {
  message: string;
  video: IVideo;
}

interface IUploadVideoParams {
  file: File;
  duration: number | null;
}

const fetchVideos = async (): Promise<IVideo[]> => {
  const response = await fetch("/api/videos");
  if (!response.ok) {
    throw new Error("Failed to fetch videos");
  }
  const data: IVideosResponse = await response.json();
  return data.videos || [];
};

const uploadVideo = async ({ file, duration }: IUploadVideoParams): Promise<IUploadVideoResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  if (duration !== null) {
    formData.append("duration", duration.toString());
  }
  const response = await fetch("/api/videos", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to upload video");
  }
  return data;
};

export function useVideos() {
  return useQuery({
    queryKey: ["videos"],
    queryFn: fetchVideos,
  });
}

export function useUploadVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });
}
