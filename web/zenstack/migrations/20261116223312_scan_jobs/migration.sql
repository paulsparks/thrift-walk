-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('Pending', 'Processing', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "scan_job" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'Pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "imagePaths" TEXT[],
    "glbPath" TEXT,
    "error" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_job_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "scan_job" ADD CONSTRAINT "scan_job_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
