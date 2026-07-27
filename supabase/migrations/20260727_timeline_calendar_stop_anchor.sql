-- Timeline chat for stops without an order/service_call entity (task / pickup).
--
-- Bug: StopChatButton anchored task/pickup stops to order_id = calendar_stops.id,
-- which violated the FK to orders(id) → "שגיאה בשליחת ההודעה" for every chat on a
-- task or pickup stop. This adds a calendar_stop anchor so those stops get a real
-- chat thread. delivery/service keep anchoring to order_id/service_call_id.

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS calendar_stop_id uuid
    REFERENCES public.calendar_stops(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS timeline_events_calendar_stop_id_idx
  ON public.timeline_events(calendar_stop_id);
