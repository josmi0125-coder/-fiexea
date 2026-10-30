-- Guest trials run for seven days in the browser. Registration must not grant a second trial.
-- Preserve all existing paid, administrator, invitation and legacy account entitlements.
create or replace function private.fiexea_register_trial() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
 if tg_table_schema <> 'auth' or tg_table_name <> 'users' or tg_op <> 'INSERT' then raise exception 'Invalid trial trigger'; end if;
 if actor is not null and actor <> new.id then raise exception 'Account identity mismatch'; end if;
 insert into private.fiexea_account_access(user_id,trial_started_at,trial_ends_at)
 values(new.id,new.created_at,new.created_at);
 return new;
end $$;
revoke all on function private.fiexea_register_trial() from public,anon,authenticated;
