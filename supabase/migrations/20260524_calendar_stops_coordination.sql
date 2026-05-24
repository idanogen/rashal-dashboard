-- ============================================================================
-- WhatsApp Coordination on Calendar Stops
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Project: kukstfxtznymfkirdmty (rashal-dashboard)
--
-- Adds 5 fields to calendar_stops so we can:
--   - track when/how each stop was coordinated (WhatsApp vs phone)
--   - persist the time window the user typed in the dialog
--   - drive the "🟢/☎/✅/❌" badge on each stop card
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE coordination_status AS ENUM (
    'whatsapp_sent',         -- template sent, no reply yet
    'phone_confirmed',       -- user manually marked phone-coordinated
    'customer_confirmed',    -- customer replied yes
    'customer_rejected',     -- customer replied no
    'customer_change'        -- customer requested a different time
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.calendar_stops
  ADD COLUMN IF NOT EXISTS coordination_status   coordination_status,
  ADD COLUMN IF NOT EXISTS coordination_method   text,             -- 'whatsapp' | 'phone' | null
  ADD COLUMN IF NOT EXISTS coordinated_at        timestamptz,
  ADD COLUMN IF NOT EXISTS time_window_start     text,             -- '09:00' (free text — store as user typed)
  ADD COLUMN IF NOT EXISTS time_window_end       text;             -- '13:00'

CREATE INDEX IF NOT EXISTS idx_calendar_stops_coord_status
  ON public.calendar_stops (coordination_status)
  WHERE coordination_status IS NOT NULL;

-- ============================================================================
-- Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'calendar_stops'
--   AND column_name IN ('coordination_status','coordination_method','coordinated_at','time_window_start','time_window_end');
-- ============================================================================
