-- DropForeignKey
ALTER TABLE "scan_runpod_dispatch" DROP CONSTRAINT "scan_runpod_dispatch_job_id_fkey";

-- AddForeignKey
ALTER TABLE "scan_runpod_dispatch" ADD CONSTRAINT "scan_runpod_dispatch_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scan_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
