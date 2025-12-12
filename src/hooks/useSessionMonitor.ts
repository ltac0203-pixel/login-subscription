import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "./useAuth";

interface SessionMonitorConfig {
  checkInterval?: number;
}

export const useSessionMonitor = (config: SessionMonitorConfig = {}) => {
  const { checkInterval = 60 } = config;
  const navigate = useNavigate();
  const { logout } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSessionStatus = useCallback(async () => {
    try {
      const status = await authApi.getSessionStatus();

      if (!status.authenticated) {
        clearInterval(intervalRef.current!);
        await logout();
        navigate("/login", {
          state: {
            message:
              "セッションがタイムアウトしました。再度ログインしてください。",
          },
        });
      }
    } catch {
      clearInterval(intervalRef.current!);
      await logout();
      navigate("/login", {
        state: {
          message:
            "セッションがタイムアウトしました。再度ログインしてください。",
        },
      });
    }
  }, [logout, navigate]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkSessionStatus();
    }, 0);

    intervalRef.current = setInterval(checkSessionStatus, checkInterval * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInterval, checkSessionStatus]);
};
