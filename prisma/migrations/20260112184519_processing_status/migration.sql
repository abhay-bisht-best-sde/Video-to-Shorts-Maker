-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('NotStarted', 'Generating', 'Generated', 'Error');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "clipsGenerationStatus" "ProcessingStatus" NOT NULL DEFAULT 'NotStarted',
ADD COLUMN     "transcriptStatus" "ProcessingStatus" NOT NULL DEFAULT 'NotStarted',
ADD COLUMN     "videoAnalysisStatus" "ProcessingStatus" NOT NULL DEFAULT 'NotStarted';
