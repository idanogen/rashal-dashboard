-- מסך "איסופים" — DOCUMENTS_N מפריוריטי (ראה docs/PICKUPS-PLAN.md)
-- אב: DOCUMENTS_N · שורות: TRANSORDER_N_SUBFORM (jsonb) · כתובת: DOCUMENTS_DCONT_SUBFORM
CREATE TABLE IF NOT EXISTS public.pickups (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_pickup_id text,          -- DOCNO (RT...)
  priority_doc       integer,       -- DOC (numeric id)
  customer_number    text,          -- CUSTNAME
  customer_name      text NOT NULL, -- CDES
  phone              text,          -- DOCUMENTS_DCONT_SUBFORM.PHONE
  address            text,          -- DOCUMENTS_DCONT_SUBFORM.ADRS
  city               text,          -- DOCUMENTS_DCONT_SUBFORM.STATE
  priority_status    text,          -- STATDES (טיוטא / סופית)
  pickup_date        date,          -- CURDATE
  source_order       text,          -- ORDNAME
  delivery_note      text,          -- ODOCNO
  reference          text,          -- REFERENCE
  to_warehouse       text,          -- TOWARHSDES
  agent              text,          -- AGENTNAME
  opened_by          text,          -- OWNERLOGIN
  total_qty          numeric,       -- TOTQUANT
  total_price        numeric,       -- TOTPRICE
  lines              jsonb,         -- TRANSORDER_N_SUBFORM
  priority_udate     timestamptz,   -- UDATE (delta watermark source)
  pickup_status      text NOT NULL DEFAULT 'ממתין לתאום', -- app-owned, never overwritten by pull
  duplicate_of       uuid REFERENCES public.pickups(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- FULL unique index (not partial) — required as an ON CONFLICT arbiter for the
-- pull's bulk upsert (learnings #11). Postgres treats NULLs as distinct, so
-- unkeyed rows never collide.
CREATE UNIQUE INDEX IF NOT EXISTS pickups_priority_id_key
  ON public.pickups (priority_pickup_id);
CREATE INDEX IF NOT EXISTS pickups_unkeyed_by_name
  ON public.pickups (customer_name) WHERE priority_pickup_id IS NULL;
CREATE INDEX IF NOT EXISTS pickups_status_idx ON public.pickups (pickup_status);
CREATE INDEX IF NOT EXISTS pickups_city_idx ON public.pickups (city);

DROP TRIGGER IF EXISTS set_updated_at ON public.pickups;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pickups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_pickups ON public.pickups;
CREATE POLICY authenticated_all_pickups ON public.pickups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pickups;

-- calendar_stops: support scheduling pickups (source_type='pickup')
ALTER TABLE public.calendar_stops
  ADD COLUMN IF NOT EXISTS pickup_id uuid REFERENCES public.pickups(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS calendar_stops_pickup_id_idx ON public.calendar_stops (pickup_id);

ALTER TABLE public.calendar_stops DROP CONSTRAINT IF EXISTS calendar_stops_source_check;
ALTER TABLE public.calendar_stops ADD CONSTRAINT calendar_stops_source_check CHECK (
  (source_type = 'delivery'   AND order_id IS NOT NULL AND service_call_id IS NULL AND inspection_id IS NULL AND pickup_id IS NULL) OR
  (source_type = 'service'    AND service_call_id IS NOT NULL AND order_id IS NULL AND inspection_id IS NULL AND pickup_id IS NULL) OR
  (source_type = 'task'       AND order_id IS NULL AND service_call_id IS NULL AND inspection_id IS NULL AND pickup_id IS NULL) OR
  (source_type = 'inspection' AND inspection_id IS NOT NULL AND order_id IS NULL AND service_call_id IS NULL AND pickup_id IS NULL) OR
  (source_type = 'pickup'     AND pickup_id IS NOT NULL AND order_id IS NULL AND service_call_id IS NULL AND inspection_id IS NULL)
);
