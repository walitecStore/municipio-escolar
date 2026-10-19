-- Supabase Storage integration only. Apply after 001 and 002 in an approved project.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('electoral-media','electoral-media',false,5242880,array['image/jpeg','image/png','image/webp']);
do $$ begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname='objects' and c.relrowsecurity) then
  raise exception 'Storage objects must already have provider-managed RLS enabled';
 end if;
end $$;
create function electoral_private.can_read_media(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from electoral_private.media_assets a join electoral_private.elections x on x.id=a.election_id where a.path=p_path and
 (electoral_private.is_admin() or (a.consent_confirmed and x.state in ('open','closed') and exists(select 1 from electoral_private.electors e where e.election_id=a.election_id and e.auth_user_id=auth.uid()))))
$$;
create function electoral_private.can_manage_media(p_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select electoral_private.is_admin() and exists(select 1 from electoral_private.media_assets a join electoral_private.elections x on x.id=a.election_id where a.path=p_path and x.state='draft')
$$;
revoke all on function electoral_private.can_read_media(text),electoral_private.can_manage_media(text) from public,anon,authenticated;
grant execute on function electoral_private.can_read_media(text),electoral_private.can_manage_media(text) to authenticated;
-- Restrictive policies prevent pre-existing permissive policies broadening this bucket.
create policy electoral_media_anon_boundary on storage.objects as restrictive for all to anon using(bucket_id<>'electoral-media') with check(bucket_id<>'electoral-media');
create policy electoral_media_read_boundary on storage.objects as restrictive for select to authenticated using(bucket_id<>'electoral-media' or electoral_private.can_read_media(name));
create policy electoral_media_insert_boundary on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'electoral-media' or electoral_private.can_manage_media(name));
create policy electoral_media_update_boundary on storage.objects as restrictive for update to authenticated using(bucket_id<>'electoral-media' or electoral_private.can_manage_media(name)) with check(bucket_id<>'electoral-media' or electoral_private.can_manage_media(name));
create policy electoral_media_delete_boundary on storage.objects as restrictive for delete to authenticated using(bucket_id<>'electoral-media' or electoral_private.can_manage_media(name));
create policy electoral_media_read on storage.objects for select to authenticated using(bucket_id='electoral-media' and electoral_private.can_read_media(name));
create policy electoral_media_insert on storage.objects for insert to authenticated with check(bucket_id='electoral-media' and electoral_private.can_manage_media(name));
create policy electoral_media_update on storage.objects for update to authenticated using(bucket_id='electoral-media' and electoral_private.can_manage_media(name)) with check(bucket_id='electoral-media' and electoral_private.can_manage_media(name));
create policy electoral_media_delete on storage.objects for delete to authenticated using(bucket_id='electoral-media' and electoral_private.can_manage_media(name));
commit;
