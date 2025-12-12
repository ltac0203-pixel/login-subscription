import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "./useAuth";

interface SessionMonitorConfig {
  checkInterval?: number;
  warningThreshold?: number;
}

export const useSessionMonitor = (config: SessionMonitorConfig = {}) => {
  const { checkInterval = 60, warningThreshold = 300 } = config;
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
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
        return;
      }

      const remaining = status.session?.remaining_time || 0;
      setRemainingTime(remaining);

      if (remaining <= warningThreshold && remaining > 0) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    } catch {
      setShowWarning(false);
      setRemainingTime(null);
    }
  }, [logout, navigate, warningThreshold]);

  const extendSession = useCallback(async () => {
    try {
      await authApi.getCurrentUser();
      setShowWarning(false);
      await checkSessionStatus();
    } catch {
      setShowWarning(false);
    }
  }, [checkSessionStatus]);

  const handleLogout = useCallback(async () => {
    clearInterval(intervalRef.current!);
    await logout();
    navigate("/login");
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

  return {
    showWarning,
    remainingTime,
    extendSession,
    handleLogout,
  };
};
