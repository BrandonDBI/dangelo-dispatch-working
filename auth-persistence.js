(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  const nativeFetch = window.fetch.bind(window);
  let refreshPromise = null;

  function getStoredSession() {
    try { return JSON.parse(localStorage.getItem('dangelo_session') || 'null'); }
    catch { return null; }
  }

  function saveSession(session) {
    if (!session?.access_token) return;
    const previous = getStoredSession();
    const merged = { ...previous, ...session };
    localStorage.setItem('dangelo_session', JSON.stringify(merged));
  }

  function tokenExpiresSoon(session, bufferSeconds = 120) {
    if (!session?.access_token) return true;
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return !payload?.exp || (payload.exp * 1000) <= (Date.now() + bufferSeconds * 1000);
    } catch {
      return true;
    }
  }

  function isSupabase(url) {
    return BASE && String(url).startsWith(BASE);
  }

  function isAuthExchange(url) {
    const value = String(url);
    return value.includes('/auth/v1/token?grant_type=password') ||
      value.includes('/auth/v1/token?grant_type=refresh_token') ||
      value.includes('/auth/v1/signup');
  }

  async function refreshSession(force = false) {
    if (refreshPromise) return refreshPromise;
    const session = getStoredSession();
    if (!session?.refresh_token) return session;
    if (!force && !tokenExpiresSoon(session)) return session;

    refreshPromise = nativeFetch(`${BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(async response => {
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.access_token) throw new Error('Session refresh failed');
      saveSession(data);
      return getStoredSession();
    }).finally(() => { refreshPromise = null; });

    return refreshPromise;
  }

  async function ensureFreshSession() {
    const session = getStoredSession();
    if (!session?.refresh_token) return session;
    if (!tokenExpiresSoon(session)) return session;
    return refreshSession(true);
  }

  window.DANGELO_AUTH = {
    getSession: getStoredSession,
    ensureFreshSession,
    refreshSession: () => refreshSession(true)
  };

  window.DANGELO_AUTH_READY = ensureFreshSession().catch(() => getStoredSession());

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url;
    if (!isSupabase(url) || isAuthExchange(url)) return nativeFetch(input, init);

    let stored = getStoredSession();
    if (stored?.refresh_token && tokenExpiresSoon(stored)) {
      try { stored = await refreshSession(true); } catch { /* retry path below handles auth failures */ }
    }

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (stored?.access_token) headers.set('Authorization', `Bearer ${stored.access_token}`);

    let response = await nativeFetch(input, { ...init, headers });
    if (response.status !== 401 || !stored?.refresh_token) return response;

    try {
      const refreshed = await refreshSession(true);
      const retryHeaders = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      retryHeaders.set('Authorization', `Bearer ${refreshed.access_token}`);
      return nativeFetch(input, { ...init, headers: retryHeaders });
    } catch {
      return response;
    }
  };

  const refreshWhenActive = () => {
    if (document.visibilityState === 'visible') ensureFreshSession().catch(() => {});
  };
  document.addEventListener('visibilitychange', refreshWhenActive);
  window.addEventListener('focus', refreshWhenActive);
})();