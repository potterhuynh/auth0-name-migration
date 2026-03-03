import { useState } from 'react';
import type { MigrationJobRecord } from '../types/migration';
import { retryRecord } from '../lib/api';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';

type RecordRowProps = {
  record: MigrationJobRecord;
  jobKey: string | null;
  onRefresh: () => void | Promise<void>;
};

export function RecordRow({ record, jobKey, onRefresh }: RecordRowProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!jobKey || isRetrying) return;
    try {
      setIsRetrying(true);
      await retryRecord(jobKey, record.user_id);
      await onRefresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setIsRetrying(false);
    }
  };
  return (
    <tr className="border-t border-border/60">
      <td className="px-3 py-2 font-mono text-xs">{record.user_id}</td>
      <td className="px-3 py-2">{record.name}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {[record.old_name, record.updated_name].filter(Boolean).join(' → ') || '—'}
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={record.status} />
      </td>
      <td className="px-3 py-2 text-right">
        {record.attempts} / {record.max_attempts}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {record.last_http_status ?? '—'}
      </td>
      <td
        className="px-3 py-2 max-w-[12rem] truncate text-xs text-red-500"
        title={record.last_error_message ?? undefined}
      >
        {record.last_error_code || record.last_error_message || '—'}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {record.last_attempt_at ? new Date(record.last_attempt_at).toLocaleString() : '—'}
      </td>
      <td className="px-3 py-2 text-xs">
        {record.status !== 'success' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isRetrying || !jobKey}
            onClick={handleRetry}
          >
            {isRetrying
              ? record.status === 'pending'
                ? 'Starting…'
                : 'Retrying…'
              : record.status === 'pending'
                ? 'Start'
                : 'Retry'}
          </Button>
        )}
      </td>
    </tr>
  );
}

