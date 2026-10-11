-- ============================================================================
-- EnergyIT — security hardening (Supabase advisor findings)
--   - pin search_path on set_updated_at (was mutable)
--   - trigger-only functions have no business being called directly via
--     PostgREST RPC by anon/authenticated; revoke that exposure
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.prevent_role_self_escalation() from anon, authenticated;
revoke execute on function public.log_account_change() from anon, authenticated;
revoke execute on function public.log_catalog_change() from anon, authenticated;
