export const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Authenticated fetch wrapper.
 * Automatically attaches Authorization: Bearer <token> from localStorage.
 * On 401 responses, clears the token and reloads to force re-login.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('TOKEN');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('TOKEN');
    window.location.reload();
  }

  return response;
}
