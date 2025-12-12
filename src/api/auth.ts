import { API_BASE_URL } from "./config";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  error?: string;
  user?: {
    id: number;
    email: string;
  };
  user_id?: number;
  fincode_customer_id?: string;
}

interface SessionStatusResponse {
  authenticated: boolean;
  user?: {
    id: number;
    email: string;
  };
  session?: {
    remaining_time: number;
    timeout: number;
  };
  error?: string;
}

async function parseJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const authApi = {
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    const result = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(result?.error || "Registration failed");
    }

    return (result as AuthResponse) ?? { success: true, message: "Registered" };
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    const result = await parseJsonSafely(response);

    if (!response.ok) {
      const message =
        response.status === 401
          ? "メールアドレスまたはパスワードが正しくありません"
          : result?.error || "Login failed";
      throw new Error(message);
    }

    return (
      (result as AuthResponse) ?? { success: true, message: "Login successful" }
    );
  },

  async logout(): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });

    const result = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(result?.error || "Logout failed");
    }

    return (
      (result as AuthResponse) ?? {
        success: true,
        message: "Logout successful",
      }
    );
  },

  async getCurrentUser(): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/user`, {
      method: "GET",
      credentials: "include",
    });

    const result = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(result?.error || "Failed to get user");
    }

    return (
      (result as AuthResponse) ?? {
        success: false,
        message: "",
        error: "No user",
      }
    );
  },

  async getSessionStatus(): Promise<SessionStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/api/session-status`, {
      method: "GET",
      credentials: "include",
    });

    const result = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(
        (result as SessionStatusResponse)?.error ||
          "Failed to get session status"
      );
    }

    return (result as SessionStatusResponse) ?? { authenticated: false };
  },
};
