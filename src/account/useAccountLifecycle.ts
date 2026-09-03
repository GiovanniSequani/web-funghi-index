import React from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getAccountLifecyclePublicConfig,
  getMyAccountAccess,
  recordMyMeaningfulActivity,
} from './lifecycleClient';
import {
  hasLifecycleFullAccess,
  type AccountAccess,
  type AccountLifecyclePublicConfig,
  type MeaningfulActivityKind,
} from './lifecycle';
import { toAccountError } from './validation';

export type AccountLifecycleState = {
  config: AccountLifecyclePublicConfig | null;
  access: AccountAccess | null;
  loading: boolean;
  error: string | null;
  fullAccess: boolean;
  refresh: (activityKind?: MeaningfulActivityKind) => Promise<AccountAccess | null>;
  applyAccess: (access: AccountAccess) => void;
};

export function useAccountLifecycle(
  session: Session | null,
  sessionLoading: boolean,
): AccountLifecycleState {
  const [config, setConfig] = React.useState<AccountLifecyclePublicConfig | null>(null);
  const [access, setAccess] = React.useState<AccountAccess | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const sequenceRef = React.useRef(0);
  const initialSessionResolvedRef = React.useRef(false);
  const sessionRef = React.useRef(session);
  sessionRef.current = session;

  const applyAccess = React.useCallback((nextAccess: AccountAccess) => {
    setAccess(nextAccess);
    setError(null);
    setLoading(false);
  }, []);

  const refresh = React.useCallback(async (
    activityKind?: MeaningfulActivityKind,
  ): Promise<AccountAccess | null> => {
    const sequence = ++sequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextConfig = await getAccountLifecyclePublicConfig();
      if (sequence !== sequenceRef.current) return null;
      setConfig(nextConfig);

      const currentSession = sessionRef.current;
      if (!currentSession || !nextConfig.api_available || !nextConfig.lifecycle_enabled) {
        setAccess(null);
        setLoading(false);
        return null;
      }

      const nextAccess = activityKind
        ? await recordMyMeaningfulActivity(activityKind)
        : await getMyAccountAccess();
      if (sequence !== sequenceRef.current) return null;
      setAccess(nextAccess);
      setLoading(false);
      return nextAccess;
    } catch (cause) {
      if (sequence !== sequenceRef.current) return null;
      setConfig(null);
      setAccess(null);
      setError(toAccountError(cause).message);
      setLoading(false);
      return null;
    }
  }, []);

  React.useEffect(() => {
    if (sessionLoading) return;
    const firstResolution = !initialSessionResolvedRef.current;
    initialSessionResolvedRef.current = true;
    void refresh(firstResolution && session ? 'foreground_session' : undefined);
  }, [refresh, session?.user.id, sessionLoading]);

  React.useEffect(() => {
    if (!session) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh('foreground_session');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh, session?.user.id]);

  React.useEffect(() => () => {
    sequenceRef.current += 1;
  }, []);

  return {
    config,
    access,
    loading,
    error,
    fullAccess: hasLifecycleFullAccess(Boolean(session), config, access),
    refresh,
    applyAccess,
  };
}