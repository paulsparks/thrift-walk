ALTER TABLE "user" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
-- Existing administrators bootstrap the first invitations.
UPDATE "user" SET "approved" = true WHERE "role" = 'Admin';
CREATE TABLE "approval_code" (
    "code" TEXT PRIMARY KEY CHECK ("code" ~ '^[0-9]{6}$')
);
