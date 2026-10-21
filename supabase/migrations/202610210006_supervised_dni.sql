-- 006: additive compatibility upgrade after 001–005. Manual application only.
-- Existing elections retain individual credentials. No election is opened or approved.
begin;
alter table electoral_private.elections add column supervised_dni boolean not null default false;
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
    if (select count(*) from electoral_private.electors where election_id = new.id) <> 230 then raise exception 'Se requieren 230 electores'; end if;
    if not new.supervised_dni and exists(select 1 from electoral_private.electors where election_id = new.id and auth_user_id is null) then raise exception 'Falta vincular identidades autenticadas'; end if;
    if not exists(select 1 from electoral_private.choices where election_id = new.id) then raise exception 'Faltan candidaturas'; end if;
    if not new.supervised_dni and (select count(*) from electoral_private.credentials where election_id = new.id and expires_at > now() and not consumed) <> 230 then raise exception 'Faltan credenciales vigentes'; end if;
  end if;
  if new.supervised_dni and exists(select 1 from electoral_private.electors where election_id=new.id and code !~ '^[0-9]{8}$') then raise exception 'El padrón presencial requiere DNI de ocho dígitos';end if;
  return new;
end $$;
create or replace function electoral_private.validate_complete_lists() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.state='open' and old.state='draft' then
  if not new.supervised_dni and (select count(*) from electoral_private.credentials where election_id=new.id and delivered and not consumed and expires_at>clock_timestamp())<>230 then raise exception 'Faltan entregas individuales supervisadas';end if;
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
create or replace function public.cast_electoral_vote(p_election uuid,p_token text,p_choice uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare e electoral_private.electors%rowtype;c electoral_private.credentials%rowtype;current_state text;
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Credencial inválida o no disponible';end if;
 select state into current_state from electoral_private.elections where id=p_election and not supervised_dni for share;
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
create or replace function public.list_accessible_elections() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'school',x.school,'year',x.year,'state',x.state,'purpose',x.purpose,'security_approved',x.security_approved,'supervised_dni',x.supervised_dni) order by x.year desc)
 from electoral_private.elections x where electoral_private.is_admin() or exists(select 1 from electoral_private.electors e where e.election_id=x.id and e.auth_user_id=auth.uid())),'[]'::jsonb);
end $$;

create function electoral_private.check_dni_roll() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from electoral_private.elections where id=new.election_id and supervised_dni) and new.code !~ '^[0-9]{8}$' then raise exception 'DNI inválido';end if;
 return new;
end $$;
-- Runs after electors_draft, which serializes edits against election configuration.
create trigger z_check_dni before insert or update on electoral_private.electors for each row execute function electoral_private.check_dni_roll();
create table electoral_private.voting_stations(
 id uuid primary key default gen_random_uuid(), election_id uuid not null references electoral_private.elections(id),
 label text not null check(length(label) between 1 and 40), token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null, active boolean not null default true,
 window_start timestamptz not null default clock_timestamp(), attempts integer not null default 0,
 unique(election_id,id)
);
create table electoral_private.supervised_turns(
 id uuid primary key default gen_random_uuid(), election_id uuid not null,
 station_id uuid not null, elector_id uuid not null,
 state text not null check(state in ('pending','authorized','consumed','cancelled','done')),
 expires_at timestamptz not null,
 foreign key(election_id,station_id) references electoral_private.voting_stations(election_id,id),
 foreign key(election_id,elector_id) references electoral_private.electors(election_id,id)
);
create unique index one_station_turn on electoral_private.supervised_turns(station_id) where state in ('pending','authorized');
alter table electoral_private.voting_stations enable row level security;
alter table electoral_private.supervised_turns enable row level security;
revoke all on electoral_private.voting_stations,electoral_private.supervised_turns from public,anon,authenticated;

