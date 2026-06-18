UPDATE "Launch" l
SET "processStatus" = 'DRAFT_CREATED'::"LaunchProcessStatus",
    "processError" = NULL
WHERE EXISTS (
  SELECT 1
  FROM "Contact" c
  WHERE c."launchId" = l.id
);

UPDATE "Launch" l
SET "processStatus" = 'SKIPPED_NO_EMAIL'::"LaunchProcessStatus",
    "processError" = NULL
WHERE l."processedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Contact" c
    WHERE c."launchId" = l.id
  );

UPDATE "Launch"
SET "processStatus" = 'PENDING'::"LaunchProcessStatus",
    "processError" = NULL
WHERE "processedAt" IS NULL;
