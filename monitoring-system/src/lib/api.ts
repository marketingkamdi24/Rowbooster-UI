// API utility with session expiration detection

const SESSION_EXPIRED_EVENT = 'session-expired';

// Dispatch session expired event to notify App.tsx
export function dispatchSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

// Listen for session expired events
export function onSessionExpired(callback: () => void) {
  window.addEventListener(SESSION_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, callback);
}

// Fetch wrapper that detects 401 responses and triggers session expiration
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
  });

  // If we get a 401, the session has expired
  if (response.status === 401) {
    dispatchSessionExpired();
  }

  return response;
}

// Helper for GET requests
export async function apiGet(url: string): Promise<Response> {
  return authFetch(url);
}

// Helper for POST requests
export async function apiPost(url: string, data?: any): Promise<Response> {
  return authFetch(url, {
    method: 'POST',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
}

// Helper for PATCH requests
export async function apiPatch(url: string, data?: any): Promise<Response> {
  return authFetch(url, {
    method: 'PATCH',
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
}

// Helper for DELETE requests
export async function apiDelete(url: string): Promise<Response> {
  return authFetch(url, {
    method: 'DELETE',
  });
}