-- Append one grade/section workbook without erasing previously imported grades.
create function public.append_electoral_dni_roll(p_election uuid,p_rows jsonb) returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb; n integer;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election and state='draft' for update;
 if not found then raise exception 'Solo en borrador';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Padrón inválido';end if;
 n:=jsonb_array_length(p_rows);
 if n not between 1 and 230 or n+(select count(*) from electoral_private.electors where election_id=p_election)>230 then raise exception 'Máximo 230 electores';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where coalesce(x->>'codigo','') !~ '^[0-9]{8}$' or coalesce(length(trim(x->>'nombre')),0) not between 1 and 120 or coalesce(x->>'grado','') !~ '^[1-5]$' or coalesce(upper(trim(x->>'seccion')),'') not in ('A','B','C')) then raise exception 'Revisa DNI, nombre, grado y sección';end if;
 if (select count(distinct x->>'codigo') from jsonb_array_elements(p_rows) x)<>n or exists(select 1 from jsonb_array_elements(p_rows) x join electoral_private.electors e on e.election_id=p_election and e.code=x->>'codigo') then raise exception 'DNI duplicados: no se agregó ninguna fila';end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  insert into electoral_private.electors(election_id,code,full_name,grade,section) values(p_election,r->>'codigo',trim(r->>'nombre'),(r->>'grado')::smallint,upper(trim(r->>'seccion')));
 end loop;
 return n;
end $$;
revoke all on function public.append_electoral_dni_roll(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.append_electoral_dni_roll(uuid,jsonb) to authenticated;

create function public.configure_supervised_dni(p_election uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 update electoral_private.elections set supervised_dni=true where id=p_election and state='draft';
 if not found then raise exception 'Solo en borrador';end if;
end $$;
create function public.create_voting_station(p_election uuid,p_label text,p_hash text) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare sid uuid;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election and supervised_dni and state<>'closed' for share;
 if not found then raise exception 'Modalidad no disponible';end if;
 insert into electoral_private.voting_stations(election_id,label,token_hash,expires_at) values(p_election,p_label,p_hash,clock_timestamp()+interval '8 hours') returning id into sid;
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id) values(p_election,auth.uid(),'station_created',sid);
 return sid;
end $$;
create function public.manage_supervised_turn(p_election uuid,p_station uuid,p_turn uuid,p_approve boolean,p_revoke boolean default false) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare t electoral_private.supervised_turns%rowtype;
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
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
create function public.get_supervised_control(p_election uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.is_admin() then raise exception 'Acceso denegado';end if;
 return jsonb_build_object('stations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'active',active,'expires_at',expires_at)) from electoral_private.voting_stations where election_id=p_election),'[]'::jsonb),
 'turns',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'station_id',t.station_id,'name',e.full_name,'dni',e.code,'grade',e.grade,'section',e.section,'state',t.state)) from electoral_private.supervised_turns t join electoral_private.electors e on e.id=t.elector_id where t.election_id=p_election and t.state in ('pending','authorized') and t.expires_at>clock_timestamp()),'[]'::jsonb));
