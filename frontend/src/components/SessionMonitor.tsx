import React from "react";
import { useAuth } from "../hooks/useAuth";
import { useSessionMonitor } from "../hooks/useSessionMonitor";
import { SessionTimeoutWarning } from "./SessionTimeoutWarning";

interface SessionMonitorProps {
  children: React.ReactNode;
}

export const SessionMonitor: React.FC<SessionMonitorProps> = ({ children }) => {
  const { user } = useAuth();

  const { showWarning, remainingTime, extendSession, handleLogout } =
    useSessionMonitor({
      checkInterval: 60,
      warningThreshold: 300,
    });

  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <SessionTimeoutWarning
        show={showWarning}
        remainingTime={remainingTime}
        onExtend={extendSession}
        onLogout={handleLogout}
      />
    </>
  );
};
