-- All fixtures and subscription simulations are rolled back; no Stripe calls.
begin;
do $$
declare active_uid uuid:=gen_random_uuid(); expired_uid uuid:=gen_random_uuid(); result jsonb; rows_seen integer;
begin
 perform set_config('request.jwt.claim.sub','',true);
 insert into auth.users(id,email,created_at,updated_at) values
 (active_uid,'fiexea-review-'||active_uid||'@example.invalid',now(),now()),
 (expired_uid,'fiexea-review-'||expired_uid||'@example.invalid',now()-interval '4 days',now());
 insert into public.fiexea_financial_data(user_id,data) values
 (active_uid,'{"fiexea_moves":"[]"}'),(expired_uid,'{"fiexea_moves":"[]"}');
 -- Simulate a legacy entitlement for RLS coverage; new registration itself has no trial.
 update private.fiexea_account_access set trial_ends_at=trial_started_at+interval '72 hours' where user_id=active_uid;
 perform set_config('request.jwt.claim.sub',active_uid::text,true);
 set local role authenticated;
 select public.fiexea_access_status() into result;
 if result->>'state'<>'trial' or not (result->>'allowed')::boolean then raise exception 'New trial not admitted'; end if;
 if (result->>'trial_ends_at')::timestamptz-(result->>'trial_started_at')::timestamptz<>interval '72 hours' then raise exception 'Trial duration invalid'; end if;
 select count(*) into rows_seen from public.fiexea_financial_data;
 if rows_seen<>1 then raise exception 'Ownership policy failed: %',rows_seen; end if;
 update public.fiexea_financial_data set data='{"fiexea_moves":"[{\"id\":\"test\"}]"}' where user_id=active_uid;
 if not found then raise exception 'Trial write blocked'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',expired_uid::text,true);
 set local role authenticated;
 select public.fiexea_access_status() into result;
 if result->>'state'<>'expired' or (result->>'allowed')::boolean then raise exception 'Expired trial admitted'; end if;
 select count(*) into rows_seen from public.fiexea_financial_data;
 if rows_seen<>0 then raise exception 'Expired user can read data'; end if;
 begin
  insert into public.fiexea_financial_data(user_id,data) values(expired_uid,'{}');
  raise exception 'Expired user can write data';
 exception when insufficient_privilege then null;
 end;
 reset role;
 insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status,livemode,current_period_end)
 values(expired_uid,'cus_fixture_'||expired_uid,'sub_fixture_'||expired_uid,'active',false,now()+interval '30 days');
 set local role authenticated;
 select public.fiexea_access_status() into result;
 if (result->>'allowed')::boolean then raise exception 'Test payment grants access'; end if;
 reset role;
 update public.subscriptions set livemode=true where user_id=expired_uid;
 set local role authenticated;
 select public.fiexea_access_status() into result;
 if result->>'state'<>'paid' or not (result->>'allowed')::boolean then raise exception 'Confirmed live state not admitted'; end if;
 reset role;
 update public.subscriptions set cancel_at_period_end=true where user_id=expired_uid;
 set local role authenticated;
 select public.fiexea_access_status() into result;
 if not (result->>'allowed')::boolean then raise exception 'Cancel renewal removed remaining paid access'; end if;
 reset role;
 update public.subscriptions set status='canceled' where user_id=expired_uid;
 set local role authenticated;
 select public.fiexea_access_status() into result;
 if (result->>'allowed')::boolean then raise exception 'Canceled subscription grants access'; end if;
 reset role;
end $$;
rollback;
select 'Trial 72h, expiry, ownership, write restrictions, test-payment rejection and paid/canceled states passed; fixtures rolled back' as validation;
