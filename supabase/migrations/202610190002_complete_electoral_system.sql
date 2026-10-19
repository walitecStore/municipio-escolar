-- Apply AFTER 202610190001. Never run against a real project without approval.
begin;
alter table electoral_private.credentials add column version uuid not null default gen_random_uuid(), add column delivered boolean not null default false;
alter table electoral_private.choices add column symbol_path text, add column proposals text[] not null default '{}', add column number smallint;
alter table electoral_private.choices add constraint list_number_valid check(number between 1 and 99), add constraint list_number_unique unique(election_id,number), add constraint proposal_limit check(cardinality(proposals)<=20);
create table electoral_private.candidates (
 id uuid primary key default gen_random_uuid(), election_id uuid not null, list_id uuid not null,
 full_name text not null check(length(trim(full_name)) between 1 and 120),
 role text not null check(role in ('alcalde','regidor')), position smallint not null,
 title text not null check(length(trim(title)) between 1 and 100),
 grade smallint not null, section text not null, photo_path text,
 foreign key(election_id,list_id) references electoral_private.choices(election_id,id) on delete cascade,
 foreign key(grade,section) references electoral_private.classrooms(grade,section),
 check((role='alcalde' and position=0) or (role='regidor' and position between 1 and 20)),
 unique(election_id,list_id,position)
);
create table electoral_private.media_assets (
 election_id uuid not null references electoral_private.elections(id), path text not null,
 consent_confirmed boolean not null default false,
 primary key(election_id,path), check(path like election_id::text||'/%'),
 check(path ~ '^[a-f0-9-]{36}/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$')
);
alter table electoral_private.candidates add foreign key(election_id,photo_path) references electoral_private.media_assets(election_id,path);
alter table electoral_private.choices add foreign key(election_id,symbol_path) references electoral_private.media_assets(election_id,path);
create table electoral_private.admin_audit (
 id uuid primary key default gen_random_uuid(), election_id uuid not null,
 actor_id uuid, action text not null, entity_id uuid, occurred_at timestamptz not null default clock_timestamp()
);
alter table electoral_private.candidates enable row level security;
alter table electoral_private.media_assets enable row level security;
alter table electoral_private.admin_audit enable row level security;
create policy admin_candidates on electoral_private.candidates for all to authenticated using(electoral_private.is_admin()) with check(electoral_private.is_admin());
create policy admin_media on electoral_private.media_assets for all to authenticated using(electoral_private.is_admin()) with check(electoral_private.is_admin());
create policy audit_read on electoral_private.admin_audit for select to authenticated using(electoral_private.is_admin());
create trigger candidates_draft before insert or update or delete on electoral_private.candidates for each row execute function electoral_private.guard_draft_edit();
create trigger media_draft before insert or update or delete on electoral_private.media_assets for each row execute function electoral_private.guard_draft_edit();

-- Audit administrative actions only. No tokens, names, candidate choices or vote events.
create function electoral_private.audit_admin_change() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid; rid uuid;
begin
 if TG_TABLE_NAME='elections' then
  if TG_OP='DELETE' then eid:=old.id; else eid:=new.id; end if; rid:=eid;
 else
  if TG_OP='DELETE' then eid:=old.election_id;rid:=old.id; else eid:=new.election_id;rid:=new.id; end if;
 end if;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id)
 values(eid,auth.uid(),TG_TABLE_NAME||'.'||lower(TG_OP),rid);
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
create trigger audit_elections after insert or update on electoral_private.elections for each row execute function electoral_private.audit_admin_change();
create trigger audit_lists after insert or update or delete on electoral_private.choices for each row execute function electoral_private.audit_admin_change();
create trigger audit_candidates after insert or update or delete on electoral_private.candidates for each row execute function electoral_private.audit_admin_change();
create trigger audit_electors after insert or update or delete on electoral_private.electors for each row execute function electoral_private.audit_admin_change();

