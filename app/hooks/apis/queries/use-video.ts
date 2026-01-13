import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { SerializedVideo } from "../types";

interface IResponse {
  video: SerializedVideo;
}

interface IParams {
  videoUuid: string;
}

export const FETCH_VIDEO = (videoUuid: string) => ["VIDEO", videoUuid] as const;

const fetchVideo = async (videoUuid: string): Promise<SerializedVideo> => {
  const { data } = await axios.get<IResponse>(`/api/videos/${videoUuid}`);
  return data.video;
};

export function useVideo(props: IParams) {
  const { videoUuid } = props;
  return useQuery({
    queryKey: FETCH_VIDEO(videoUuid),
    queryFn: () => fetchVideo(videoUuid),
    enabled: !!videoUuid,
  });
}
