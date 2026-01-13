import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const FETCH_R2_PRESIGNED_URL = (key: string) => ["R2_PRESIGNED_URL", key] as const;

interface IResponse {
  url: string;
  expiresIn: number;
}

interface IParams {
  key: string;
  enabled?: boolean;
}

const fetchR2PresignedUrl = async (key: string): Promise<string> => {
  const { data } = await axios.get<IResponse>(
    `/api/storage/signed-url?key=${encodeURIComponent(key)}`
  );
  return data.url;
};

export function useR2PresignedUrl(props: IParams) {
  const { key, enabled = true } = props;
  return useQuery({
    queryKey: FETCH_R2_PRESIGNED_URL(key),
    queryFn: () => fetchR2PresignedUrl(key),
    enabled: enabled && !!key,
    staleTime: 3600000,
  });
}
