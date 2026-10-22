-- 009: staff invitation authorization and private team directory. Apply manually after 008.
-- No election, roll, ballot or opening flag is modified.
begin;
create function electoral_private.can_administer_team(p_institution uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select electoral_private.can_manage_institution(p_institution) and
 (electoral_private.is_platform_operator() or exists(select 1 from electoral_private.institution_staff
 where institution_id=p_institution and user_id=auth.uid() and active and role='administrator'))
$$;
create function public.get_institution_team(p_institution uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_administer_team(p_institution) then raise exception 'Acceso denegado';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.user_id,'email',coalesce(to_jsonb(u)->>'email','Sin correo'),
 'name',coalesce(to_jsonb(u)->'raw_user_meta_data'->>'full_name','Personal autorizado'),
 'role',s.role,'active',s.active,'accepted',(to_jsonb(u)->>'email_confirmed_at') is not null) order by s.role,s.user_id)
 from electoral_private.institution_staff s join auth.users u on u.id=s.user_id where s.institution_id=p_institution),'[]'::jsonb);
end $$;
create function public.authorize_staff_invitation(p_institution uuid,p_email text,p_existing uuid default null) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not electoral_private.can_administer_team(p_institution) then raise exception 'Acceso denegado';end if;
 if p_email is null or length(p_email) not between 3 and 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo inválido';end if;
 perform pg_advisory_xact_lock(912209);
 if (select count(*) from electoral_private.institution_audit where action='staff.invitation_requested' and occurred_at>clock_timestamp()-interval '1 hour' and institution_id=p_institution)>=20
 or (select count(*) from electoral_private.institution_audit where action='staff.invitation_requested' and occurred_at>clock_timestamp()-interval '1 hour')>=200 then raise exception 'Espera antes de invitar de nuevo';end if;
 if p_existing is null then
  if exists(select 1 from auth.users u where lower(to_jsonb(u)->>'email')=lower(trim(p_email))) then raise exception 'Cuenta existente: utiliza su acceso actual';end if;
 else
  if not exists(select 1 from auth.users u join electoral_private.institution_staff s on s.user_id=u.id
   where u.id=p_existing and lower(to_jsonb(u)->>'email')=lower(trim(p_email)) and (to_jsonb(u)->>'email_confirmed_at') is null
   and s.institution_id=p_institution and s.active) then raise exception 'Invitación no disponible';end if;
 end if;
 insert into electoral_private.institution_audit(institution_id,actor_id,action) values(p_institution,auth.uid(),'staff.invitation_requested');
end $$;
create function public.assign_existing_institution_staff(p_institution uuid,p_email text,p_role text,p_active boolean) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid;
begin
 if not electoral_private.can_administer_team(p_institution) then raise exception 'Acceso denegado';end if;
 select u.id into target from auth.users u where lower(to_jsonb(u)->>'email')=lower(trim(p_email));
 if target is null then raise exception 'Cuenta no disponible';end if;
 perform public.assign_institution_staff(p_institution,target,p_role,p_active);
end $$;
revoke all on function electoral_private.can_administer_team(uuid) from public,anon,authenticated;
revoke all on function public.get_institution_team(uuid),public.authorize_staff_invitation(uuid,text,uuid),public.assign_existing_institution_staff(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.get_institution_team(uuid),public.authorize_staff_invitation(uuid,text,uuid),public.assign_existing_institution_staff(uuid,text,text,boolean) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
 revoke all on function public.get_institution_team(uuid),public.authorize_staff_invitation(uuid,text,uuid),public.assign_existing_institution_staff(uuid,text,text,boolean) from service_role;
 end if;
end $$;
commit;
