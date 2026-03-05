import { useEffect, useState } from 'react';
import { listJobs, listJobRecords } from '../lib/jobs';
import { Button } from './ui/button';
import { useSupabaseClientSelection } from './SupabaseClientContext';

export function JobsTable() {
  const { supabaseClient } = useSupabaseClientSelection();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await listJobs(supabaseClient);
      setJobs(data);
    })();
  }, [supabaseClient]);

  const loadRecords = async (job: any) => {
    setSelectedJob(job);
    setLoadingRecords(true);
    try {
      const data = await listJobRecords(String(job.id), supabaseClient);
      setRecords(data);
    } finally {
      setLoadingRecords(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Jobs</h2>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Job key</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Processed</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{job.job_key}</td>
                  <td className="px-3 py-2">{job.status}</td>
                  <td className="px-3 py-2 text-right">{job.total_records}</td>
                  <td className="px-3 py-2 text-right">{job.processed_records}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadRecords(job)}
                    >
                      View records
                    </Button>
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                    No jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Records {selectedJob && `for ${selectedJob.job_key}`}
        </h2>
        {loadingRecords ? (
          <p className="text-sm text-slate-600">Loading records…</p>
        ) : (
          <div className="max-h-96 overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 [&_th]:bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">User ID</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Attempts</th>
                  <th className="px-3 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.user_id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.user_id}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-right">{r.attempts}</td>
                    <td className="px-3 py-2 text-xs text-red-500">
                      {r.last_error_code || r.last_error_message || ''}
                    </td>
                  </tr>
                ))}
                {!records.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                      No records loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

