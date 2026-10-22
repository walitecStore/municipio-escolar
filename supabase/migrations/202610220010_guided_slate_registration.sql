-- 010: atomic guided registration with automatic numbering. Apply manually after 009.
-- Existing parties/candidates are preserved. No election is approved or opened.
begin;
create table electoral_private.slate_registration_receipts (
 election_id uuid not null references electoral_private.elections(id) on delete cascade,
 request_id uuid not null,actor_id uuid not null,list_id uuid not null,number smallint not null,
 primary key(election_id,request_id)
);
alter table electoral_private.slate_registration_receipts enable row level security;
revoke all on electoral_private.slate_registration_receipts from public,anon,authenticated;
create function public.get_slate_registration_receipt(p_election uuid,p_request uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare receipt electoral_private.slate_registration_receipts;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 select * into receipt from electoral_private.slate_registration_receipts where election_id=p_election and request_id=p_request;
 if not found then return null;end if;
 if receipt.actor_id<>auth.uid() then raise exception 'Solicitud no disponible';end if;
 return jsonb_build_object('id',receipt.list_id,'number',receipt.number,'deleted',not exists(select 1 from electoral_private.choices where election_id=p_election and id=receipt.list_id));
end $$;
create function public.register_electoral_slate(p_election uuid,p_request uuid,p_party text,p_proposals text[],p_symbol text,p_mayor jsonb,p_regidors jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare state_value text;rid uuid;n smallint;item jsonb;ordinal bigint;receipt jsonb;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 select state into state_value from electoral_private.elections where id=p_election for update;
 if p_request is null then raise exception 'Solicitud inválida';end if;
 receipt:=public.get_slate_registration_receipt(p_election,p_request);
 if receipt is not null then return receipt;end if;
 if state_value is distinct from 'draft' then raise exception 'Solo se registra en borrador';end if;
 if p_party is null or length(trim(p_party)) not between 1 and 120 or
 p_proposals is null or cardinality(p_proposals) not between 1 and 20 or
 exists(select 1 from unnest(p_proposals) proposal where proposal is null or length(trim(proposal)) not between 1 and 500) then raise exception 'Datos del partido incompletos';end if;
 if jsonb_typeof(p_mayor) is distinct from 'object' or jsonb_typeof(p_regidors) is distinct from 'array' then raise exception 'Plana inválida';end if;
 if jsonb_array_length(p_regidors) not between 1 and 20 then raise exception 'Registra entre 1 y 20 regidores';end if;
 select candidate_number::smallint into n from generate_series(1,99) candidate_number where not exists(select 1 from electoral_private.choices where election_id=p_election and number=candidate_number) order by candidate_number limit 1;
 if n is null then raise exception 'Se alcanzó el máximo de partidos';end if;
 insert into electoral_private.choices(election_id,name,number,proposals,symbol_path) values(p_election,trim(p_party),n,p_proposals,p_symbol) returning id into rid;
 insert into electoral_private.candidates(election_id,list_id,full_name,role,position,title,grade,section,photo_path)
 values(p_election,rid,trim(p_mayor->>'name'),'alcalde',0,'Alcaldía escolar',(p_mayor->>'grade')::smallint,upper(trim(p_mayor->>'section')),p_mayor->>'photo');
 for item,ordinal in select value,ordinality from jsonb_array_elements(p_regidors) with ordinality loop
  insert into electoral_private.candidates(election_id,list_id,full_name,role,position,title,grade,section)
  values(p_election,rid,trim(item->>'name'),'regidor',ordinal::smallint,trim(item->>'title'),(item->>'grade')::smallint,upper(trim(item->>'section')));
 end loop;
 insert into electoral_private.slate_registration_receipts values(p_election,p_request,auth.uid(),rid,n);
 insert into electoral_private.admin_audit(election_id,actor_id,action,entity_id) values(p_election,auth.uid(),'slate.guided_registration',rid);
 return jsonb_build_object('id',rid,'number',n,'deleted',false);
end $$;
revoke all on function public.get_slate_registration_receipt(uuid,uuid),public.register_electoral_slate(uuid,uuid,text,text[],text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.get_slate_registration_receipt(uuid,uuid),public.register_electoral_slate(uuid,uuid,text,text[],text,jsonb,jsonb) to authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
 revoke all on electoral_private.slate_registration_receipts from service_role;
 revoke all on function public.get_slate_registration_receipt(uuid,uuid),public.register_electoral_slate(uuid,uuid,text,text[],text,jsonb,jsonb) from service_role;
 end if;end $$;
commit;
