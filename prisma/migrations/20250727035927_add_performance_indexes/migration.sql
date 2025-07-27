-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "elo" DOUBLE PRECISION NOT NULL DEFAULT 1200.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Image_url_key" ON "Image"("url");

-- CreateIndex
CREATE INDEX "Image_elo_desc_idx" ON "Image"("elo" DESC);

-- CreateIndex
CREATE INDEX "Image_elo_asc_idx" ON "Image"("elo" ASC);

-- CreateIndex
CREATE INDEX "Image_createdAt_idx" ON "Image"("createdAt");
