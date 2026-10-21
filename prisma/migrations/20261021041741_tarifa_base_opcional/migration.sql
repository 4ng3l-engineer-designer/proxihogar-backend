-- AlterTable
ALTER TABLE "technicians" ALTER COLUMN "tarifaBase" DROP NOT NULL;

-- CreateConstraint
ALTER TABLE "technicians" ADD CONSTRAINT "tarifa_base_no_negativa" CHECK ("tarifaBase" IS NULL OR "tarifaBase" >= 0);
