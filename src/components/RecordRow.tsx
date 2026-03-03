import type { MigrationJobRecord } from '../types/migration';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';

type RecordRowProps = {
  record: MigrationJobRecord;
  onRetry: (userId: string) => void | Promise<void>;
};

export function RecordRow({ record, onRetry }: RecordRowProps) {
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
            onClick={() => onRetry(record.user_id)}
          >
            Retry
          </Button>
        )}
      </td>
    </tr>
  );
}

