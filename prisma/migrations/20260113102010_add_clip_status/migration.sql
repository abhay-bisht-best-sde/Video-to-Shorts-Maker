-- AlterTable
ALTER TABLE "clip_metadata" ADD COLUMN     "status" "ProcessingStatus" NOT NULL DEFAULT 'NotStarted',
ALTER COLUMN "filePath" DROP NOT NULL;
