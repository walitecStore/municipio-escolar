-- 011: institution badge and private station ballot presentation. Apply manually after 010.
-- No election is approved/opened; existing voters, ballots and candidates are preserved.
begin;
create table electoral_private.institution_branding (
 institution_id uuid primary key references electoral_private.institutions(id),
 logo text not null check(length(logo)<=200000 and logo ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$')
);
create table electoral_private.ballot_previews (
 election_id uuid not null,path text not null,
 image text not null check(length(image)<=200000 and image ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$'),
 primary key(election_id,path),foreign key(election_id,path) references electoral_private.media_assets(election_id,path)
);
alter table electoral_private.institution_branding enable row level security;
alter table electoral_private.ballot_previews enable row level security;
revoke all on electoral_private.institution_branding,electoral_private.ballot_previews from public,anon,authenticated;
create function public.get_institution_branding(p_institution uuid) returns text language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_institution(p_institution) then raise exception 'Acceso denegado';end if;
 return (select logo from electoral_private.institution_branding where institution_id=p_institution);
end $$;
create function public.save_institution_branding(p_institution uuid,p_logo text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_institution(p_institution) or not (electoral_private.is_platform_operator() or exists(select 1 from electoral_private.institution_staff where institution_id=p_institution and user_id=auth.uid() and role='administrator' and active)) then raise exception 'Acceso denegado';end if;
 insert into electoral_private.institution_branding values(p_institution,p_logo) on conflict(institution_id) do update set logo=excluded.logo;
 insert into electoral_private.institution_audit(institution_id,actor_id,action) values(p_institution,auth.uid(),'institution.badge_updated');
end $$;
create function public.prepare_electoral_presentation(p_election uuid,p_images jsonb) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare item record;
begin
 if not electoral_private.can_manage_election(p_election) then raise exception 'Acceso denegado';end if;
 perform 1 from electoral_private.elections where id=p_election and state in ('draft','open') for update;
 if not found then raise exception 'Elección cerrada';end if;
 if jsonb_typeof(p_images) is distinct from 'object' or octet_length(p_images::text)>6000000 then raise exception 'Presentación inválida';end if;
 for item in select key,value from jsonb_each_text(p_images) loop
  if not exists(select 1 from electoral_private.media_assets where election_id=p_election and path=item.key and consent_confirmed) then raise exception 'Imagen no autorizada';end if;
  insert into electoral_private.ballot_previews values(p_election,item.key,item.value) on conflict(election_id,path) do update set image=excluded.image;
 end loop;
end $$;
create function electoral_private.ballot_presentation(p_election uuid) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('school',e.school,'purpose',e.purpose,'logo',b.logo,'lists',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'number',l.number,'mayor',c.full_name,'photo',p.image,'symbol',s.image) order by l.number) from electoral_private.choices l left join electoral_private.candidates c on c.election_id=l.election_id and c.list_id=l.id and c.role='alcalde' left join electoral_private.ballot_previews p on p.election_id=l.election_id and p.path=c.photo_path left join electoral_private.ballot_previews s on s.election_id=l.election_id and s.path=l.symbol_path where l.election_id=e.id),'[]'::jsonb)) from electoral_private.elections e left join electoral_private.institution_branding b on b.institution_id=e.institution_id where e.id=p_election
$$;
create function public.get_electoral_presentation(p_election uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_manage_election(p_election) and not exists(select 1 from electoral_private.electors r join electoral_private.elections e on e.id=r.election_id where e.id=p_election and r.auth_user_id=auth.uid() and e.state in ('open','closed')) then raise exception 'Acceso denegado';end if;
 return electoral_private.ballot_presentation(p_election);
end $$;
create function public.get_station_presentation(p_token text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare eid uuid;
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{64}$' then raise exception 'Mesa no disponible';end if;
 select e.id into eid from electoral_private.voting_stations s join electoral_private.elections e on e.id=s.election_id where s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and s.active and s.expires_at>clock_timestamp() and e.supervised_dni and e.state='open' and (e.purpose='test' or e.security_approved);
 if eid is null then raise exception 'Mesa no disponible';end if;
 return electoral_private.ballot_presentation(eid);
end $$;
revoke all on function electoral_private.ballot_presentation(uuid) from public,anon,authenticated;
revoke all on function public.get_institution_branding(uuid),public.save_institution_branding(uuid,text),public.prepare_electoral_presentation(uuid,jsonb),public.get_electoral_presentation(uuid),public.get_station_presentation(text) from public,anon,authenticated;
grant execute on function public.get_institution_branding(uuid),public.save_institution_branding(uuid,text),public.prepare_electoral_presentation(uuid,jsonb),public.get_electoral_presentation(uuid) to authenticated;
grant execute on function public.get_station_presentation(text) to anon;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
 revoke all on electoral_private.institution_branding,electoral_private.ballot_previews from service_role;
 revoke all on function electoral_private.ballot_presentation(uuid),public.get_institution_branding(uuid),public.save_institution_branding(uuid,text),public.prepare_electoral_presentation(uuid,jsonb),public.get_electoral_presentation(uuid),public.get_station_presentation(text) from service_role;
end if;end $$;
commit;
