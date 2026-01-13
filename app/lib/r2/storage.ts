import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "@/app/helpers/logger";
import { env } from "@/app/config/env";
import { r2Client } from "@/app/lib/r2/client";

interface IParams {
  fileBuffer: Buffer;
  bucketName: string;
  fileType: string;
  mimeType: string;
  traceId: string;
}

interface IResult {
  key: string;
  uuid: string;
}

export async function uploadFileToBucket({
  fileBuffer,
  bucketName,
  fileType,
  mimeType,
  traceId,
}: IParams): Promise<IResult> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  const uuid = randomUUID();
  const key = `${bucketName}/${uuid}.${fileType}`;

  log.debug("Uploading file to R2 bucket", {
    bucketName,
    key,
    fileSize: fileBuffer.length,
    mimeType,
  });

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
