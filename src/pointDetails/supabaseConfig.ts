import { DataUnavailableError } from './errors';

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

let cachedConfig: SupabasePublicConfig | null = null;

export function getSupabasePublicConfig(): SupabasePublicConfig {
  if (cachedConfig) return cachedConfig;

  const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const url = rawUrl?.replace(/\/+$/, '');

  if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) {
    throw new DataUnavailableError('Configurazione VITE_SUPABASE_URL non valida.');
  }
  if (!anonKey) {
    throw new DataUnavailableError('Configurazione VITE_SUPABASE_ANON_KEY mancante.');
  }

  cachedConfig = { url, anonKey };
  return cachedConfig;
}

export function supabaseHeaders(config: SupabasePublicConfig): HeadersInit {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
  };
}
