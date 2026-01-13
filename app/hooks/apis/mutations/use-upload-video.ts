import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FETCH_VIDEOS } from "../queries/use-videos";
import toast from "react-hot-toast";
import axios from "axios";
import { SerializedVideo } from "../types";

interface IResponse {
  message: string;
  video: SerializedVideo;
}

interface IParams {
  file: File;
  duration: number | null;
}

const uploadVideo = async (params: IParams): Promise<IResponse> => {
  const { file, duration } = params;

  const formData = new FormData();

  formData.append("file", file);

  if (duration !== null) {
    formData.append("duration", duration.toString());
  }else{
    toast.error("Duration is required to upload a video");
    throw new Error("Duration is required to upload a video");
  }

  try {
    const { data } = await axios.post<IResponse>("/api/videos", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error("Failed to upload video");
  }
};

export function useUploadVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FETCH_VIDEOS });
    },
  });
}
