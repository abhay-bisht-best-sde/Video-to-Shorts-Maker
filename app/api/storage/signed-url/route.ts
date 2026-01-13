import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/app/(core)/config/env";
import { logger } from "@/app/(core)/lib/logger";
import { r2Client } from "@/app/(core)/lib/r2/client";

const EXPIRY_HOURS = 2;

export async function GET(request: NextRequest) {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);
  log.info("Received request for signed URL");

  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get("key");

    if (!key) {
      log.warn("Missing key parameter");
      return NextResponse.json(
        { error: "Key parameter is required" },
        { status: 400 }
      );
    }

    const bucketName = env.R2_BUCKET_NAME!;

    log.debug("Generating signed URL", { key, bucketName });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: EXPIRY_HOURS * 3600,
    });

    log.info("Signed URL generated successfully", { key });

    return NextResponse.json(
      { url: signedUrl, expiresIn: EXPIRY_HOURS * 3600 },
      { status: 200 }
    );
  } catch (error) {
    log.error("Error generating signed URL", error as Error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}
