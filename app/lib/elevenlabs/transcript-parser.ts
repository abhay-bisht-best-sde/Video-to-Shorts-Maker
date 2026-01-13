import { TranscriptionResponse, ITranscriptionResponse, IAdditionalFormat } from "./types";
import { convertSRTToVTT, convertTextToVTT } from "./vtt-converter";

export function extractTranscriptText(transcription: TranscriptionResponse): string {
  if (typeof transcription === "string") {
    return transcription;
  }
  
  if (transcription && typeof transcription === "object" && "text" in transcription) {
    return transcription.text || "";
  }
  
  return "";
}

export function extractVTTContent(
  transcription: TranscriptionResponse,
  transcriptText: string
): string {
  if (typeof transcription === "string") {
    return convertTextToVTT(transcriptText);
  }
  
  if (!transcription || typeof transcription !== "object" || !("additionalFormats" in transcription)) {
    return convertTextToVTT(transcriptText);
  }
  
  const response: ITranscriptionResponse = transcription;
  
  if (!response.additionalFormats || !Array.isArray(response.additionalFormats)) {
    return convertTextToVTT(transcriptText);
  }
  
  const validFormats = response.additionalFormats.filter(
    (fmt): fmt is IAdditionalFormat => fmt !== undefined
  );
  
  const vttFormat = findFormatByExtension(validFormats, "vtt");
  if (vttFormat && vttFormat.content) {
    return decodeFormatContent(vttFormat);
  }
  
  const srtFormat = findFormatByExtension(validFormats, "srt");
  if (srtFormat && srtFormat.content) {
    const srtContent = decodeFormatContent(srtFormat);
    if (srtContent) {
      return convertSRTToVTT(srtContent);
    }
  }
  
  return convertTextToVTT(transcriptText);
}

function findFormatByExtension(
  formats: IAdditionalFormat[],
  extension: string
): IAdditionalFormat | undefined {
  return formats.find(
    (fmt) => fmt.requestedFormat === extension || fmt.fileExtension === extension
  );
}

function decodeFormatContent(format: IAdditionalFormat): string {
  if (!format.content || typeof format.content !== "string") {
    return "";
  }
  
  if (format.isBase64Encoded) {
    return Buffer.from(format.content, "base64").toString("utf-8");
  }
  
  return format.content;
}