import { useState } from 'react';
import { Button } from './ui/button';
import { startBackfill } from '../lib/api';

type StartNameBackfillSectionProps = {
  variant?: 'default' | 'inline';
};

export function StartNameBackfillSection({ variant = 'default' }: StartNameBackfillSectionProps) {
  const [jobKey, setJobKey] = useState('job-local-001');
  const [limit, setLimit] = useState(100);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await startBackfill(jobKey, limit);
      setStatus(
        `${res.message} — processed/queued ${res.count} records for job ${res.job_key}`,
      );
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  if (variant === 'inline') {
    return (
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          className={inputClass}
          style={{ width: '10rem' }}
          placeholder="Job key"
          value={jobKey}
          onChange={(e) => setJobKey(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={1000}
          className={inputClass}
          style={{ width: '4.5rem' }}
          placeholder="Limit"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Starting…' : 'Start name backfill'}
        </Button>
        {status && (
          <span className="w-full text-xs text-muted-foreground sm:w-auto">
            {status}
          </span>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">Job key</label>
        <input
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
          value={jobKey}
          onChange={(e) => setJobKey(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          Batch size (limit)
        </label>
        <input
          type="number"
          min={1}
          max={1000}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Starting name backfill…' : 'Start name backfill'}
      </Button>

      {status && <p className="text-sm text-slate-600">{status}</p>}
    </form>
  );
}
