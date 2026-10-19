-- Preparación local: NO aplicar a un servicio externo sin autorización.
-- Requiere los roles anon/authenticated y auth.uid()/auth.users de Supabase.
begin;
create schema electoral_private;
create schema ballot_box;
revoke all on schema electoral_private, ballot_box from public, anon, authenticated;

create table electoral_private.administrators (
  user_id uuid primary key references auth.users(id)
);
create table electoral_private.elections (
  id uuid primary key default gen_random_uuid(),
  school text not null default 'I.E. ESTEBAN PAVLETICH TRUJILLO',
  level text not null default 'Educación Secundaria',
  year integer not null default 2026 check(year >= 2026),
  expected_students integer not null default 230 check(expected_students = 230),
  state text not null default 'draft' check(state in ('draft','open','closed')),
  unique(school, year)
);
create table electoral_private.classrooms (
  grade smallint not null check(grade between 1 and 5),
  section text not null check(section in ('A','B','C')),
  primary key(grade,section)
);
insert into electoral_private.classrooms select grade, section from generate_series(1,5) grade cross join (values ('A'),('B'),('C')) as s(section);
create table electoral_private.electors (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references electoral_private.elections(id),
  code text not null check(code ~ '^[A-Z0-9][A-Z0-9_-]{1,29}$'),
  full_name text not null check(length(trim(full_name)) between 1 and 120),
  grade smallint not null,
  section text not null,
  auth_user_id uuid references auth.users(id),
  foreign key(grade,section) references electoral_private.classrooms(grade,section),
  unique(election_id,code),
  unique(election_id,auth_user_id),
  unique(election_id,id)
);
create table electoral_private.credentials (
  election_id uuid not null,
  elector_id uuid not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed boolean not null default false,
  primary key(election_id,elector_id),
  foreign key(election_id,elector_id) references electoral_private.electors(election_id,id) on delete cascade
);
create table electoral_private.participations (
  election_id uuid not null,
  elector_id uuid not null,
  primary key(election_id,elector_id),
  foreign key(election_id,elector_id) references electoral_private.electors(election_id,id)
);
create table electoral_private.choices (
  election_id uuid not null references electoral_private.elections(id),
  id uuid not null default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 120),
  primary key(election_id,id)
);
-- No student ID, credential, participation ID, timestamp or sequential ID here.
create table ballot_box.ballots (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references electoral_private.elections(id),
  choice_id uuid,
  foreign key(election_id,choice_id) references electoral_private.choices(election_id,id)
);

create function electoral_private.is_admin() returns boolean
language sql stable security definer set search_path = pg_catalog
as $$ select exists(select 1 from electoral_private.administrators where user_id = auth.uid()) $$;

-- Every edit locks the election row, so opening and editing cannot race.
create function electoral_private.guard_draft_edit() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare eid uuid; current_state text;
begin
  if TG_OP = 'UPDATE' and new.election_id <> old.election_id then
    raise exception 'No se permite trasladar registros entre elecciones';
  end if;
  if TG_OP = 'DELETE' then eid := old.election_id; else eid := new.election_id; end if;
  select state into current_state from electoral_private.elections where id = eid for update;
  if current_state is distinct from 'draft' then raise exception 'La elección ya no admite correcciones'; end if;
  if TG_TABLE_NAME = 'electors' and TG_OP = 'INSERT' and
    (select count(*) from electoral_private.electors where election_id = eid) >= 230 then
    raise exception 'Máximo 230 electores';
  end if;
  if TG_OP = 'DELETE' then return old; else return new; end if;
end $$;
create trigger electors_draft before insert or update or delete on electoral_private.electors for each row execute function electoral_private.guard_draft_edit();
create trigger choices_draft before insert or update or delete on electoral_private.choices for each row execute function electoral_private.guard_draft_edit();

create function electoral_private.invalidate_corrected_credential() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  delete from electoral_private.credentials where elector_id = new.id and election_id = new.election_id;
  return new;
