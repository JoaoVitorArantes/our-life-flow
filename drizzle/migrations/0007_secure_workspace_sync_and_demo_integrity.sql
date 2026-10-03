-- Demo flags (idempotent; production rows default to false)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.workspaces ALTER COLUMN is_demo SET DEFAULT false;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.physical_activities ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Tenant-scoped sync signal table: carries only workspace, table name and operation (never row ids)
CREATE TABLE IF NOT EXISTS public.workspace_sync_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  table_name text NOT NULL,
  op text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspace_sync_events_ws_created ON public.workspace_sync_events (workspace_id, created_at);
GRANT SELECT ON public.workspace_sync_events TO authenticated;
GRANT ALL ON public.workspace_sync_events TO service_role;
ALTER TABLE public.workspace_sync_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_sync_events_select ON public.workspace_sync_events;
CREATE POLICY workspace_sync_events_select ON public.workspace_sync_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.emit_workspace_sync_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row jsonb := to_jsonb(coalesce(NEW, OLD)); _ws uuid;
BEGIN
  _ws := CASE WHEN TG_TABLE_NAME = 'workspaces' THEN (_row->>'id')::uuid ELSE (_row->>'workspace_id')::uuid END;
  IF _ws IS NULL THEN RETURN NULL; END IF;
  DELETE FROM public.workspace_sync_events WHERE workspace_id = _ws AND created_at < now() - interval '10 minutes';
  INSERT INTO public.workspace_sync_events (workspace_id, table_name, op) VALUES (_ws, TG_TABLE_NAME, TG_OP);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.emit_workspace_sync_event() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces','workspace_members','workspace_relationships','accounts','cards','card_invoice_payments','categories','transactions','transaction_splits','transaction_payers','installments','installment_plans','recurring_transactions','loans','financings','settlements','events','tasks','goals','goal_contributions','notes','contexts','purchases','physical_activities','routines','routine_logs','ai_conversations','ai_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS emit_workspace_sync_event ON public.%I', t);
    EXECUTE format('CREATE TRIGGER emit_workspace_sync_event AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event()', t);
    -- Remove domain tables from Postgres Changes: unfiltered DELETE events would leak primary keys across tenants.
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='workspace_sync_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_sync_events;
  END IF;
END $$;

-- Atomic, idempotent reset covering every demo-marked table, children before parents
CREATE OR REPLACE FUNCTION public.reset_demo_workspace(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(_workspace_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND is_demo) THEN
    RAISE EXCEPTION 'Este workspace não é de demonstração.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('demo:' || _workspace_id::text, 0));
  DELETE FROM public.routines WHERE workspace_id = _workspace_id AND is_demo;           -- routine_logs cascade
  DELETE FROM public.purchases WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.physical_activities WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.settlements WHERE workspace_id = _workspace_id AND transaction_id IN (SELECT id FROM public.transactions WHERE workspace_id = _workspace_id AND is_demo);
  DELETE FROM public.transactions WHERE workspace_id = _workspace_id AND is_demo;       -- splits/payers/installments cascade
  DELETE FROM public.goal_contributions WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.installment_plans WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.recurring_transactions WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.loans WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.financings WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.goals WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.events WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.tasks WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.notes WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.contexts WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.cards WHERE workspace_id = _workspace_id AND is_demo;               -- card_invoice_payments cascade
  DELETE FROM public.accounts WHERE workspace_id = _workspace_id AND is_demo;
END $$;

-- Extra demo coverage for purchases, activities and routines (main seed stays in seed_demo_workspace)
CREATE OR REPLACE FUNCTION public.seed_demo_extras(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _d date := current_date; _ctx uuid; _goal uuid; _r uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_workspace_member(_workspace_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND is_demo) THEN RAISE EXCEPTION 'Este workspace não é de demonstração.'; END IF;
  SELECT id INTO _ctx FROM contexts WHERE workspace_id=_workspace_id AND is_demo AND type='TRIP' LIMIT 1;
  SELECT id INTO _goal FROM goals WHERE workspace_id=_workspace_id AND is_demo AND title='Reserva de emergência' LIMIT 1;

  INSERT INTO purchases (workspace_id, created_by, title, description, category, budget_amount, found_price, priority, status, desired_date, context_id, person_scope, is_demo) VALUES
  (_workspace_id,_uid,'Mala de viagem','Item fictício para a viagem.','Viagem',400,359.9,'HIGH','DECIDED',_d+20,_ctx,'COUPLE',true),
  (_workspace_id,_uid,'Fone com cancelamento de ruído',NULL,'Eletrônicos',800,NULL,'MEDIUM','RESEARCHING',NULL,NULL,'COUPLE',true),
  (_workspace_id,_uid,'Cadeira de escritório',NULL,'Casa',900,NULL,'LOW','WANT_TO_BUY',NULL,NULL,'COUPLE',true);

  INSERT INTO physical_activities (workspace_id, created_by, activity_type, title, activity_date, duration_minutes, distance_km, location, person_scope, is_demo) VALUES
  (_workspace_id,_uid,'RUN','Corrida leve',_d-1,35,5.2,'Parque Exemplo','COUPLE',true),
  (_workspace_id,_uid,'GYM','Treino de força',_d-3,50,NULL,'Academia Exemplo','COUPLE',true);

  INSERT INTO routines (workspace_id, created_by, kind, title, frequency, weekdays, month_days, start_date, start_time, duration_minutes, person_scope, goal_id, daily_target, status, show_in_agenda, is_demo)
  VALUES (_workspace_id,_uid,'ROUTINE','Revisar finanças da semana','WEEKLY',ARRAY[0]::smallint[],ARRAY[]::smallint[],_d-30,'20:00',20,'COUPLE',_goal,NULL,'ACTIVE',true,true)
  RETURNING id INTO _r;
  INSERT INTO routines (workspace_id, created_by, kind, title, frequency, weekdays, month_days, start_date, person_scope, daily_target, status, show_in_agenda, is_demo)
  VALUES (_workspace_id,_uid,'HABIT','Beber 2L de água','DAILY',ARRAY[]::smallint[],ARRAY[]::smallint[],_d-14,'COUPLE',8,'ACTIVE',false,true)
  RETURNING id INTO _r;
  INSERT INTO routine_logs (workspace_id, routine_id, log_date, status, count, user_id) VALUES
  (_workspace_id,_r,_d-1,'DONE',8,_uid),(_workspace_id,_r,_d-2,'DONE',6,_uid);
END $$;
REVOKE ALL ON FUNCTION public.seed_demo_extras(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_extras(uuid) TO authenticated;