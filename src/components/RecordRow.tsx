import { useState } from 'react';
import type { MigrationJobRecord } from '../types/migration';
import { retryRecord } from '../lib/api';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';
import { useSupabaseClientSelection } from './SupabaseClientContext';

type Auth0Identity = {
  provider?: string;
  connection?: string;
  profileData?: {
    name?: string;
    email?: string;
    [key: string]: unknown;
  } | null;
};

type RawUser = {
  identities?: Auth0Identity[] | null;
  [key: string]: unknown;
};

function normalizeRawUser(raw: unknown | null | undefined): RawUser | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as RawUser;
      }
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as RawUser;
  }
  return null;
}

function getSocialProfileName(rawUser: RawUser | null, providerKey: string): string | null {
  if (!rawUser || !Array.isArray(rawUser.identities)) return null;
  for (const identity of rawUser.identities) {
    if (!identity) continue;
    const matchesProvider =
      identity.provider === providerKey || identity.connection === providerKey;
    if (!matchesProvider) continue;
    const name = identity.profileData && typeof identity.profileData.name === 'string'
      ? identity.profileData.name
      : null;
    if (name) return name;
  }
  return null;
}

type RecordRowProps = {
  record: MigrationJobRecord;
  jobKey: string | null;
  onRefresh: () => void | Promise<void>;
};

export function RecordRow({ record, jobKey, onRefresh }: RecordRowProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const { supabaseClient } = useSupabaseClientSelection();

  const rawUser = normalizeRawUser(record.raw_user as unknown);
  const googleName = getSocialProfileName(rawUser, 'google-oauth2');
  const appleName = getSocialProfileName(rawUser, 'apple');

  const handleRetry = async () => {
    if (!jobKey || isRetrying) return;
    try {
      setIsRetrying(true);
      await retryRecord(jobKey, record.user_id, supabaseClient);
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
        {googleName || '—'}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {appleName || '—'}
      </td>
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

