-- Upload history: one row per uploaded file (after successful ingest).
-- Used to list past uploads and link jobs to stored files.
create table if not exists public.upload_history (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  file_name text not null,
  storage_path text not null,
  file_size bigint not null,
  record_count integer not null,
  created_at timestamptz not null default now()
);

create index if not exists upload_history_created_at_idx
  on public.upload_history (created_at desc);

create index if not exists upload_history_job_key_idx
  on public.upload_history (job_key);

-- RLS: allow same access as your anon key policy for migration_jobs (adjust to match your project).
alter table public.upload_history enable row level security;

create policy "Allow anon read and insert upload_history"
  on public.upload_history
  for all
  using (true)
  with check (true);

comment on table public.upload_history is 'History of JSON files uploaded for migration jobs; links to files in Storage bucket migration-uploads.';

-- Storage RLS for migration-uploads bucket.
-- This assumes a bucket named 'migration-uploads' already exists.
-- It allows the anon role (used by this UI) to upload and read files
-- only within that bucket.
create policy "Allow anon insert into migration-uploads"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'migration-uploads');

create policy "Allow anon read from migration-uploads"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'migration-uploads');
