import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Upload, Eye, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { ingestFile } from '../lib/api';
import { listJobs } from '../lib/jobs';
import { cn } from '../lib/cn';
import { useSupabaseClientSelection } from './SupabaseClientContext';

function jobKeyFromFile(file: File): string {
  const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'upload';
  return base;
}

function isJsonFile(f: File): boolean {
  return f.name.toLowerCase().endsWith('.json') || f.type === 'application/json';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UploadRecord = {
  name?: string;
  [key: string]: unknown;
};

export function UploadSection() {
  const { supabaseClient } = useSupabaseClientSelection();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingJobKey, setUploadingJobKey] = useState<string | null>(null);
  const [uploadAllInProgress, setUploadAllInProgress] = useState(false);
  const [existingJobKeys, setExistingJobKeys] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (files.length === 0) return;
    listJobs(supabaseClient)
      .then((jobs) => setExistingJobKeys(new Set(jobs.map((j) => j.job_key))))
      .catch(() => setExistingJobKeys(new Set()));
  }, [files.length, supabaseClient]);

  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null);
  const [previewRecords, setPreviewRecords] = useState<UploadRecord[]>([]);
  const [skippedRecords, setSkippedRecords] = useState<UploadRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewQuery, setPreviewQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'valid' | 'skipped'>('valid');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const parseFileToEmailRecords = useCallback(async (f: File) => {
    const text = await f.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error('File must contain a JSON array');
    }
    const records = data as UploadRecord[];
    const emailRecords = records.filter(
      (r) => r && typeof r.name === 'string' && EMAIL_REGEX.test(r.name),
    );
    const skipped = records.filter(
      (r) => !r || typeof r.name !== 'string' || !EMAIL_REGEX.test(r.name),
    );
    return { validRecords: emailRecords, skippedRecords: skipped, total: records.length };
  }, []);

  const loadPreviewForFile = useCallback(
    async (f: File) => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const { validRecords, skippedRecords: skipped, total } = await parseFileToEmailRecords(f);
        setPreviewRecords(validRecords);
        setSkippedRecords(skipped);
        setTotalRecords(total);
        setActiveTab('valid');
        setPage(1);
      } catch (err: unknown) {
        setPreviewRecords([]);
        setSkippedRecords([]);
        setTotalRecords(0);
        setPreviewError(err instanceof Error ? err.message : String(err));
      } finally {
        setPreviewLoading(false);
      }
    },
    [parseFileToEmailRecords],
  );

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles);
    const jsonOnly = list.filter(isJsonFile);
    setFiles((prev) => [...prev, ...jsonOnly]);
    setStatus(null);
    if (list.length !== jsonOnly.length) {
      toast('Only .json files were added.', { icon: 'ℹ️' });
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (previewingIndex === index) {
      setPreviewingIndex(null);
      setPreviewRecords([]);
      setSkippedRecords([]);
      setTotalRecords(0);
      setPreviewError(null);
    } else if (previewingIndex !== null && previewingIndex > index) {
      setPreviewingIndex(previewingIndex - 1);
    }
  }, [previewingIndex]);

  const handlePreviewRecords = useCallback(
    async (index: number) => {
      const f = files[index];
      if (!f) return;
      setPreviewingIndex(index);
      setPreviewError(null);
      await loadPreviewForFile(f);
    },
    [files, loadPreviewForFile],
  );

  const uploadOneFile = useCallback(
    async (file: File) => {
      const jobKey = jobKeyFromFile(file);
      if (existingJobKeys.has(jobKey)) {
        toast.error(`Job key "${jobKey}" already exists.`);
        return;
      }
      setUploadingJobKey(jobKey);
      setStatus(null);
      try {
        const { validRecords } = await parseFileToEmailRecords(file);
        if (!validRecords.length) {
          toast.error('No records with a valid email-format name to upload.');
          return;
        }
        const res = await ingestFile(jobKey, validRecords, supabaseClient);
        const okMsg = `Ingested ${res.total_records ?? validRecords.length} records for job ${res.job_key}`;
        toast.success(okMsg);
        setStatus(okMsg);
        setExistingJobKeys((prev) => new Set([...prev, res.job_key]));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(msg);
        setStatus(`Error: ${msg}`);
      } finally {
        setUploadingJobKey(null);
      }
    },
    [parseFileToEmailRecords, existingJobKeys, supabaseClient],
  );

  const uploadAll = useCallback(async () => {
    if (!files.length) return;
    setUploadAllInProgress(true);
    setStatus(null);
    let done = 0;
    for (let i = 0; i < files.length; i++) {
      await uploadOneFile(files[i]);
      done++;
      setStatus(`Uploaded ${done} of ${files.length} files.`);
    }
    setStatus(`Finished uploading ${done} file(s).`);
    setUploadAllInProgress(false);
  }, [files, uploadOneFile]);

  const q = previewQuery.trim().toLowerCase();
  const baseRecords = activeTab === 'valid' ? previewRecords : skippedRecords;
  const filteredPreview = q
    ? baseRecords.filter((r) => {
        const name = (r.name ?? '') as string;
        const userId = (r as any).user_id ?? '';
        const email = (r as any).email ?? '';
        const haystack = `${name} ${userId} ${email}`.toLowerCase();
        return haystack.includes(q);
      })
    : baseRecords;

  const totalFiltered = filteredPreview.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRecords = filteredPreview.slice(start, start + pageSize);

  const skipped = skippedRecords.length;
  const anyUploading = !!uploadingJobKey || uploadAllInProgress;
  const uploadableCount = files.filter((f) => !existingJobKeys.has(jobKeyFromFile(f))).length;
  const allJobsExist = files.length > 0 && uploadableCount === 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">JSON files</label>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          onChange={(e) => {
            const chosen = e.target.files;
            if (chosen?.length) addFiles(chosen);
            e.target.value = '';
          }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            const dropped = e.dataTransfer.files;
            if (dropped?.length) addFiles(dropped);
          }}
          className={cn(
            'relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50',
          )}
        >
          <Upload className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-sm font-medium text-foreground">
            Drag files here or click to browse
          </span>
          <span className="text-xs text-muted-foreground">
            .json only · multiple files allowed
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Job key per file is derived from the file name. Only records whose <code>name</code> is a
          valid email will be uploaded.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Files ready for upload</span>
            <Button
              type="button"
              size="sm"
              onClick={uploadAll}
              disabled={anyUploading || allJobsExist}
            >
              {uploadAllInProgress && <Spinner className="mr-2 h-3.5 w-3.5" />}
              Upload all
            </Button>
          </div>
          <div className="rounded-md border bg-card">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">File</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Size</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, index) => {
                  const jobKey = jobKeyFromFile(f);
                  const isUploading = uploadingJobKey === jobKey;
                  const isPreviewing = previewingIndex === index;
                  const jobExists = existingJobKeys.has(jobKey);
                  return (
                    <tr
                      key={`${f.name}-${index}`}
                      className={cn(
                        'border-t border-border/60',
                        isPreviewing && 'bg-primary/5',
                      )}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">{f.name}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {(f.size / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={anyUploading}
                            onClick={() => handlePreviewRecords(index)}
                            className="gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview records
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            disabled={anyUploading || jobExists}
                            onClick={() => uploadOneFile(f)}
                            className="gap-1"
                            title={jobExists ? `Job "${jobKey}" already exists` : undefined}
                          >
                            {isUploading && <Spinner className="h-3.5 w-3.5" />}
                            <Upload className="h-3.5 w-3.5" />
                            Upload
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={anyUploading}
                            onClick={() => removeFile(index)}
                            aria-label="Remove file"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previewingIndex !== null && files[previewingIndex] && (
      <div className="space-y-2 rounded-md border bg-card text-card-foreground">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
            Preview: {files[previewingIndex].name}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Valid:{' '}
            <span className="font-semibold">{previewRecords.length}</span>
            {totalRecords > 0 && (
              <>
                {' '}
                of <span className="font-semibold text-emerald-800">{totalRecords}</span>
              </>
            )}
          </span>
          {skipped > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Skipped:{' '}
              <span className="font-semibold">{skipped}</span>
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium shadow-sm transition-colors',
                activeTab === 'valid'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
              )}
              onClick={() => {
                setActiveTab('valid');
                setPage(1);
              }}
            >
              Will upload ({previewRecords.length})
            </button>
            <button
              type="button"
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-medium shadow-sm transition-colors',
                activeTab === 'skipped'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
              )}
              onClick={() => {
                setActiveTab('skipped');
                setPage(1);
              }}
            >
              Skipped ({skipped})
            </button>
          </div>
          <div className="ml-auto flex min-w-[160px] flex-1 items-center gap-1 sm:min-w-[220px]">
            <input
              type="text"
              placeholder={
                activeTab === 'valid'
                  ? 'Filter by email, user id…'
                  : 'Filter skipped by name, user id…'
              }
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={previewQuery}
              onChange={(e) => {
                setPreviewQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {previewLoading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <Spinner className="h-3.5 w-3.5" />
            Parsing file…
          </div>
        ) : previewError ? (
          <p className="px-3 py-3 text-xs text-red-500">{previewError}</p>
        ) : (
          <div className="min-h-[120px] max-h-64 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-1.5 text-left">#</th>
                  <th className="px-3 py-1.5 text-left">
                    {activeTab === 'valid' ? 'Name (email)' : 'Name (skipped)'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRecords.map((r, idx) => (
                  <tr key={`${r.name}-${start + idx}`} className="border-t border-border/60">
                    <td className="px-3 py-1.5 text-[11px] text-muted-foreground">
                      {start + idx + 1}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px]">{(r.name ?? '') as string}</td>
                  </tr>
                ))}
                {!pageRecords.length && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-3 text-center text-[11px] text-muted-foreground"
                    >
                      {activeTab === 'valid'
                        ? 'No records with email-format names in this file.'
                        : 'No skipped records without email-format names.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalFiltered > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              Rows {start + 1}-{Math.min(start + pageSize, totalFiltered)} of {totalFiltered}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span>
                Page {currentPage} of {pageCount}
              </span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {status && <p className="text-sm text-slate-600">{status}</p>}
    </div>
  );
}

