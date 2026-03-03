import { useEffect, useState } from 'react';
import { listJobs, listJobRecords, getJobRecordSummary } from '../lib/jobs';
import type { MigrationJobRecord } from '../types/migration';
import type { JobRecordSummary } from '../lib/jobs';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { DispatchJobModal } from './DispatchJobModal';

export function RecordsManagement() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [records, setRecords] = useState<MigrationJobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<JobRecordSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [dispatchJob, setDispatchJob] = useState<
    { id: number; job_key: string; total_records: number } | null
  >(null);

  useEffect(() => {
    (async () => {
      const data = await listJobs();
      setJobs(data);
      if (data.length && !selectedJobId) {
        setSelectedJobId(String(data[0].id));
      }
    })();
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;
    (async () => {
      setLoading(true);
      try {
        const [data, summaryData] = await Promise.all([
          listJobRecords(selectedJobId),
          getJobRecordSummary(selectedJobId),
        ]);
        setRecords(data);
        setSummary(summaryData);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedJobId]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, query, selectedJobId]);

  const selectedJob = jobs.find((j) => String(j.id) === selectedJobId) ?? null;

  const availableStatuses = Array.from(
    new Set(records.map((r) => r.status).filter(Boolean)),
  ).sort();

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.user_id.toLowerCase().includes(q) ||
      (r.name ?? '').toLowerCase().includes(q) ||
      (r.old_name ?? '').toLowerCase().includes(q) ||
      (r.updated_name ?? '').toLowerCase().includes(q) ||
      (r.last_error_code ?? '').toLowerCase().includes(q) ||
      (r.last_error_message ?? '').toLowerCase().includes(q)
    );
  });

  const total = filteredRecords.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRecords = filteredRecords.slice(start, start + pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Records management</h2>
          <p className="text-xs text-muted-foreground">
            Inspect individual migration records for a specific job.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 text-xs sm:flex-row sm:items-end sm:justify-end">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-muted-foreground">
              Job
            </label>
            <select
              className="h-8 min-w-[160px] rounded-md border border-input bg-background px-2 text-xs shadow-sm"
              value={selectedJobId ?? ''}
              onChange={(e) => setSelectedJobId(e.target.value || null)}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.job_key} — {job.status}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            className="sm:ml-2"
            disabled={!selectedJob}
            onClick={() => {
              if (!selectedJob) return;
              setDispatchJob({
                id: selectedJob.id,
                job_key: selectedJob.job_key,
                total_records: selectedJob.total_records ?? summary?.total ?? 0,
              });
            }}
          >
            Start migration
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-md border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wide">
            Filters
          </span>
          <div className="flex items-center gap-1">
            <span>Status</span>
            <select
              className="h-7 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex min-w-[160px] flex-1 items-center gap-1 sm:min-w-[220px]">
            <input
              type="text"
              placeholder="Filter by user, name, error…"
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {summary && (
          <div className="flex flex-wrap items-center gap-3 border-b bg-card/80 px-3 py-2 text-xs text-muted-foreground">
            <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
              Summary
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Total:{' '}
              <span className="font-semibold text-foreground">{summary.total}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Success:{' '}
              <span className="font-semibold">{summary.success}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              Failed:{' '}
              <span className="font-semibold">{summary.failed}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Pending:{' '}
              <span className="font-semibold">{summary.pending}</span>
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center py-10 text-xs text-muted-foreground">
            <Spinner className="mr-2 h-4 w-4" />
            Loading records…
          </div>
        ) : (
          <div className="flex min-h-0 max-h-full flex-col">
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
                    <th className="px-3 py-2 text-left">User ID</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Old / Updated</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Attempts</th>
                    <th className="px-3 py-2 text-left">HTTP</th>
                    <th className="px-3 py-2 text-left">Error</th>
                    <th className="px-3 py-2 text-left">Last attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((r) => (
                    <tr key={r.user_id} className="border-t border-border/60">
                      <td className="px-3 py-2 font-mono text-xs">{r.user_id}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {[r.old_name, r.updated_name].filter(Boolean).join(' → ') || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.attempts} / {r.max_attempts}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.last_http_status ?? '—'}
                      </td>
                      <td
                        className="px-3 py-2 max-w-[12rem] truncate text-xs text-red-500"
                        title={r.last_error_message ?? undefined}
                      >
                        {r.last_error_code || r.last_error_message || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.last_attempt_at
                          ? new Date(r.last_attempt_at).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {!filteredRecords.length && !loading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-4 text-center text-xs text-muted-foreground"
                      >
                        {records.length
                          ? 'No records match the current filters.'
                          : selectedJob
                            ? 'No records for this job yet.'
                            : 'Select a job to view its records.'}
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
        )}
      </div>
      {dispatchJob && (
        <DispatchJobModal
          job={dispatchJob}
          onClose={() => setDispatchJob(null)}
          onSuccess={async () => {
            if (!selectedJobId) return;
            setLoading(true);
            try {
              const [data, summaryData] = await Promise.all([
                listJobRecords(selectedJobId),
                getJobRecordSummary(selectedJobId),
              ]);
              setRecords(data);
              setSummary(summaryData);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

