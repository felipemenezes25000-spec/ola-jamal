CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON public.outbox_events(status) WHERE status = 'pending';
