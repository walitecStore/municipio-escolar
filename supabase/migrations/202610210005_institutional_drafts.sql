-- Additive migration after 001–004. Prepare only; never execute automatically.
-- An institutional draft can be prepared without approving or opening voting.
begin;
-- Existing elections are retained. One test and one institutional election may
-- coexist for the same school/year; there is still only one of each modality.
alter table electoral_private.elections drop constraint elections_school_year_key;
alter table electoral_private.elections add constraint elections_school_year_purpose_key unique(school,year,purpose);
create function public.create_institutional_election(p_year integer) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado'; end if;
 if p_year is null or p_year not between 2026 and 2100 then raise exception 'Año inválido'; end if;
 insert into electoral_private.elections(year,state,purpose,security_approved)
 values(p_year,'draft','official',false) returning id into eid;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id)
 values(eid,auth.uid(),'institutional_draft_created',eid);
 return eid;
end $$;
revoke all on function public.create_institutional_election(integer) from public,anon,authenticated;
grant execute on function public.create_institutional_election(integer) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  revoke all on function public.create_institutional_election(integer) from service_role;
 end if;
end $$;
commit;
