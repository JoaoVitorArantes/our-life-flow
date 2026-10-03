-- Guard for fresh databases: the demo flag must exist before the trigger/RPCs below reference it.
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 1) Realtime publication (idempotent)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces','workspace_members','workspace_relationships','accounts','cards','card_invoice_payments','categories','transactions','transaction_splits','transaction_payers','installments','installment_plans','recurring_transactions','loans','financings','settlements','events','tasks','goals','goal_contributions','notes','contexts','purchases','physical_activities','routines','routine_logs','ai_conversations','ai_messages'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) workspaces.is_demo can only be changed by an administrator (SQL/service role), never by app users
CREATE OR REPLACE FUNCTION public.protect_workspace_demo_flag()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF _role IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' AND NEW.is_demo THEN
      RAISE EXCEPTION 'Somente um administrador pode marcar um workspace como demonstração.';
    ELSIF TG_OP = 'UPDATE' AND NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
      RAISE EXCEPTION 'Somente um administrador pode alterar o modo demonstração.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_workspace_demo_flag ON public.workspaces;
CREATE TRIGGER protect_workspace_demo_flag BEFORE INSERT OR UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_demo_flag();

-- 3) Atomic reset: deletes only is_demo rows of a workspace explicitly flagged as demo
CREATE OR REPLACE FUNCTION public.reset_demo_workspace(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(_workspace_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND is_demo) THEN
    RAISE EXCEPTION 'Este workspace não é de demonstração.';
  END IF;
  DELETE FROM public.settlements WHERE workspace_id = _workspace_id AND transaction_id IN (SELECT id FROM public.transactions WHERE workspace_id = _workspace_id AND is_demo);
  DELETE FROM public.transactions WHERE workspace_id = _workspace_id AND is_demo;
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
  DELETE FROM public.cards WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.accounts WHERE workspace_id = _workspace_id AND is_demo;
END $$;

-- 4) Atomic seed of fictitious data, only inside a demo workspace
CREATE OR REPLACE FUNCTION public.seed_demo_workspace(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _acc1 uuid; _acc2 uuid; _card uuid; _ctx_trip uuid; _ctx_course uuid;
  _goal1 uuid; _goal2 uuid; _plan uuid; _rec uuid; _loan uuid;
  _cat_food uuid; _cat_home uuid; _cat_transp uuid; _cat_fun uuid; _cat_salary uuid; _cat_study uuid; _cat_health uuid;
  _d date := current_date;
BEGIN
  IF _uid IS NULL OR NOT public.is_workspace_member(_workspace_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND is_demo) THEN
    RAISE EXCEPTION 'Este workspace não é de demonstração.';
  END IF;
  PERFORM public.reset_demo_workspace(_workspace_id);

  SELECT id INTO _cat_food FROM categories WHERE workspace_id=_workspace_id AND name='Alimentação' LIMIT 1;
  SELECT id INTO _cat_home FROM categories WHERE workspace_id=_workspace_id AND name='Moradia' LIMIT 1;
  SELECT id INTO _cat_transp FROM categories WHERE workspace_id=_workspace_id AND name='Transporte' LIMIT 1;
  SELECT id INTO _cat_fun FROM categories WHERE workspace_id=_workspace_id AND name='Lazer' LIMIT 1;
  SELECT id INTO _cat_salary FROM categories WHERE workspace_id=_workspace_id AND name='Salário' LIMIT 1;
  SELECT id INTO _cat_study FROM categories WHERE workspace_id=_workspace_id AND name='Faculdade' LIMIT 1;
  SELECT id INTO _cat_health FROM categories WHERE workspace_id=_workspace_id AND name='Saúde' LIMIT 1;

  INSERT INTO accounts (workspace_id, owner_id, name, institution, account_type, initial_balance, current_balance, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Conta Demo','Banco Fictício','CHECKING',4200,4200,'SHARED',true) RETURNING id INTO _acc1;
  INSERT INTO accounts (workspace_id, owner_id, name, institution, account_type, initial_balance, current_balance, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Reserva Demo','Banco Exemplo','SAVINGS',2500,2500,'SHARED',true) RETURNING id INTO _acc2;
  INSERT INTO cards (workspace_id, owner_id, name, institution, credit_limit, closing_day, due_day, payment_account_id, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Cartão Demo','Banco Fictício',3000,3,10,_acc1,'SHARED',true) RETURNING id INTO _card;

  INSERT INTO contexts (workspace_id, owner_id, name, description, type, start_date, end_date, location, visibility, status, budget_amount, is_demo)
  VALUES (_workspace_id,_uid,'Viagem de férias','Contexto fictício para demonstrar orçamento por projeto.','TRIP',_d+30,_d+37,'Cidade Exemplo','SHARED','PLANNED',3500,true) RETURNING id INTO _ctx_trip;
  INSERT INTO contexts (workspace_id, owner_id, name, description, type, start_date, visibility, status, is_demo)
  VALUES (_workspace_id,_uid,'Semestre letivo','Disciplinas, entregas e gastos de estudo.','COLLEGE',_d-60,'SHARED','ACTIVE',true) RETURNING id INTO _ctx_course;

  INSERT INTO recurring_transactions (workspace_id, owner_id, description, amount, type, category_id, account_id, frequency, start_date, next_date, due_day, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Aluguel (exemplo)',1300,'EXPENSE',_cat_home,_acc1,'MONTHLY',_d-90,_d+5,5,'SHARED',true) RETURNING id INTO _rec;
  INSERT INTO recurring_transactions (workspace_id, owner_id, description, amount, type, category_id, account_id, frequency, start_date, next_date, due_day, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Salário (exemplo)',5800,'INCOME',_cat_salary,_acc1,'MONTHLY',_d-90,_d+20,5,'SHARED',true);

  INSERT INTO installment_plans (workspace_id, owner_id, description, total_amount, total_installments, installment_amount, start_date, category_id, card_id, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Notebook (exemplo)',3600,12,300,_d-30,_cat_study,_card,'SHARED',true) RETURNING id INTO _plan;

  INSERT INTO loans (workspace_id, owner_id, type, person_name, description, total_amount, total_installments, installment_amount, start_date, due_day, account_id, visibility, is_demo)
  VALUES (_workspace_id,_uid,'LENT','Pessoa Exemplo','Empréstimo fictício',600,3,200,_d-15,15,_acc1,'SHARED',true) RETURNING id INTO _loan;

  INSERT INTO financings (workspace_id, owner_id, name, description, financed_amount, total_installments, installment_amount, interest_rate, start_date, due_day, account_id, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Moto (exemplo)','Financiamento fictício',12000,36,420,1.2,_d-120,20,_acc1,'SHARED',true);

  INSERT INTO transactions (workspace_id, owner_id, type, amount, description, transaction_date, category_id, account_id, card_id, context_id, visibility, is_shared, status, paid_at, due_date, installment_plan_id, installment_number, recurring_id, loan_id, is_demo) VALUES
  (_workspace_id,_uid,'INCOME',5800,'Salário (exemplo)',_d-12,_cat_salary,_acc1,NULL,NULL,'SHARED',false,'PAID',_d-12,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',1300,'Aluguel (exemplo)',_d-7,_cat_home,_acc1,NULL,NULL,'SHARED',false,'PAID',_d-7,_d-7,NULL,NULL,_rec,NULL,true),
  (_workspace_id,_uid,'EXPENSE',1300,'Aluguel (exemplo)',_d+23,_cat_home,_acc1,NULL,NULL,'SHARED',false,'PENDING',NULL,_d+23,NULL,NULL,_rec,NULL,true),
  (_workspace_id,_uid,'EXPENSE',245.9,'Mercado do mês',_d-5,_cat_food,_acc1,NULL,NULL,'SHARED',false,'PAID',_d-5,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',38.5,'Almoço',_d-1,_cat_food,NULL,_card,NULL,'SHARED',false,'PENDING',NULL,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',89.9,'Transporte por app',_d-3,_cat_transp,NULL,_card,NULL,'SHARED',false,'PENDING',NULL,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',120,'Cinema e jantar',_d-2,_cat_fun,_acc1,NULL,NULL,'SHARED',false,'PAID',_d-2,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',75,'Farmácia',_d-8,_cat_health,_acc1,NULL,NULL,'SHARED',false,'PAID',_d-8,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',180,'Livros do semestre',_d-20,_cat_study,_acc1,NULL,_ctx_course,'SHARED',false,'PAID',_d-20,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',650,'Reserva de hospedagem',_d-4,_cat_fun,_acc1,NULL,_ctx_trip,'SHARED',false,'PAID',_d-4,NULL,NULL,NULL,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',300,'Notebook (exemplo) 1/12',_d-30,_cat_study,NULL,_card,NULL,'SHARED',false,'PAID',_d-20,NULL,_plan,1,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',300,'Notebook (exemplo) 2/12',_d,_cat_study,NULL,_card,NULL,'SHARED',false,'PENDING',NULL,NULL,_plan,2,NULL,NULL,true),
  (_workspace_id,_uid,'EXPENSE',200,'Empréstimo a Pessoa Exemplo',_d-15,NULL,_acc1,NULL,NULL,'SHARED',false,'PAID',_d-15,NULL,NULL,NULL,NULL,_loan,true);

  INSERT INTO goals (workspace_id, owner_id, title, description, target_amount, current_amount, due_date, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Reserva de emergência','Meta fictícia de 6 meses de custos.',15000,2500,_d+300,'SHARED',true) RETURNING id INTO _goal1;
  INSERT INTO goals (workspace_id, owner_id, title, target_amount, current_amount, due_date, context_id, visibility, is_demo)
  VALUES (_workspace_id,_uid,'Viagem de férias',3500,900,_d+30,_ctx_trip,'SHARED',true) RETURNING id INTO _goal2;
  INSERT INTO goal_contributions (goal_id, user_id, workspace_id, amount, contribution_date, description, is_demo) VALUES
  (_goal1,_uid,_workspace_id,2500,_d-40,'Aporte inicial (exemplo)',true),
  (_goal2,_uid,_workspace_id,900,_d-10,'Aporte (exemplo)',true);

  INSERT INTO events (workspace_id, owner_id, title, description, starts_at, ends_at, location, context_id, visibility, is_demo) VALUES
  (_workspace_id,_uid,'Aula de Estruturas de Dados',NULL,(_d + time '19:00')::timestamptz,(_d + time '21:00')::timestamptz,'Campus Exemplo',_ctx_course,'SHARED',true),
  (_workspace_id,_uid,'Apresentação do projeto',NULL,(_d+2 + time '10:00')::timestamptz,(_d+2 + time '11:00')::timestamptz,'Sala 101',_ctx_course,'SHARED',true),
  (_workspace_id,_uid,'Consulta médica (exemplo)',NULL,(_d+4 + time '15:00')::timestamptz,NULL,NULL,NULL,'SHARED',true);

  INSERT INTO tasks (workspace_id, owner_id, title, notes, due_date, status, context_id, visibility, is_demo) VALUES
  (_workspace_id,_uid,'Entregar relatório técnico',NULL,_d+3,'TODO',_ctx_course,'SHARED',true),
  (_workspace_id,_uid,'Pagar fatura do Cartão Demo',NULL,_d+6,'TODO',NULL,'SHARED',true),
  (_workspace_id,_uid,'Comprar passagens da viagem',NULL,_d+10,'DOING',_ctx_trip,'SHARED',true),
  (_workspace_id,_uid,'Revisar orçamento do mês',NULL,_d-1,'DONE',NULL,'SHARED',true);

  INSERT INTO notes (workspace_id, owner_id, title, content, note_date, context_id, visibility, is_demo) VALUES
  (_workspace_id,_uid,'Roteiro da viagem','Dia 1: chegada. Dia 2: centro histórico. (conteúdo fictício)',_d,_ctx_trip,'SHARED',true),
  (_workspace_id,_uid,'Ideias para o TCC','Arquitetura com RLS, Realtime e agente de IA com ferramentas controladas.',_d-3,_ctx_course,'SHARED',true);
END $$;

REVOKE ALL ON FUNCTION public.reset_demo_workspace(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_demo_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_demo_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_workspace(uuid) TO authenticated;