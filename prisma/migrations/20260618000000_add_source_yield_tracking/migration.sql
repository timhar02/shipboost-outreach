CREATE TYPE "LaunchProcessStatus" AS ENUM ('PENDING', 'DRAFT_CREATED', 'SKIPPED_DEDUP', 'SKIPPED_NO_EMAIL', 'SKIPPED_ERROR');

ALTER TABLE "Launch"
  ADD COLUMN "processStatus" "LaunchProcessStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "processError" TEXT;

UPDATE "Launch"
SET "processStatus" = CASE
  WHEN "processedAt" IS NULL THEN 'PENDING'::"LaunchProcessStatus"
  ELSE 'SKIPPED_ERROR'::"LaunchProcessStatus"
END;

ALTER TYPE "SourceKind" ADD VALUE 'STARTUPBASE';
ALTER TYPE "SourceKind" ADD VALUE 'PITCHWALL';
ALTER TYPE "SourceKind" ADD VALUE 'LAUNCHING_NEXT';
ALTER TYPE "SourceKind" ADD VALUE 'SAASHUB';

CREATE INDEX "Launch_processStatus_idx" ON "Launch"("processStatus");
