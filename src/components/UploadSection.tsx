import { useState, useRef } from 'react';
import { Upload, FileJson } from 'lucide-react';
import { Button } from './ui/button';
import { ingestFile } from '../lib/api';
import { cn } from '../lib/cn';

function jobKeyFromFile(file: File): string {
  const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'upload';
  return base;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UploadRecord = {
  name?: string;
  [key: string]: unknown;
};

export function UploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewRecords, setPreviewRecords] = useState<UploadRecord[]>([]);
  const [skippedRecords, setSkippedRecords] = useState<UploadRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewQuery, setPreviewQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'valid' | 'skipped'>('valid');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const parseFileToEmailRecords = async (f: File) => {
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
  };

  const loadPreviewForFile = async (f: File) => {
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
  };

  const setFileFromInput = (f: File | null) => {
    if (f && !f.name.toLowerCase().endsWith('.json') && f.type !== 'application/json') return;
    setFile(f);
    setStatus(null);
    setPreviewError(null);
    setPreviewRecords([]);
    setSkippedRecords([]);
    setTotalRecords(0);
    setActiveTab('valid');
    setPage(1);

    if (f) {
      void loadPreviewForFile(f);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus(null);

    try {
      let recordsToUpload = previewRecords;

      if (!recordsToUpload.length) {
        // Fallback: parse file now if preview hasn't run or failed.
        const { records } = await parseFileToEmailRecords(file);
        recordsToUpload = records;
      }

      if (!recordsToUpload.length) {
        setStatus('No records with a valid email-format name to upload.');
        return;
      }

      const jobKey = jobKeyFromFile(file);
      const res = await ingestFile(jobKey, recordsToUpload);
      setStatus(
        `Ingested ${res.total_records ?? recordsToUpload.length} records for job ${res.job_key}`,
      );
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">JSON file</label>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => setFileFromInput(e.target.files?.[0] ?? null)}
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
            const f = e.dataTransfer.files?.[0];
            if (f) setFileFromInput(f);
          }}
          className={cn(
            'relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50',
          )}
        >
          {file ? (
            <>
              <FileJson className="size-10 text-primary" strokeWidth={1.5} />
              <span className="text-sm font-medium text-foreground">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · click or drop to replace
              </span>
            </>
          ) : (
            <>
              <Upload className="size-10 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-sm font-medium text-foreground">
                Drag file here or click to browse
              </span>
              <span className="text-xs text-muted-foreground">.json only</span>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Job key will be the file name (e.g. users_export). Only records whose <code>name</code>{' '}
          is a valid email will be uploaded.
        </p>
      </div>

      <div className="space-y-2 rounded-md border bg-card text-card-foreground">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
            Preview
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
          <p className="px-3 py-3 text-xs text-muted-foreground">Parsing file…</p>
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
                      {!file
                        ? 'Select a file to preview records.'
                        : activeTab === 'valid'
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

      <Button type="submit" disabled={loading || !file}>
        {loading ? 'Uploading…' : 'Upload & ingest'}
      </Button>

      {status && <p className="text-sm text-slate-600">{status}</p>}
    </form>
  );
}

