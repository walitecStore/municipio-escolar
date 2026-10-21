-- 008: shared platform, institution-bound staff and elections. Manual application after 007.
-- Existing data belongs to the initial institution; nothing is deleted or opened.
begin;
create table electoral_private.institutions(
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160),
 expected_students integer not null default 230 check(expected_students between 1 and 10000),
 legacy boolean not null default false, unique(legacy,id)
);
create unique index one_legacy_institution on electoral_private.institutions(legacy) where legacy;
insert into electoral_private.institutions(name,legacy) values('I.E. ESTEBAN PAVLETICH TRUJILLO',true);
create table electoral_private.institution_audit(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references electoral_private.institutions(id),
 actor_id uuid not null,action text not null,occurred_at timestamptz not null default clock_timestamp()
);
alter table electoral_private.institution_audit enable row level security;
revoke all on electoral_private.institution_audit from public,anon,authenticated;
create table electoral_private.institution_staff(
 institution_id uuid not null references electoral_private.institutions(id),user_id uuid not null references auth.users(id),
 role text not null check(role in ('administrator','committee')),active boolean not null default true,
 primary key(institution_id,user_id),unique(user_id)
);
alter table electoral_private.institutions enable row level security;
alter table electoral_private.institution_staff enable row level security;
revoke all on electoral_private.institutions,electoral_private.institution_staff from public,anon,authenticated;
create function electoral_private.default_institution() returns uuid language sql stable security definer set search_path=pg_catalog as $$ select id from electoral_private.institutions where legacy $$;
alter table electoral_private.elections add column institution_id uuid references electoral_private.institutions(id);
update electoral_private.elections set institution_id=electoral_private.default_institution();
alter table electoral_private.elections alter column institution_id set not null,alter column institution_id set default electoral_private.default_institution();
alter table electoral_private.elections drop constraint elections_school_year_purpose_key;
alter table electoral_private.elections add constraint elections_institution_year_purpose_key unique(institution_id,year,purpose);
create function electoral_private.is_platform_operator() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from electoral_private.administrators where user_id=auth.uid() and role='administrator')
$$;
create function electoral_private.can_manage_institution(p_institution uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from electoral_private.institutions i where i.id=p_institution and
 (electoral_private.is_platform_operator() or exists(select 1 from electoral_private.institution_staff s where s.institution_id=i.id and s.user_id=auth.uid() and s.active) or
 (i.legacy and exists(select 1 from electoral_private.administrators where user_id=auth.uid()))))
$$;
create function electoral_private.can_manage_election(p_election uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from electoral_private.elections e where e.id=p_election and electoral_private.can_manage_institution(e.institution_id))
$$;
create or replace function electoral_private.is_admin() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and (exists(select 1 from electoral_private.administrators where user_id=auth.uid()) or exists(select 1 from electoral_private.institution_staff where user_id=auth.uid() and active))
$$;
create or replace function public.get_electoral_session() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare staff_role text;
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 select role into staff_role from electoral_private.administrators where user_id=auth.uid();
 if staff_role is null then select role into staff_role from electoral_private.institution_staff where user_id=auth.uid() and active;end if;
 return jsonb_build_object('role',coalesce(staff_role,case when exists(select 1 from electoral_private.electors where auth_user_id=auth.uid()) then 'elector' else 'unassigned' end),'aal',coalesce(auth.jwt()->>'aal','aal1'),'platform_operator',electoral_private.is_platform_operator());
