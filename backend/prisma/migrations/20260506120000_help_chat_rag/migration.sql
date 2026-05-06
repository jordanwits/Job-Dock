-- pgvector for help RAG (enable in RDS if not already; may require rds_superuser once)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "help_knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_chat_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_escalations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_chat_daily_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "chat_turns" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "help_chat_daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "help_knowledge_chunks_source_chunk_index_key" ON "help_knowledge_chunks"("source", "chunk_index");

-- CreateIndex
CREATE INDEX "help_knowledge_chunks_source_idx" ON "help_knowledge_chunks"("source");

-- CreateIndex
CREATE INDEX "help_chat_sessions_tenant_id_idx" ON "help_chat_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "help_chat_sessions_user_id_idx" ON "help_chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "help_chat_messages_session_id_idx" ON "help_chat_messages"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "help_escalations_session_id_key" ON "help_escalations"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "help_chat_daily_usage_user_id_day_key" ON "help_chat_daily_usage"("user_id", "day");

-- AddForeignKey
ALTER TABLE "help_chat_sessions" ADD CONSTRAINT "help_chat_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_chat_sessions" ADD CONSTRAINT "help_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_chat_messages" ADD CONSTRAINT "help_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "help_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_escalations" ADD CONSTRAINT "help_escalations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "help_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_chat_daily_usage" ADD CONSTRAINT "help_chat_daily_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
