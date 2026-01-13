import { openai_client } from "./openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { logger } from "@/app/helpers/logger";
import { prisma } from "@/app/lib/prisma";
import { ProcessingStatus } from "@prisma/client";

export interface VideoMoment {
  start_time: number;
  end_time: number;
  title: string;
}

interface IDetectMomentsAndUpdateStatusProps {
  transcriptContent: string;
  videoId: string;
  videoUuid: string;
  traceId: string;
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
      `You are an expert video content editor and analyst specializing in creating viral reels and short-form content.
Your primary goal is to extract the most engaging, shareable, and reel-worthy moments from a long-form video transcript.

The aim is to create reels - short, captivating clips that grab attention, deliver value quickly, and are perfect for social media platforms.

A "key moment" for reel creation is a short continuous time segment that:
- Contains a clear, compelling idea, insight, story, or hook that hooks viewers immediately
- Has high engagement potential - something people would want to share or react to
- Delivers value or entertainment quickly (within 10-30 seconds)
- Has a strong opening that captures attention within the first few seconds
- Has a clear beginning and end that makes sense as a standalone clip
- Is visually or narratively interesting enough to stand alone without context
- Contains punchy, quotable, or memorable content

Prioritize moments that:
- Start with a hook or question that draws viewers in
- Include surprising facts, emotional peaks, or dramatic moments
- Feature clear takeaways or actionable insights
- Have natural pacing that works for short-form content
- Are self-contained and don't require prior context

You must:
- Return exactly 3 to 5 key moments optimized for reel creation
- Use only timestamps that exist in the transcript
- Ensure no moments overlap in time
- Ensure start_time < end_time
- Ensure each moment is at least 10 seconds long
- Ensure each moment is at most 30 seconds long
- Ensure each moment has a specific, engaging, reel-optimized title that would work as a hook or caption

If the transcript does not contain 3 valid reel-worthy moments, return as many as are valid.
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

export async function detectMomementsAndUpdateStatus(props: IDetectMomentsAndUpdateStatusProps): Promise<void> {
  const { transcriptContent, videoId, videoUuid, traceId } = props;

  const log = logger.withTraceId(traceId);

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
      where: {
        videoId,
        videoUuid
      }
    });

    log.debug("Deleted existing moments for video", { videoId });

    if (moments.length === 0) {
      log.warn("No moments detected, skipping database insertion", { videoId });
      await prisma.video.update({
        where: { id: videoId },
        data: { videoAnalysisStatus: ProcessingStatus.Generated },
      });
      return;
    }

    const validMoments = moments.filter((moment) => {
      const duration = moment.end_time - moment.start_time;
      return duration > 10 && duration <= 30;
    });

    if (validMoments.length === 0) {
      log.warn("No valid moments after filtering (duration must be > 10s and <= 30s), skipping database insertion", { videoId });
      await prisma.video.update({
        where: { id: videoId },
        data: { videoAnalysisStatus: ProcessingStatus.Generated },
      });
      return;
    }

    log.debug("Filtered moments by duration", {
      originalCount: moments.length,
      validCount: validMoments.length,
    });

    await Promise.all([
      prisma.videoMoment.createMany({
        data: validMoments.map((moment) => ({
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
    ]);
    log.info("Inserted moments into database & updated video analysis status", { videoId, momentsCount: validMoments.length });
  } catch (error) {
    log.error("Error detecting moments", error as Error, { videoId, videoUuid });
    throw error;
  }
}