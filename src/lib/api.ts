const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export async function ingestFile(jobKey: string, records: unknown[]) {
  const res = await fetch(
    `${API_BASE}/auth0-migration/ingest?job_key=${encodeURIComponent(jobKey)}`,
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

export async function createJob(jobKey: string, limit: number) {
  const res = await fetch(`${API_BASE}/auth0-migration/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_key: jobKey, limit }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

