/*
  Warnings:

  - The `status` column on the `clip_metadata` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ClipStatus" AS ENUM ('Success', 'Error', 'NotStarted');

-- AlterTable
ALTER TABLE "clip_metadata" DROP COLUMN "status",
ADD COLUMN     "status" "ClipStatus" NOT NULL DEFAULT 'NotStarted';
