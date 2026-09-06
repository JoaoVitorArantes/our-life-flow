DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('SCHEDULED','DONE','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_recurrence AS ENUM ('DAILY','WEEKLY','MONTHLY','YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS status public.event_status NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS reminder_minutes smallint,
  ADD COLUMN IF NOT EXISTS participants uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence public.event_recurrence,
  ADD COLUMN IF NOT EXISTS recurrence_until date,
  ADD COLUMN IF NOT EXISTS recurrence_exceptions date[] NOT NULL DEFAULT '{}';

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS note_date date;

CREATE INDEX IF NOT EXISTS events_workspace_starts_idx ON public.events (workspace_id, starts_at);
CREATE INDEX IF NOT EXISTS notes_workspace_note_date_idx ON public.notes (workspace_id, note_date);