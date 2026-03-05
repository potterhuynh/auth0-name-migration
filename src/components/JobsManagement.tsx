import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ExternalLink } from 'lucide-react';
import { listJobs, deleteJobAndRecords, getJobRecordSummary } from '../lib/jobs';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { StatusBadge } from './StatusBadge';
import { useSupabaseClientSelection } from './SupabaseClientContext';

type JobRow = { id: number; job_key: string; status: string; total_records: number; processed_records: number; success_records: number; failed_records: number };

export function JobsManagement() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalJobs, setTotalJobs] = useState(0);
  const [jobToDelete, setJobToDelete] = useState<JobRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { supabaseClient } = useSupabaseClientSelection();
  const navigate = useNavigate();

  const loadJobs = async (pageToLoad: number) => {
    setLoading(true);
    try {
      const { jobs: data, total } = await listJobs<JobRow>(supabaseClient, {
        page: pageToLoad,
        pageSize,
      });
      const jobsWithCounts = await Promise.all(
        data.map(async (job: any) => {
          try {
            const summary = await getJobRecordSummary(String(job.id), supabaseClient);
            const processed = summary.success + summary.failed;
            return {
              ...job,
              total_records: summary.total,
              processed_records: processed,
              success_records: summary.success,
              failed_records: summary.failed,
            } as JobRow;
          } catch {
            // If summary fails, fall back to existing fields.
            return job as JobRow;
          }
        }),
      );
      setJobs(jobsWithCounts);
      setTotalJobs(total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [supabaseClient]);

  useEffect(() => {
    void loadJobs(page);
  }, [page, supabaseClient]);

  const total = totalJobs;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageJobs = jobs;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Jobs management</h2>
          <p className="text-xs text-muted-foreground">
            View and refresh recent migration jobs. Open records to view a job’s migration records.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void loadJobs(page);
          }}
          disabled={loading}
        >
          {loading && <Spinner className="h-3 w-3" />}
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm">
        {total > 0 && (
          <div className="flex items-center justify-between border-b px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              Rows {start + 1}-{Math.min(start + pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md border border-input bg-background px-2 py-1 text-[11px] disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span>
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                className="rounded-md border border-input bg-background px-2 py-1 text-[11px] disabled:opacity-50"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
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
              {pageJobs.map((job) => (
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
                        onClick={() => navigate(`/records?job_id=${job.id}`)}
                        className="gap-1"
                      >
                        <ExternalLink className="size-3.5" />
                        Open records
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
        {total > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              Rows {start + 1}-{Math.min(start + pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md border border-input bg-background px-2 py-1 text-[11px] disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span>
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                className="rounded-md border border-input bg-background px-2 py-1 text-[11px] disabled:opacity-50"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

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
                    await deleteJobAndRecords(jobToDelete, supabaseClient);
                    setJobToDelete(null);
                    await loadJobs(page);
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

