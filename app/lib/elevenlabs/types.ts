export interface IGenerateTranscriptParams {
  audioBuffer: Buffer;
  traceId: string;
}

export interface ITranscriptResult {
  text: string;
  vtt?: string;
}

export interface IAdditionalFormat {
  requestedFormat?: string;
  fileExtension?: string;
  content?: string | undefined;
  isBase64Encoded?: boolean;
}

export interface ITranscriptionResponse {
  text?: string;
  additionalFormats?: (IAdditionalFormat | undefined)[];
}

export type TranscriptionResponse = string | ITranscriptionResponse;
