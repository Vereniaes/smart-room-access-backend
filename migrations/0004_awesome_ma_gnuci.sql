CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "face_embeddings" ALTER COLUMN "embedding" TYPE vector(512) USING embedding::vector;