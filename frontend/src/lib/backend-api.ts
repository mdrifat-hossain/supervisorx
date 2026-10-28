/**
 * Centralized backend API configuration and proxy client.
 * Server-only helper for Next.js API routes communicating with the FastAPI service.
 */

export const PRODUCTION_BACKEND_URL = "https://supervisorx-backend.onrender.com";
export const LOCAL_DEV_BACKEND_URL = "http://localhost:8000";
export const DOCKER_DEV_BACKEND_URL = "http://backend:8000";

/**
 * Returns the primary backend base URL based on environment variables and execution context.
 *
 * Precedence:
 * 1. BACKEND_URL environment variable (explicitly configured in Render / Docker / .env)
 * 2. If NODE_ENV === 'production' -> https://supervisorx-backend.onrender.com
 * 3. If DOCKER_ENV === '1' -> http://backend:8000
 * 4. Local development default -> http://localhost:8000
 */
export function getBackendBaseUrl(): string {
  const envUrl = process.env.BACKEND_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_BACKEND_URL;
  }

  if (process.env.DOCKER_ENV) {
    return DOCKER_DEV_BACKEND_URL;
  }

  return LOCAL_DEV_BACKEND_URL;
}

/**
 * Returns candidate backend URLs in order of preference.
 * In development, candidates include fallback local URLs.
 * In production, it targets the primary backend URL.
 */
export function getCandidateBackendUrls(): string[] {
  const primary = getBackendBaseUrl();
  const candidates: string[] = [primary];

  if (process.env.NODE_ENV !== "production") {
    const devFallbacks = [
      process.env.DOCKER_ENV ? DOCKER_DEV_BACKEND_URL : null,
      LOCAL_DEV_BACKEND_URL,
      DOCKER_DEV_BACKEND_URL,
    ].filter(Boolean) as string[];

    for (const fb of devFallbacks) {
      if (!candidates.includes(fb)) {
        candidates.push(fb);
      }
    }
  }

  return candidates;
}

/**
 * Executes a fetch request to the Python FastAPI backend service,
 * trying candidate URLs with failover if unreachable.
 */
export async function fetchFromBackend(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const candidates = getCandidateBackendUrls();
  let lastError: unknown = null;

  for (const base of candidates) {
    try {
      const url = `${base}${cleanEndpoint}`;
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
    }
  }

  throw (
    lastError ||
    new Error(
      `Could not reach Python backend service at ${candidates.join(", ")}`
    )
  );
}
