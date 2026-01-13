import { supabaseStorageClient } from "@/app/lib/supabase/storage-client";
import { logger } from "@/app/helpers/logger";

interface IUploadTranscriptParams {
  content: string;
  bucketName: string;
  fileExtension: string;
  traceId: string;
  transcriptUuid : string
}

interface IUploadTranscriptResult {
  key: string;
}

export async function uploadTranscriptToSupabase({
  content,
  bucketName,
  fileExtension,
  traceId,
  transcriptUuid
}: IUploadTranscriptParams): Promise<IUploadTranscriptResult> {
  const log = logger.withTraceId(traceId);

  const fileName = `${transcriptUuid}.${fileExtension}`;
  const contentType = fileExtension === "vtt" ? "text/vtt" : "text/plain";

  log.debug("Uploading transcript to Supabase bucket", {
    bucketName,
    fileName,
    contentLength: content.length,
    contentType,
  });

  const { data, error } = await supabaseStorageClient.storage
    .from(bucketName)
    .upload(fileName, content, {
      contentType,
      upsert: false,
    });

  if (error) {
    log.error("Error uploading transcript to Supabase bucket", error as Error, {
      bucketName,
      fileName,
    });
    throw new Error(`Failed to upload transcript to bucket: ${error.message}`);
  }

  log.info("Transcript uploaded successfully to Supabase bucket", {
    bucketName,
    fileName,
    path: data.path,
  });

  return {
    key: data.path,
  };
}
