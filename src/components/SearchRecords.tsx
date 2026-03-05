import { useCallback, useEffect, useState } from 'react';
import { searchRecords } from '../lib/jobs';
import { listJobs } from '../lib/jobs';
import type { MigrationJobRecord } from '../types/migration';
import { useSupabaseClientSelection } from './SupabaseClientContext';
import { Spinner } from './ui/spinner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { RecordRow } from './RecordRow';

type JobRow = {
  id: number;
  job_key: string;
};

const STATUS_OPTIONS = ['all', 'pending', 'success', 'failed'];

export function SearchRecords() {
  const [records, setRecords] = useState<MigrationJobRecord[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [jobId, setJobId] = useState('');

  const { supabaseClient } = useSupabaseClientSelection();

  // Load jobs for filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const data = await listJobs(supabaseClient);
        setJobs(data);
      } catch (error) {
        console.error('Failed to load jobs:', error);
      }
    })();
  }, [supabaseClient]);

  // Load records with filters
  const loadRecords = useCallback(
    async (pageNum: number = 1) => {
      setLoading(true);
      try {
        const result = await searchRecords(supabaseClient, {
          page: pageNum,
          pageSize,
          filters: {
            query: searchQuery || undefined,
            status: status !== 'all' ? status : undefined,
            jobId: jobId || undefined,
          },
        });
        setRecords(result.jobs);
        setTotal(result.total);
        setPage(pageNum);
      } catch (error) {
        console.error('Failed to search records:', error);
        setRecords([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [supabaseClient, searchQuery, status, jobId],
  );

  useEffect(() => {
    loadRecords(1);
  }, [loadRecords]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Search Records</h2>
        
        {/* Filters */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Search
              </label>
              <Input
                type="text"
                placeholder="Search user ID, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-slate-500">
                Searches: user ID, name, email
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Job
              </label>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All jobs</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.job_key}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setStatus('all');
                  setJobId('');
                  setPage(1);
                }}
                variant="outline"
                className="w-full text-xs"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Results info */}
        <div className="text-xs text-slate-600">
          {loading ? (
            'Loading...'
          ) : (
            <>
              Showing {Math.min((page - 1) * pageSize + 1, total)}-
              {Math.min(page * pageSize, total)} of {total} records
            </>
          )}
        </div>
      </div>

      {/* Records table */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <Spinner />
          </div>
        )}
        
        {records.length === 0 && !loading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <div className="text-center">
              <p className="text-sm font-medium">No records found</p>
              <p className="mt-1 text-xs">Try adjusting your search filters</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="border-r border-slate-200 px-4 py-2 text-left font-medium text-slate-700">
                    User ID
                  </th>
                  <th className="border-r border-slate-200 px-4 py-2 text-left font-medium text-slate-700">
                    Name
                  </th>
                  <th className="border-r border-slate-200 px-4 py-2 text-left font-medium text-slate-700">
                    Google name
                  </th>
                  <th className="border-r border-slate-200 px-4 py-2 text-left font-medium text-slate-700">
                    Apple name
                  </th>
                  <th className="border-r border-slate-200 px-4 py-2 text-left font-medium text-slate-700">
                    Job ID
                  </th>
                  <th className="border-r border-slate-200 px-4 py-2 text-left font-medium text-slate-700">
                    Attempts
                  </th>
                  <th className="border-r border-slate-200 px-4 py-2 text-left font-medium text-slate-700">
                    Updated At
                  </th>
              
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((record) => {
                    const job = jobs.find((j) => j.id.toString() === record.job_id);
                  return (
                    <RecordRow 
                      key={`${record.job_id}-${record.user_id}`} 
                      record={record} 
                      jobKey={job?.job_key || null}
                      onRefresh={() => loadRecords(page)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-600">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => loadRecords(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
              variant="outline"
              className="text-xs"
            >
              Previous
            </Button>
            <Button
              onClick={() => loadRecords(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || loading}
              variant="outline"
              className="text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
