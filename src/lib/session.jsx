import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from './api';
import { connectSocket, disconnectSocket } from './socket';
import { useNavigate } from 'react-router-dom';

const SessionCtx = createContext(null);

export function SessionProvider({ children }) {
  const navigate = useNavigate();

  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => get('/auth/me').then((r) => r.user).catch((e) => (e.status === 401 || e.status === 403 ? null : Promise.reject(e))), staleTime: 60e3, retry: false });
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => get('/meta'), staleTime: 5 * 60e3 });
  const user = me.data || null;

  useEffect(() => {
    if (user) connectSocket(qc);
    else disconnectSocket();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    qc.clear();
    qc.setQueryData(['me'], null);

    navigate('/login');

  }, [qc]);

  const value = useMemo(() => {
    const roles = user?.roles || [];
    const isStaff = roles.includes('admin') || roles.includes('superadmin');
    const can = (perm) => roles.includes('superadmin') || (user?.staffPermissions || []).includes(perm);
    return { user, loading: me.isLoading, meta: meta.data, isStaff, can, signOut, refresh: () => qc.invalidateQueries({ queryKey: ['me'] }), setUser: (u) => qc.setQueryData(['me'], u) };
  }, [user, me.isLoading, meta.data, signOut, qc]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('mp-theme') || 'system';
    } catch {
      return 'system';
    }
  });
  const setTheme = (t) => {
    setThemeState(t);
    try {
      localStorage.setItem('mp-theme', t);
    } catch {
      /* storage unavailable */
    }
    const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };
  return [theme, setTheme];
}
