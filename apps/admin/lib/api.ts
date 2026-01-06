/**
 * API client using native fetch
 * No Axios needed - using fetch with proper error handling
 * Includes automatic token refresh on 401 errors
 */

import { getPublicApiUrl, getServerApiUrl } from "./env";

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

export class FetchError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.errors = errors;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuthRefresh?: boolean; // Skip automatic token refresh for this request
}

// Token refresh state management
let refreshPromise: Promise<boolean> | null = null;
let isRefreshing = false;

/**
 * Get the API base URL from environment or default to localhost
 * Uses validated environment variables in production
 */
function getApiBaseUrl(): string {
  // Always use backend URL directly - no proxies needed
  // Backend handles CORS and cookies directly
  if (typeof window !== "undefined") {
    // Client-side: use NEXT_PUBLIC_API_URL for direct backend calls
    // In production, this will be validated and throw if missing
    if (process.env.NODE_ENV === "production") {
      return getPublicApiUrl();
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }
  // Server-side: use env variable or default
  if (process.env.NODE_ENV === "production") {
    return getServerApiUrl();
  }
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  );
}

/**
 * Build query string from params object
 */
function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Get auth token from cookies or localStorage
 * httpOnly cookies are sent automatically by browser
 * This checks Authorization header as fallback
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // Check localStorage as fallback (primary auth is via httpOnly cookies)
  return localStorage.getItem("admin_access_token");
}

/**
 * Create headers with auth token
 * Note: httpOnly cookies are sent automatically by browser
 * This adds Authorization header as fallback
 */
function createHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);

  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Only set Content-Type if not already set and body exists
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

/**
 * Server-side fetch with cookie forwarding
 * Used in server components and API routes
 */
export async function serverApiFetch<T = unknown>(
  endpoint: string,
  options: RequestOptions & { cookies?: string } = {},
): Promise<T> {
  const { params, cookies, ...fetchOptions } = options;

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}${params ? buildQueryString(params) : ""}`;

  const headers = createHeaders(fetchOptions.headers);

  // Forward cookies for server-side requests
  if (cookies) {
    headers.set("Cookie", cookies);
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include cookies
    });

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw new FetchError(error.message, error.status, error.errors);
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    return undefined as T;
  } catch (error) {
    if (error instanceof FetchError) {
      throw error;
    }

    throw new FetchError(
      error instanceof Error ? error.message : "Network error occurred",
      0,
    );
  }
}

/**
 * Parse error response
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let errors: Record<string, string[]> | undefined;

  try {
    const data = await response.json();
    message = data.message || data.error || message;
    errors = data.errors;
  } catch {
    // If response is not JSON, use status text
    message = response.statusText || message;
  }

  return {
    message,
    status: response.status,
    errors,
  };
}

/**
 * Refresh access token using refresh token
 * Returns true if refresh was successful, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
  // If already refreshing, wait for that promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Start refresh process
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const baseUrl = getApiBaseUrl();
      // Use the refresh endpoint - cookies are sent automatically
      const response = await fetch(`${baseUrl}/admin/auth/refresh`, {
        method: "POST",
        credentials: "include", // Include httpOnly cookies
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // Refresh failed - user needs to login again
        if (typeof window !== "undefined") {
          // Clear any stored tokens
          localStorage.removeItem("admin_access_token");
          localStorage.removeItem("admin_refresh_token");

          // Redirect to login if not already there
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/login")) {
            const loginUrl = new URL("/login", window.location.origin);
            loginUrl.searchParams.set("expired", "true");
            loginUrl.searchParams.set("redirect", currentPath);
            window.location.href = loginUrl.toString();
          }
        }
        return false;
      }

      // Refresh successful - cookies are updated automatically by browser
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();

        // Update localStorage token if provided (fallback)
        if (data.accessToken && typeof window !== "undefined") {
          localStorage.setItem("admin_access_token", data.accessToken);
        }
      }

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/login")) {
          const loginUrl = new URL("/login", window.location.origin);
          loginUrl.searchParams.set("expired", "true");
          loginUrl.searchParams.set("redirect", currentPath);
          window.location.href = loginUrl.toString();
        }
      }
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Fetch wrapper with error handling and automatic token refresh
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, skipAuthRefresh, ...fetchOptions } = options;

  const baseUrl = getApiBaseUrl();
  // Always use backend URL directly - no Next.js API route proxies
  const url = `${baseUrl}${endpoint}${params ? buildQueryString(params) : ""}`;

  const headers = createHeaders(fetchOptions.headers);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include httpOnly cookies
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && !skipAuthRefresh) {
      // Don't refresh if this is already a refresh request or login request
      if (
        endpoint.includes("/auth/refresh") ||
        endpoint.includes("/auth/login")
      ) {
        const error = await parseErrorResponse(response);
        throw new FetchError(error.message, error.status, error.errors);
      }

      // Attempt to refresh token
      const refreshSuccess = await refreshAccessToken();

      if (refreshSuccess) {
        // Retry original request with new token
        const retryHeaders = createHeaders(fetchOptions.headers);
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: retryHeaders,
          credentials: "include",
        });

        if (!retryResponse.ok) {
          const error = await parseErrorResponse(retryResponse);
          throw new FetchError(error.message, error.status, error.errors);
        }

        // Handle empty responses
        const contentType = retryResponse.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          return await retryResponse.json();
        }

        return undefined as T;
      } else {
        // Refresh failed - redirect to login if not already there
        if (typeof window !== "undefined") {
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/login")) {
            const loginUrl = new URL("/login", window.location.origin);
            loginUrl.searchParams.set("expired", "true");
            loginUrl.searchParams.set("redirect", currentPath);
            window.location.href = loginUrl.toString();
            // Return a promise that never resolves to prevent further execution
            return new Promise(() => {}) as T;
          }
        }
        // Refresh failed - throw original 401 error
        const error = await parseErrorResponse(response);
        throw new FetchError(error.message, error.status, error.errors);
      }
    }

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw new FetchError(error.message, error.status, error.errors);
    }

    // Handle empty responses
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    return undefined as T;
  } catch (error) {
    if (error instanceof FetchError) {
      throw error;
    }

    // Network or other errors
    throw new FetchError(
      error instanceof Error ? error.message : "Network error occurred",
      0,
    );
  }
}

/**
 * Convenience methods for HTTP verbs
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),

  post: <T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
