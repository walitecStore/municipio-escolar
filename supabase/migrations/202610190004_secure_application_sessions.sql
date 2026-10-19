-- Apply after 001, 002, 003. Prepared only; no live migration is executed by the app.
begin;
alter table electoral_private.administrators add column role text not null default 'administrator' check(role in ('administrator','committee'));
alter table electoral_private.elections add column purpose text not null default 'test' check(purpose in ('test','official')), add column security_approved boolean not null default false;
-- Privileged staff RPCs now require both membership and a verified AAL2 JWT claim.
create or replace function electoral_private.is_admin() returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from electoral_private.administrators where user_id=auth.uid())
$$;
create function public.get_electoral_session() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare staff_role text;
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 select role into staff_role from electoral_private.administrators where user_id=auth.uid();
 return jsonb_build_object('role',coalesce(staff_role,case when exists(select 1 from electoral_private.electors where auth_user_id=auth.uid()) then 'elector' else 'unassigned' end),'aal',coalesce(auth.jwt()->>'aal','aal1'));
end $$;
create function public.list_accessible_elections() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'Acceso denegado';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'school',x.school,'year',x.year,'state',x.state,'purpose',x.purpose,'security_approved',x.security_approved) order by x.year desc)
 from electoral_private.elections x where electoral_private.is_admin() or exists(select 1 from electoral_private.electors e where e.election_id=x.id and e.auth_user_id=auth.uid())),'[]'::jsonb);
end $$;
create function electoral_private.guard_official_activation() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if old.state<>'draft' and (new.purpose,new.security_approved) is distinct from (old.purpose,old.security_approved) then raise exception 'Modo y aprobación se fijan antes de abrir';end if;
 if new.state='open' and new.purpose='official' and not new.security_approved then raise exception 'Elección oficial sin aprobación de seguridad';end if;
 return new;
end $$;
create trigger official_activation before update on electoral_private.elections for each row execute function electoral_private.guard_official_activation();
-- App roles cannot set purpose/security_approved; only an authorized DB operator can.
revoke all on function electoral_private.guard_official_activation() from public,anon,authenticated;
revoke all on function public.get_electoral_session(),public.list_accessible_elections() from public,anon,authenticated;
grant execute on function public.get_electoral_session(),public.list_accessible_elections() to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then revoke all on function public.get_electoral_session(),public.list_accessible_elections() from service_role;end if;
end $$;
commit;
