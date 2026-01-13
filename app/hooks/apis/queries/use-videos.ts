import { useQuery } from "@tanstack/react-query";
import { ProcessingStatus } from "@prisma/client";
import axios from "axios";
import { SerializedVideo } from "../types";

export const FETCH_VIDEOS = ["VIDEOS"] as const;

interface IResponse {
  videos: SerializedVideo[];
}

const fetchVideos = async (): Promise<SerializedVideo[]> => {
  const { data } = await axios.get<IResponse>("/api/videos");
  return data.videos || [];
};

export function useVideos() {
  const query = useQuery({
    queryKey: FETCH_VIDEOS,
    queryFn: fetchVideos,
    refetchInterval: (query) => {
      const videos = query.state.data;
      if (!videos || videos.length === 0) {
        return false;
      }
      const hasProcessingVideos = videos.some(
        (video) =>
          video.transcriptStatus !== ProcessingStatus.Generated ||
          video.videoAnalysisStatus !== ProcessingStatus.Generated ||
          video.clipsGenerationStatus !== ProcessingStatus.Generated
      );
      return hasProcessingVideos ? 5000 : false;
    },
  });
  return query;
}