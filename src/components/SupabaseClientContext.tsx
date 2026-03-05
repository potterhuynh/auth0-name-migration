import {
  createContext,
  type ReactNode,
  useContext,
  useState,
} from 'react';
import type { SupabaseClientName } from '../types/supabaseClient';

type SupabaseClientContextValue = {
  supabaseClient: SupabaseClientName;
  setSupabaseClient: (client: SupabaseClientName) => void;
};

const SupabaseClientContext = createContext<SupabaseClientContextValue | undefined>(
  undefined,
);

export function SupabaseClientProvider({ children }: { children: ReactNode }) {
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClientName>(
    'primary',
  );

  return (
    <SupabaseClientContext.Provider value={{ supabaseClient, setSupabaseClient }}>
      {children}
    </SupabaseClientContext.Provider>
  );
}

export function useSupabaseClientSelection(): SupabaseClientContextValue {
  const ctx = useContext(SupabaseClientContext);
  if (!ctx) {
    throw new Error('useSupabaseClientSelection must be used within SupabaseClientProvider');
  }
  return ctx;
}

