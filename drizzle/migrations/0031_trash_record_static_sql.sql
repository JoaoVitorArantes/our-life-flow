CREATE OR REPLACE FUNCTION public.trash_record(_table text, _id uuid, _op text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ws uuid; owner uuid; label text; is_deleted boolean; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.' USING ERRCODE = '42501'; END IF;
  IF _op IS NULL OR _op NOT IN ('delete','restore','purge') THEN RAISE EXCEPTION 'Operação inválida.'; END IF;

  -- Leitura com comandos fixos por tabela (nada é montado a partir da entrada).
  CASE _table
    WHEN 'tasks' THEN SELECT t.workspace_id, t.owner_id, t.title, t.deleted_at IS NOT NULL INTO ws, owner, label, is_deleted FROM public.tasks t WHERE t.id = _id;
    WHEN 'notes' THEN SELECT t.workspace_id, t.owner_id, t.title, t.deleted_at IS NOT NULL INTO ws, owner, label, is_deleted FROM public.notes t WHERE t.id = _id;
    WHEN 'goals' THEN SELECT t.workspace_id, t.owner_id, t.title, t.deleted_at IS NOT NULL INTO ws, owner, label, is_deleted FROM public.goals t WHERE t.id = _id;
    WHEN 'contexts' THEN SELECT t.workspace_id, t.owner_id, t.name, t.deleted_at IS NOT NULL INTO ws, owner, label, is_deleted FROM public.contexts t WHERE t.id = _id;
    WHEN 'events' THEN SELECT t.workspace_id, t.owner_id, t.title, t.deleted_at IS NOT NULL INTO ws, owner, label, is_deleted FROM public.events t WHERE t.id = _id;
    WHEN 'purchases' THEN SELECT t.workspace_id, t.created_by, t.title, t.deleted_at IS NOT NULL INTO ws, owner, label, is_deleted FROM public.purchases t WHERE t.id = _id;
    ELSE RAISE EXCEPTION 'Tabela inválida.';
  END CASE;

  IF ws IS NULL OR NOT public.user_is_workspace_member(ws) THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  IF _table <> 'purchases' AND owner IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'Só quem criou pode excluir ou restaurar este item.' USING ERRCODE = '42501';
  END IF;

  IF _op = 'delete' THEN
    IF is_deleted THEN RETURN; END IF;
    CASE _table
      WHEN 'tasks' THEN UPDATE public.tasks SET deleted_at = now(), deleted_by = _uid WHERE id = _id;
      WHEN 'notes' THEN UPDATE public.notes SET deleted_at = now(), deleted_by = _uid WHERE id = _id;
      WHEN 'goals' THEN UPDATE public.goals SET deleted_at = now(), deleted_by = _uid WHERE id = _id;
      WHEN 'contexts' THEN UPDATE public.contexts SET deleted_at = now(), deleted_by = _uid WHERE id = _id;
      WHEN 'events' THEN UPDATE public.events SET deleted_at = now(), deleted_by = _uid WHERE id = _id;
      WHEN 'purchases' THEN UPDATE public.purchases SET deleted_at = now(), deleted_by = _uid WHERE id = _id;
    END CASE;
    PERFORM public.log_activity(ws, 'trashed', _table, label);
  ELSIF _op = 'restore' THEN
    IF NOT is_deleted THEN RETURN; END IF;
    CASE _table
      WHEN 'tasks' THEN UPDATE public.tasks SET deleted_at = NULL, deleted_by = NULL WHERE id = _id;
      WHEN 'notes' THEN UPDATE public.notes SET deleted_at = NULL, deleted_by = NULL WHERE id = _id;
      WHEN 'goals' THEN UPDATE public.goals SET deleted_at = NULL, deleted_by = NULL WHERE id = _id;
      WHEN 'contexts' THEN UPDATE public.contexts SET deleted_at = NULL, deleted_by = NULL WHERE id = _id;
      WHEN 'events' THEN UPDATE public.events SET deleted_at = NULL, deleted_by = NULL WHERE id = _id;
      WHEN 'purchases' THEN UPDATE public.purchases SET deleted_at = NULL, deleted_by = NULL WHERE id = _id;
    END CASE;
    PERFORM public.log_activity(ws, 'restored', _table, label);
  ELSE
    IF NOT is_deleted THEN RAISE EXCEPTION 'Mova para a lixeira antes de excluir definitivamente.'; END IF;
    CASE _table
      WHEN 'tasks' THEN DELETE FROM public.tasks WHERE id = _id;
      WHEN 'notes' THEN DELETE FROM public.notes WHERE id = _id;
      WHEN 'goals' THEN DELETE FROM public.goals WHERE id = _id;
      WHEN 'contexts' THEN DELETE FROM public.contexts WHERE id = _id;
      WHEN 'events' THEN DELETE FROM public.events WHERE id = _id;
      WHEN 'purchases' THEN DELETE FROM public.purchases WHERE id = _id;
    END CASE;
    PERFORM public.log_activity(ws, 'purged', _table, label);
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.trash_record(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trash_record(text, uuid, text) TO authenticated;