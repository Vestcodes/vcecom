/**
 * Auth utilities
 * Token management, cookie helpers, session validation
 */

import { api } from "./api";
import { endpoints } from "./endpoints";

export interface AdminSession {
  id: string;
  email: string;
  role: "admin" | "customer" | "support" | "reviewer" | "marketing";
  roleId?: string | null;
  activeSessionsCount: number;
  twoFactorEnabled: boolean;
}

/**
 * Get auth token from cookies (httpOnly) or localStorage
 * In browser, cookies are sent automatically
 * This is mainly for server-side token access
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    // Server-side: tokens come from cookies via middleware
    return null;
  }

  // Client-side: check localStorage as fallback
  // Primary auth is via httpOnly cookies
  return localStorage.getItem("admin_access_token");
}

/**
 * Set auth token in localStorage (fallback, cookies are primary)
 */
export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("admin_access_token", token);
  }
}

/**
 * Remove auth token from localStorage
 */
export function removeAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("admin_access_token");
    localStorage.removeItem("admin_refresh_token");
  }
}

/**
 * Fetch current admin session
 * Calls backend directly - cookies are sent automatically by browser
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    // Call backend directly - cookies sent automatically
    const session = await api.get<AdminSession>(endpoints.auth.me);
    return session;
  } catch (_error) {
    return null;
  }
}

/**
 * Refresh access token manually
 * Returns true if refresh was successful, false otherwise
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${baseUrl}${endpoints.auth.refresh}`, {
      method: "POST",
      credentials: "include", // Include httpOnly cookies
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return false;
    }

    // Refresh successful - cookies are updated automatically by browser
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();

      // Update localStorage token if provided (fallback)
      if (data.accessToken && typeof window !== "undefined") {
        setAuthToken(data.accessToken);
      }
    }

    return true;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

/**
 * Logout admin
 * Calls backend directly - cookies are cleared automatically by backend
 */
export async function logout(): Promise<void> {
  try {
    // Call backend directly - cookies cleared automatically
    await api.post(endpoints.auth.logout, undefined, { skipAuthRefresh: true });
  } catch (error) {
    // Continue with logout even if API call fails
    console.error("Logout error:", error);
  } finally {
    removeAuthToken();
    // Redirect handled by middleware or component
  }
}

/**
 * Check if user is authenticated (client-side check)
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!getAuthToken() || document.cookie.includes("admin_access_token");
}