create function electoral_private.validate_complete_lists() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.state='open' and old.state='draft' then
  if (select count(*) from electoral_private.credentials where election_id=new.id and delivered and not consumed and expires_at>clock_timestamp())<>230 then raise exception 'Faltan entregas individuales supervisadas';end if;
  if exists(select 1 from electoral_private.choices l where l.election_id=new.id and
    (l.number is null or cardinality(l.proposals)=0 or exists(select 1 from unnest(l.proposals) p where length(trim(p)) not between 1 and 500) or
     (select count(*) from electoral_private.candidates c where c.election_id=l.election_id and c.list_id=l.id and c.role='alcalde')<>1 or
     not exists(select 1 from electoral_private.candidates c where c.election_id=l.election_id and c.list_id=l.id and c.role='regidor'))) then
   raise exception 'Listas incompletas: número, propuestas, alcalde y regidores obligatorios';
  end if;
  if exists(select 1 from electoral_private.media_assets a where a.election_id=new.id and not a.consent_confirmed) then
   raise exception 'Medios sin autorización documentada';
  end if;
 end if;
 return new;
end $$;
create trigger z_complete_lists before update on electoral_private.elections for each row execute function electoral_private.validate_complete_lists();

-- All application administration goes through checked RPCs; private schemas stay unexposed.
create function public.manage_electoral_election(p_id uuid,p_year integer,p_state text default 'draft') returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 if p_id is null then
  if p_state<>'draft' then raise exception 'Estado inicial inválido';end if;
  insert into electoral_private.elections(year) values(p_year) returning id into eid;
 else
  update electoral_private.elections set state=p_state where id=p_id returning id into eid;
  if eid is null then raise exception 'Elección inexistente';end if;
 end if;
 return eid;
