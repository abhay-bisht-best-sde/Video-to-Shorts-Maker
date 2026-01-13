import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "@/app/(core)/lib/logger";
import { env } from "@/app/(core)/config/env";
import { r2Client } from "@/app/(core)/lib/r2/client";

interface IUploadFileParams {
  file: File | Buffer;
  bucketName: string;
  fileType: string;
  mimeType: string;
  traceId?: string;
}

interface IUploadFileResult {
  key: string;
  uuid: string;
}

export async function uploadFileToBucket({
  file,
  bucketName,
  fileType,
  mimeType,
  traceId,
}: IUploadFileParams): Promise<IUploadFileResult> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  const uuid = randomUUID();
  const key = `${bucketName}/${uuid}.${fileType}`;

  log.debug("Uploading file to R2 bucket", {
    bucketName,
    key,
    fileSize: file instanceof File ? file.size : file.length,
    mimeType,
  });

  const fileBuffer = file instanceof File 
    ? Buffer.from(await file.arrayBuffer())
    : Buffer.from(file);

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  try {
    await r2Client.send(command);
    log.info("File uploaded successfully to R2 bucket", {
      bucketName,
      key,
    });

    return {
      key,
      uuid,
    };
  } catch (error) {
    log.error("Error uploading file to R2 bucket", error as Error, {
      bucketName,
      key,
    });
    throw new Error(`Failed to upload file to bucket: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
