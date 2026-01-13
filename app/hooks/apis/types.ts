import { Video, VideoMoment, ClipMetadata } from "@prisma/client";

export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] extends Date | undefined ? string | undefined : T[K];
};

export type SerializedVideo = Serialized<Video>;
export type SerializedVideoMoment = Serialized<VideoMoment & { clips: SerializedClipMetadata[] }>;
export type SerializedClipMetadata = Serialized<ClipMetadata>;
export type SerializedVideoDetails = Serialized<Video & { moments: SerializedVideoMoment[] }>;