end $$;
create or replace function public.register_electoral_credential(p_election uuid,p_elector uuid,p_token_hash text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare current_state text;receipt uuid;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
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
create or replace function public.replace_electoral_roll(p_election uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path = pg_catalog as $$
declare current_state text; imported integer; capacity integer;
begin
  if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado'; end if;
  select state,expected_students into current_state,capacity from electoral_private.elections where id=p_election for update;
  if current_state is distinct from 'draft' then raise exception 'Solo se importa en borrador'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Se requiere una lista de registros'; end if;
  if jsonb_array_length(p_rows) not between 1 and capacity then raise exception 'El lote supera la capacidad electoral configurada'; end if;
  delete from electoral_private.electors where election_id=p_election;
  insert into electoral_private.electors(election_id,code,full_name,grade,section,auth_user_id)
  select p_election,upper(trim(r.codigo)),trim(r.nombre),r.grado,upper(trim(r.seccion)),r.auth_user_id
  from jsonb_to_recordset(p_rows) as r(codigo text,nombre text,grado smallint,seccion text,auth_user_id uuid);
  get diagnostics imported = row_count;
  return imported;
end $$;
create or replace function public.electoral_roll_summary(p_election uuid)
returns table(grade smallint, section text, electors bigint, voters bigint, pending bigint)
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado'; end if;
  return query select c.grade,c.section,count(e.id),count(p.elector_id),count(e.id)-count(p.elector_id)
  from electoral_private.classrooms c left join electoral_private.electors e on e.grade=c.grade and e.section=c.section and e.election_id=p_election
  left join electoral_private.participations p on p.election_id=e.election_id and p.elector_id=e.id
  group by c.grade,c.section order by c.grade,c.section;
end $$;
create or replace function public.get_electoral_roll(p_election uuid) returns setof electoral_private.electors
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 return query select * from electoral_private.electors where election_id=p_election order by code;
end $$;
create or replace function public.correct_electoral_student(p_election uuid,p_id uuid,p_code text,p_name text,p_grade smallint,p_section text,p_auth_user uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election for update;
 update electoral_private.electors set code=upper(trim(p_code)),full_name=trim(p_name),grade=p_grade,section=upper(trim(p_section)),auth_user_id=p_auth_user where election_id=p_election and id=p_id;
 if not found then raise exception 'Elector inexistente';end if;
end $$;
create or replace function public.manage_electoral_list(p_election uuid,p_id uuid,p_name text,p_number smallint,p_proposals text[],p_symbol text default null,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare rid uuid;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
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
create or replace function public.manage_electoral_candidate(p_election uuid,p_id uuid,p_list uuid,p_name text,p_role text,p_position smallint,p_title text,p_grade smallint,p_section text,p_photo text default null,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare rid uuid;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
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
create or replace function public.register_electoral_media(p_election uuid,p_path text,p_consent boolean) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election for update;
 insert into electoral_private.media_assets values(p_election,p_path,p_consent) on conflict(election_id,path) do update set consent_confirmed=excluded.consent_confirmed;
 insert into electoral_private.admin_audit(election_id,actor_id,action) values(p_election,auth.uid(),'media.authorization');
end $$;
create or replace function public.get_electoral_lists(p_election uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) and not exists(select 1 from electoral_private.electors e join electoral_private.elections x on x.id=e.election_id where e.election_id=p_election and e.auth_user_id=auth.uid() and x.state in ('open','closed')) then raise exception 'Acceso denegado';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'number',l.number,'proposals',l.proposals,'symbol_path',l.symbol_path,'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.full_name,'role',c.role,'position',c.position,'title',c.title,'grade',c.grade,'section',c.section,'photo_path',c.photo_path) order by c.position) from electoral_private.candidates c where c.election_id=l.election_id and c.list_id=l.id),'[]'::jsonb)) order by l.number) from electoral_private.choices l where l.election_id=p_election),'[]'::jsonb);
end $$;
create or replace function public.confirm_electoral_delivery(p_election uuid,p_elector uuid,p_version uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare current_state text;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 select state into current_state from electoral_private.elections where id=p_election for share;
 if current_state is null or current_state not in ('draft','open') then raise exception 'Elección cerrada o inexistente';end if;
 perform 1 from electoral_private.electors where election_id=p_election and id=p_elector for update;
 if exists(select 1 from electoral_private.participations where election_id=p_election and elector_id=p_elector) then raise exception 'Elector ya participó';end if;
 update electoral_private.credentials set delivered=true where election_id=p_election and elector_id=p_elector and version=p_version and not consumed and expires_at>clock_timestamp();
 if not found then raise exception 'Entrega obsoleta o credencial no disponible';end if;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id) values(p_election,auth.uid(),'credential.delivery_confirmed',p_elector);
end $$;
create or replace function public.get_electoral_results(p_election uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare current_state text; total bigint; voters bigint; blank bigint; max_votes bigint; rows jsonb;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
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
create or replace function public.get_electoral_audit(p_election uuid) returns setof electoral_private.admin_audit
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 return query select * from electoral_private.admin_audit where election_id=p_election order by occurred_at;
end $$;
create or replace function public.append_electoral_dni_roll(p_election uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb; n integer; capacity integer;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 select expected_students into capacity from electoral_private.elections where id=p_election and state='draft' for update;
 if not found then raise exception 'Solo en borrador';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Padrón inválido';end if;
 n:=jsonb_array_length(p_rows);
 if n not between 1 and capacity or n+(select count(*) from electoral_private.electors where election_id=p_election)>capacity then raise exception 'El lote supera la capacidad electoral configurada';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where coalesce(x->>'codigo','') !~ '^[0-9]{8}$' or coalesce(length(trim(x->>'nombre')),0) not between 1 and 120 or coalesce(x->>'grado','') !~ '^[1-5]$' or coalesce(upper(trim(x->>'seccion')),'') not in ('A','B','C')) then raise exception 'Revisa DNI, nombre, grado y sección';end if;
 if (select count(distinct x->>'codigo') from jsonb_array_elements(p_rows) x)<>n or exists(select 1 from jsonb_array_elements(p_rows) x join electoral_private.electors e on e.election_id=p_election and e.code=x->>'codigo') then raise exception 'DNI duplicados: no se agregó ninguna fila';end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  insert into electoral_private.electors(election_id,code,full_name,grade,section) values(p_election,r->>'codigo',trim(r->>'nombre'),(r->>'grado')::smallint,upper(trim(r->>'seccion')));
 end loop;
 return n;
end $$;
create or replace function public.configure_supervised_dni(p_election uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 update electoral_private.elections set supervised_dni=true where id=p_election and state='draft';
 if not found then raise exception 'Solo en borrador';end if;
end $$;
create or replace function public.create_voting_station(p_election uuid,p_label text,p_hash text) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare sid uuid;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election and supervised_dni and state<>'closed' for share;
 if not found then raise exception 'Modalidad no disponible';end if;
 insert into electoral_private.voting_stations(election_id,label,token_hash,expires_at) values(p_election,p_label,p_hash,clock_timestamp()+interval '8 hours') returning id into sid;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id) values(p_election,auth.uid(),'station_created',sid);
 return sid;
end $$;
create or replace function public.manage_supervised_turn(p_election uuid,p_station uuid,p_turn uuid,p_approve boolean,p_revoke boolean default false) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare t electoral_private.supervised_turns%rowtype;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election for share;
 perform 1 from electoral_private.voting_stations where election_id=p_election and id=p_station for update;
 if not found then raise exception 'Mesa inválida';end if;
 if p_revoke then
  update electoral_private.voting_stations set active=false where id=p_station;
  update electoral_private.supervised_turns set state='cancelled' where station_id=p_station and state in ('pending','authorized');
 else
  select * into t from electoral_private.supervised_turns where id=p_turn and station_id=p_station for update;
  if not found or t.state not in ('pending','authorized') or t.expires_at<=clock_timestamp() then raise exception 'Turno no disponible';end if;
  perform 1 from electoral_private.electors where id=t.elector_id for update;
  if p_approve then
   if not exists(select 1 from electoral_private.elections where id=p_election and state='open' and (purpose='test' or security_approved)) then raise exception 'Elección no abierta';end if;
   if exists(select 1 from electoral_private.participations where election_id=p_election and elector_id=t.elector_id) or exists(select 1 from electoral_private.supervised_turns where election_id=p_election and elector_id=t.elector_id and id<>t.id and state='authorized' and expires_at>clock_timestamp()) then raise exception 'Participación o autorización ya registrada';end if;
  end if;
  update electoral_private.supervised_turns set state=case when p_approve then 'authorized' else 'cancelled' end,expires_at=clock_timestamp()+interval '2 minutes' where id=t.id;
 end if;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id) values(p_election,auth.uid(),case when p_revoke then 'station_revoked' when p_approve then 'identity_checked' else 'turn_cancelled' end,coalesce(p_turn,p_station));
end $$;
create or replace function public.get_supervised_control(p_election uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 return jsonb_build_object('stations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'active',active,'expires_at',expires_at)) from electoral_private.voting_stations where election_id=p_election),'[]'::jsonb),
 'turns',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'station_id',t.station_id,'name',e.full_name,'dni',e.code,'grade',e.grade,'section',e.section,'state',t.state)) from electoral_private.supervised_turns t join electoral_private.electors e on e.id=t.elector_id where t.election_id=p_election and t.state in ('pending','authorized') and t.expires_at>clock_timestamp()),'[]'::jsonb));
end $$;
create or replace function public.configure_institutional_election(p_election uuid,p_school text,p_expected integer) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 if p_school is null or length(trim(p_school)) not between 1 and 160 or p_expected is null or p_expected not between 1 and 10000 then raise exception 'Configuración institucional inválida';end if;
 perform 1 from electoral_private.elections where id=p_election and state='draft' and purpose='official' for update;
 if not found then raise exception 'Solo elecciones institucionales en borrador';end if;
 if (select count(*) from electoral_private.electors where election_id=p_election)>p_expected then raise exception 'El total no puede ser menor que el padrón existente';end if;
 update electoral_private.elections set school=trim(p_school),expected_students=p_expected where id=p_election;
end $$;
create or replace function public.create_institutional_election(p_year integer) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if not electoral_private.is_platform_operator() then raise exception 'Acceso denegado'; end if;
 if p_year is null or p_year not between 2026 and 2100 then raise exception 'Año inválido'; end if;
 insert into electoral_private.elections(year,state,purpose,security_approved)
 values(p_year,'draft','official',false) returning id into eid;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id)
 values(eid,auth.uid(),'institutional_draft_created',eid);
 return eid;
end $$;
create or replace function public.create_configured_election(p_school text,p_year integer,p_expected integer) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if not electoral_private.is_platform_operator() then raise exception 'Acceso denegado';end if;
 if p_school is null or length(trim(p_school)) not between 1 and 160 or p_year is null or p_year not between 2026 and 2100 or p_expected is null or p_expected not between 1 and 10000 then raise exception 'Configuración institucional inválida';end if;
 insert into electoral_private.elections(school,year,expected_students,state,purpose,security_approved,supervised_dni)
 values(trim(p_school),p_year,p_expected,'draft','official',false,true) returning id into eid;
 return eid;
end $$;
create or replace function public.manage_electoral_election(p_id uuid,p_year integer,p_state text default 'draft') returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if (p_id is null and not electoral_private.is_platform_operator()) or (p_id is not null and not electoral_private.can_manage_election(p_id)) then raise exception 'Acceso denegado';end if;
 if p_id is null then
  if p_state<>'draft' then raise exception 'Estado inicial inválido';end if;
  insert into electoral_private.elections(year) values(p_year) returning id into eid;
 else
  update electoral_private.elections set state=p_state where id=p_id returning id into eid;
  if eid is null then raise exception 'Elección inexistente';end if;
 end if;
 return eid;
end $$;
create or replace function public.list_accessible_elections() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'school',x.school,'year',x.year,'state',x.state,'purpose',x.purpose,'security_approved',x.security_approved,'supervised_dni',x.supervised_dni,'expected_students',x.expected_students,'institution_id',x.institution_id) order by x.year desc)
 from electoral_private.elections x where electoral_private.can_manage_election(x.id) or exists(select 1 from electoral_private.electors e where e.election_id=x.id and e.auth_user_id=auth.uid())),'[]'::jsonb);
