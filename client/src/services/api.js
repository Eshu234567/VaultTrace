const API_BASE = '/api';

export function getStoredToken() {
  return localStorage.getItem('vaulttrace_token') || '';
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('vaulttrace_token', token);
  } else {
    localStorage.removeItem('vaulttrace_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const payload = await res.json().catch(() => ({
    success: false,
    error: `Unexpected server response (${res.status})`,
  }));

  if (!res.ok || payload.success === false) {
    const err = new Error(payload.error || payload.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}