end $$;
create trigger corrected_credential after update on electoral_private.electors for each row execute function electoral_private.invalidate_corrected_credential();

create function electoral_private.guard_election_state() returns trigger
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
  if old.state <> 'draft' and (new.school,new.level,new.year,new.expected_students) is distinct from (old.school,old.level,old.year,old.expected_students) then
    raise exception 'Configuración institucional bloqueada';
  end if;
  if new.state = 'open' and old.state = 'draft' then
    if (select count(*) from electoral_private.electors where election_id = new.id) <> 230 then raise exception 'Se requieren 230 electores'; end if;
    if exists(select 1 from electoral_private.electors where election_id = new.id and auth_user_id is null) then raise exception 'Falta vincular identidades autenticadas'; end if;
    if not exists(select 1 from electoral_private.choices where election_id = new.id) then raise exception 'Faltan candidaturas'; end if;
    if (select count(*) from electoral_private.credentials where election_id = new.id and expires_at > now() and not consumed) <> 230 then raise exception 'Faltan credenciales vigentes'; end if;
  end if;
  return new;
end $$;
create trigger election_state before insert or update on electoral_private.elections for each row execute function electoral_private.guard_election_state();

create function public.register_electoral_credential(p_election uuid,p_elector uuid,p_token_hash text,p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare current_state text;
begin
  if not electoral_private.is_admin() then raise exception 'Acceso denegado'; end if;
  select state into current_state from electoral_private.elections where id = p_election for update;
  if current_state is distinct from 'draft' then raise exception 'Solo se emiten credenciales en borrador'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '24 hours' or p_expires_at is null then raise exception 'Caducidad inválida'; end if;
  if not exists(select 1 from electoral_private.electors where election_id = p_election and id = p_elector and auth_user_id is not null) then raise exception 'Elector sin identidad vinculada'; end if;
  insert into electoral_private.credentials(election_id,elector_id,token_hash,expires_at) values(p_election,p_elector,p_token_hash,p_expires_at)
  on conflict(election_id,elector_id) do update set token_hash=excluded.token_hash, expires_at=excluded.expires_at, consumed=false;
end $$;

-- Atomic replacement: invalid rows roll back the whole import, including deletes.
create function public.replace_electoral_roll(p_election uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path = pg_catalog as $$
declare current_state text; imported integer;
begin
  if not electoral_private.is_admin() then raise exception 'Acceso denegado'; end if;
  select state into current_state from electoral_private.elections where id=p_election for update;
  if current_state is distinct from 'draft' then raise exception 'Solo se importa en borrador'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Se requiere una lista de registros'; end if;
  if jsonb_array_length(p_rows) not between 1 and 230 then raise exception 'Se requieren entre 1 y 230 registros'; end if;
  delete from electoral_private.electors where election_id=p_election;
  insert into electoral_private.electors(election_id,code,full_name,grade,section,auth_user_id)
  select p_election,upper(trim(r.codigo)),trim(r.nombre),r.grado,upper(trim(r.seccion)),r.auth_user_id
  from jsonb_to_recordset(p_rows) as r(codigo text,nombre text,grado smallint,seccion text,auth_user_id uuid);
  get diagnostics imported = row_count;
  return imported;
end $$;

-- Locks + a unique participation key make simultaneous submissions single-use.
-- Identity and choice are stored in separate schemas with no connecting ballot ID.
create function public.cast_electoral_vote(p_election uuid,p_token text,p_choice uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare e electoral_private.electors%rowtype; c electoral_private.credentials%rowtype; current_state text;
begin
  if auth.uid() is null then raise exception 'Acceso denegado'; end if;
  if p_token is null or length(p_token) <> 43 or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Credencial inválida o no disponible'; end if;
  select state into current_state from electoral_private.elections where id = p_election for share;
  if current_state is distinct from 'open' then raise exception 'Elección no abierta'; end if;
  select * into e from electoral_private.electors where election_id = p_election and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Credencial inválida o no disponible'; end if;
  select * into c from electoral_private.credentials where election_id = p_election and elector_id = e.id for update;
  if not found or c.consumed or c.expires_at <= now() or c.token_hash <> encode(sha256(convert_to(p_token,'UTF8')),'hex') then raise exception 'Credencial inválida o no disponible'; end if;
  if exists(select 1 from electoral_private.participations where election_id=p_election and elector_id=e.id) then raise exception 'Participación ya registrada'; end if;
  if p_choice is not null and not exists(select 1 from electoral_private.choices where election_id=p_election and id=p_choice) then raise exception 'Candidatura inválida'; end if;
  insert into electoral_private.participations(election_id,elector_id) values(p_election,e.id);
  insert into ballot_box.ballots(election_id,choice_id) values(p_election,p_choice);
  update electoral_private.credentials set consumed=true where election_id=p_election and elector_id=e.id;
end $$;

create function public.electoral_roll_summary(p_election uuid)
returns table(grade smallint, section text, electors bigint, voters bigint, pending bigint)
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  if not electoral_private.is_admin() then raise exception 'Acceso denegado'; end if;
  return query select c.grade,c.section,count(e.id),count(p.elector_id),count(e.id)-count(p.elector_id)
  from electoral_private.classrooms c left join electoral_private.electors e on e.grade=c.grade and e.section=c.section and e.election_id=p_election
  left join electoral_private.participations p on p.election_id=e.election_id and p.elector_id=e.id
  group by c.grade,c.section order by c.grade,c.section;
end $$;

-- Explicit policies and grants. No browser has access to credentials or ballots.
alter table electoral_private.administrators enable row level security;
alter table electoral_private.elections enable row level security;
alter table electoral_private.classrooms enable row level security;
alter table electoral_private.electors enable row level security;
alter table electoral_private.credentials enable row level security;
alter table electoral_private.participations enable row level security;
alter table electoral_private.choices enable row level security;
alter table ballot_box.ballots enable row level security;
create policy admin_elections on electoral_private.elections for all to authenticated using(electoral_private.is_admin()) with check(electoral_private.is_admin());
create policy admin_roll_read on electoral_private.electors for select to authenticated using(electoral_private.is_admin());
create policy admin_roll_insert on electoral_private.electors for insert to authenticated with check(electoral_private.is_admin());
create policy admin_roll_update on electoral_private.electors for update to authenticated using(electoral_private.is_admin()) with check(electoral_private.is_admin());
create policy admin_roll_delete on electoral_private.electors for delete to authenticated using(electoral_private.is_admin());
create policy classroom_read on electoral_private.classrooms for select to authenticated using(true);
create policy admin_choices on electoral_private.choices for all to authenticated using(electoral_private.is_admin()) with check(electoral_private.is_admin());
create policy admin_participation_read on electoral_private.participations for select to authenticated using(electoral_private.is_admin());
revoke all on all tables in schema electoral_private,ballot_box from public,anon,authenticated;
revoke all on all functions in schema electoral_private from public,anon,authenticated;
revoke all on function public.cast_electoral_vote(uuid,text,uuid),public.register_electoral_credential(uuid,uuid,text,timestamptz),public.electoral_roll_summary(uuid),public.replace_electoral_roll(uuid,jsonb) from public,anon,authenticated;
grant usage on schema electoral_private to authenticated;
grant execute on function electoral_private.is_admin() to authenticated;
grant select,insert,update on electoral_private.elections to authenticated;
grant select,insert,update,delete on electoral_private.electors,electoral_private.choices to authenticated;
grant select on electoral_private.classrooms,electoral_private.participations to authenticated;
grant execute on function public.cast_electoral_vote(uuid,text,uuid),public.register_electoral_credential(uuid,uuid,text,timestamptz),public.electoral_roll_summary(uuid),public.replace_electoral_roll(uuid,jsonb) to authenticated;
commit;
