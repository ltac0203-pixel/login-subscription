const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const normalizedEnvBaseUrl = envApiBaseUrl
  ? envApiBaseUrl.replace(/\/$/, "")
  : "";

const fallbackBaseUrl =
  typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "http://localhost:8000";

export const API_BASE_URL = normalizedEnvBaseUrl || fallbackBaseUrl;
