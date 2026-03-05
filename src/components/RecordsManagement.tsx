import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listJobs, listJobRecords, getJobRecordSummary } from '../lib/jobs';
import type { MigrationJobRecord } from '../types/migration';
import type { JobRecordSummary } from '../lib/jobs';
import { getSupabaseClient } from '../lib/supabase';
import { useSupabaseClientSelection } from './SupabaseClientContext';
import { Spinner } from './ui/spinner';
import { DispatchJobModal } from './DispatchJobModal';
import { RecordsHeader } from './RecordsHeader';
import { RecordsFilters } from './RecordsFilters';
import { RecordRow } from './RecordRow';

type JobRow = {
  id: number;
  job_key: string;
  total_records?: number | null;
};

export function RecordsManagement() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [records, setRecords] = useState<MigrationJobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<JobRecordSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [dispatchJob, setDispatchJob] = useState<
    { id: number; job_key: string; total_records: number } | null
  >(null);
  const { supabaseClient } = useSupabaseClientSelection();
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get('job_id');

  useEffect(() => {
    (async () => {
      const data = await listJobs(supabaseClient);
      setJobs(data);
      if (data.length) {
        const idFromUrl =
          jobIdFromUrl != null &&
          data.some((j) => String(j.id) === jobIdFromUrl)
            ? jobIdFromUrl
            : null;
        setSelectedJobId(idFromUrl ?? String(data[0].id));
      }
    })();
  }, [jobIdFromUrl, supabaseClient]);

  const refreshSelectedJobData = useCallback(
    async (jobId: string, mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      try {
        const [data, summaryData] = await Promise.all([
          listJobRecords(jobId, supabaseClient),
          getJobRecordSummary(jobId, supabaseClient),
        ]);
        setRecords(data);
        setSummary(summaryData);
      } finally {
        if (mode === 'initial') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [supabaseClient],
  );

  useEffect(() => {
    if (!selectedJobId) return;
    setRecords([]);
    setSummary(null);
    void refreshSelectedJobData(selectedJobId, 'initial');
  }, [refreshSelectedJobData, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) return;

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimeout) return;
      refreshTimeout = setTimeout(() => {
        refreshTimeout = null;
        void refreshSelectedJobData(selectedJobId);
      }, 300);
    };

    const supabase = getSupabaseClient(supabaseClient);
    const channel = supabase
      .channel(`migration-job-records-${selectedJobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'migration_job_records',
          filter: `job_id=eq.${selectedJobId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      void supabase.removeChannel(channel);
    };
  }, [refreshSelectedJobData, selectedJobId, supabaseClient]);

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

  const handleStartMigration = () => {
    if (!selectedJob) return;
    setDispatchJob({
      id: selectedJob.id,
      job_key: selectedJob.job_key,
      total_records: selectedJob.total_records ?? summary?.total ?? 0,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <RecordsHeader
        jobs={jobs}
        selectedJobId={selectedJobId}
        onSelectedJobIdChange={setSelectedJobId}
        selectedJob={selectedJob}
        onStartMigration={handleStartMigration}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm">
        <RecordsFilters
          statusFilter={statusFilter}
          availableStatuses={availableStatuses}
          onStatusFilterChange={setStatusFilter}
          query={query}
          onQueryChange={setQuery}
        />

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

        {loading && records.length === 0 ? (
          <div className="flex h-full items-center justify-center py-10 text-xs text-muted-foreground">
            <Spinner className="mr-2 h-4 w-4" />
            Loading records…
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {refreshing && (
              <div className="flex items-center gap-2 border-b px-3 py-1.5 text-[11px] text-muted-foreground">
                <Spinner className="h-3 w-3" />
                Refreshing…
              </div>
            )}
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
                <thead className="sticky top-0 z-10 bg-muted/60 [&_th]:bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left">User ID</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Google</th>
                    <th className="px-3 py-2 text-left">Apple</th>
                    <th className="px-3 py-2 text-left">Old / Updated</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Attempts</th>
                    <th className="px-3 py-2 text-left">HTTP</th>
                    <th className="px-3 py-2 text-left">Error</th>
                    <th className="px-3 py-2 text-left">Last attempt</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((r) => (
                    <RecordRow
                      key={r.user_id}
                      record={r}
                      jobKey={selectedJob?.job_key ?? null}
                      onRefresh={() =>
                        selectedJobId
                          ? refreshSelectedJobData(selectedJobId)
                          : Promise.resolve()
                      }
                    />
                  ))}
                  {!filteredRecords.length && (
                    <tr>
                      <td
                        colSpan={11}
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
            await refreshSelectedJobData(selectedJobId);
          }}
        />
      )}
    </div>
  );
}
