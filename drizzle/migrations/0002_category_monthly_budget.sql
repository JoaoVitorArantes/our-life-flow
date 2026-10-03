ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS monthly_budget numeric;
CREATE POLICY "Members update categories" ON public.categories FOR UPDATE TO authenticated USING (public.user_is_workspace_member(workspace_id)) WITH CHECK (public.user_is_workspace_member(workspace_id));
GRANT UPDATE ON public.categories TO authenticated;