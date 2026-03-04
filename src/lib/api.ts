const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export async function ingestFile(jobKey: string, records: unknown[]) {
  const res = await fetch(
    `${API_BASE}/ingest?job_key=${encodeURIComponent(jobKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(records),
    },
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function startBackfill(jobKey: string, limit: number, status?: string) {
  const res = await fetch(`${API_BASE}/start-backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_key: jobKey, limit, status }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function retryRecord(jobKey: string, userId: string) {
  const res = await fetch(`${API_BASE}/start-backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_key: jobKey, user_id: userId }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

