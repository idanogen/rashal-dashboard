-- ============================================================================
-- WhatsApp (heyy.io) Integration — Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Project: kukstfxtznymfkirdmty (rashal-dashboard)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE whatsapp_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_message_kind AS ENUM ('text', 'template');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_outbound_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_inbound_status AS ENUM ('received', 'processed', 'failed', 'ignored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customer_reply_status AS ENUM ('ממתין', 'מתאים', 'לא מתאים', 'בקשת שינוי');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_reminder_kind AS ENUM ('delivery_reminder', 'schedule_request', 'team_notification', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. Inbound messages (every reply from a customer)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id  text UNIQUE,                       -- idempotency key from heyy
  phone_e164           text NOT NULL,                     -- +972523694547
  phone_local          text,                              -- 0523694547 (for matching orders.phone)
  body_text            text,
  raw_payload          jsonb,                             -- full payload for debugging
  status               whatsapp_inbound_status NOT NULL DEFAULT 'received',
  order_id             uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  parsed_reply_status  customer_reply_status,             -- if we managed to parse a yes/no
  notes                text,                              -- free text for human review
  is_demo              boolean NOT NULL DEFAULT false,    -- demo-mode simulation row
  received_at          timestamptz NOT NULL DEFAULT now(),
  processed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_phone_e164 ON public.whatsapp_inbound (phone_e164);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_phone_local ON public.whatsapp_inbound (phone_local);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_order_id ON public.whatsapp_inbound (order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_received_at ON public.whatsapp_inbound (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_status ON public.whatsapp_inbound (status);

-- ----------------------------------------------------------------------------
-- 3. Outbound messages (every send attempt, demo or real)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_outbound (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id        text,                              -- waMessageId from heyy (empty if Meta rejected)
  phone_e164           text NOT NULL,
  message_kind         whatsapp_message_kind NOT NULL,    -- text | template
  template_id          text,                              -- heyy templateId (null for text)
  template_params      jsonb,                             -- ["param1", "param2", ...]
  body_text            text,                              -- text body (null for template)
  reminder_kind        whatsapp_reminder_kind,            -- semantic label
  status               whatsapp_outbound_status NOT NULL DEFAULT 'pending',
  status_detail        text,                              -- error message / heyy response
  order_id             uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  triggered_by         text,                              -- 'cron' | 'user:<email>' | 'webhook'
  is_demo              boolean NOT NULL DEFAULT false,
  sent_at              timestamptz NOT NULL DEFAULT now(),
  delivered_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_phone_e164 ON public.whatsapp_outbound (phone_e164);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_order_id ON public.whatsapp_outbound (order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_sent_at ON public.whatsapp_outbound (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_status ON public.whatsapp_outbound (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_reminder_kind ON public.whatsapp_outbound (reminder_kind);

-- ----------------------------------------------------------------------------
-- 4. Reminder cooldown log (prevents duplicate reminders within 48h)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_reminder_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reminder_kind   whatsapp_reminder_kind NOT NULL,
  phone_e164      text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  outbound_id     uuid REFERENCES public.whatsapp_outbound(id) ON DELETE SET NULL,
  -- one reminder of a given kind per order per send instant; cooldown enforced in code
  UNIQUE (order_id, reminder_kind, sent_at)
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_order_kind ON public.whatsapp_reminder_log (order_id, reminder_kind, sent_at DESC);

-- ----------------------------------------------------------------------------
-- 5. New columns on orders for WhatsApp state
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_date date,                              -- explicit delivery day for cron
  ADD COLUMN IF NOT EXISTS scheduled_reminder_at timestamptz,                -- user-set reminder time
  ADD COLUMN IF NOT EXISTS customer_reply_status customer_reply_status,      -- last parsed reply
  ADD COLUMN IF NOT EXISTS customer_requested_time text,                     -- free text from customer
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;                     -- cache of latest outbound

CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.orders (delivery_date) WHERE delivery_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_reminder_at ON public.orders (scheduled_reminder_at) WHERE scheduled_reminder_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.whatsapp_inbound      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outbound     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_reminder_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read/write (same pattern as orders).
-- Tighten later if you want role separation.

DROP POLICY IF EXISTS "authenticated read inbound"  ON public.whatsapp_inbound;
DROP POLICY IF EXISTS "authenticated write inbound" ON public.whatsapp_inbound;
CREATE POLICY "authenticated read inbound"  ON public.whatsapp_inbound  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write inbound" ON public.whatsapp_inbound  FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read outbound"  ON public.whatsapp_outbound;
DROP POLICY IF EXISTS "authenticated write outbound" ON public.whatsapp_outbound;
CREATE POLICY "authenticated read outbound"  ON public.whatsapp_outbound FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write outbound" ON public.whatsapp_outbound FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read reminders"  ON public.whatsapp_reminder_log;
DROP POLICY IF EXISTS "authenticated write reminders" ON public.whatsapp_reminder_log;
CREATE POLICY "authenticated read reminders"  ON public.whatsapp_reminder_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write reminders" ON public.whatsapp_reminder_log FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- service_role bypasses RLS automatically — used by /api functions

-- ----------------------------------------------------------------------------
-- 7. Realtime publication (so the dashboard inbox refreshes live)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_inbound;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_outbound;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- DONE. Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'whatsapp_%';
-- ============================================================================
