import { getSupabaseClient } from './supabase';
import type { MigrationJobRecord } from '../types/migration';
import type { SupabaseClientName } from '../types/supabaseClient';

export type JobRecordSummary = {
  total: number;
  success: number;
  failed: number;
  pending: number;
};

type ListJobsPageOptions = {
  page: number;
  pageSize: number;
};

type ListJobsPageResult<TJob> = {
  jobs: TJob[];
  total: number;
};

export async function listJobs<TJob = any>(
  client: SupabaseClientName,
): Promise<TJob[]>;
export async function listJobs<TJob = any>(
  client: SupabaseClientName,
  options: ListJobsPageOptions,
): Promise<ListJobsPageResult<TJob>>;
export async function listJobs<TJob = any>(
  client: SupabaseClientName,
  options?: ListJobsPageOptions,
): Promise<TJob[] | ListJobsPageResult<TJob>> {
  const supabase = getSupabaseClient(client);
  const shouldPaginate = !!options;
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = shouldPaginate ? Math.max(0, (page - 1) * pageSize) : undefined;
  const to = shouldPaginate && from !== undefined ? from + pageSize - 1 : undefined;

  let query = supabase
    .from('migration_jobs')
    .select(
      'id, job_key, status, total_records, processed_records, success_records, failed_records, created_at, updated_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: true });

  if (shouldPaginate && from !== undefined && to !== undefined) {
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  if (shouldPaginate) {
    return {
      jobs: (data ?? []) as TJob[],
      total: count ?? (data?.length ?? 0),
    };
  }

  return (data ?? []) as TJob[];
}

export async function listJobRecords(
  jobId: string,
  client: SupabaseClientName,
): Promise<MigrationJobRecord[]> {
  const supabase = getSupabaseClient(client);
  const { data, error } = await supabase
    .from('migration_job_records')
    .select(
      'job_id, user_id, name, raw_user, status, attempts, max_attempts, last_error_code, last_error_message, last_http_status, auth0_request_id, old_name, updated_name, queued_at, first_attempt_at, last_attempt_at, completed_at, created_at, updated_at',
    )
    .eq('job_id', jobId)
    .order('user_id', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getJobRecordSummary(
  jobId: string,
  client: SupabaseClientName,
): Promise<JobRecordSummary> {
  const supabase = getSupabaseClient(client);
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

export async function getAllJobRecordsCount(
  client: SupabaseClientName,
): Promise<number> {
  const supabase = getSupabaseClient(client);
  const { count, error } = await supabase
    .from('migration_job_records')
    .select('user_id', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function jobKeyExists(
  jobKey: string,
  client: SupabaseClientName,
): Promise<boolean> {
  const supabase = getSupabaseClient(client);
  const { count, error } = await supabase
    .from('migration_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('job_key', jobKey);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

export async function deleteJobRecords(
  jobId: string,
  client: SupabaseClientName,
): Promise<void> {
  const supabase = getSupabaseClient(client);
  const { error } = await supabase
    .from('migration_job_records')
    .delete()
    .eq('job_id', jobId);

  if (error) throw error;
}

export async function deleteJob(
  jobId: number,
  client: SupabaseClientName,
): Promise<void> {
  const supabase = getSupabaseClient(client);
  const { error } = await supabase
    .from('migration_jobs')
    .delete()
    .eq('id', jobId);

  if (error) throw error;
}

export async function deleteJobAndRecords(
  job: { id: number },
  client: SupabaseClientName,
): Promise<void> {
  await deleteJobRecords(String(job.id), client);
  await deleteJob(job.id, client);
}

type SearchRecordsFilter = {
  query?: string;
  status?: string;
  jobId?: string;
};

type SearchRecordsOptions = {
  page?: number;
  pageSize?: number;
  filters?: SearchRecordsFilter;
};

export async function searchRecords(
  client: SupabaseClientName,
  options: SearchRecordsOptions = {},
): Promise<ListJobsPageResult<MigrationJobRecord>> {
  const supabase = getSupabaseClient(client);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  const filters = options.filters ?? {};

  let query = supabase
    .from('migration_job_records')
    .select(
      'job_id, user_id, name, raw_user, status, attempts, max_attempts, last_error_code, last_error_message, last_http_status, auth0_request_id, old_name, updated_name, queued_at, first_attempt_at, last_attempt_at, completed_at, created_at, updated_at',
      { count: 'exact' },
    );

  if (filters.query) {
    const searchTerm = `%${filters.query}%`;
    query = query.or(
      `user_id.ilike.${searchTerm},name.ilike.${searchTerm},raw_user->>email.ilike.${searchTerm}`,
    );
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.jobId) {
    query = query.eq('job_id', filters.jobId);
  }

  query = query.order('updated_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    jobs: (data ?? []) as MigrationJobRecord[],
    total: count ?? (data?.length ?? 0),
  };
}