end $$;
-- A high-entropy station capability is held only in an HttpOnly server cookie.
-- No password, service-role key, student account or identity enters the ballot RPC.
create function public.station_electoral_operation(p_token text,p_operation text,p_dni text default null,p_choice uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare s electoral_private.voting_stations%rowtype; e electoral_private.elections%rowtype;t electoral_private.supervised_turns%rowtype; eid uuid; result jsonb;
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{64}$' then raise exception 'Mesa no disponible';end if;
 -- Read only to locate election; lock order for ALL mutations: election, station, turn, elector.
 select election_id into eid from electoral_private.voting_stations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 select * into e from electoral_private.elections where id=eid for share;
 select * into s from electoral_private.voting_stations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or not s.active or s.expires_at<=clock_timestamp() or not e.supervised_dni then raise exception 'Mesa no disponible';end if;
 if e.state<>'open' or (e.purpose='official' and not e.security_approved) then raise exception 'Elección no abierta';end if;
 select * into t from electoral_private.supervised_turns where station_id=s.id and state in ('pending','authorized','consumed') order by (state='consumed'),expires_at desc limit 1 for update;
 if p_operation='request' then
  if p_dni is null or p_dni !~ '^[0-9]{8}$' then raise exception 'Solicitud no disponible';end if;
  if s.window_start+interval '1 minute'<=clock_timestamp() then update electoral_private.voting_stations set attempts=0,window_start=clock_timestamp() where id=s.id;s.attempts:=0;end if;
  if s.attempts>=5 then return jsonb_build_object('purpose',e.purpose,'state','limited');end if;
  update electoral_private.voting_stations set attempts=attempts+1 where id=s.id;
  if t.id is not null and t.state in ('pending','authorized') and t.expires_at>clock_timestamp() then raise exception 'Hay un turno en curso';end if;
  update electoral_private.supervised_turns set state=case when state='consumed' then 'done' else 'cancelled' end where station_id=s.id and state in ('pending','authorized','consumed');
  select id into eid from electoral_private.electors where election_id=e.id and code=p_dni;
  if eid is null or exists(select 1 from electoral_private.participations where election_id=e.id and elector_id=eid) then return jsonb_build_object('purpose',e.purpose,'state','unavailable');end if;
  insert into electoral_private.supervised_turns(election_id,station_id,elector_id,state,expires_at) values(e.id,s.id,eid,'pending',clock_timestamp()+interval '5 minutes');
  return jsonb_build_object('purpose',e.purpose,'state','pending');
 elsif p_operation='finish' then
  if t.state='consumed' then update electoral_private.supervised_turns set state='done' where id=t.id;end if;
  return jsonb_build_object('purpose',e.purpose,'state','ready');
 elsif p_operation='cast' then
  if t.id is null or t.state<>'authorized' or t.expires_at<=clock_timestamp() then raise exception 'Falta verificación presencial vigente';end if;
  perform 1 from electoral_private.electors where id=t.elector_id for update;
  if exists(select 1 from electoral_private.participations where election_id=e.id and elector_id=t.elector_id) then raise exception 'Participación ya registrada';end if;
  if p_choice is not null and not exists(select 1 from electoral_private.choices where election_id=e.id and id=p_choice) then raise exception 'Candidatura inválida';end if;
  insert into electoral_private.participations values(e.id,t.elector_id);
  insert into ballot_box.ballots(election_id,choice_id) values(e.id,p_choice);
  update electoral_private.supervised_turns set state='consumed' where id=t.id;
  return jsonb_build_object('purpose',e.purpose,'state','consumed');
 elsif p_operation<>'status' then raise exception 'Operación inválida';end if;
 if t.id is null or (t.state<>'consumed' and t.expires_at<=clock_timestamp()) then return jsonb_build_object('purpose',e.purpose,'state','ready');end if;
 result:=jsonb_build_object('purpose',e.purpose,'state',t.state);
 if t.state='authorized' then
  result:=result||jsonb_build_object('name',(select full_name from electoral_private.electors where id=t.elector_id),'lists',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'number',c.number,'mayor',(select full_name from electoral_private.candidates where election_id=e.id and list_id=c.id and role='alcalde')) order by c.number) from electoral_private.choices c where c.election_id=e.id),'[]'::jsonb));
 end if;
 return result;
end $$;

revoke all on function electoral_private.check_dni_roll() from public,anon,authenticated;
revoke all on function public.configure_supervised_dni(uuid),public.create_voting_station(uuid,text,text),public.manage_supervised_turn(uuid,uuid,uuid,boolean,boolean),public.get_supervised_control(uuid),public.station_electoral_operation(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.configure_supervised_dni(uuid),public.create_voting_station(uuid,text,text),public.manage_supervised_turn(uuid,uuid,uuid,boolean,boolean),public.get_supervised_control(uuid) to authenticated;
grant execute on function public.station_electoral_operation(text,text,text,uuid) to anon;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  revoke all on electoral_private.voting_stations,electoral_private.supervised_turns from service_role;
  revoke all on function public.append_electoral_dni_roll(uuid,jsonb) from service_role;
  revoke all on function public.configure_supervised_dni(uuid),public.create_voting_station(uuid,text,text),public.manage_supervised_turn(uuid,uuid,uuid,boolean,boolean),public.get_supervised_control(uuid),public.station_electoral_operation(text,text,text,uuid) from service_role;
 end if;
end $$;
commit;
