REVOKE ALL ON public.wedding_gifts, public.wedding_gift_pledges, public.wedding_gift_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_gifts TO authenticated;
GRANT SELECT ON public.wedding_gift_pledges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wedding_gift_settings TO authenticated;