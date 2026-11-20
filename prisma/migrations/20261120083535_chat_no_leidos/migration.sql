-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "messages_requestId_idempotencyKey_key" ON "messages"("requestId", "idempotencyKey");
