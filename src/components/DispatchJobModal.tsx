import { useState, useEffect } from 'react';
import { createJob } from '../lib/api';
import { Button } from './ui/button';
import { cn } from '../lib/cn';

type JobRow = { id: number; job_key: string; total_records: number };

type DispatchJobModalProps = {
  job: JobRow | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function DispatchJobModal({ job, onClose, onSuccess }: DispatchJobModalProps) {
  const [limit, setLimit] = useState(100);
  const [useAll, setUseAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      setLimit(100);
      setUseAll(false);
      setError(null);
    }
  }, [job]);

  if (!job) return null;

  const effectiveLimit = useAll ? (job.total_records > 0 ? job.total_records : 100000) : limit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createJob(job.job_key, effectiveLimit);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatch-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dispatch-modal-title" className="text-sm font-semibold">
          Create job / dispatch
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Job: <span className="font-mono">{job.job_key}</span>
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!useAll}
                onChange={() => setUseAll(false)}
                className="rounded border-input"
              />
              Limit
            </label>
            {!useAll && (
              <input
                type="number"
                min={1}
                max={100000}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 1)}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              />
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={useAll}
                onChange={() => setUseAll(true)}
                className="rounded border-input"
              />
              All ({job.total_records} records)
            </label>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Dispatching…' : 'Dispatch'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
