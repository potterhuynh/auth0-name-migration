import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Upload, Eye, History, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { ingestFile } from '../lib/api';
import { listJobs } from '../lib/jobs';
import {
  uploadFileToStorage,
  insertUploadHistory,
  listUploadHistory,
  getUploadDownloadUrl,
  downloadUploadFile,
  type UploadHistoryRow,
} from '../lib/uploads';
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

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function isSkippedIdentityProvider(provider: string): boolean {
  return provider.toLowerCase() === 'auth0';
}

type IdentityItem = {
  provider?: unknown;
  profileData?: unknown;
  projectData?: unknown;
};

function getIdentities(record: UploadRecord): IdentityItem[] {
  const identities = (record as { identities?: unknown }).identities;
  if (!Array.isArray(identities)) return [];
  return identities.filter((item) => !!item && typeof item === 'object') as IdentityItem[];
}

function getIdentityName(identity: IdentityItem): string {
  const projectData = identity.projectData;
  if (projectData && typeof projectData === 'object') {
    const name = pickString((projectData as { name?: unknown }).name);
    if (name) return name;
  }

  const profileData = identity.profileData;
  if (profileData && typeof profileData === 'object') {
    return pickString((profileData as { name?: unknown }).name);
  }

  return '';
}

function getIdentityProviders(records: UploadRecord[]): string[] {
  const seen = new Set<string>();
  const providers: string[] = [];
  records.forEach((record) => {
    getIdentities(record).forEach((identity) => {
      const provider = pickString(identity.provider);
      if (!provider || isSkippedIdentityProvider(provider) || seen.has(provider)) return;
      seen.add(provider);
      providers.push(provider);
    });
  });
  return providers;
}

function getIdentityValueByProvider(record: UploadRecord, provider: string): string {
  for (const identity of getIdentities(record)) {
    const identityProvider = pickString(identity.provider);
    if (isSkippedIdentityProvider(identityProvider) || identityProvider !== provider) continue;
    const name = getIdentityName(identity);
    if (name) return name;
  }
  return '';
}

function getIdentitySearchText(record: UploadRecord): string {
  return getIdentities(record)
    .filter((identity) => !isSkippedIdentityProvider(pickString(identity.provider)))
    .map((identity) => `${pickString(identity.provider)} ${getIdentityName(identity)}`)
    .join(' ')
    .trim();
}

