import { supabase } from './supabase';
import type { MigrationJobRecord } from '../types/migration';

export type JobRecordSummary = {
  total: number;
  success: number;
  failed: number;
  pending: number;
};

export async function listJobs() {
  const { data, error } = await supabase
    .from('migration_jobs')
    .select(
      'id, job_key, status, total_records, processed_records, success_records, failed_records, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listJobRecords(jobId: string): Promise<MigrationJobRecord[]> {
  const { data, error } = await supabase
    .from('migration_job_records')
    .select(
      'job_id, user_id, name, source_hash, status, attempts, max_attempts, last_error_code, last_error_message, last_http_status, auth0_request_id, old_name, updated_name, queued_at, first_attempt_at, last_attempt_at, completed_at, created_at, updated_at',
    )
    .eq('job_id', jobId)
    .order('user_id', { ascending: true })
    .limit(200);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getJobRecordSummary(jobId: string): Promise<JobRecordSummary> {
  const table = supabase.from('migration_job_records');

  const [
    { count: total, error: totalError },
    { count: success, error: successError },
    { count: failed, error: failedError },
    { count: pending, error: pendingError },
  ] = await Promise.all([
    table.select('user_id', { count: 'exact', head: true }).eq('job_id', jobId),
    table
      .select('user_id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'success'),
    table
      .select('user_id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'failed'),
    table
      .select('user_id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'pending'),
  ]);

  if (totalError || successError || failedError || pendingError) {
    throw totalError || successError || failedError || pendingError!;
  }

  return {
    total: total ?? 0,
    success: success ?? 0,
    failed: failed ?? 0,
    pending: pending ?? 0,
  };
}

export async function deleteJobRecords(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('migration_job_records')
    .delete()
    .eq('job_id', jobId);

  if (error) throw error;
}

export async function deleteJob(jobId: number): Promise<void> {
  const { error } = await supabase
    .from('migration_jobs')
    .delete()
    .eq('id', jobId);

  if (error) throw error;
}

export async function deleteJobAndRecords(job: { id: number }): Promise<void> {
  await deleteJobRecords(String(job.id));
  await deleteJob(job.id);
}

