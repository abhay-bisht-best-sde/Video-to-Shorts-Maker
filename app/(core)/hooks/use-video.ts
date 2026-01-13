import { useQuery } from "@tanstack/react-query";
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

interface IVideoResponse {
  video: IVideo;
}

const fetchVideo = async (videoUuid: string): Promise<IVideo> => {
  const response = await fetch(`/api/videos/${videoUuid}`);
  if (!response.ok) {
    throw new Error("Failed to fetch video");
  }
  const data: IVideoResponse = await response.json();
  return data.video;
};

export function useVideo(videoUuid: string) {
  return useQuery({
    queryKey: ["video", videoUuid],
    queryFn: () => fetchVideo(videoUuid),
    enabled: !!videoUuid,
  });
}
