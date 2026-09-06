DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_movement_type') THEN
    CREATE TYPE public.goal_movement_type AS ENUM ('CONTRIBUTION', 'WITHDRAWAL');
  END IF;
END $$;

ALTER TABLE public.goal_contributions
  ADD COLUMN IF NOT EXISTS movement_type public.goal_movement_type NOT NULL DEFAULT 'CONTRIBUTION';

UPDATE public.goal_contributions SET movement_type = 'WITHDRAWAL' WHERE amount < 0;
UPDATE public.goal_contributions SET amount = abs(amount) WHERE amount < 0;
DELETE FROM public.goal_contributions WHERE amount = 0;

ALTER TABLE public.goal_contributions
  DROP CONSTRAINT IF EXISTS goal_contributions_amount_positive;
ALTER TABLE public.goal_contributions
  ADD CONSTRAINT goal_contributions_amount_positive CHECK (amount > 0);

ALTER TABLE public.goal_contributions ALTER COLUMN goal_id SET NOT NULL;