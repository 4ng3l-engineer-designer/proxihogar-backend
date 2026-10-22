-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'ON_THE_WAY' BEFORE 'IN_PROGRESS';

-- CreateTable
CREATE TABLE "request_status_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_status_logs_requestId_idx" ON "request_status_logs"("requestId");

-- AddForeignKey
ALTER TABLE "request_status_logs" ADD CONSTRAINT "request_status_logs_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
