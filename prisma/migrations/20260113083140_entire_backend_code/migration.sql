-- DropForeignKey
ALTER TABLE "video_moments" DROP CONSTRAINT "video_moments_videoId_fkey";

-- AddForeignKey
ALTER TABLE "video_moments" ADD CONSTRAINT "video_moments_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
