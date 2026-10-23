-- Operational trial records: anonymous until the visitor authenticates with the token.
create schema if not exists fiexea_guest_internal;
revoke all on schema fiexea_guest_internal from public;
grant usage on schema fiexea_guest_internal to anon,authenticated;
create table fiexea_guest_internal.trials (
 id uuid primary key default gen_random_uuid(),
 token_hash text unique not null,
 started_at timestamptz not null,
 ends_at timestamptz not null,
 last_seen_at timestamptz not null default now(),
 user_id uuid unique references auth.users(id) on delete set null,
 registered_at timestamptz,
 converted_at timestamptz,
 check(ends_at=started_at+interval '7 days')
);
alter table fiexea_guest_internal.trials enable row level security;
revoke all on fiexea_guest_internal.trials from public,anon,authenticated;
create index on fiexea_guest_internal.trials(started_at desc,id);
create function fiexea_guest_internal.trial_api(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare token text:=payload->>'token'; digest text; trial fiexea_guest_internal.trials; uid uuid:=auth.uid(); started timestamptz;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Identificador de prueba no válido'; end if;
 digest:=encode(sha256(convert_to(token,'UTF8')),'hex');
 if action='start' then
  -- A supplied legacy start can shorten a trial, never extend it beyond seven server days.
  started:=least(now(),coalesce((payload->>'started_at')::timestamptz,now()));
  insert into fiexea_guest_internal.trials(token_hash,started_at,ends_at)
  values(digest,started,started+interval '7 days') on conflict(token_hash) do nothing;
 elsif action not in ('status','claim') then raise exception 'Operación no válida'; end if;
 select * into trial from fiexea_guest_internal.trials where token_hash=digest for update;
 if not found then raise exception 'Prueba no encontrada'; end if;
 if action='claim' then
  if uid is null then raise exception 'Inicia sesión para continuar' using errcode='28000'; end if;
  if trial.user_id is not null and trial.user_id<>uid then raise exception 'Esta prueba está vinculada a otra cuenta'; end if;
  if not exists(select 1 from fiexea_guest_internal.trials where user_id=uid and id<>trial.id) then
   update fiexea_guest_internal.trials set user_id=uid,registered_at=coalesce(registered_at,now()),
    converted_at=case when exists(select 1 from public.subscriptions where user_id=uid and livemode and status='active' and current_period_end>now()) then coalesce(converted_at,now()) else converted_at end
    where id=trial.id;
  end if;
 end if;
 update fiexea_guest_internal.trials set last_seen_at=now() where id=trial.id returning * into trial;
 return jsonb_build_object('id',trial.id,'started_at',trial.started_at,'ends_at',trial.ends_at,'server_now',now(),'allowed',trial.ends_at>now());
end $$;
revoke all on function fiexea_guest_internal.trial_api(text,jsonb) from public;
grant execute on function fiexea_guest_internal.trial_api(text,jsonb) to anon,authenticated;
create function public.fiexea_guest_trial(action text,payload jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$select fiexea_guest_internal.trial_api(action,payload)$$;
revoke all on function public.fiexea_guest_trial(text,jsonb) from public;
grant execute on function public.fiexea_guest_trial(text,jsonb) to anon,authenticated;
create function fiexea_guest_internal.admin_trials(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb; summary jsonb; chosen text:=coalesce(payload->>'filter','all'); page_number integer:=greatest(0,least(100000,coalesce((payload->>'page')::integer,0)));
begin
 if uid is null or not exists(select 1 from private.fiexea_administrators where user_id=uid) then raise exception 'Acceso reservado al administrador' using errcode='42501'; end if;
 if chosen not in ('all','active','expired','registered','converted') then raise exception 'Filtro no válido'; end if;
 select jsonb_build_object('total',count(*),'active',count(*) filter(where user_id is null and converted_at is null and ends_at>now()),'expired',count(*) filter(where user_id is null and converted_at is null and ends_at<=now()),'registered',count(*) filter(where user_id is not null and converted_at is null),'converted',count(*) filter(where converted_at is not null)) into summary from fiexea_guest_internal.trials;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at desc,t.id),'[]'::jsonb) into result from (
  select * from (
   select g.id,g.started_at,g.ends_at,g.last_seen_at,g.registered_at,g.converted_at,u.email,
    case when g.converted_at is not null then 'converted' when g.user_id is not null then 'registered' when g.ends_at>now() then 'active' else 'expired' end as state
   from fiexea_guest_internal.trials g left join auth.users u on u.id=g.user_id
  ) items where chosen='all' or state=chosen order by started_at desc,id limit 50 offset page_number*50
 ) t;
 return jsonb_build_object('summary',summary,'rows',result,'page',page_number,'server_now',now());
end $$;
revoke all on function fiexea_guest_internal.admin_trials(jsonb) from public,anon;
grant execute on function fiexea_guest_internal.admin_trials(jsonb) to authenticated;
create function public.fiexea_admin_trials(payload jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$select fiexea_guest_internal.admin_trials(payload)$$;
revoke all on function public.fiexea_admin_trials(jsonb) from public,anon;
grant execute on function public.fiexea_admin_trials(jsonb) to authenticated;
create function fiexea_guest_internal.record_conversion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.livemode and new.status='active' and new.current_period_end>now() then
  update fiexea_guest_internal.trials set converted_at=coalesce(converted_at,now()) where user_id=new.user_id;
 end if;
 return new;
end $$;
revoke all on function fiexea_guest_internal.record_conversion() from public,anon,authenticated;
create trigger fiexea_guest_trial_conversion after insert or update on public.subscriptions for each row execute function fiexea_guest_internal.record_conversion();
