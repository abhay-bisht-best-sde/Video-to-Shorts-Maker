import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { SerializedVideoDetails, SerializedVideoMoment, SerializedClipMetadata } from "../types";

export type IVideoMoment = SerializedVideoMoment;
export type IClipMetadata = SerializedClipMetadata;
export type IVideoDetails = SerializedVideoDetails;

interface IResponse {
  video: SerializedVideoDetails;
}

interface IParams {
  videoUuid: string;
}

export const FETCH_VIDEO_DETAILS = (videoUuid: string) => ["VIDEO_DETAILS", videoUuid] as const;

const fetchVideoDetails = async (videoUuid: string): Promise<SerializedVideoDetails> => {
  const { data } = await axios.get<IResponse>(`/api/videos/${videoUuid}`);
  return data.video;
};

export function useVideoDetails(props: IParams) {
  const { videoUuid } = props;
  return useQuery({
    queryKey: FETCH_VIDEO_DETAILS(videoUuid),
    queryFn: () => fetchVideoDetails(videoUuid),
    enabled: !!videoUuid,
  });
}
