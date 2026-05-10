-- ===================================================================
-- Manual migration: add reminder response tables
-- Apply with: psql "$DATABASE_URL" -f prisma/sql/add_reminder_responses.sql
-- Or:         npx prisma db push (which will sync schema → DB)
-- ===================================================================

-- 1. Add rendered_message column to existing reminder_logs
ALTER TABLE "reminder_logs"
  ADD COLUMN IF NOT EXISTS "rendered_message" TEXT;

CREATE INDEX IF NOT EXISTS "reminder_logs_user_id_sent_at_idx"
  ON "reminder_logs" ("user_id", "sent_at");

-- 2. reminder_responses
CREATE TABLE IF NOT EXISTS "reminder_responses" (
  "id"                TEXT PRIMARY KEY,
  "reminder_log_id"   TEXT NOT NULL UNIQUE,
  "reminder_id"       TEXT NOT NULL,
  "user_id"           TEXT NOT NULL,
  "caption"           TEXT,
  "responded_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reminder_responses_log_fkey"
    FOREIGN KEY ("reminder_log_id") REFERENCES "reminder_logs"("id") ON DELETE CASCADE,
  CONSTRAINT "reminder_responses_reminder_fkey"
    FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE,
  CONSTRAINT "reminder_responses_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "reminder_responses_reminder_id_responded_at_idx"
  ON "reminder_responses" ("reminder_id", "responded_at");
CREATE INDEX IF NOT EXISTS "reminder_responses_user_id_responded_at_idx"
  ON "reminder_responses" ("user_id", "responded_at");

-- 3. reminder_response_images
CREATE TABLE IF NOT EXISTS "reminder_response_images" (
  "id"          TEXT PRIMARY KEY,
  "response_id" TEXT NOT NULL,
  "photo_url"   TEXT NOT NULL,
  "description" TEXT,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reminder_response_images_response_fkey"
    FOREIGN KEY ("response_id") REFERENCES "reminder_responses"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "reminder_response_images_response_id_idx"
  ON "reminder_response_images" ("response_id");
