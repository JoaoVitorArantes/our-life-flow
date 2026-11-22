CREATE TABLE public.budget_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  visibility public.visibility NOT NULL DEFAULT 'SHARED',
  category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0 AND amount <= 1000000000),
  start_month date NOT NULL,
  end_month date,
  note text CHECK (note IS NULL OR length(note) <= 200),
  from_legacy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_month IS NULL OR end_month >= start_month)
);
CREATE INDEX budget_rules_ws_idx ON public.budget_rules (workspace_id, start_month);
CREATE INDEX budget_rules_cat_idx ON public.budget_rules (category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_rules TO authenticated;
GRANT ALL ON public.budget_rules TO service_role;
ALTER TABLE public.budget_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_rules_select ON public.budget_rules FOR SELECT TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND (visibility = 'SHARED' OR owner_id = auth.uid()));
CREATE POLICY budget_rules_insert ON public.budget_rules FOR INSERT TO authenticated
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY budget_rules_update ON public.budget_rules FOR UPDATE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND (visibility = 'SHARED' OR owner_id = auth.uid()))
  WITH CHECK (public.user_is_workspace_member(workspace_id) AND (visibility = 'SHARED' OR owner_id = auth.uid()));
CREATE POLICY budget_rules_delete ON public.budget_rules FOR DELETE TO authenticated
  USING (public.user_is_workspace_member(workspace_id) AND (visibility = 'SHARED' OR owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.budget_rules_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.start_month := date_trunc('month', NEW.start_month)::date;
  IF NEW.end_month IS NOT NULL THEN NEW.end_month := date_trunc('month', NEW.end_month)::date; END IF;
  IF NEW.end_month IS NOT NULL AND NEW.end_month < NEW.start_month THEN
    RAISE EXCEPTION 'O mês final não pode ser anterior ao inicial.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id <> OLD.workspace_id OR NEW.owner_id <> OLD.owner_id OR NEW.visibility <> OLD.visibility
       OR NEW.category_id IS DISTINCT FROM OLD.category_id OR NEW.from_legacy <> OLD.from_legacy THEN
      RAISE EXCEPTION 'Não é possível mudar o dono, espaço, categoria ou visibilidade de um orçamento.';
    END IF;
  END IF;
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories c WHERE c.id = NEW.category_id AND c.workspace_id = NEW.workspace_id AND c.type <> 'INCOME'
  ) THEN
    RAISE EXCEPTION 'Categoria de despesa inválida para este espaço.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER budget_rules_validate BEFORE INSERT OR UPDATE ON public.budget_rules
  FOR EACH ROW EXECUTE FUNCTION public.budget_rules_validate();
CREATE TRIGGER budget_rules_sync AFTER INSERT OR UPDATE OR DELETE ON public.budget_rules
  FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event();

-- Compatibilidade com categories.monthly_budget (limite mensal recorrente antigo).
CREATE OR REPLACE FUNCTION public.budget_rule_owner(_ws uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(auth.uid(), (SELECT m.user_id FROM public.workspace_members m WHERE m.workspace_id = _ws
    ORDER BY (m.role = 'OWNER') DESC, m.created_at LIMIT 1))
$$;
REVOKE ALL ON FUNCTION public.budget_rule_owner(uuid) FROM PUBLIC, anon, authenticated;

INSERT INTO public.budget_rules (workspace_id, owner_id, visibility, category_id, amount, start_month, from_legacy)
SELECT c.workspace_id, public.budget_rule_owner(c.workspace_id), 'SHARED', c.id, c.monthly_budget,
       date_trunc('month', c.created_at)::date, true
FROM public.categories c
WHERE c.monthly_budget > 0 AND c.type <> 'INCOME'
  AND public.budget_rule_owner(c.workspace_id) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.budget_rules r WHERE r.category_id = c.id AND r.from_legacy);

CREATE OR REPLACE FUNCTION public.categories_legacy_budget_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _m date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
        _r public.budget_rules; _owner uuid;
BEGIN
  IF NEW.monthly_budget IS NOT DISTINCT FROM OLD.monthly_budget OR NEW.type = 'INCOME' THEN RETURN NEW; END IF;
  SELECT * INTO _r FROM public.budget_rules
    WHERE category_id = NEW.id AND from_legacy AND end_month IS NULL ORDER BY start_month DESC LIMIT 1;
  IF _r.id IS NOT NULL THEN
    IF _r.start_month >= _m THEN
      IF coalesce(NEW.monthly_budget, 0) > 0 THEN
        UPDATE public.budget_rules SET amount = NEW.monthly_budget WHERE id = _r.id;
      ELSE
        DELETE FROM public.budget_rules WHERE id = _r.id;
      END IF;
      RETURN NEW;
    END IF;
    UPDATE public.budget_rules SET end_month = (_m - interval '1 month')::date WHERE id = _r.id;
  END IF;
  IF coalesce(NEW.monthly_budget, 0) > 0 THEN
    _owner := public.budget_rule_owner(NEW.workspace_id);
    IF _owner IS NOT NULL THEN
      INSERT INTO public.budget_rules (workspace_id, owner_id, visibility, category_id, amount, start_month, from_legacy)
      VALUES (NEW.workspace_id, _owner, 'SHARED', NEW.id, NEW.monthly_budget, _m, true);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.categories_legacy_budget_sync() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER categories_legacy_budget_sync AFTER UPDATE OF monthly_budget ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.categories_legacy_budget_sync();
COMMENT ON COLUMN public.categories.monthly_budget IS 'DEPRECATED: replaced by budget_rules; kept in sync for older clients via categories_legacy_budget_sync';

CREATE OR REPLACE FUNCTION public.category_usage(_category_id uuid)
 RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ws uuid; n integer;
BEGIN
  SELECT workspace_id INTO ws FROM public.categories WHERE id = _category_id;
  IF ws IS NULL OR NOT public.user_is_workspace_member(ws) THEN RETURN 0; END IF;
  SELECT (SELECT count(*) FROM public.transactions WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.recurring_transactions WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.installment_plans WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.financings WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.categories WHERE parent_id = _category_id)
       + (SELECT count(*) FROM public.budget_rules WHERE category_id = _category_id)
    INTO n;
  RETURN n;
END $function$;

-- Metas contínuas: início, frequência e valor por período (todos opcionais).
ALTER TABLE public.goals
  ADD COLUMN start_date date,
  ADD COLUMN recurrence text NOT NULL DEFAULT 'NONE',
  ADD COLUMN recurrence_months integer,
  ADD COLUMN period_amount numeric(14,2);
ALTER TABLE public.goals
  ADD CONSTRAINT goals_recurrence_check CHECK (recurrence IN ('NONE','MONTHLY','YEARLY','CUSTOM')),
  ADD CONSTRAINT goals_recurrence_months_check CHECK (
    (recurrence = 'CUSTOM' AND recurrence_months BETWEEN 1 AND 120) OR (recurrence <> 'CUSTOM' AND recurrence_months IS NULL)),
  ADD CONSTRAINT goals_period_amount_check CHECK (period_amount IS NULL OR (period_amount > 0 AND period_amount <= 1000000000)),
  ADD CONSTRAINT goals_dates_check CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date);