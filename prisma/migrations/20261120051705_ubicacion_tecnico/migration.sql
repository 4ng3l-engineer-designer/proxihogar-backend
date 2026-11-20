-- AlterTable
ALTER TABLE "technicians" ADD COLUMN     "ubicacionActualAt" TIMESTAMP(3),
ADD COLUMN     "ubicacionActualLat" DOUBLE PRECISION,
ADD COLUMN     "ubicacionActualLng" DOUBLE PRECISION;
