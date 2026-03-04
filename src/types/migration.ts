export type MigrationJobRecordStatus = string;

export interface MigrationJobRecord {
  job_id: string;
  user_id: string;
  name: string;
  // denormalized / audit fields
  identities?: unknown | null;
  raw_user?: unknown | null;
  status: MigrationJobRecordStatus;
  attempts: number;
  max_attempts: number;
  last_error_code: string | null;
  last_error_message: string | null;
  last_http_status: number | null;
  auth0_request_id: string | null;
  old_name: string | null;
  updated_name: string | null;
  queued_at: string | null;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
