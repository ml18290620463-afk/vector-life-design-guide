-- Apply only when enabling authenticated cloud use. Retain a data-free tombstone
-- so offline/old clients cannot silently recreate a deleted cloud archive.
begin;
create table public.vector_vault_erasure (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  erased_at timestamptz not null default now()
);
alter table public.vector_vault_erasure enable row level security;
alter table public.vector_vault_erasure force row level security;
revoke all on public.vector_vault_erasure from public, anon, authenticated;
create or replace function public.vector_write_vault(expected_revision bigint, encrypted_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); actual bigint;
begin
  if uid is null then raise sqlstate '42501' using message = 'Authentication required'; end if;
  if expected_revision is null or expected_revision < 0 then raise exception 'Invalid revision'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if exists(select 1 from public.vector_vault_erasure where owner_id = uid) then
    raise sqlstate 'PT410' using message = 'Cloud archive erased; automatic upload disabled';
  end if;
  select coalesce(max(v.revision), 0) into actual from public.vector_vault_revisions v where v.owner_id = uid;
  if actual <> expected_revision then raise sqlstate 'PT409' using message = 'Revision conflict'; end if;
  insert into public.vector_vault_revisions(owner_id, revision, payload) values(uid, actual + 1, encrypted_payload);
  return actual + 1;
end;
$$;
create function public.vector_erase_vault(expected_revision bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); actual bigint;
begin
  if uid is null then raise sqlstate '42501' using message = 'Authentication required'; end if;
  if expected_revision is null or expected_revision < 0 then raise exception 'Invalid revision'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if exists(select 1 from public.vector_vault_erasure where owner_id = uid) then return true; end if;
  select coalesce(max(v.revision), 0) into actual from public.vector_vault_revisions v where v.owner_id = uid;
  if actual <> expected_revision then raise sqlstate 'PT409' using message = 'Revision conflict'; end if;
  insert into public.vector_vault_erasure(owner_id) values(uid);
  delete from public.vector_vault_revisions where owner_id = uid;
  return true;
end;
$$;
revoke all on function public.vector_erase_vault(bigint) from public, anon;
grant execute on function public.vector_erase_vault(bigint) to authenticated;
commit;
