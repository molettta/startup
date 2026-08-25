-- CreateTable
CREATE TABLE "Vistoria" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "vistoriadorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vistoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VistoriaFoto" (
    "id" SERIAL NOT NULL,
    "comentario" TEXT,
    "arquivo" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "vistoriaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VistoriaFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vistoria_vistoriadorId_idx" ON "Vistoria"("vistoriadorId");

-- CreateIndex
CREATE INDEX "VistoriaFoto_vistoriaId_idx" ON "VistoriaFoto"("vistoriaId");

-- AddForeignKey
ALTER TABLE "Vistoria" ADD CONSTRAINT "Vistoria_vistoriadorId_fkey" FOREIGN KEY ("vistoriadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VistoriaFoto" ADD CONSTRAINT "VistoriaFoto_vistoriaId_fkey" FOREIGN KEY ("vistoriaId") REFERENCES "Vistoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
