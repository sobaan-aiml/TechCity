/**
 * Safe fetch helper that gracefully handles non-JSON responses (such as Vercel 404/500 HTML error pages)
 * to prevent: "Unexpected token 'T', 'The page could not be found...' is not valid JSON".
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.warn(`[SafeFetch] ${url} returned non-JSON (${res.status}): ${text.slice(0, 120)}`);
      return {
        success: false,
        status: res.status,
        error: `Server returned non-JSON response (${res.status}). Verify API serverless functions are active.`,
      };
    }

    const json = await res.json();
    const isOk = res.ok && json.success !== false;

    return {
      success: isOk,
      data: json,
      error: json.error || (res.ok ? undefined : `Server returned error (${res.status})`),
      status: res.status,
    };
  } catch (err: any) {
    console.error(`[SafeFetch] Request to ${url} failed:`, err);
    return {
      success: false,
      error: err.message || 'Network connection failed. Please check server availability.',
    };
  }
}