end $$;
create function public.get_electoral_roll(p_election uuid) returns setof electoral_private.electors
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 return query select * from electoral_private.electors where election_id=p_election order by code;
end $$;
create function public.correct_electoral_student(p_election uuid,p_id uuid,p_code text,p_name text,p_grade smallint,p_section text,p_auth_user uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election for update;
 update electoral_private.electors set code=upper(trim(p_code)),full_name=trim(p_name),grade=p_grade,section=upper(trim(p_section)),auth_user_id=p_auth_user where election_id=p_election and id=p_id;
 if not found then raise exception 'Elector inexistente';end if;
end $$;
create function public.manage_electoral_list(p_election uuid,p_id uuid,p_name text,p_number smallint,p_proposals text[],p_symbol text default null,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare rid uuid;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election for update;
 if p_delete then
  delete from electoral_private.choices where election_id=p_election and id=p_id returning id into rid;
 elsif p_id is null then
  insert into electoral_private.choices(election_id,name,number,proposals,symbol_path) values(p_election,trim(p_name),p_number,p_proposals,p_symbol) returning id into rid;
 else
  update electoral_private.choices set name=trim(p_name),number=p_number,proposals=p_proposals,symbol_path=p_symbol where election_id=p_election and id=p_id returning id into rid;
 end if;
 if rid is null then raise exception 'Lista inexistente';end if;
 return rid;
end $$;
create function public.manage_electoral_candidate(p_election uuid,p_id uuid,p_list uuid,p_name text,p_role text,p_position smallint,p_title text,p_grade smallint,p_section text,p_photo text default null,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare rid uuid;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election for update;
 if p_delete then
  delete from electoral_private.candidates where election_id=p_election and id=p_id returning id into rid;
 elsif p_id is null then
  insert into electoral_private.candidates(election_id,list_id,full_name,role,position,title,grade,section,photo_path) values(p_election,p_list,trim(p_name),p_role,p_position,trim(p_title),p_grade,upper(trim(p_section)),p_photo) returning id into rid;
 else
  update electoral_private.candidates set list_id=p_list,full_name=trim(p_name),role=p_role,position=p_position,title=trim(p_title),grade=p_grade,section=upper(trim(p_section)),photo_path=p_photo where election_id=p_election and id=p_id returning id into rid;
 end if;
 if rid is null then raise exception 'Candidatura inexistente';end if;
 return rid;
end $$;
create function public.register_electoral_media(p_election uuid,p_path text,p_consent boolean) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election for update;
 insert into electoral_private.media_assets values(p_election,p_path,p_consent) on conflict(election_id,path) do update set consent_confirmed=excluded.consent_confirmed;
 insert into electoral_private.admin_audit(election_id,actor_id,action) values(p_election,auth.uid(),'media.authorization');
end $$;
create function public.get_electoral_lists(p_election uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() and not exists(select 1 from electoral_private.electors e join electoral_private.elections x on x.id=e.election_id where e.election_id=p_election and e.auth_user_id=auth.uid() and x.state in ('open','closed')) then raise exception 'Acceso denegado';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'number',l.number,'proposals',l.proposals,'symbol_path',l.symbol_path,'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.full_name,'role',c.role,'position',c.position,'title',c.title,'grade',c.grade,'section',c.section,'photo_path',c.photo_path) order by c.position) from electoral_private.candidates c where c.election_id=l.election_id and c.list_id=l.id),'[]'::jsonb)) order by l.number) from electoral_private.choices l where l.election_id=p_election),'[]'::jsonb);
end $$;

-- Recovery uses the same election -> elector -> credential lock order as voting.
-- It never removes a participation and cannot re-enable a voter who already voted.
drop function public.register_electoral_credential(uuid,uuid,text,timestamptz);
create function public.register_electoral_credential(p_election uuid,p_elector uuid,p_token_hash text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare current_state text;receipt uuid;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 select state into current_state from electoral_private.elections where id=p_election for share;
 if current_state is null or current_state not in ('draft','open') then raise exception 'Elección cerrada o inexistente';end if;
 perform 1 from electoral_private.electors where election_id=p_election and id=p_elector and auth_user_id is not null for update;
 if not found then raise exception 'Elector sin identidad vinculada';end if;
 if exists(select 1 from electoral_private.participations where election_id=p_election and elector_id=p_elector) then raise exception 'Elector ya participó';end if;
 if p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '24 hours' then raise exception 'Caducidad inválida';end if;
 insert into electoral_private.credentials(election_id,elector_id,token_hash,expires_at) values(p_election,p_elector,p_token_hash,p_expires_at)
 on conflict(election_id,elector_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,consumed=false,delivered=false,version=gen_random_uuid() returning version into receipt;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id) values(p_election,auth.uid(),'credential.issue_or_recover',p_elector);
 return receipt;
end $$;
create function public.confirm_electoral_delivery(p_election uuid,p_elector uuid,p_version uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare current_state text;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 select state into current_state from electoral_private.elections where id=p_election for share;
 if current_state is null or current_state not in ('draft','open') then raise exception 'Elección cerrada o inexistente';end if;
 perform 1 from electoral_private.electors where election_id=p_election and id=p_elector for update;
 if exists(select 1 from electoral_private.participations where election_id=p_election and elector_id=p_elector) then raise exception 'Elector ya participó';end if;
 update electoral_private.credentials set delivered=true where election_id=p_election and elector_id=p_elector and version=p_version and not consumed and expires_at>clock_timestamp();
 if not found then raise exception 'Entrega obsoleta o credencial no disponible';end if;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id) values(p_election,auth.uid(),'credential.delivery_confirmed',p_elector);
end $$;

-- Replace now() with wall clock at validation time, including lock waits.
create or replace function public.cast_electoral_vote(p_election uuid,p_token text,p_choice uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare e electoral_private.electors%rowtype;c electoral_private.credentials%rowtype;current_state text;
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Credencial inválida o no disponible';end if;
 select state into current_state from electoral_private.elections where id=p_election for share;
 if current_state is distinct from 'open' then raise exception 'Elección no abierta';end if;
 select * into e from electoral_private.electors where election_id=p_election and auth_user_id=auth.uid() for update;
 if not found then raise exception 'Credencial inválida o no disponible';end if;
 select * into c from electoral_private.credentials where election_id=p_election and elector_id=e.id for update;
 if not found or not c.delivered or c.consumed or c.expires_at<=clock_timestamp() or c.token_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex') then raise exception 'Credencial inválida o no disponible';end if;
 if exists(select 1 from electoral_private.participations where election_id=p_election and elector_id=e.id) then raise exception 'Participación ya registrada';end if;
 if p_choice is not null and not exists(select 1 from electoral_private.choices where election_id=p_election and id=p_choice) then raise exception 'Candidatura inválida';end if;
 insert into electoral_private.participations values(p_election,e.id);
 insert into ballot_box.ballots(election_id,choice_id) values(p_election,p_choice);
 update electoral_private.credentials set consumed=true where election_id=p_election and elector_id=e.id;
end $$;
create function public.electoral_vote_status(p_election uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from electoral_private.participations p join electoral_private.electors e on e.id=p.elector_id and e.election_id=p.election_id where e.election_id=p_election and e.auth_user_id=auth.uid())
$$;
-- No real counts by choice are accessible before closed, including to application admins.
create function public.get_electoral_results(p_election uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare current_state text; total bigint; voters bigint; blank bigint; max_votes bigint; rows jsonb;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 select state into current_state from electoral_private.elections where id=p_election for share;
 if current_state is distinct from 'closed' then raise exception 'Resultados disponibles solo después del cierre oficial';end if;
 select count(*) into total from electoral_private.electors where election_id=p_election;
 select count(*) into voters from electoral_private.participations where election_id=p_election;
 select count(*) into blank from ballot_box.ballots where election_id=p_election and choice_id is null;
 select max(n) into max_votes from (select count(b.id) n from electoral_private.choices l left join ballot_box.ballots b on b.election_id=l.election_id and b.choice_id=l.id where l.election_id=p_election group by l.election_id,l.id,l.number,l.name) q;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'number',q.number,'name',q.name,'votes',q.n,'percentage',case when voters=0 then 0 else round(q.n*100.0/voters,2) end,'winner',q.n=max_votes and max_votes>0) order by q.number),'[]'::jsonb) into rows from
 (select l.id,l.number,l.name,count(b.id) n from electoral_private.choices l left join ballot_box.ballots b on b.election_id=l.election_id and b.choice_id=l.id where l.election_id=p_election group by l.election_id,l.id,l.number,l.name) q;
 return jsonb_build_object('election_id',p_election,'state',current_state,'electors',total,'voters',voters,'pending',total-voters,'blank',blank,'blank_percentage',case when voters=0 then 0 else round(blank*100.0/voters,2) end,'participation',case when total=0 then 0 else round(voters*100.0/total,2) end,'lists',rows);
end $$;
create function public.get_electoral_audit(p_election uuid) returns setof electoral_private.admin_audit
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 return query select * from electoral_private.admin_audit where election_id=p_election order by occurred_at;
end $$;
-- Revoke direct application writes: even administrators use checked RPCs.
revoke all on all tables in schema electoral_private,ballot_box from public,anon,authenticated;
revoke all on all functions in schema electoral_private from public,anon,authenticated;
grant execute on function electoral_private.is_admin() to authenticated;
-- New public functions default to PUBLIC execute; explicitly revoke each overload.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('confirm_electoral_delivery','manage_electoral_election','get_electoral_roll','correct_electoral_student','manage_electoral_list','manage_electoral_candidate','register_electoral_media','get_electoral_lists','register_electoral_credential','replace_electoral_roll','cast_electoral_vote','electoral_vote_status','get_electoral_results','get_electoral_audit','electoral_roll_summary') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 if exists(select 1 from pg_roles where rolname='service_role') then execute format('revoke all on function %s from service_role',f.signature);end if;
 end loop;
end $$;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  revoke all on schema electoral_private,ballot_box from service_role;
  revoke all on all tables in schema electoral_private,ballot_box from service_role;
 end if;
end $$;
create index ballot_counts on ballot_box.ballots(election_id,choice_id);
create index audit_election_order on electoral_private.admin_audit(election_id,occurred_at);
commit;
