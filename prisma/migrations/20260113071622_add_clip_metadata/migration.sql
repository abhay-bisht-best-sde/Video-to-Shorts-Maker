-- CreateEnum
CREATE TYPE "ClipOrientation" AS ENUM ('Horizontal', 'Vertical');

-- CreateTable
CREATE TABLE "clip_metadata" (
    "id" UUID NOT NULL,
    "videoMomentId" UUID NOT NULL,
    "orientation" "ClipOrientation" NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clip_metadata_videoMomentId_idx" ON "clip_metadata"("videoMomentId");

-- AddForeignKey
ALTER TABLE "clip_metadata" ADD CONSTRAINT "clip_metadata_videoMomentId_fkey" FOREIGN KEY ("videoMomentId") REFERENCES "video_moments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
