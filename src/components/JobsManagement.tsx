import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { listJobs, deleteJobAndRecords } from '../lib/jobs';
import { Button } from './ui/button';
import { DispatchJobModal } from './DispatchJobModal';
import { StatusBadge } from './StatusBadge';

type JobRow = { id: number; job_key: string; status: string; total_records: number; processed_records: number; success_records: number; failed_records: number };

export function JobsManagement() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatchJob, setDispatchJob] = useState<JobRow | null>(null);
  const [jobToDelete, setJobToDelete] = useState<JobRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await listJobs();
      setJobs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Jobs management</h2>
          <p className="text-xs text-muted-foreground">
            View and refresh recent migration jobs. Use Create job to dispatch.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadJobs} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-card text-card-foreground shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2 text-left">Job key</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Processed</th>
              <th className="px-3 py-2 text-right">Success</th>
              <th className="px-3 py-2 text-right">Failed</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-border/60">
                <td className="px-3 py-2">{job.job_key}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-3 py-2 text-right">{job.total_records}</td>
                <td className="px-3 py-2 text-right">{job.processed_records}</td>
                <td className="px-3 py-2 text-right">{job.success_records}</td>
                <td className="px-3 py-2 text-right">{job.failed_records}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDispatchJob(job)}
                    >
                      Create job
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setDeleteError(null);
                        setJobToDelete(job);
                      }}
                      title="Delete job and all records"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!jobs.length && !loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-xs text-muted-foreground"
                >
                  No jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dispatchJob && (
        <DispatchJobModal
          job={dispatchJob}
          onClose={() => setDispatchJob(null)}
          onSuccess={loadJobs}
        />
      )}

      {jobToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={(e) => e.target === e.currentTarget && !deleting && setJobToDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-modal-title" className="text-sm font-semibold">
              Delete job and records
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Delete job <span className="font-mono">{jobToDelete.job_key}</span> and all its
              migration records? This cannot be undone.
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-destructive">{deleteError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setJobToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    await deleteJobAndRecords(jobToDelete);
                    setJobToDelete(null);
                    await loadJobs();
                  } catch (err) {
                    setDeleteError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

