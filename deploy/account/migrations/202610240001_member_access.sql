-- Apply ONLY to the dedicated NOBI Photos TEST Supabase project.
-- Requires a full Supabase Auth/API installation; the Phase 5 database-only deployment is insufficient.
begin;
create or replace function public.nobi_member_access()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from auth.users
    where id = auth.uid() and email_confirmed_at is not null
      and (banned_until is null or banned_until < now())
  ) then '["beautify","compose","share"]'::jsonb else '[]'::jsonb end;
$$;
revoke all on function public.nobi_member_access() from public, anon;
grant execute on function public.nobi_member_access() to authenticated;
comment on function public.nobi_member_access() is
  'Free verified-email member features; no photo metadata, billing, user-editable roles or paid claims.';
commit;
