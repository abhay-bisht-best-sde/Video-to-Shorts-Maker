import { NextRequest, NextResponse } from "next/server";

import { supabaseStorageClient } from "@/app/lib/supabase/storage-client";
import { logger } from "@/app/helpers/logger";
import { SUPABASE_SIGNED_URL_EXPIRY_SECONDS } from "@/app/config/constants";

export async function GET(request: NextRequest) {
  const traceId = logger.generateTraceId();
  const log = logger.withTraceId(traceId);

  log.info("Received request for Supabase signed URL");

  try {
    const searchParams = request.nextUrl.searchParams;

    const bucketName = searchParams.get("bucket");
    const filePath = searchParams.get("path");
    
    if (!bucketName || !filePath) {
      log.warn("Missing required parameters", { bucketName, filePath });
      return NextResponse.json(
        { error: "Bucket and path parameters are required" },
        { status: 400 }
      );
    }

    log.debug("Generating Supabase signed URL", { bucketName, filePath });
    
    const { data, error } = await supabaseStorageClient.storage
      .from(bucketName)
      .createSignedUrl(filePath, SUPABASE_SIGNED_URL_EXPIRY_SECONDS);

    if (error || !data) {
      log.error("Error generating Supabase signed URL", error as Error, { bucketName, filePath });
      return NextResponse.json(
        { error: error?.message || "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    log.info("Supabase signed URL generated successfully", { filePath });

    return NextResponse.json(
      { url: data.signedUrl, expiresIn: SUPABASE_SIGNED_URL_EXPIRY_SECONDS },
      { status: 200 }
    );
    
  } catch (error) {
    log.error("Error generating Supabase signed URL", error as Error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}
