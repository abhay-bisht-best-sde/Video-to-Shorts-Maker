/*
  Warnings:

  - The primary key for the `videos` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `transcriptUuid` column on the `videos` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `vttUuid` column on the `videos` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `id` on the `videos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "videos" DROP CONSTRAINT "videos_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "transcriptUuid",
ADD COLUMN     "transcriptUuid" UUID,
DROP COLUMN "vttUuid",
ADD COLUMN     "vttUuid" UUID,
ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "video_moments" (
    "id" UUID NOT NULL,
    "videoId" UUID NOT NULL,
    "videoUuid" UUID NOT NULL,
    "start_time" DOUBLE PRECISION NOT NULL,
    "end_time" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_moments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_moments_videoId_key" ON "video_moments"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "video_moments_videoUuid_key" ON "video_moments"("videoUuid");

-- CreateIndex
CREATE INDEX "video_moments_videoId_videoUuid_idx" ON "video_moments"("videoId", "videoUuid");

-- CreateIndex
CREATE INDEX "videos_id_videoUuid_idx" ON "videos"("id", "videoUuid");

-- AddForeignKey
ALTER TABLE "video_moments" ADD CONSTRAINT "video_moments_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
