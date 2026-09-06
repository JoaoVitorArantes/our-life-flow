CREATE OR REPLACE FUNCTION public.validate_workspace_references()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'cards' THEN
    IF NEW.payment_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.payment_account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta de pagamento pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME = 'transactions' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Categoria pertence a outro workspace.'; END IF;
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cards WHERE id=NEW.card_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Cartão pertence a outro workspace.'; END IF;
    IF NEW.source_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.source_account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta de origem pertence a outro workspace.'; END IF;
    IF NEW.destination_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.destination_account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta de destino pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
    IF NEW.installment_plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.installment_plans WHERE id=NEW.installment_plan_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Parcelamento pertence a outro workspace.'; END IF;
    IF NEW.recurring_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.recurring_transactions WHERE id=NEW.recurring_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Recorrência pertence a outro workspace.'; END IF;
    IF NEW.loan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.loans WHERE id=NEW.loan_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Empréstimo pertence a outro workspace.'; END IF;
    IF NEW.financing_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.financings WHERE id=NEW.financing_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Financiamento pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME IN ('events','goals','notes','tasks') THEN
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME = 'recurring_transactions' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Categoria pertence a outro workspace.'; END IF;
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cards WHERE id=NEW.card_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Cartão pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME IN ('financings','installment_plans') THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Categoria pertence a outro workspace.'; END IF;
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
  ELSIF TG_TABLE_NAME = 'loans' THEN
    IF NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.accounts WHERE id=NEW.account_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Conta pertence a outro workspace.'; END IF;
    IF NEW.context_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contexts WHERE id=NEW.context_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Contexto pertence a outro workspace.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;