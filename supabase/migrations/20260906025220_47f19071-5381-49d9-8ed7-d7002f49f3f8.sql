REVOKE EXECUTE ON FUNCTION public.trg_rebuild_settlement() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rebuild_transaction_settlement(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rebuild_settlements(uuid) FROM authenticated;