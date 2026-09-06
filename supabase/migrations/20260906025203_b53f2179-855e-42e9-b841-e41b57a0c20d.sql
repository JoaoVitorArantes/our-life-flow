-- Recalcula o acerto (settlement) de uma despesa dividida, de forma idempotente.
CREATE OR REPLACE FUNCTION public.rebuild_transaction_settlement(_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.transactions%ROWTYPE;
  _members uuid[];
  _member_count int;
  _net jsonb := '{}'::jsonb;
  _uid uuid;
  _val numeric;
  _creditor uuid;
  _debtor uuid;
  _credit numeric := 0;
  _debit numeric := 0;
  _paid_signed numeric := 0;
  _low uuid;
  _high uuid;
  _signed numeric;
  _amount numeric;
  _pending public.settlements%ROWTYPE;
  _has_splits boolean;
  _has_payers boolean;
BEGIN
  SELECT * INTO t FROM public.transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT array_agg(user_id ORDER BY user_id) INTO _members
  FROM public.workspace_members WHERE workspace_id = t.workspace_id;
  _member_count := coalesce(array_length(_members, 1), 0);

  -- despesa não dividida / cancelada / transferência: remove pendente e sai
  IF t.is_shared IS NOT TRUE OR t.status = 'CANCELLED' OR t.type = 'TRANSFER' OR _member_count < 2 THEN
    DELETE FROM public.settlements
     WHERE transaction_id = _transaction_id AND status = 'PENDING';
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.transaction_splits WHERE transaction_id = _transaction_id) INTO _has_splits;
  SELECT EXISTS (SELECT 1 FROM public.transaction_payers WHERE transaction_id = _transaction_id) INTO _has_payers;

  -- responsabilidade (negativa no saldo)
  IF _has_splits THEN
    FOR _uid, _val IN SELECT user_id, sum(amount) FROM public.transaction_splits
      WHERE transaction_id = _transaction_id GROUP BY user_id
    LOOP
      _net := jsonb_set(_net, ARRAY[_uid::text],
        to_jsonb(coalesce((_net ->> _uid::text)::numeric, 0) - _val));
    END LOOP;
  ELSE
    FOREACH _uid IN ARRAY _members LOOP
      _net := jsonb_set(_net, ARRAY[_uid::text],
        to_jsonb(coalesce((_net ->> _uid::text)::numeric, 0)
          - round(t.amount / _member_count, 2)));
    END LOOP;
  END IF;

  -- pagamento efetivo (positivo no saldo)
  IF _has_payers THEN
    FOR _uid, _val IN SELECT user_id, sum(amount) FROM public.transaction_payers
      WHERE transaction_id = _transaction_id GROUP BY user_id
    LOOP
      _net := jsonb_set(_net, ARRAY[_uid::text],
        to_jsonb(coalesce((_net ->> _uid::text)::numeric, 0) + _val));
    END LOOP;
  ELSE
    _net := jsonb_set(_net, ARRAY[t.owner_id::text],
      to_jsonb(coalesce((_net ->> t.owner_id::text)::numeric, 0) + t.amount));
  END IF;

  FOR _uid, _val IN SELECT key::uuid, value::numeric FROM jsonb_each_text(_net) LOOP
    IF _val > _credit THEN _credit := _val; _creditor := _uid; END IF;
    IF _val < _debit THEN _debit := _val; _debtor := _uid; END IF;
  END LOOP;

  IF _creditor IS NULL OR _debtor IS NULL THEN
    DELETE FROM public.settlements
     WHERE transaction_id = _transaction_id AND status = 'PENDING';
    RETURN;
  END IF;

  IF _creditor < _debtor THEN _low := _creditor; _high := _debtor;
  ELSE _low := _debtor; _high := _creditor; END IF;

  -- valor devido no sentido low -> high (positivo) ou high -> low (negativo)
  _amount := round(least(_credit, -_debit), 2);
  IF _debtor = _low THEN _signed := _amount; ELSE _signed := -_amount; END IF;

  -- acertos já quitados desta despesa entram como valor já pago
  SELECT coalesce(sum(CASE WHEN from_user_id = _low THEN amount ELSE -amount END), 0)
    INTO _paid_signed
    FROM public.settlements
   WHERE transaction_id = _transaction_id AND status = 'SETTLED';

  _signed := round(_signed - _paid_signed, 2);

  SELECT * INTO _pending FROM public.settlements
   WHERE transaction_id = _transaction_id AND status = 'PENDING' LIMIT 1;

  IF abs(_signed) < 0.01 THEN
    IF _pending.id IS NOT NULL THEN
      DELETE FROM public.settlements WHERE id = _pending.id;
    END IF;
    RETURN;
  END IF;

  IF _signed > 0 THEN _debtor := _low; _creditor := _high;
  ELSE _debtor := _high; _creditor := _low; END IF;
  _amount := abs(_signed);

  IF _pending.id IS NOT NULL THEN
    UPDATE public.settlements
       SET from_user_id = _debtor,
           to_user_id = _creditor,
           amount = _amount,
           note = coalesce(nullif(_pending.note, ''), t.description)
     WHERE id = _pending.id
       AND (from_user_id IS DISTINCT FROM _debtor
         OR to_user_id IS DISTINCT FROM _creditor
         OR amount IS DISTINCT FROM _amount);
  ELSE
    INSERT INTO public.settlements
      (workspace_id, transaction_id, from_user_id, to_user_id, amount, status, note)
    VALUES (t.workspace_id, _transaction_id, _debtor, _creditor, _amount, 'PENDING', t.description);
  END IF;
END;
$$;

-- Reprocessa todas as despesas divididas (opcionalmente de um espaço).
CREATE OR REPLACE FUNCTION public.rebuild_settlements(_workspace_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid; _count int := 0;
BEGIN
  FOR _id IN
    SELECT id FROM public.transactions
     WHERE is_shared IS TRUE
       AND (_workspace_id IS NULL OR workspace_id = _workspace_id)
  LOOP
    PERFORM public.rebuild_transaction_settlement(_id);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_transaction_settlement(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rebuild_settlements(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rebuild_transaction_settlement(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_settlements(uuid) TO authenticated, service_role;

-- Mantém o acerto sincronizado com a despesa, a divisão e o pagamento.
CREATE OR REPLACE FUNCTION public.trg_rebuild_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _tid uuid;
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    _tid := coalesce(NEW.id, OLD.id);
  ELSE
    _tid := coalesce(NEW.transaction_id, OLD.transaction_id);
  END IF;
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'transactions' THEN
    RETURN OLD;
  END IF;
  PERFORM public.rebuild_transaction_settlement(_tid);
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS transactions_rebuild_settlement ON public.transactions;
CREATE TRIGGER transactions_rebuild_settlement
AFTER INSERT OR UPDATE OF amount, is_shared, status, owner_id, description ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_rebuild_settlement();

DROP TRIGGER IF EXISTS splits_rebuild_settlement ON public.transaction_splits;
CREATE TRIGGER splits_rebuild_settlement
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_splits
FOR EACH ROW EXECUTE FUNCTION public.trg_rebuild_settlement();

DROP TRIGGER IF EXISTS payers_rebuild_settlement ON public.transaction_payers;
CREATE TRIGGER payers_rebuild_settlement
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_payers
FOR EACH ROW EXECUTE FUNCTION public.trg_rebuild_settlement();