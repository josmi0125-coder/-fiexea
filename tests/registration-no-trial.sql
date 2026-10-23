begin;
do $$
declare uid uuid:=gen_random_uuid(); result jsonb;
begin
 perform set_config('request.jwt.claim.sub','',true);
 insert into auth.users(id,email,created_at,updated_at,raw_user_meta_data)
 values(uid,'guest-transition-'||uid||'@example.invalid',now(),now(),'{"trial_days":7,"trial_ends_at":"2099-01-01","premium":true}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 set local role authenticated;
 result:=public.fiexea_access_status();
 if (result->>'allowed')::boolean or result->>'state'<>'expired' then raise exception 'Registration granted a second trial'; end if;
 if (result->>'trial_ends_at')::timestamptz<>(result->>'trial_started_at')::timestamptz then raise exception 'Registration extended trial'; end if;
 reset role;
end $$;
rollback;
