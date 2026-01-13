import { openai_client } from "./openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { logger } from "@/app/(core)/helpers/logger";
import { prisma } from "@/app/(core)/helpers/prisma";
import { ProcessingStatus } from "@prisma/client";

export interface VideoMoment {
  start_time: number;
  end_time: number;
  title: string;
}

const VideoMomentSchema = z.object({
  start_time: z.number().describe("Start time in seconds"),
  end_time: z.number().describe("End time in seconds"),
  title: z.string().describe("Concise, descriptive, specific title for the moment"),
});

const MomentsResponseSchema = z.object({
  moments: z.array(VideoMomentSchema).describe("Array of key video moments"),
});

type MomentsResponseType = z.infer<typeof MomentsResponseSchema>;

const getPromptTemplate = () => {
  return ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are an expert video content editor and analyst.
Your task is to extract the most valuable, engaging, and meaningful moments from a long-form video transcript.

A "key moment" is a short continuous time segment that:
- Contains a clear idea, insight, story, or turning point
- Would make sense as a standalone short clip
- Has a clear beginning and end

You must:
- Return exactly 3 to 5 key moments
- Use only timestamps that exist in the transcript
- Ensure no moments overlap in time
- Ensure start_time < end_time
- Ensure each moment is at least 15 seconds long
- Ensure each moment has a specific, descriptive title (not generic)

If the transcript does not contain 3 valid moments, return as many as are valid.
If no valid moments exist, return an empty array.`,
    ],
    [
      "human",
      `### CONTEXT
You will be given a video transcript with timestamps.
Each transcript entry follows this format:

[timestamp_in_seconds] text spoken at that time

Example:
[12.5] Today we're going to talk about how startups fail
[45.2] The first mistake founders make is hiring too early

Here is the transcript:
"""
{transcriptContent}
"""

Extract the key moments from this transcript.`,
    ],
  ]);
};

export async function detectMomementsAndUpdateStatus(
  transcriptContent: string,
  videoId: string,
  videoUuid: string,
  traceId?: string
): Promise<void> {
  const log = traceId ? logger.withTraceId(traceId) : logger;
  
  try {
    log.debug("Starting moment detection", { 
      transcriptLength: transcriptContent.length,
      videoId,
      videoUuid,
    });

    const prompt = getPromptTemplate();
    
    if (!openai_client.withStructuredOutput) {
      throw new Error("withStructuredOutput is not available on OpenAI client");
    }
    
    const structuredLLM = openai_client.withStructuredOutput<MomentsResponseType>(MomentsResponseSchema);
    
    const chain = prompt.pipe(structuredLLM);

    const result = await chain.invoke({
      transcriptContent,
    });

    const moments: VideoMoment[] = result?.moments || [];

    log.info("Moment detection completed", { 
      momentsCount: moments.length
    });

    await prisma.videoMoment.deleteMany({
        where : {
            videoId,  
            videoUuid
        }
    })

    log.debug("Deleted existing moments for video", { videoId });

    if (moments.length === 0) {
      log.warn("No moments detected, skipping database insertion", { videoId });
      return;
    }

    await Promise.all([
        prisma.videoMoment.createMany({
            data: moments.map((moment) => ({
              videoId,
              videoUuid,
              start_time: moment.start_time,
              end_time: moment.end_time,
              title: moment.title,
            })),
          }),
          prisma.video.update({
            where: { id: videoId },
            data: { videoAnalysisStatus: ProcessingStatus.Generated },
          })
    ])

    log.info("Inserted moments into database & updated video analysis status", { videoId, momentsCount: moments.length });
  } catch (error) {
    log.error("Error detecting moments", error as Error, { videoId, videoUuid });
    throw error;
  }
}