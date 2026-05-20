-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('PRODUCT_HUNT', 'PEERPUSH', 'PEERLIST', 'UNEED', 'FOUNDRLIST', 'SCROLLLAUNCH');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING_REVIEW', 'SENT', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('OPEN', 'REPLY', 'FOLLOWUP_SENT');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('OUT', 'IN');

-- CreateEnum
CREATE TYPE "DiscoveredFrom" AS ENUM ('CONTACT_PAGE', 'ABOUT_PAGE', 'HOMEPAGE_FOOTER', 'MAILTO_LINK', 'META_TAG');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "url" TEXT NOT NULL,
    "launchedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT,
    "launchId" TEXT NOT NULL,
    "discoveredFrom" "DiscoveredFrom" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachDraft" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "parentDraftId" TEXT,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "OutreachDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEvent" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "zohoMessageId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_kind_key" ON "Source"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Launch_sourceId_externalId_key" ON "Launch"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_domain_key" ON "Contact"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_launchId_key" ON "Contact"("launchId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_zohoMessageId_key" ON "EmailMessage"("zohoMessageId");

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_parentDraftId_fkey" FOREIGN KEY ("parentDraftId") REFERENCES "OutreachDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEvent" ADD CONSTRAINT "OutreachEvent_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "OutreachDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "OutreachDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
