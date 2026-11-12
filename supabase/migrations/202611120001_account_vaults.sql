-- Run in a dedicated Supabase project. Clients never supply an owner identity.
-- Execute the entire script once. Any error rolls back all changes.
begin;
create table public.vector_vault_revisions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  payload jsonb not null check (
    coalesce((jsonb_typeof(payload) = 'object'
    and payload->>'type' = 'vector-encrypted-vault-backup'
    and payload->>'cipher' = 'AES-256-GCM'
    and jsonb_typeof(payload->'ciphertext') = 'string'
    and payload->>'schemaVersion' = '1'
    and payload->>'kdf' = 'PBKDF2-SHA256'
    and payload->>'iterations' = '600000'
    and jsonb_typeof(payload->'salt') = 'string'
    and jsonb_typeof(payload->'iv') = 'string'
    and length(payload->>'salt') = 24
    and length(payload->>'iv') = 16
    and length(payload->>'ciphertext') >= 24
    and octet_length(payload::text) <= 20000000), false)
  ),
  created_at timestamptz not null default now(),
  primary key(owner_id, revision)
);
alter table public.vector_vault_revisions enable row level security;
alter table public.vector_vault_revisions force row level security;
create policy owner_read on public.vector_vault_revisions for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.vector_vault_revisions from anon, authenticated;
grant select on public.vector_vault_revisions to authenticated;

create function public.vector_read_vault()
returns table(revision bigint, payload jsonb, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select v.revision, v.payload, v.created_at from public.vector_vault_revisions v
  where v.owner_id = auth.uid() order by v.revision desc limit 1;
$$;
create function public.vector_write_vault(expected_revision bigint, encrypted_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); actual bigint;
begin
  if uid is null then raise sqlstate '42501' using message = 'Authentication required'; end if;
  if expected_revision is null or expected_revision < 0 then raise exception 'Invalid revision'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select coalesce(max(v.revision), 0) into actual from public.vector_vault_revisions v where v.owner_id = uid;
  if actual <> expected_revision then raise sqlstate 'PT409' using message = 'Revision conflict'; end if;
  insert into public.vector_vault_revisions(owner_id, revision, payload) values(uid, actual + 1, encrypted_payload);
  return actual + 1;
end;
$$;
revoke all on function public.vector_read_vault() from public, anon;
revoke all on function public.vector_write_vault(bigint, jsonb) from public, anon;
grant execute on function public.vector_read_vault() to authenticated;
grant execute on function public.vector_write_vault(bigint, jsonb) to authenticated;
commit;