end $$;
create or replace function electoral_private.can_read_media(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from electoral_private.media_assets a join electoral_private.elections x on x.id=a.election_id where a.path=p_path and
 (electoral_private.can_manage_election(a.election_id) or (a.consent_confirmed and x.state in ('open','closed') and exists(select 1 from electoral_private.electors e where e.election_id=a.election_id and e.auth_user_id=auth.uid()))))
$$;
create or replace function electoral_private.can_manage_media(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from electoral_private.media_assets a join electoral_private.elections x on x.id=a.election_id where a.path=p_path and x.state='draft' and electoral_private.can_manage_election(a.election_id))
$$;

-- Institution identity is immutable for every existing election, including drafts.
create function electoral_private.guard_institution_identity() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin if new.institution_id is distinct from old.institution_id then raise exception 'No se permite trasladar elecciones entre instituciones';end if;return new;end $$;
create trigger institution_identity before update on electoral_private.elections for each row execute function electoral_private.guard_institution_identity();
create function public.list_my_institutions() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 return jsonb_build_object('platform_operator',electoral_private.is_platform_operator(),'institutions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'expected_students',expected_students) order by name) from electoral_private.institutions where electoral_private.can_manage_institution(id)),'[]'::jsonb));
end $$;
create function public.provision_institution(p_name text,p_admin uuid,p_expected integer) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare iid uuid;
begin
 if not electoral_private.is_platform_operator() then raise exception 'Acceso denegado';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 160 or p_expected is null or p_expected not between 1 and 10000 or not exists(select 1 from auth.users where id=p_admin) then raise exception 'Datos institucionales inválidos';end if;
 if exists(select 1 from electoral_private.administrators where user_id=p_admin) then raise exception 'Asigna una cuenta institucional independiente';end if;
 insert into electoral_private.institutions(name,expected_students) values(trim(p_name),p_expected) returning id into iid;
 insert into electoral_private.institution_staff(institution_id,user_id,role) values(iid,p_admin,'administrator');
 insert into electoral_private.institution_audit(institution_id,actor_id,action) values(iid,auth.uid(),'institution.provision');
 return iid;
end $$;
create function public.update_my_institution(p_institution uuid,p_name text,p_expected integer) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_institution(p_institution) or not (electoral_private.is_platform_operator() or exists(select 1 from electoral_private.institution_staff where institution_id=p_institution and user_id=auth.uid() and role='administrator' and active)) then raise exception 'Acceso denegado';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 160 or p_expected is null or p_expected not between 1 and 10000 then raise exception 'Datos institucionales inválidos';end if;
 update electoral_private.institutions set name=trim(p_name),expected_students=p_expected where id=p_institution;
 insert into electoral_private.institution_audit(institution_id,actor_id,action) values(p_institution,auth.uid(),'institution.update');
end $$;
create function public.assign_institution_staff(p_institution uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_institution(p_institution) or not (electoral_private.is_platform_operator() or exists(select 1 from electoral_private.institution_staff where institution_id=p_institution and user_id=auth.uid() and role='administrator' and active)) then raise exception 'Acceso denegado';end if;
 if p_user=auth.uid() or exists(select 1 from electoral_private.administrators where user_id=p_user) or p_role is null or p_role not in ('administrator','committee') or p_active is null then raise exception 'Asignación inválida';end if;
 if exists(select 1 from electoral_private.institution_staff where user_id=p_user and institution_id<>p_institution) then raise exception 'La cuenta ya pertenece a otra institución';end if;
 insert into electoral_private.institution_staff(institution_id,user_id,role,active) values(p_institution,p_user,p_role,p_active) on conflict(institution_id,user_id) do update set role=excluded.role,active=excluded.active;
 insert into electoral_private.institution_audit(institution_id,actor_id,action) values(p_institution,auth.uid(),'institution.staff_update');
end $$;
create function public.create_institution_election(p_institution uuid,p_year integer,p_expected integer) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid; school_name text;
begin
 if not electoral_private.can_manage_institution(p_institution) then raise exception 'Acceso denegado';end if;
 if p_year is null or p_year not between 2026 and 2100 or p_expected is null or p_expected not between 1 and 10000 then raise exception 'Configuración inválida';end if;
 select name into school_name from electoral_private.institutions where id=p_institution;
 insert into electoral_private.elections(institution_id,school,year,expected_students,state,purpose,security_approved,supervised_dni) values(p_institution,school_name,p_year,p_expected,'draft','official',false,true) returning id into eid;
 return eid;
end $$;
drop policy admin_elections on electoral_private.elections;
create policy admin_elections on electoral_private.elections for all to authenticated using(electoral_private.can_manage_election(id)) with check(electoral_private.can_manage_election(id));
drop policy admin_roll_read on electoral_private.electors;
create policy admin_roll_read on electoral_private.electors for select to authenticated using(electoral_private.can_manage_election(election_id)) ;
drop policy admin_roll_insert on electoral_private.electors;
create policy admin_roll_insert on electoral_private.electors for insert to authenticated with check(electoral_private.can_manage_election(election_id));
drop policy admin_roll_update on electoral_private.electors;
create policy admin_roll_update on electoral_private.electors for update to authenticated using(electoral_private.can_manage_election(election_id)) with check(electoral_private.can_manage_election(election_id));
drop policy admin_roll_delete on electoral_private.electors;
create policy admin_roll_delete on electoral_private.electors for delete to authenticated using(electoral_private.can_manage_election(election_id)) ;
drop policy admin_choices on electoral_private.choices;
create policy admin_choices on electoral_private.choices for all to authenticated using(electoral_private.can_manage_election(election_id)) with check(electoral_private.can_manage_election(election_id));
drop policy admin_participation_read on electoral_private.participations;
create policy admin_participation_read on electoral_private.participations for select to authenticated using(electoral_private.can_manage_election(election_id)) ;
drop policy admin_candidates on electoral_private.candidates;
create policy admin_candidates on electoral_private.candidates for all to authenticated using(electoral_private.can_manage_election(election_id)) with check(electoral_private.can_manage_election(election_id));
drop policy admin_media on electoral_private.media_assets;
create policy admin_media on electoral_private.media_assets for all to authenticated using(electoral_private.can_manage_election(election_id)) with check(electoral_private.can_manage_election(election_id));
drop policy audit_read on electoral_private.admin_audit;
create policy audit_read on electoral_private.admin_audit for select to authenticated using(electoral_private.can_manage_election(election_id)) ;

revoke all on function electoral_private.default_institution(),electoral_private.is_platform_operator(),electoral_private.can_manage_institution(uuid),electoral_private.can_manage_election(uuid),electoral_private.guard_institution_identity() from public,anon,authenticated;
grant execute on function electoral_private.can_manage_election(uuid) to authenticated;
revoke all on function public.list_my_institutions(),public.provision_institution(text,uuid,integer),public.update_my_institution(uuid,text,integer),public.assign_institution_staff(uuid,uuid,text,boolean),public.create_institution_election(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.list_my_institutions(),public.provision_institution(text,uuid,integer),public.update_my_institution(uuid,text,integer),public.assign_institution_staff(uuid,uuid,text,boolean),public.create_institution_election(uuid,integer,integer) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
 revoke all on electoral_private.institutions,electoral_private.institution_staff,electoral_private.institution_audit from service_role;
 revoke all on function public.list_my_institutions(),public.provision_institution(text,uuid,integer),public.update_my_institution(uuid,text,integer),public.assign_institution_staff(uuid,uuid,text,boolean),public.create_institution_election(uuid,integer,integer) from service_role;
 end if;
end $$;
commit;
