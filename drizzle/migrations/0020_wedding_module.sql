CREATE OR REPLACE FUNCTION public.wedding_block_demo() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = NEW.workspace_id AND w.is_demo) THEN
    RAISE EXCEPTION 'Casamento indisponível em espaços de demonstração';
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE public.wedding_plans (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  wedding_date date,
  move_in_date date,
  total_budget numeric CHECK (total_budget IS NULL OR total_budget >= 0),
  housing text NOT NULL DEFAULT 'rent' CHECK (housing IN ('rent','own','other')),
  bedrooms integer DEFAULT 2 CHECK (bedrooms IS NULL OR bedrooms BETWEEN 0 AND 20),
  standard text NOT NULL DEFAULT 'intermediate' CHECK (standard IN ('economy','intermediate','premium')),
  savings_start date DEFAULT '2027-01-01',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wedding_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL DEFAULT 'house' CHECK (area IN ('house','ceremony','party','honeymoon','planning')),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE public.wedding_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  category text, contact text, url text, notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);

CREATE TABLE public.wedding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  room_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  priority text NOT NULL DEFAULT 'P2' CHECK (priority IN ('P1','P2','P3')),
  price_low numeric CHECK (price_low IS NULL OR price_low >= 0),
  price_target numeric CHECK (price_target IS NULL OR price_target >= 0),
  price_high numeric CHECK (price_high IS NULL OR price_high >= 0),
  price_actual numeric CHECK (price_actual IS NULL OR price_actual >= 0),
  status text NOT NULL DEFAULT 'to_research' CHECK (status IN ('to_research','researched','planned','bought')),
  responsible_user_id uuid,
  supplier_id uuid,
  links text[] NOT NULL DEFAULT '{}',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, room_id) REFERENCES public.wedding_rooms(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, supplier_id) REFERENCES public.wedding_suppliers(workspace_id, id) ON DELETE SET NULL (supplier_id),
  FOREIGN KEY (workspace_id, responsible_user_id) REFERENCES public.workspace_members(workspace_id, user_id)
);

CREATE TABLE public.wedding_savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL DEFAULT 'house' CHECK (area IN ('house','ceremony','party','honeymoon','planning')),
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  target_amount numeric NOT NULL CHECK (target_amount >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, area, month)
);

CREATE TABLE public.wedding_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL DEFAULT 'house' CHECK (area IN ('house','ceremony','party','honeymoon','planning')),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  contributed_on date NOT NULL DEFAULT current_date,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, user_id) REFERENCES public.workspace_members(workspace_id, user_id)
);

CREATE TABLE public.wedding_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL DEFAULT 'house' CHECK (area IN ('house','ceremony','party','honeymoon','planning')),
  item_id uuid,
  supplier_id uuid,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 200),
  amount numeric NOT NULL CHECK (amount > 0),
  spent_on date NOT NULL DEFAULT current_date,
  paid_by_user_id uuid NOT NULL,
  split text NOT NULL DEFAULT 'equal' CHECK (split IN ('equal','payer')),
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, item_id) REFERENCES public.wedding_items(workspace_id, id) ON DELETE SET NULL (item_id),
  FOREIGN KEY (workspace_id, supplier_id) REFERENCES public.wedding_suppliers(workspace_id, id) ON DELETE SET NULL (supplier_id),
  FOREIGN KEY (workspace_id, paid_by_user_id) REFERENCES public.workspace_members(workspace_id, user_id)
);

CREATE TABLE public.wedding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  area text NOT NULL DEFAULT 'house' CHECK (area IN ('house','ceremony','party','honeymoon','planning')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  kind text NOT NULL DEFAULT 'task' CHECK (kind IN ('task','decision','note')),
  due_date date,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  responsible_user_id uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, responsible_user_id) REFERENCES public.workspace_members(workspace_id, user_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wedding_plans','wedding_rooms','wedding_suppliers','wedding_items','wedding_savings_goals','wedding_contributions','wedding_expenses','wedding_tasks'] LOOP
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

CREATE INDEX wedding_items_room_idx ON public.wedding_items (workspace_id, room_id);
CREATE INDEX wedding_expenses_ws_idx ON public.wedding_expenses (workspace_id, spent_on);
CREATE INDEX wedding_contributions_ws_idx ON public.wedding_contributions (workspace_id, contributed_on);