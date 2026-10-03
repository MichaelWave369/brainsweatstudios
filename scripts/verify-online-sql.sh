#!/usr/bin/env bash
set -euo pipefail
# Run only against the isolated CI database, never an existing user project.
psql -X -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
SQL
for migration in supabase/migrations/*.sql; do
  psql -X -v ON_ERROR_STOP=1 -f "$migration"
done
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.bs_online'::regclass) then
    raise exception 'RLS must be enabled';
  end if;
  if has_table_privilege('anon', 'public.bs_online', 'select')
    or has_table_privilege('authenticated', 'public.bs_online', 'select')
    or has_table_privilege('anon', 'public.bs_online', 'insert')
    or has_table_privilege('authenticated', 'public.bs_online', 'update') then
    raise exception 'Browser roles must have no table access';
  end if;
  if not has_table_privilege('service_role', 'public.bs_online', 'select,insert,update,delete') then
    raise exception 'Explicit service grants are required';
  end if;
end $$;
set role service_role;
insert into public.bs_online (id, bucket, lookup, data, expires_at)
values ('11111111-1111-4111-8111-111111111111', 'room', 'room:SQLCHECK',
        '{"members":[{"id":"22222222-2222-4222-8222-222222222222"}]}', now() + interval '1 day');
do $$
begin
  if (select count(*) from public.bs_online where data->'members' @> '[{"id":"22222222-2222-4222-8222-222222222222"}]') <> 1 then
    raise exception 'Membership lookup failed';
  end if;
end $$;
SQL
online_cas_dir=$(mktemp -d)
trap 'rm -rf "$online_cas_dir"' EXIT
for attempt in 1 2; do
  psql -X -At -v ON_ERROR_STOP=1 -c "with changed as (update public.bs_online set version=1 where id='11111111-1111-4111-8111-111111111111' and version=0 returning id) select count(*) from changed;" > "$online_cas_dir/$attempt" &
done
wait
online_changed=$(cat "$online_cas_dir/1" "$online_cas_dir/2")
if [ "$(printf '%s\n' "$online_changed" | sort | tr '\n' ' ')" != "0 1 " ]; then
  printf 'Atomic update check failed\n'
  exit 1
fi
printf 'Online SQL passed: RLS, denied browser access, explicit service grants, membership lookup, and one winner under simultaneous updates.\n'
