-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PAID');

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "manoDeObra" DOUBLE PRECISION NOT NULL,
    "items" JSONB NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_requestId_key" ON "work_orders"("requestId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
