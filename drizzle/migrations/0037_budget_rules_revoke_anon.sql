REVOKE ALL ON public.budget_rules FROM anon, PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.budget_rules FROM authenticated;
REVOKE ALL ON FUNCTION public.budget_rules_validate() FROM PUBLIC, anon;