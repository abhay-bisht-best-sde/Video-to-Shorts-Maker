/*
  Warnings:

  - Changed the type of `videoUuid` on the `videos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "videos" DROP COLUMN "videoUuid",
ADD COLUMN     "videoUuid" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "videos_videoUuid_key" ON "videos"("videoUuid");

-- CreateIndex
CREATE INDEX "videos_id_videoUuid_idx" ON "videos"("id", "videoUuid");
