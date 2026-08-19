-- upgrade2.sql — societies weren't saving to the database.
--
-- Live testing (19 Aug 2026) shows every INSERT into societies is rejected
-- with "new row violates row-level security policy", even with a correct
-- owner_id. The live database's policies have drifted from schema.sql —
-- whatever is there now denies inserts. This drops every policy on the
-- societies table (including any stray restrictive one) and rebuilds the
-- four known-good policies. RLS itself stays enabled throughout.
--
-- Run in: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Expected result: "Success. No rows returned", then the final SELECT
-- lists exactly 4 policies.

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'societies'
  loop
    execute format('drop policy %I on societies', p.policyname);
  end loop;
end $$;

create policy "read own societies" on societies
  for select using (can_organise(id));

create policy "create societies" on societies
  for insert to authenticated with check (owner_id = auth.uid());

create policy "owner edits" on societies
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner deletes" on societies
  for delete to authenticated using (owner_id = auth.uid());

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'societies'
order by policyname;
