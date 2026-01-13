import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const FETCH_SUPABASE_PRESIGNED_URL = (bucket: string, path: string) =>
  ["SUPABASE_PRESIGNED_URL", bucket, path] as const;

interface IResponse {
  url: string;
  expiresIn: number;
}

interface IParams {
  bucket: string;
  path: string;
  enabled?: boolean;
}

const fetchSupabasePresignedUrl = async (bucket: string, path: string): Promise<string> => {
  const { data } = await axios.get<IResponse>(
    `/api/storage/supabase-signed-url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
  );
  return data.url;
};

export function useSupabasePresignedUrl(props: IParams) {
  const { bucket, path, enabled = true } = props;
  return useQuery({
    queryKey: FETCH_SUPABASE_PRESIGNED_URL(bucket, path),
    queryFn: () => fetchSupabasePresignedUrl(bucket, path),
    enabled: enabled && !!bucket && !!path,
    staleTime: 3600000,
  });
}
