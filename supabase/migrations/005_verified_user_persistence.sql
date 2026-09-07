-- Apply after 001-004. Enable the deployment database switch only after RLS checks.
begin;
alter table public.inspections drop constraint if exists inspections_status_check;
alter table public.inspections add constraint inspections_status_check
  check (status in ('PASS', 'FAIL', 'REVIEW', 'NOT_APPLICABLE'));
-- Newly written records must faithfully index their canonical outcome.
-- NOT VALID avoids rewriting/rejecting existing data; new writes are still checked.
alter table public.inspections add constraint inspections_report_status_matches
  check (report #>> '{summary,overall_status}' is not null
    and status = report #>> '{summary,overall_status}') not valid;

-- Anonymous Auth sessions also use the authenticated database role. Deny them explicitly.
create policy "Verified accounts only" on public.inspections as restrictive
  for all to authenticated
  using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'true') = 'false')
  with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'true') = 'false');
create policy "Verified profiles only" on public.profiles as restrictive
  for all to authenticated
  using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'true') = 'false')
  with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'true') = 'false');

-- Reports are immutable in this release. Ownership and original outcomes cannot be edited.
revoke update, delete on public.inspections from authenticated;
drop policy if exists "Users can update their own inspections" on public.inspections;
drop policy if exists "Users can delete their own inspections" on public.inspections;
-- 004 already restricts profile updates to non-privileged columns; preserve that grant.
revoke all on function public.handle_new_user() from public, anon, authenticated;
insert into public.profiles (id, full_name)
  select id, coalesce(raw_user_meta_data ->> 'full_name', '') from auth.users
  on conflict (id) do nothing;
commit;
