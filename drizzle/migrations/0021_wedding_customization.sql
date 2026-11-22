CREATE TABLE public.wedding_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  description text,
  color text NOT NULL DEFAULT 'blush' CHECK (color IN ('blush','lavender','gold','plum','sage','sky','stone')),
  sort_order integer NOT NULL DEFAULT 0,
  legacy_key text,
  archived_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE TABLE public.wedding_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  color text NOT NULL DEFAULT 'stone' CHECK (color IN ('blush','lavender','gold','plum','sage','sky','stone')),
  counts_as_bought boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  legacy_key text,
  archived_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wedding_priorities','wedding_statuses'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id))', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id))', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.user_is_workspace_member(workspace_id))', t || '_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF workspace_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wedding_block_demo()', t || '_no_demo', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event()', t || '_sync', t);
  END LOOP;
END $$;

ALTER TABLE public.wedding_rooms
  ADD COLUMN icon text, ADD COLUMN color text, ADD COLUMN description text, ADD COLUMN archived_at timestamptz;
ALTER TABLE public.wedding_items
  ADD COLUMN priority_id uuid, ADD COLUMN status_id uuid, ADD COLUMN description text,
  ADD COLUMN image_path text, ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN archived_at timestamptz, ADD COLUMN archived_by uuid;
ALTER TABLE public.wedding_plans
  ADD COLUMN couple_names text, ADD COLUMN message text, ADD COLUMN cover_path text,
  ADD COLUMN theme text NOT NULL DEFAULT 'champagne' CHECK (theme IN ('champagne','lavender','ivory'));

-- Backfill: opções padrão para cada espaço que já usa o módulo
INSERT INTO public.wedding_priorities (workspace_id, label, description, color, sort_order, legacy_key, created_by)
SELECT w.workspace_id, v.label, v.descr, v.color, v.ord, v.k, w.created_by
FROM (SELECT DISTINCT ON (workspace_id) workspace_id, created_by FROM public.wedding_rooms ORDER BY workspace_id, created_at) w
CROSS JOIN (VALUES ('P1','P1 · Essencial','Indispensável para morar','plum',1),
                   ('P2','P2 · Importante','Faz falta logo no início','blush',2),
                   ('P3','P3 · Complementar','Pode vir depois','lavender',3)) AS v(k,label,descr,color,ord);
INSERT INTO public.wedding_statuses (workspace_id, label, color, counts_as_bought, sort_order, legacy_key, created_by)
SELECT w.workspace_id, v.label, v.color, v.bought, v.ord, v.k, w.created_by
FROM (SELECT DISTINCT ON (workspace_id) workspace_id, created_by FROM public.wedding_rooms ORDER BY workspace_id, created_at) w
CROSS JOIN (VALUES ('to_research','A pesquisar','stone',false,1),
                   ('researched','Pesquisado','sky',false,2),
                   ('planned','Planejado','gold',false,3),
                   ('bought','Comprado','sage',true,4)) AS v(k,label,color,bought,ord);
UPDATE public.wedding_items i SET priority_id = p.id
FROM public.wedding_priorities p WHERE p.workspace_id = i.workspace_id AND p.legacy_key = i.priority;
UPDATE public.wedding_items i SET status_id = s.id
FROM public.wedding_statuses s WHERE s.workspace_id = i.workspace_id AND s.legacy_key = i.status;
UPDATE public.wedding_items i SET sort_order = sub.rn
FROM (SELECT id, row_number() OVER (PARTITION BY room_id ORDER BY created_at, id) AS rn FROM public.wedding_items) sub
WHERE sub.id = i.id;

ALTER TABLE public.wedding_items
  ADD CONSTRAINT wedding_items_priority_fkey FOREIGN KEY (workspace_id, priority_id) REFERENCES public.wedding_priorities(workspace_id, id) ON DELETE SET NULL (priority_id),
  ADD CONSTRAINT wedding_items_status_fkey FOREIGN KEY (workspace_id, status_id) REFERENCES public.wedding_statuses(workspace_id, id) ON DELETE SET NULL (status_id);

COMMENT ON COLUMN public.wedding_items.priority IS 'DEPRECATED: replaced by priority_id';
COMMENT ON COLUMN public.wedding_items.status IS 'DEPRECATED: replaced by status_id';

-- Novos espaços: cria opções padrão ao criar o primeiro cômodo
CREATE OR REPLACE FUNCTION public.wedding_ensure_defaults() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_is_workspace_member(NEW.workspace_id) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wedding_priorities WHERE workspace_id = NEW.workspace_id) THEN
    INSERT INTO public.wedding_priorities (workspace_id, label, description, color, sort_order, legacy_key, created_by) VALUES
      (NEW.workspace_id,'P1 · Essencial','Indispensável para morar','plum',1,'P1',NEW.created_by),
      (NEW.workspace_id,'P2 · Importante','Faz falta logo no início','blush',2,'P2',NEW.created_by),
      (NEW.workspace_id,'P3 · Complementar','Pode vir depois','lavender',3,'P3',NEW.created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wedding_statuses WHERE workspace_id = NEW.workspace_id) THEN
    INSERT INTO public.wedding_statuses (workspace_id, label, color, counts_as_bought, sort_order, legacy_key, created_by) VALUES
      (NEW.workspace_id,'A pesquisar','stone',false,1,'to_research',NEW.created_by),
      (NEW.workspace_id,'Pesquisado','sky',false,2,'researched',NEW.created_by),
      (NEW.workspace_id,'Planejado','gold',false,3,'planned',NEW.created_by),
      (NEW.workspace_id,'Comprado','sage',true,4,'bought',NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wedding_rooms_defaults AFTER INSERT ON public.wedding_rooms FOR EACH ROW EXECUTE FUNCTION public.wedding_ensure_defaults();