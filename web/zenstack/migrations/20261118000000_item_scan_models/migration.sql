ALTER TABLE item ADD COLUMN "scanJobId" TEXT;
ALTER TABLE item ADD CONSTRAINT "item_scanJobId_fkey"
    FOREIGN KEY ("scanJobId") REFERENCES scan_job(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "item_scanJobId_idx" ON item("scanJobId");
-- Legacy items may have neither, but a listing must never have both media types.
ALTER TABLE item ADD CONSTRAINT "item_media_exclusive"
    CHECK ("imageAssetId" IS NULL OR "scanJobId" IS NULL);
