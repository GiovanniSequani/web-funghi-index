import React from 'react';
import { getAccountSupabaseClient, getMyProfile } from './client';
import type { AccountSessionState } from './types';
import { toAccountError } from './validation';

export function useAccountSession(): AccountSessionState {
  const [state, setState] = React.useState<AccountSessionState>({
    session: null,
    username: null,
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let active = true;
    let identitySequence = 0;

    const applySession = (session: AccountSessionState['session']) => {
      const sequence = ++identitySequence;
      setState({ session, username: null, loading: false, error: null });
      if (!session) return;

      void getMyProfile()
        .then((profile) => {
          if (active && sequence === identitySequence) {
            setState((current) => ({ ...current, username: profile.username }));
          }
        })
        .catch(() => undefined);
    };

    try {
      const supabase = getAccountSupabaseClient();
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({ session: null, username: null, loading: false, error: toAccountError(error).message });
          return;
        }
        applySession(data.session);
      });

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) applySession(session);
      });

      return () => {
        active = false;
        identitySequence += 1;
        subscription.subscription.unsubscribe();
      };
    } catch (error) {
      setState({ session: null, username: null, loading: false, error: toAccountError(error).message });
      return () => {
        active = false;
      };
    }
  }, []);

  return state;
}