import React from "react";
import { useAuth } from "../hooks/useAuth";
import { useSessionMonitor } from "../hooks/useSessionMonitor";

interface SessionMonitorProps {
  children: React.ReactNode;
}

export const SessionMonitor: React.FC<SessionMonitorProps> = ({ children }) => {
  const { user } = useAuth();

  useSessionMonitor({
    checkInterval: 60,
  });

  if (!user) {
    return <>{children}</>;
  }

  return <>{children}</>;
};
