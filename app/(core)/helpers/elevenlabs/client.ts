import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "@/app/(core)/config/env";
import { logger } from "@/app/(core)/helpers/logger";

interface IGenerateTranscriptParams {
  audioBuffer: Buffer;
  traceId?: string;
}

interface ITranscriptResult {
  text: string;
  vtt?: string;
}

const elevenlabs = new ElevenLabsClient({
  apiKey: env.ELEVAN_LABS_API_KEY!,
});

export async function generateTranscript({
  audioBuffer,
  traceId,
}: IGenerateTranscriptParams): Promise<ITranscriptResult> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  
  log.debug("Sending audio to ElevenLabs API", { audioSize: audioBuffer.length });

  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });

  try {
    const transcription = await elevenlabs.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v2",
      tagAudioEvents: true,
      languageCode: "eng",
      diarize: true,
      additionalFormats: [{ format: "srt" }],
    });

    let transcriptText = "";
    let vttContent = "";

    if (typeof transcription === "string") {
      transcriptText = transcription;
    } else if (transcription && typeof transcription === "object") {
      const transcriptObj = transcription as unknown as { 
        text?: string; 
        additionalFormats?: Array<{
          requestedFormat?: string;
          fileExtension?: string;
          contentType?: string;
          isBase64Encoded?: boolean;
          content?: string;
        }>;
        [key: string]: unknown;
      };
      transcriptText = transcriptObj.text || "";
      
      if (transcriptObj.additionalFormats && Array.isArray(transcriptObj.additionalFormats)) {
        const vttFormat = transcriptObj.additionalFormats.find(
          (fmt) => fmt.requestedFormat === "vtt" || fmt.fileExtension === "vtt"
        );
        if (vttFormat && vttFormat.content) {
          vttContent = typeof vttFormat.content === "string" 
            ? (vttFormat.isBase64Encoded 
              ? Buffer.from(vttFormat.content, "base64").toString("utf-8")
              : vttFormat.content)
            : "";
        } else {
          const srtFormat = transcriptObj.additionalFormats.find(
            (fmt) => fmt.requestedFormat === "srt" || fmt.fileExtension === "srt"
          );
          if (srtFormat && srtFormat.content) {
            const srtContent = typeof srtFormat.content === "string"
              ? (srtFormat.isBase64Encoded
                ? Buffer.from(srtFormat.content, "base64").toString("utf-8")
                : srtFormat.content)
              : "";
            if (srtContent) {
              vttContent = convertSRTToVTT(srtContent);
            }
          }
        }
      }
    }

    if (!vttContent && transcriptText) {
      vttContent = convertTextToVTT(transcriptText);
    }

    log.info("Transcript generated successfully", { 
      transcriptLength: transcriptText.length,
      hasVtt: !!vttContent,
    });

    return {
      text: transcriptText,
      vtt: vttContent || undefined,
    };
  } catch (error) {
    log.error("ElevenLabs API error", error as Error);
    throw new Error(`ElevenLabs API error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

function convertSRTToVTT(srtContent: string): string {
  const lines = srtContent.split("\n");
  let vtt = "WEBVTT\n\n";
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line && !isNaN(Number(line))) {
      i++;
      if (i < lines.length) {
        const timeLine = lines[i].trim();
        if (timeLine.includes("-->")) {
          const vttTime = timeLine.replace(/,/g, ".");
          i++;
          const textLines: string[] = [];
          while (i < lines.length && lines[i].trim()) {
            textLines.push(lines[i].trim());
            i++;
          }
          if (textLines.length > 0) {
            vtt += `${vttTime}\n${textLines.join("\n")}\n\n`;
          }
        }
      }
    } else {
      i++;
    }
  }
  
  return vtt;
}

function convertTextToVTT(text: string): string {
  const lines = text.split("\n").filter((line) => line.trim());
  let vtt = "WEBVTT\n\n";
  
  lines.forEach((line, index) => {
    const startTime = formatVTTTime((index * 2) * 1000);
    const endTime = formatVTTTime((index * 2 + 2) * 1000);
    vtt += `${startTime} --> ${endTime}\n${line}\n\n`;
  });
  
  return vtt;
}

function formatVTTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}
