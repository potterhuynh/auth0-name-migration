import { getSupabaseClient } from './supabase';
import type { SupabaseClientName } from '../types/supabaseClient';

export const UPLOADS_BUCKET = 'migration-uploads';

export type UploadHistoryRow = {
  id: string;
  job_key: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  record_count: number;
  created_at: string;
};

/**
 * Upload a file to Supabase Storage and return the storage path.
 * Path format: {jobKey}/{timestamp}_{fileName}
 */
export async function uploadFileToStorage(
  client: SupabaseClientName,
  file: File,
  jobKey: string,
): Promise<string> {
  const supabase = getSupabaseClient(client);
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${jobKey}/${timestamp}_${safeName}`;

  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'application/json',
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return storagePath;
}

/**
 * Insert an upload history row (after successful ingest).
 */
export async function insertUploadHistory(
  client: SupabaseClientName,
  row: {
    job_key: string;
    file_name: string;
    storage_path: string;
    file_size: number;
    record_count: number;
  },
): Promise<UploadHistoryRow | null> {
  const supabase = getSupabaseClient(client);
  const { data, error } = await supabase
    .from('upload_history')
    .insert({
      job_key: row.job_key,
      file_name: row.file_name,
      storage_path: row.storage_path,
      file_size: row.file_size,
      record_count: row.record_count,
    })
    .select('id, job_key, file_name, storage_path, file_size, record_count, created_at')
    .single();

  if (error) {
    console.warn('Upload history insert failed (table may not exist):', error.message);
    return null;
  }

  return data as UploadHistoryRow;
}

/**
 * List recent upload history, newest first.
 */
export async function listUploadHistory(
  client: SupabaseClientName,
): Promise<UploadHistoryRow[]> {
  const supabase = getSupabaseClient(client);
  const { data, error } = await supabase
    .from('upload_history')
    .select('id, job_key, file_name, storage_path, file_size, record_count, created_at')
    .order('job_key', { ascending: true });

  if (error) {
    console.warn('Upload history list failed (table may not exist):', error.message);
    return [];
  }

  return (data ?? []) as UploadHistoryRow[];
}

/**
 * Get a signed URL to download a file from storage (optional, for history UI).
 */
export async function getUploadDownloadUrl(
  client: SupabaseClientName,
  storagePath: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = getSupabaseClient(client);
  const { data, error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new Error(`Signed URL failed: ${error.message}`);
  }
  return data.signedUrl;
}

/**
 * Download an uploaded file from Storage as a File object.
 * Useful for previewing records or creating jobs from history.
 */
export async function downloadUploadFile(
  client: SupabaseClientName,
  storagePath: string,
  fileName: string,
): Promise<File> {
  const supabase = getSupabaseClient(client);
  const { data, error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .download(storagePath);

  if (error) {
    throw new Error(`Download failed: ${error.message}`);
  }

  const blob = data;
  return new File([blob], fileName, { type: 'application/json' });
}
