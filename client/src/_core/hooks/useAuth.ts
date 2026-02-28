import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useState } from "react";
import { getSessionStorage } from "@/lib/sessionStorage";
import { toast } from "sonner";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const {
    redirectOnUnauthenticated = false,
    redirectPath = "/login",
  } = options ?? {};
  
  const utils = trpc.useUtils();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      try {
        const sessionStorage = getSessionStorage({ debugMode: false });
        sessionStorage.clearSession();
      } catch (e) {
        console.error("Error clearing session storage:", e);
      }
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // Refresh session handler
  const refreshSession = useCallback(async () => {
    try {
      setIsRecovering(true);
      await meQuery.refetch();
      setSessionError(null);
      toast.success("Session refreshed");
    } catch (error) {
      console.error("Failed to refresh session:", error);
      toast.error("Failed to refresh session");
      throw error;
    } finally {
      setIsRecovering(false);
    }
  }, [meQuery]);

  // Redirect on unauthenticated - only when explicitly requested
  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (meQuery.data) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, meQuery.isLoading, meQuery.data, logoutMutation.isPending]);

  // Persist session to localStorage on successful auth
  useEffect(() => {
    if (meQuery.data) {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(meQuery.data)
      );
    }
  }, [meQuery.data?.id]); // Only depend on user ID to avoid loops

  return {
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || logoutMutation.isPending,
    error: meQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    refresh: () => meQuery.refetch(),
    logout,
    refreshSession,
    sessionError,
    isRecovering,
  };
}
