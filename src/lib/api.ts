const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
import type { SupabaseClientName } from '../types/supabaseClient';

export async function ingestFile(
  jobKey: string,
  records: unknown[],
  supabaseClient?: SupabaseClientName | null,
) {
  const url = `${API_BASE}/ingest?job_key=${encodeURIComponent(jobKey)}`;

  const useObjectShape = !!supabaseClient && supabaseClient !== 'primary';
  const body = useObjectShape
    ? JSON.stringify({
        supabase_client: supabaseClient,
        records,
      })
    : JSON.stringify(records);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function startBackfill(
  jobKey: string,
  limit: number,
  status?: string,
  supabaseClient?: SupabaseClientName | null,
) {
  const payload: Record<string, unknown> = {
    job_key: jobKey,
    limit,
    status,
  };

  if (supabaseClient && supabaseClient !== 'primary') {
    payload.supabase_client = supabaseClient;
  }

  const res = await fetch(`${API_BASE}/start-backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function retryRecord(
  jobKey: string,
  userId: string,
  supabaseClient?: SupabaseClientName | null,
) {
  const payload: Record<string, unknown> = {
    job_key: jobKey,
    user_id: userId,
  };

  if (supabaseClient && supabaseClient !== 'primary') {
    payload.supabase_client = supabaseClient;
  }

  const res = await fetch(`${API_BASE}/start-backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

