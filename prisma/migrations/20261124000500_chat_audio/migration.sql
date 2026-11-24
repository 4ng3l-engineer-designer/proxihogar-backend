-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'AUDIO';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "duracionSegundos" DOUBLE PRECISION;
