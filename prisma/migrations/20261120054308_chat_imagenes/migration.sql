-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'IMAGE';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "archivoMime" TEXT,
ADD COLUMN     "archivoPath" TEXT,
ADD COLUMN     "archivoSize" INTEGER,
ALTER COLUMN "contenido" DROP NOT NULL;
