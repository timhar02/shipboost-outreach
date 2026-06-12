-- Per-contact $9 Premium Launch code + display deadline, stamped at first-touch.
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "discountCode" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "discountDeadline" TIMESTAMP(3);
