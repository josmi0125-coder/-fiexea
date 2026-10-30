-- No persistent fixtures or real payments.
begin;
do $$
declare token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); visitor jsonb; again jsonb; panel jsonb; uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); owner_uid uuid; row_count integer;
begin
 perform set_config('request.jwt.claim.sub','',true);
 select user_id into owner_uid from private.fiexea_administrators limit 1;
 set local role anon;
 visitor:=public.fiexea_guest_trial('start',jsonb_build_object('token',token));
 if (visitor->>'ends_at')::timestamptz-(visitor->>'started_at')::timestamptz<>interval '7 days' then raise exception 'Wrong duration'; end if;
 again:=public.fiexea_guest_trial('start',jsonb_build_object('token',token,'started_at','2099-01-01'));
 if visitor->>'id'<>again->>'id' or visitor->>'ends_at'<>again->>'ends_at' then raise exception 'Trial restarted'; end if;
 begin perform public.fiexea_admin_trials(); raise exception 'Anonymous dashboard access'; exception when insufficient_privilege then null; end;
 begin perform count(*) from fiexea_guest_internal.trials; raise exception 'Anonymous table read'; exception when insufficient_privilege then null; end;
 begin perform public.fiexea_guest_trial('claim',jsonb_build_object('token',token)); raise exception 'Anonymous claim'; exception when invalid_authorization_specification then null; end;
 reset role;
 insert into auth.users(id,email,created_at,updated_at) values(uid,'trial-fixture-'||uid||'@example.invalid',now(),now()),(other_uid,'trial-fixture-'||other_uid||'@example.invalid',now(),now());
 perform set_config('request.jwt.claim.sub',uid::text,true);
 set local role authenticated;
 begin perform public.fiexea_admin_trials(); raise exception 'Non-admin dashboard access'; exception when insufficient_privilege then null; end;
 perform public.fiexea_guest_trial('claim',jsonb_build_object('token',token));
 reset role;
 if not exists(select 1 from fiexea_guest_internal.trials where id=(visitor->>'id')::uuid and user_id=uid and converted_at is null) then raise exception 'Registration not linked'; end if;
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 set local role authenticated;
 begin perform public.fiexea_guest_trial('claim',jsonb_build_object('token',token)); raise exception 'Fixture assertion: other account took token'; exception when raise_exception then if sqlerrm like 'Fixture assertion:%' then raise; end if; end;
 reset role;
 insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status,livemode,current_period_end) values(uid,'cus_fixture_'||uid,'sub_fixture_'||uid,'active',false,now()+interval '30 days');
 if exists(select 1 from fiexea_guest_internal.trials where user_id=uid and converted_at is not null) then raise exception 'Test payment counted'; end if;
 update public.subscriptions set livemode=true where user_id=uid;
 if not exists(select 1 from fiexea_guest_internal.trials where user_id=uid and converted_at is not null) then raise exception 'Live conversion missing'; end if;
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 set local role authenticated;
 panel:=public.fiexea_admin_trials('{"filter":"converted","page":0}');
 if (panel->'summary'->>'converted')::integer<1 then raise exception 'Admin summary missing conversion'; end if;
 if panel::text like '%'||token||'%' or panel::text like '%token_hash%' then raise exception 'Dashboard leaked token'; end if;
 reset role;
end $$;
rollback;
