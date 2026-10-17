create table private.fiexea_administrators(user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.fiexea_administrators enable row level security;
revoke all on private.fiexea_administrators from public,anon,authenticated;
insert into private.fiexea_administrators values ('d9b8c47d-5650-4f17-9358-2c11e30f26c5');
create table private.fiexea_invitations(
 id uuid primary key default gen_random_uuid(), token_hash text unique not null,
 email text not null, label text not null default '', created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), redeem_by timestamptz not null,
 duration_days integer check(duration_days between 1 and 365), fixed_end timestamptz,
 redeemed_by uuid references auth.users(id) on delete set null, redeemed_at timestamptz,
 access_until timestamptz, revoked_at timestamptz,
 check ((duration_days is null) <> (fixed_end is null))
);
alter table private.fiexea_invitations enable row level security;
revoke all on private.fiexea_invitations from public,anon,authenticated;
create index on private.fiexea_invitations(redeemed_by);
create function private.fiexea_invitation_api(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); admin boolean; inv private.fiexea_invitations; token text; target_email text; days integer; deadline timestamptz; output jsonb;
begin
 if uid is null then raise exception 'Inicia sesión para continuar' using errcode='28000'; end if;
 select exists(select 1 from private.fiexea_administrators where user_id=uid) into admin;
 if action='status' then return jsonb_build_object('admin',admin); end if;
 if action='redeem' then
  token:=payload->>'token';
  if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Invitación no válida'; end if;
  select * into inv from private.fiexea_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
  if not found then raise exception 'Invitación no válida'; end if;
  select lower(btrim(email)) into target_email from auth.users where id=uid and email_confirmed_at is not null;
  if target_email is null or target_email<>inv.email then raise exception 'Confirma tu correo e inicia sesión con el correo destinatario de la invitación'; end if;
  if inv.revoked_at is not null then raise exception 'Invitación desactivada'; end if;
  if inv.redeemed_by=uid then return jsonb_build_object('activated',true,'access_until',inv.access_until); end if;
  if inv.redeemed_at is not null then raise exception 'Invitación ya utilizada'; end if;
  if inv.redeem_by<=now() or coalesce(inv.fixed_end,'infinity'::timestamptz)<=now() then raise exception 'Invitación caducada'; end if;
  deadline:=coalesce(inv.fixed_end,now()+make_interval(days=>inv.duration_days));
  update private.fiexea_invitations set redeemed_by=uid,redeemed_at=now(),access_until=deadline where id=inv.id;
  return jsonb_build_object('activated',true,'access_until',deadline);
 end if;
 if not admin then raise exception 'Solo administración' using errcode='42501'; end if;
 if action='list' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into output from (
   select id,email,label,created_at,redeem_by,duration_days,fixed_end,redeemed_at,access_until,revoked_at,
    case when revoked_at is not null then 'Desactivada' when redeemed_at is not null and access_until>now() then 'Activa' when redeemed_at is not null then 'Caducada' when redeem_by<=now() or fixed_end<=now() then 'Caducada' else 'Pendiente' end as status
   from private.fiexea_invitations order by created_at desc limit 500
  ) t;
  return output;
 elsif action='create' then
  target_email:=lower(btrim(payload->>'email'));
  if target_email is null or length(target_email)>254 or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Indica un correo válido'; end if;
  days:=(payload->>'duration_days')::integer;
  deadline:=(payload->>'fixed_end')::timestamptz;
  if (days is null)=(deadline is null) or days not between 1 and 365 or deadline<=now() then raise exception 'Elige entre 1 y 365 días o una fecha futura'; end if;
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into private.fiexea_invitations(token_hash,email,label,created_by,redeem_by,duration_days,fixed_end)
   values(encode(sha256(convert_to(token,'UTF8')),'hex'),target_email,left(coalesce(payload->>'label',''),100),uid,least(now()+interval '30 days',coalesce(deadline,'infinity'::timestamptz)),days,deadline) returning * into inv;
  return jsonb_build_object('id',inv.id,'token',token);
 elsif action in ('revoke','extend') then
  select * into inv from private.fiexea_invitations where id=(payload->>'id')::uuid for update;
  if not found then raise exception 'Invitación no encontrada'; end if;
  if action='revoke' then
   update private.fiexea_invitations set revoked_at=now() where id=inv.id;
  else
   if inv.revoked_at is not null then raise exception 'Crea otra invitación para un acceso desactivado'; end if;
   days:=(payload->>'days')::integer;
   if days is null or days not between 1 and 365 then raise exception 'Indica entre 1 y 365 días'; end if;
   update private.fiexea_invitations set
    access_until=case when redeemed_at is not null then greatest(access_until,now())+make_interval(days=>days) else access_until end,
    fixed_end=case when redeemed_at is null and fixed_end is not null then greatest(fixed_end,now())+make_interval(days=>days) else fixed_end end,
    duration_days=case when redeemed_at is null and duration_days is not null then least(365,duration_days+days) else duration_days end,
    redeem_by=case when redeemed_at is null then greatest(redeem_by,now())+make_interval(days=>days) else redeem_by end where id=inv.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Acción no válida';
end $$;
revoke all on function private.fiexea_invitation_api(text,jsonb) from public,anon;
grant execute on function private.fiexea_invitation_api(text,jsonb) to authenticated;
create function public.fiexea_invitations(action text,payload jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.fiexea_invitation_api(action,payload)$$;
revoke all on function public.fiexea_invitations(text,jsonb) from public,anon;
grant execute on function public.fiexea_invitations(text,jsonb) to authenticated;
create or replace function private.fiexea_access_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); account private.fiexea_account_access; paid_until timestamptz; invitation_until timestamptz; has_invitation boolean; current_time_at_server timestamptz:=now();
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into account from private.fiexea_account_access where user_id=uid;
 if not found then return jsonb_build_object('allowed',false,'state','unavailable','server_now',current_time_at_server); end if;
 select max(current_period_end) into paid_until from public.subscriptions where user_id=uid and livemode and status='active' and current_period_end>current_time_at_server;
 select count(*)>0,max(access_until) filter(where revoked_at is null and access_until>current_time_at_server) into has_invitation,invitation_until from private.fiexea_invitations where redeemed_by=uid;
 return jsonb_build_object('allowed',account.existing_access or paid_until is not null or invitation_until is not null or (not has_invitation and account.trial_ends_at>current_time_at_server),
 'state',case when account.existing_access then 'existing' when paid_until is not null then 'paid' when invitation_until is not null then 'invitation' when has_invitation then 'invitation_expired' when account.trial_ends_at>current_time_at_server then 'trial' else 'expired' end,
 'trial_started_at',account.trial_started_at,'trial_ends_at',account.trial_ends_at,'invitation_ends_at',invitation_until,'paid_until',paid_until,'server_now',current_time_at_server);
end $$;
