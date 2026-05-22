CREATE TYPE "EmailProvider" AS ENUM ('GMAIL');

ALTER TABLE "EmailMessage" RENAME COLUMN "zohoMessageId" TO "providerMessageId";
ALTER TABLE "EmailMessage" ADD COLUMN "providerThreadId" TEXT;

ALTER INDEX "EmailMessage_zohoMessageId_key" RENAME TO "EmailMessage_providerMessageId_key";
CREATE INDEX "EmailMessage_providerThreadId_idx" ON "EmailMessage"("providerThreadId");

CREATE TABLE "EmailCredential" (
    "id" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL DEFAULT 'GMAIL',
    "accountEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailCredential_provider_accountEmail_key" ON "EmailCredential"("provider", "accountEmail");

DROP TABLE "ZohoCredential";
