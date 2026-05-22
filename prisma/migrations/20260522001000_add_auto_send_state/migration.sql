CREATE TABLE "AutoSendState" (
    "id" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "nextAllowedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoSendState_pkey" PRIMARY KEY ("id")
);
