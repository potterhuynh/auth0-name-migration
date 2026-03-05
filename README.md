Auth0 Migration UI
==================

A small React + Vite dashboard for managing an Auth0-to-new-system name migration workflow, backed by Supabase.

## Features

- **Upload & validate JSON**
  - Drag-and-drop `.json` file upload.
  - Shows a preview table of records.
  - Only records whose `name` field is a valid email are included.
  - Two tabs:
    - **Will upload** – records that will be sent to the backend.
    - **Skipped** – records excluded because `name` is not an email.

- **Job management**
  - Jobs are created per file (job key = sanitized file name).
  - Jobs table shows status, totals, success/failed counts, and actions.
  - **Create job** per row opens a modal to dispatch a migration with:
    - Limit (batch size), or
    - “All” records for that job.
  - **Delete job** deletes the job and all associated records (via Supabase).

- **Record management**
  - Select a job to inspect its individual records.
  - Filters:
    - By status (dropdown).
    - Free-text search across user id, name, old/updated names, error code/message.
  - Colored status badges and a summary bar:
    - Total, Success, Failed, Pending (from Supabase count queries).
  - Paginated table (page size 50).

## Tech stack

- **Frontend**
  - React + TypeScript + Vite
  - Tailwind CSS v4
  - shadcn-style UI components
  - `lucide-react` icons

- **Backend / data**
  - Supabase JavaScript client.
  - Tables (expected):
    - `migration_jobs`
    - `migration_job_records`
    - `upload_history` (optional; see `supabase/migrations/` for SQL)
  - Storage bucket: `migration-uploads` (optional; for saving uploaded JSON files)
  - HTTP API for ingestion and job dispatch:
    - `POST /ingest?job_key=...`
    - `POST /jobs`

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Create `.env.local` with:

   ```bash
   VITE_API_BASE_URL=http://localhost:8787        # or your lambda URL
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Then open the printed `http://localhost:5173` URL in your browser.

## Usage flow

1. **Upload**
   - Go to the **Upload** tab.
   - Drop or select a JSON file containing an array of Auth0-style user objects.
   - Verify which rows will be uploaded vs skipped in the preview tabs.
   - Click **Upload & ingest**.

2. **Jobs**
   - Switch to **Jobs management**.
   - Find the job created for that file (job key = file name).
   - Click **Create job** to dispatch a migration batch.
   - Optionally **Delete** a job and all its records if you want to re-run.

3. **Records**
   - Switch to **Records management**.
   - Choose a job from the dropdown.
   - Use filters and search to inspect status, HTTP codes, and error messages for each record.

## Pages and sidebar

Each sidebar item corresponds to a logical page:

- **Upload**: main upload screen (logical path: `/upload`)
- **Jobs management**: jobs overview and dispatch (logical path: `/jobs`)
- **Records management**: per-record inspection for a job (logical path: `/records`)
- **Settings**: environment variable hints and configuration notes (logical path: `/settings`)

## Notes

- The UI assumes Supabase RLS rules allow `SELECT`, `DELETE`, and counting on the `migration_jobs` and `migration_job_records` tables for the configured anon key.
- **Uploads**: On each successful ingest, the app uploads the JSON file to the Supabase Storage bucket `migration-uploads` and inserts a row into `upload_history`. Create the bucket in the Supabase dashboard (Storage → New bucket → name `migration-uploads`, allow public or use RLS as needed). Run the migration in `supabase/migrations/` to create the `upload_history` table; if the table or bucket is missing, the job is still created but a warning is shown.
- Status values are expected to be lowercase strings such as `success`, `failed`, `pending`, etc.; the UI renders them as uppercase badges with color.

