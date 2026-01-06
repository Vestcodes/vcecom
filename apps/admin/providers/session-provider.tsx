"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AdminSession } from "@/lib/auth";
import {
  logout as authLogout,
  getAdminSession,
  refreshToken,
} from "@/lib/auth";

interface SessionContextValue {
  session: AdminSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

interface SessionProviderProps {
  children: React.ReactNode;
  initialSession?: AdminSession | null;
}

// Token refresh interval: refresh every 14 minutes (tokens typically expire in 15 minutes)
const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes

export function SessionProvider({
  children,
  initialSession,
}: SessionProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AdminSession | null>(
    initialSession || null,
  );
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    data: sessionData,
    isLoading,
    refetch,
    error: sessionError,
  } = useQuery({
    queryKey: ["admin-session"],
    queryFn: getAdminSession,
    enabled: !initialSession, // Only fetch if no initial session provided
    retry: (failureCount, error) => {
      // Don't retry on 401 errors (unauthorized)
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // We'll handle refresh manually
  });

  const handleLogout = useCallback(async () => {
    // Clear refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    try {
      await authLogout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setSession(null);
      queryClient.clear();
      router.push("/login");
    }
  }, [router, queryClient]);

  useEffect(() => {
    if (sessionData) {
      setSession(sessionData);
    } else if (sessionData === null && !isLoading) {
      // Session fetch returned null (unauthorized)
      setSession(null);
    }
  }, [sessionData, isLoading]);

  // Handle session errors (like 401)
  useEffect(() => {
    if (
      sessionError &&
      typeof sessionError === "object" &&
      "status" in sessionError
    ) {
      if (sessionError.status === 401) {
        // Token expired - try to refresh
        refreshToken().then((success) => {
          if (!success) {
            // Refresh failed - logout
            handleLogout();
          } else {
            // Refresh successful - refetch session
            refetch();
          }
        });
      }
    }
  }, [
    sessionError,
    refetch, // Refresh failed - logout
    handleLogout,
  ]);

  // Set up proactive token refresh
  useEffect(() => {
    if (!session) {
      // Clear interval if no session
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Set up interval to refresh token proactively
    refreshIntervalRef.current = setInterval(async () => {
      try {
        const success = await refreshToken();
        if (!success) {
          // Refresh failed - logout
          handleLogout();
        } else {
          // Refresh successful - refetch session to get updated data
          refetch();
        }
      } catch (error) {
        console.error("Proactive token refresh error:", error);
      }
    }, TOKEN_REFRESH_INTERVAL);

    // Cleanup interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [
    session,
    refetch, // Refresh failed - logout
    handleLogout,
  ]);

  const refreshSession = useCallback(async () => {
    try {
      // First refresh token, then refetch session
      const tokenRefreshed = await refreshToken();
      if (tokenRefreshed) {
        const { data } = await refetch();
        if (data) {
          setSession(data);
        }
      } else {
        // Token refresh failed - logout
        handleLogout();
      }
    } catch (error) {
      console.error("Session refresh error:", error);
    }
  }, [refetch, handleLogout]);

  const value: SessionContextValue = {
    session,
    isLoading,
    isAuthenticated: !!session,
    logout: handleLogout,
    refreshSession,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useAdminSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useAdminSession must be used within a SessionProvider");
  }
  return context;
}
