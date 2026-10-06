-- Control Center (additive only)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS accent_color text;

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Personal preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY,
  home_route text NOT NULL DEFAULT '/dashboard',
  nav_order text[] NOT NULL DEFAULT '{}',
  nav_hidden text[] NOT NULL DEFAULT '{}',
  favorites jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text NOT NULL DEFAULT 'BRL',
  date_format text NOT NULL DEFAULT 'dd/MM/yyyy',
  density text NOT NULL DEFAULT 'comfortable',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefs_select ON public.user_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY prefs_insert ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY prefs_update ON public.user_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Activity log (minimal metadata; written only by definer functions/triggers)
CREATE TABLE IF NOT EXISTS public.workspace_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspace_activity_ws_idx ON public.workspace_activity (workspace_id, created_at DESC);
GRANT SELECT ON public.workspace_activity TO authenticated;
GRANT ALL ON public.workspace_activity TO service_role;
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_select ON public.workspace_activity FOR SELECT TO authenticated USING (public.user_is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.log_activity(_ws uuid, _action text, _type text, _label text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.workspace_activity (workspace_id, actor_id, action, entity_type, entity_label)
  VALUES (_ws, auth.uid(), _action, _type, left(_label, 80));
$$;
REVOKE ALL ON FUNCTION public.log_activity(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Permission base (today OWNER and MEMBER keep current behavior)
CREATE OR REPLACE FUNCTION public.workspace_can(_workspace_id uuid, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = _workspace_id AND m.user_id = auth.uid()
      AND CASE
        WHEN _action IN ('manage_members','delete_workspace') THEN m.role = 'OWNER'
        ELSE m.role IN ('OWNER','MEMBER')
      END
  );
$$;

-- Workspace identity update (members may customize; never creates another workspace)
CREATE OR REPLACE FUNCTION public.update_workspace_identity(
  _workspace_id uuid, _name text, _description text, _accent_color text,
  _avatar_url text, _cover_url text, _set_avatar boolean, _set_cover boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_name text;
BEGIN
  IF NOT public.workspace_can(_workspace_id, 'manage_workspace') THEN
    RAISE EXCEPTION 'Sem permissão para alterar este espaço.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(_name), '') = '' OR length(_name) > 60 THEN RAISE EXCEPTION 'Nome inválido.'; END IF;
  IF _description IS NOT NULL AND length(_description) > 280 THEN RAISE EXCEPTION 'Descrição muito longa.'; END IF;
  IF _accent_color IS NOT NULL AND _accent_color !~ '^#[0-9A-Fa-f]{6}$' THEN RAISE EXCEPTION 'Cor inválida.'; END IF;
  IF _set_avatar AND _avatar_url IS NOT NULL AND _avatar_url NOT LIKE 'workspaces/' || _workspace_id || '/%' THEN RAISE EXCEPTION 'Imagem inválida.'; END IF;
  IF _set_cover AND _cover_url IS NOT NULL AND _cover_url NOT LIKE 'workspaces/' || _workspace_id || '/%' THEN RAISE EXCEPTION 'Imagem inválida.'; END IF;
  SELECT name INTO old_name FROM public.workspaces WHERE id = _workspace_id;
  UPDATE public.workspaces SET
    name = btrim(_name),
    description = nullif(btrim(_description), ''),
    accent_color = _accent_color,
    avatar_url = CASE WHEN _set_avatar THEN _avatar_url ELSE avatar_url END,
    cover_url = CASE WHEN _set_cover THEN _cover_url ELSE cover_url END
  WHERE id = _workspace_id;
  IF old_name IS DISTINCT FROM btrim(_name) THEN
    PERFORM public.log_activity(_workspace_id, 'renamed', 'workspace', btrim(_name));
  ELSE
    PERFORM public.log_activity(_workspace_id, 'updated', 'workspace', btrim(_name));
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.update_workspace_identity(uuid, text, text, text, text, text, boolean, boolean) TO authenticated;

-- Trash columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.contexts ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Normal reads never see trashed rows (same sharing rule + deleted_at IS NULL)
ALTER POLICY tasks_select ON public.tasks USING (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED') AND deleted_at IS NULL);
ALTER POLICY notes_select ON public.notes USING (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED') AND deleted_at IS NULL);
ALTER POLICY goals_select ON public.goals USING (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED') AND deleted_at IS NULL);
ALTER POLICY contexts_select ON public.contexts USING (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED') AND deleted_at IS NULL);
ALTER POLICY events_select ON public.events USING (user_is_workspace_member(workspace_id) AND (owner_id = auth.uid() OR visibility = 'SHARED') AND deleted_at IS NULL);
ALTER POLICY purchases_select ON public.purchases USING (user_is_workspace_member(workspace_id) AND deleted_at IS NULL);

-- Trash operations: same who-can-delete rule as the existing DELETE policies
CREATE OR REPLACE FUNCTION public.trash_record(_table text, _id uuid, _op text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; owner uuid; label text; is_deleted boolean; label_col text; owner_col text;
BEGIN
  IF _table NOT IN ('tasks','notes','goals','contexts','events','purchases') THEN RAISE EXCEPTION 'Tabela inválida.'; END IF;
  IF _op NOT IN ('delete','restore','purge') THEN RAISE EXCEPTION 'Operação inválida.'; END IF;
  label_col := CASE WHEN _table = 'contexts' THEN 'name' ELSE 'title' END;
  owner_col := CASE WHEN _table = 'purchases' THEN 'created_by' ELSE 'owner_id' END;
  EXECUTE format('SELECT workspace_id, %I, %I, deleted_at IS NOT NULL FROM public.%I WHERE id = $1', owner_col, label_col, _table)
    INTO ws, owner, label, is_deleted USING _id;
  IF ws IS NULL OR NOT public.user_is_workspace_member(ws) THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  IF _table <> 'purchases' AND owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Só quem criou pode excluir ou restaurar este item.' USING ERRCODE = '42501';
  END IF;
  IF _op = 'delete' THEN
    IF is_deleted THEN RETURN; END IF;
    EXECUTE format('UPDATE public.%I SET deleted_at = now(), deleted_by = auth.uid() WHERE id = $1', _table) USING _id;
    PERFORM public.log_activity(ws, 'trashed', _table, label);
  ELSIF _op = 'restore' THEN
    IF NOT is_deleted THEN RETURN; END IF;
    EXECUTE format('UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', _table) USING _id;
    PERFORM public.log_activity(ws, 'restored', _table, label);
  ELSE
    IF NOT is_deleted THEN RAISE EXCEPTION 'Mova para a lixeira antes de excluir definitivamente.'; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', _table) USING _id;
    PERFORM public.log_activity(ws, 'purged', _table, label);
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.trash_record(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_trash(_workspace_id uuid)
RETURNS TABLE(table_name text, id uuid, label text, deleted_at timestamptz, deleted_by uuid, can_manage boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_is_workspace_member(_workspace_id) THEN RETURN; END IF;
  RETURN QUERY
    SELECT 'tasks', t.id, t.title, t.deleted_at, t.deleted_by, t.owner_id = auth.uid() FROM public.tasks t WHERE t.workspace_id = _workspace_id AND t.deleted_at IS NOT NULL AND (t.owner_id = auth.uid() OR t.visibility = 'SHARED')
    UNION ALL SELECT 'notes', n.id, n.title, n.deleted_at, n.deleted_by, n.owner_id = auth.uid() FROM public.notes n WHERE n.workspace_id = _workspace_id AND n.deleted_at IS NOT NULL AND (n.owner_id = auth.uid() OR n.visibility = 'SHARED')
    UNION ALL SELECT 'goals', g.id, g.title, g.deleted_at, g.deleted_by, g.owner_id = auth.uid() FROM public.goals g WHERE g.workspace_id = _workspace_id AND g.deleted_at IS NOT NULL AND (g.owner_id = auth.uid() OR g.visibility = 'SHARED')
    UNION ALL SELECT 'contexts', c.id, c.name, c.deleted_at, c.deleted_by, c.owner_id = auth.uid() FROM public.contexts c WHERE c.workspace_id = _workspace_id AND c.deleted_at IS NOT NULL AND (c.owner_id = auth.uid() OR c.visibility = 'SHARED')
    UNION ALL SELECT 'events', e.id, e.title, e.deleted_at, e.deleted_by, e.owner_id = auth.uid() FROM public.events e WHERE e.workspace_id = _workspace_id AND e.deleted_at IS NOT NULL AND (e.owner_id = auth.uid() OR e.visibility = 'SHARED')
    UNION ALL SELECT 'purchases', p.id, p.title, p.deleted_at, p.deleted_by, true FROM public.purchases p WHERE p.workspace_id = _workspace_id AND p.deleted_at IS NOT NULL
    ORDER BY 4 DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.list_trash(uuid) TO authenticated;

-- Categories: archive / safe delete
CREATE OR REPLACE FUNCTION public.category_usage(_category_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; n integer;
BEGIN
  SELECT workspace_id INTO ws FROM public.categories WHERE id = _category_id;
  IF ws IS NULL OR NOT public.user_is_workspace_member(ws) THEN RETURN 0; END IF;
  SELECT (SELECT count(*) FROM public.transactions WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.recurring_transactions WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.installment_plans WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.financings WHERE category_id = _category_id)
       + (SELECT count(*) FROM public.categories WHERE parent_id = _category_id)
    INTO n;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.category_usage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_category_safe(_category_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; nm text;
BEGIN
  SELECT workspace_id, name INTO ws, nm FROM public.categories WHERE id = _category_id;
  IF ws IS NULL OR NOT public.workspace_can(ws, 'manage_settings') THEN RAISE EXCEPTION 'Categoria não encontrada.'; END IF;
  IF public.category_usage(_category_id) > 0 THEN
    RAISE EXCEPTION 'Esta categoria tem registros associados. Arquive em vez de excluir.';
  END IF;
  DELETE FROM public.categories WHERE id = _category_id;
  PERFORM public.log_activity(ws, 'deleted', 'category', nm);
END $$;
GRANT EXECUTE ON FUNCTION public.delete_category_safe(uuid) TO authenticated;

-- Audit triggers (metadata only)
CREATE OR REPLACE FUNCTION public.audit_category_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN PERFORM public.log_activity(NEW.workspace_id, 'created', 'category', NEW.name);
  ELSIF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    PERFORM public.log_activity(NEW.workspace_id, CASE WHEN NEW.archived_at IS NULL THEN 'unarchived' ELSE 'archived' END, 'category', NEW.name);
  ELSIF (NEW.name, NEW.icon, NEW.color, NEW.type) IS DISTINCT FROM (OLD.name, OLD.icon, OLD.color, OLD.type) THEN
    PERFORM public.log_activity(NEW.workspace_id, 'updated', 'category', NEW.name);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_category_change ON public.categories;
CREATE TRIGGER audit_category_change AFTER INSERT OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.audit_category_change();

CREATE OR REPLACE FUNCTION public.audit_created_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.is_demo THEN RETURN NEW; END IF;
  PERFORM public.log_activity(NEW.workspace_id, 'created', TG_TABLE_NAME, CASE WHEN TG_TABLE_NAME = 'contexts' THEN NEW.name ELSE NEW.title END);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_goal_created ON public.goals;
CREATE TRIGGER audit_goal_created AFTER INSERT ON public.goals FOR EACH ROW EXECUTE FUNCTION public.audit_created_record();
DROP TRIGGER IF EXISTS audit_context_created ON public.contexts;
CREATE TRIGGER audit_context_created AFTER INSERT ON public.contexts FOR EACH ROW EXECUTE FUNCTION public.audit_created_record();

CREATE OR REPLACE FUNCTION public.audit_member_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  SELECT name INTO nm FROM public.profiles WHERE id = coalesce(NEW.user_id, OLD.user_id);
  IF TG_OP = 'INSERT' THEN PERFORM public.log_activity(NEW.workspace_id, 'member_added', 'member', nm);
  ELSIF TG_OP = 'DELETE' THEN PERFORM public.log_activity(OLD.workspace_id, 'member_removed', 'member', nm);
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN PERFORM public.log_activity(NEW.workspace_id, 'role_changed', 'member', nm);
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS audit_member_change ON public.workspace_members;
CREATE TRIGGER audit_member_change AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.audit_member_change();

-- Live sync for the new shared table
DROP TRIGGER IF EXISTS emit_workspace_sync_event ON public.workspace_activity;
CREATE TRIGGER emit_workspace_sync_event AFTER INSERT ON public.workspace_activity FOR EACH ROW EXECUTE FUNCTION public.emit_workspace_sync_event();