export function UploadSection() {
  const { supabaseClient } = useSupabaseClientSelection();
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingJobKey, setUploadingJobKey] = useState<string | null>(null);
  const [uploadAllInProgress, setUploadAllInProgress] = useState(false);
  const [existingJobKeys, setExistingJobKeys] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listJobs(supabaseClient)
      .then((jobs) => setExistingJobKeys(new Set(jobs.map((j) => j.job_key))))
      .catch(() => setExistingJobKeys(new Set()));
  }, [supabaseClient]);

  const [previewRecords, setPreviewRecords] = useState<UploadRecord[]>([]);
  const [skippedRecords, setSkippedRecords] = useState<UploadRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDownloadingId, setPreviewDownloadingId] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuery, setPreviewQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'valid' | 'skipped'>('valid');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [uploadHistory, setUploadHistory] = useState<UploadHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    listUploadHistory(supabaseClient, { limit: 20 })
      .then(setUploadHistory)
      .catch(() => setUploadHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [supabaseClient]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

  const uploadFileAndHistory = useCallback(
    async (file: File) => {
      const jobKey = jobKeyFromFile(file);
      try {
        const { validRecords } = await parseFileToEmailRecords(file);
        const storagePath = await uploadFileToStorage(supabaseClient, file, jobKey);
        await insertUploadHistory(supabaseClient, {
          job_key: jobKey,
          file_name: file.name,
          storage_path: storagePath,
          file_size: file.size,
          record_count: validRecords.length,
        });
        loadHistory();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast(`File saved partially: ${msg}`, { icon: '⚠️' });
      }
    },
    [loadHistory, parseFileToEmailRecords, supabaseClient],
  );

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const list = Array.from(newFiles);
      const jsonOnly = list.filter(isJsonFile);
      setStatus(null);
      if (list.length !== jsonOnly.length) {
        toast('Only .json files were added.', { icon: 'ℹ️' });
      }
      jsonOnly.forEach((f) => {
        void uploadFileAndHistory(f);
      });
    },
    [uploadFileAndHistory],
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
        const recordCount = res.total_records ?? validRecords.length;
        const okMsg = `Ingested ${recordCount} records for job ${res.job_key}`;
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
    const pending = uploadHistory.filter((row) => !existingJobKeys.has(row.job_key));
    if (!pending.length) return;
    setUploadAllInProgress(true);
    setStatus(null);
    let done = 0;
    for (const row of pending) {
      try {
        const file = await downloadUploadFile(supabaseClient, row.storage_path, row.file_name);
        await uploadOneFile(file);
        done++;
        setStatus(`Created jobs for ${done} of ${pending.length} uploads.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Could not create job for ${row.job_key}: ${msg}`);
      }
    }
    setStatus(`Finished creating jobs for ${done} upload(s).`);
    setUploadAllInProgress(false);
  }, [uploadHistory, existingJobKeys, supabaseClient, uploadOneFile]);

  const q = previewQuery.trim().toLowerCase();
  const baseRecords = activeTab === 'valid' ? previewRecords : skippedRecords;
  const filteredPreview = q
    ? baseRecords.filter((r) => {
        const rec = r as {
          name?: unknown;
          user_id?: unknown;
          email?: unknown;
        };
        const name = pickString(rec.name);
        const userId = pickString(rec.user_id);
        const email = pickString(rec.email);
        const identitiesText = getIdentitySearchText(r);
        const haystack = `${userId} ${name} ${email} ${identitiesText}`.toLowerCase();
        return haystack.includes(q);
      })
    : baseRecords;

  const identityProviders = getIdentityProviders(baseRecords);

  const totalFiltered = filteredPreview.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRecords = filteredPreview.slice(start, start + pageSize);

  const skipped = skippedRecords.length;
  const anyUploading = !!uploadingJobKey || uploadAllInProgress;
  const hasPendingHistoryJobs = uploadHistory.some((row) => !existingJobKeys.has(row.job_key));

  const closePreviewSheet = () => {
    setIsPreviewOpen(false);
    setPreviewTitle(null);
    setPreviewQuery('');
    setPreviewError(null);
    setPage(1);
  };

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

      {status && <p className="text-sm text-slate-600">{status}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <History className="h-4 w-4 text-muted-foreground" />
            Files & recent uploads
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="xs"
              onClick={uploadAll}
              disabled={anyUploading || !hasPendingHistoryJobs}
            >
              {uploadAllInProgress && <Spinner className="mr-2 h-3.5 w-3.5" />}
              Create jobs for all
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={loadHistory}
              disabled={historyLoading}
            >
              {historyLoading ? <Spinner className="h-3.5 w-3.5" /> : 'Refresh'}
            </Button>
          </div>
        </div>
        {uploadHistory.length === 0 && !historyLoading && (
          <p className="text-xs text-muted-foreground">No upload history yet. Files are saved to Storage and listed here after each upload.</p>
        )}
        {uploadHistory.length > 0 && (
          <div className="rounded-md border bg-card overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Job key</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">File</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Records</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploadHistory.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{row.job_key}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]" title={row.file_name}>{row.file_name}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{row.record_count}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="gap-1"
                          disabled={previewLoading || previewDownloadingId !== null}
                          onClick={async () => {
                            setPreviewDownloadingId(row.id);
                            try {
                              setPreviewTitle(row.file_name);
                              setIsPreviewOpen(true);
                              setPreviewQuery('');
                              setPreviewError(null);
                              const file = await downloadUploadFile(
                                supabaseClient,
                                row.storage_path,
                                row.file_name,
                              );
                              await loadPreviewForFile(file);
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : String(err);
                              toast.error(`Could not preview file: ${msg}`);
                            } finally {
                              setPreviewDownloadingId(null);
                            }
                          }}
                        >
                          {previewDownloadingId === row.id ? (
                            <>
                              <Spinner className="h-3.5 w-3.5" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          disabled={anyUploading || existingJobKeys.has(row.job_key)}
                          className="gap-1"
                          onClick={async () => {
                            try {
                              const file = await downloadUploadFile(
                                supabaseClient,
                                row.storage_path,
                                row.file_name,
                              );
                              await uploadOneFile(file);
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : String(err);
                              toast.error(`Could not create job: ${msg}`);
                            }
                          }}
                          title={
                            existingJobKeys.has(row.job_key)
                              ? `Job "${row.job_key}" already exists`
                              : undefined
                          }
                        >
                          {uploadingJobKey === row.job_key && (
                            <Spinner className="h-3.5 w-3.5" />
                          )}
                          <Upload className="h-3.5 w-3.5" />
                          Create job
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={async () => {
                            try {
                              const url = await getUploadDownloadUrl(
                                supabaseClient,
                                row.storage_path,
                              );
                              window.open(url, '_blank');
                            } catch {
                              toast.error('Could not get download link');
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet
        open={isPreviewOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsPreviewOpen(true);
            return;
          }
          closePreviewSheet();
        }}
      >
        <SheetContent side="center" disableAnimation className="gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Preview: {previewTitle ?? 'Upload'}</SheetTitle>
            <SheetDescription>
              Review valid and skipped records before creating a job.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
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
                  Skipped: <span className="font-semibold">{skipped}</span>
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
              <div className="flex min-w-[160px] flex-1 items-center gap-1 sm:min-w-[220px]">
                <input
                  type="text"
                  placeholder={
                    activeTab === 'valid'
                      ? 'Filter by user_id, name, email, provider, identity name…'
                      : 'Filter skipped by user_id, name, email, provider, identity name…'
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
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/60 [&_th]:bg-muted/60">
                    <tr>
                      <th className="px-3 py-1.5 text-left">#</th>
                      <th className="px-3 py-1.5 text-left">User ID</th>
                      <th className="px-3 py-1.5 text-left">Name</th>
                      <th className="px-3 py-1.5 text-left">Email</th>
                      {identityProviders.map((provider) => (
                        <th key={provider} className="px-3 py-1.5 text-left">
                          {provider}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRecords.map((r, idx) => {
                      const rec = r as {
                        user_id?: unknown;
                        name?: unknown;
                        email?: unknown;
                      };
                      return (
                        <tr key={`preview-${start + idx}`} className="border-t border-border/60">
                          <td className="px-3 py-1.5 text-[11px] text-muted-foreground">
                            {start + idx + 1}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                            {pickString(rec.user_id) || '-'}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px]">{pickString(rec.name) || '-'}</td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                            {pickString(rec.email) || '-'}
                          </td>
                          {identityProviders.map((provider) => {
                            const identityName = getIdentityValueByProvider(r, provider);
                            return (
                              <td key={`${provider}-${start + idx}`} className="px-3 py-1.5 text-[11px] text-muted-foreground">
                                {identityName || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {!pageRecords.length && (
                      <tr>
                        <td
                          colSpan={4 + identityProviders.length}
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
        </SheetContent>
      </Sheet>
    </div>
  );
}

