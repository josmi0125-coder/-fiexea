create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.fiexea_email_trials (
 email_hash text primary key,
 started_at timestamptz not null,
 ends_at timestamptz not null,
 constraint fiexea_trial_length check (ends_at = started_at + interval '72 hours')
);
create table private.fiexea_account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 trial_started_at timestamptz not null,
 trial_ends_at timestamptz not null,
 existing_access boolean not null default false
);
alter table private.fiexea_email_trials enable row level security;
alter table private.fiexea_account_access enable row level security;
revoke all on private.fiexea_email_trials, private.fiexea_account_access from public,anon,authenticated;

-- Preserve access for accounts that existed before the new public registration flow.
insert into private.fiexea_email_trials(email_hash,started_at,ends_at)
select encode(sha256(convert_to(lower(btrim(coalesce(email,id::text))),'UTF8')),'hex'), min(created_at), min(created_at)+interval '72 hours'
from auth.users group by 1;
insert into private.fiexea_account_access(user_id,trial_started_at,trial_ends_at,existing_access)
select id,created_at,created_at+interval '72 hours',true from auth.users;

create function private.fiexea_register_trial() returns trigger
language plpgsql security definer set search_path = '' as $$
declare trial private.fiexea_email_trials; actor uuid := auth.uid(); normalized_hash text;
begin
 if tg_table_schema <> 'auth' or tg_table_name <> 'users' or tg_op <> 'INSERT' then raise exception 'Invalid trial trigger'; end if;
 if actor is not null and actor <> new.id then raise exception 'Account identity mismatch'; end if;
 normalized_hash := encode(sha256(convert_to(lower(btrim(coalesce(new.email,new.id::text))),'UTF8')),'hex');
 insert into private.fiexea_email_trials(email_hash,started_at,ends_at)
 values(normalized_hash,new.created_at,new.created_at+interval '72 hours') on conflict(email_hash) do nothing;
 select * into strict trial from private.fiexea_email_trials where email_hash=normalized_hash;
 insert into private.fiexea_account_access(user_id,trial_started_at,trial_ends_at)
 values(new.id,trial.started_at,trial.ends_at);
 return new;
end $$;
revoke all on function private.fiexea_register_trial() from public,anon,authenticated;
create trigger fiexea_register_trial after insert on auth.users for each row execute function private.fiexea_register_trial();

alter table public.subscriptions add column if not exists livemode boolean not null default false;
create index if not exists fiexea_live_subscription_access_idx on public.subscriptions(user_id,current_period_end) where livemode and status='active';

create function private.fiexea_access_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); account private.fiexea_account_access; paid_until timestamptz; current_time_at_server timestamptz := now();
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into account from private.fiexea_account_access where user_id=uid;
 if not found then return jsonb_build_object('allowed',false,'state','unavailable','server_now',current_time_at_server); end if;
 select max(current_period_end) into paid_until from public.subscriptions where user_id=uid and livemode and status='active' and current_period_end>current_time_at_server;
 return jsonb_build_object('allowed',account.existing_access or paid_until is not null or account.trial_ends_at>current_time_at_server,
 'state',case when account.existing_access then 'existing' when paid_until is not null then 'paid' when account.trial_ends_at>current_time_at_server then 'trial' else 'expired' end,
 'trial_started_at',account.trial_started_at,'trial_ends_at',account.trial_ends_at,'paid_until',paid_until,'server_now',current_time_at_server);
end $$;
revoke all on function private.fiexea_access_state() from public,anon;
grant execute on function private.fiexea_access_state() to authenticated;
create function public.fiexea_access_status() returns jsonb language sql stable security invoker set search_path = '' as $$select private.fiexea_access_state()$$;
revoke all on function public.fiexea_access_status() from public,anon;
grant execute on function public.fiexea_access_status() to authenticated;
create function private.fiexea_has_access() returns boolean language sql stable security invoker set search_path = '' as $$select coalesce((private.fiexea_access_state()->>'allowed')::boolean,false)$$;
revoke all on function private.fiexea_has_access() from public,anon;
grant execute on function private.fiexea_has_access() to authenticated;

-- Restrictive policies combine with the existing ownership policies; clients cannot bypass expiry.
create policy fiexea_trial_read on public.fiexea_financial_data as restrictive for select to authenticated using ((select private.fiexea_has_access()));
create policy fiexea_trial_insert on public.fiexea_financial_data as restrictive for insert to authenticated with check ((select private.fiexea_has_access()));
create policy fiexea_trial_update on public.fiexea_financial_data as restrictive for update to authenticated using ((select private.fiexea_has_access())) with check ((select private.fiexea_has_access()));
create policy fiexea_trial_avatar_read on storage.objects as restrictive for select to authenticated using (bucket_id<>'profile-avatars' or (select private.fiexea_has_access()));
create policy fiexea_trial_avatar_insert on storage.objects as restrictive for insert to authenticated with check (bucket_id<>'profile-avatars' or (select private.fiexea_has_access()));
create policy fiexea_trial_avatar_update on storage.objects as restrictive for update to authenticated using (bucket_id<>'profile-avatars' or (select private.fiexea_has_access())) with check (bucket_id<>'profile-avatars' or (select private.fiexea_has_access()));
