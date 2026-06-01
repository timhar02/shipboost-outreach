-- CreateEnum
CREATE TYPE "ConversionType" AS ENUM ('PREMIUM_LAUNCH', 'AD');

-- CreateEnum
CREATE TYPE "ConversionMatchStatus" AS ENUM ('MATCHED_DOMAIN', 'MATCHED_EMAIL', 'POSSIBLE', 'CONFIRMED', 'REJECTED', 'ORGANIC');

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "type" "ConversionType" NOT NULL,
    "websiteDomain" TEXT NOT NULL,
    "founderEmail" TEXT,
    "productName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "matchStatus" "ConversionMatchStatus" NOT NULL DEFAULT 'ORGANIC',
    "matchedContactId" TEXT,
    "matchedDraftId" TEXT,
    "matchedTemplateKey" TEXT,
    "matchConfidence" DOUBLE PRECISION,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionSyncState" (
    "id" TEXT NOT NULL,
    "lastPaidAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversion_type_idx" ON "Conversion"("type");

-- CreateIndex
CREATE INDEX "Conversion_matchStatus_idx" ON "Conversion"("matchStatus");

-- CreateIndex
CREATE INDEX "Conversion_matchedTemplateKey_idx" ON "Conversion"("matchedTemplateKey");

-- CreateIndex
CREATE INDEX "Conversion_websiteDomain_idx" ON "Conversion"("websiteDomain");

-- CreateIndex
CREATE INDEX "Conversion_paidAt_idx" ON "Conversion"("paidAt");
