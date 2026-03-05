import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClientName } from '../types/supabaseClient';

const primaryUrl =
  (import.meta.env.VITE_SUPABASE_PRIMARY_URL as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_URL as string);
const primaryKey =
  (import.meta.env.VITE_SUPABASE_PRIMARY_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string);

const secondaryUrl = import.meta.env
  .VITE_SUPABASE_SECONDARY_URL as string | undefined;
const secondaryKey = import.meta.env
  .VITE_SUPABASE_SECONDARY_ANON_KEY as string | undefined;

const primaryClient = createClient(primaryUrl, primaryKey, {
  auth: { persistSession: false },
});

let secondaryClient: SupabaseClient | null = null;

if (secondaryUrl && secondaryKey) {
  secondaryClient = createClient(secondaryUrl, secondaryKey, {
    auth: { persistSession: false },
  });
}

export function getSupabaseClient(name: SupabaseClientName): SupabaseClient {
  if (name === 'secondary' && secondaryClient) {
    return secondaryClient;
  }
  return primaryClient;
}

// Backwards-compatible default (primary) client.
export const supabase = primaryClient;

