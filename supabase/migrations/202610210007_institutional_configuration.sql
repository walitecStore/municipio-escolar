-- 007: configuration per election, compatible with existing records. Apply manually after 006.
-- Does not approve, open, delete or migrate any live student records.
begin;
alter table electoral_private.elections drop constraint elections_expected_students_check;
alter table electoral_private.elections add constraint elections_expected_students_check check(expected_students between 1 and 10000);
create or replace function electoral_private.guard_draft_edit() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare eid uuid; current_state text; capacity integer;
begin
  if TG_OP = 'UPDATE' and new.election_id <> old.election_id then
    raise exception 'No se permite trasladar registros entre elecciones';
  end if;
  if TG_OP = 'DELETE' then eid := old.election_id; else eid := new.election_id; end if;
  select state,expected_students into current_state,capacity from electoral_private.elections where id = eid for update;
  if current_state is distinct from 'draft' then raise exception 'La elección ya no admite correcciones'; end if;
  if TG_TABLE_NAME = 'electors' and TG_OP = 'INSERT' and
    (select count(*) from electoral_private.electors where election_id = eid) >= capacity then
    raise exception 'Se alcanzó el total de electores configurado';
  end if;
  if TG_OP = 'DELETE' then return old; else return new; end if;
end $$;
create or replace function electoral_private.guard_election_state() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if TG_OP = 'INSERT' then
    if new.state <> 'draft' then raise exception 'Una elección debe iniciar en borrador'; end if;
    return new;
  end if;
  if new.id <> old.id then raise exception 'Identificador inmutable'; end if;
  if new.state <> old.state and not ((old.state = 'draft' and new.state = 'open') or (old.state = 'open' and new.state = 'closed')) then
    raise exception 'Transición electoral inválida';
  end if;
  if old.state <> 'draft' and new.supervised_dni is distinct from old.supervised_dni then raise exception 'Modalidad bloqueada'; end if;
  if old.state <> 'draft' and (new.school,new.level,new.year,new.expected_students) is distinct from (old.school,old.level,old.year,old.expected_students) then
    raise exception 'Configuración institucional bloqueada';
  end if;
  if new.state = 'open' and old.state = 'draft' then
    if (select count(*) from electoral_private.electors where election_id = new.id) <> new.expected_students then raise exception 'El padrón debe coincidir con el total configurado'; end if;
    if not new.supervised_dni and exists(select 1 from electoral_private.electors where election_id = new.id and auth_user_id is null) then raise exception 'Falta vincular identidades autenticadas'; end if;
    if not exists(select 1 from electoral_private.choices where election_id = new.id) then raise exception 'Faltan candidaturas'; end if;
    if not new.supervised_dni and (select count(*) from electoral_private.credentials where election_id = new.id and expires_at > now() and not consumed) <> new.expected_students then raise exception 'Faltan credenciales vigentes'; end if;
  end if;
  if new.supervised_dni and exists(select 1 from electoral_private.electors where election_id=new.id and code !~ '^[0-9]{8}$') then raise exception 'El padrón presencial requiere DNI de ocho dígitos';end if;
  return new;
end $$;
create or replace function electoral_private.validate_complete_lists() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.state='open' and old.state='draft' then
  if not new.supervised_dni and (select count(*) from electoral_private.credentials where election_id=new.id and delivered and not consumed and expires_at>clock_timestamp())<>new.expected_students then raise exception 'Faltan entregas individuales supervisadas';end if;
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
create or replace function public.replace_electoral_roll(p_election uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path = pg_catalog as $$
declare current_state text; imported integer; capacity integer;
begin
  if not electoral_private.is_admin() then raise exception 'Acceso denegado'; end if;
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
create or replace function public.append_electoral_dni_roll(p_election uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb; n integer; capacity integer;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
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
create or replace function public.list_accessible_elections() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'school',x.school,'year',x.year,'state',x.state,'purpose',x.purpose,'security_approved',x.security_approved,'supervised_dni',x.supervised_dni,'expected_students',x.expected_students) order by x.year desc)
 from electoral_private.elections x where electoral_private.is_admin() or exists(select 1 from electoral_private.electors e where e.election_id=x.id and e.auth_user_id=auth.uid())),'[]'::jsonb);
end $$;

create function public.configure_institutional_election(p_election uuid,p_school text,p_expected integer) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 if p_school is null or length(trim(p_school)) not between 1 and 160 or p_expected is null or p_expected not between 1 and 10000 then raise exception 'Configuración institucional inválida';end if;
 perform 1 from electoral_private.elections where id=p_election and state='draft' and purpose='official' for update;
 if not found then raise exception 'Solo elecciones institucionales en borrador';end if;
 if (select count(*) from electoral_private.electors where election_id=p_election)>p_expected then raise exception 'El total no puede ser menor que el padrón existente';end if;
 update electoral_private.elections set school=trim(p_school),expected_students=p_expected where id=p_election;
end $$;
create function public.create_configured_election(p_school text,p_year integer,p_expected integer) returns uuid
language plpgsql security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 if p_school is null or length(trim(p_school)) not between 1 and 160 or p_year is null or p_year not between 2026 and 2100 or p_expected is null or p_expected not between 1 and 10000 then raise exception 'Configuración institucional inválida';end if;
 insert into electoral_private.elections(school,year,expected_students,state,purpose,security_approved,supervised_dni)
 values(trim(p_school),p_year,p_expected,'draft','official',false,true) returning id into eid;
 return eid;
end $$;
revoke all on function public.configure_institutional_election(uuid,text,integer),public.create_configured_election(text,integer,integer) from public,anon,authenticated;
grant execute on function public.configure_institutional_election(uuid,text,integer),public.create_configured_election(text,integer,integer) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
 revoke all on function public.configure_institutional_election(uuid,text,integer),public.create_configured_election(text,integer,integer) from service_role;
 end if;
end $$;
commit;
