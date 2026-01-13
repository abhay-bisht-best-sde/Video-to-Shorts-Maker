import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "@/app/config/env";
import { logger } from "@/app/helpers/logger";
import { IGenerateTranscriptParams, ITranscriptResult, TranscriptionResponse } from "./types";
import { extractTranscriptText, extractVTTContent } from "./transcript-parser";

const elevenlabs = new ElevenLabsClient({
  apiKey: env.ELEVAN_LABS_API_KEY!,
});

function normalizeTranscriptionResponse(
  response: unknown
): TranscriptionResponse {
  if (typeof response === "string") {
    return response;
  }
  
  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    return {
      text: typeof obj.text === "string" ? obj.text : undefined,
      additionalFormats: Array.isArray(obj.additionalFormats)
        ? obj.additionalFormats.map((fmt) => {
            if (!fmt || typeof fmt !== "object") {
              return undefined;
            }
            const format = fmt as Record<string, unknown>;
            return {
              requestedFormat: typeof format.requestedFormat === "string"
                ? format.requestedFormat
                : undefined,
              fileExtension: typeof format.fileExtension === "string"
                ? format.fileExtension
                : undefined,
              content: typeof format.content === "string"
                ? format.content
                : undefined,
              isBase64Encoded: typeof format.isBase64Encoded === "boolean"
                ? format.isBase64Encoded
                : undefined,
            };
          })
        : undefined,
    };
  }
  
  return "";
}

export async function generateTranscript({
  audioBuffer,
  traceId,
}: IGenerateTranscriptParams): Promise<ITranscriptResult> {
  const log = logger.withTraceId(traceId);
  log.debug("Sending audio to ElevenLabs API", { audioSize: audioBuffer.length });

  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mp3" });

  try {
    const transcription = await elevenlabs.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v2",
      tagAudioEvents: true,
      languageCode: "eng",
      diarize: true,
      additionalFormats: [{ format: "srt" }],
    });

    const normalizedTranscription = normalizeTranscriptionResponse(transcription);
    const transcriptText = extractTranscriptText(normalizedTranscription);
    const vttContent = extractVTTContent(normalizedTranscription, transcriptText);

    log.info("Transcript generated successfully", { 
      transcriptLength: transcriptText.length,
      hasVtt: !!vttContent,
    });

    return {
      text: transcriptText,
      vtt: vttContent || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error("ElevenLabs API error", new Error(errorMessage));
    throw new Error(`ElevenLabs API error: ${errorMessage}`);
  }
}
