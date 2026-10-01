import type {
  ApiErrorBody,
  DashboardMetrics,
  HealthResponse,
  SessionCreateRequest,
  SessionDetail,
  SessionSummary,
  SystemStatus,
  User,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function detailMessage(body: ApiErrorBody | undefined, fallback: string): string {
  const detail = body?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    const msg = first?.msg ?? first?.message;
    if (msg) return msg;
  }
  if (detail && typeof detail === "object" && "message" in detail && detail.message) {
    return detail.message;
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new Error("Cannot reach the API. Start the backend on port 8000, then use http://localhost:5173");
  }

  if (!response.ok) {
    let message = "Request failed";
    if (response.status === 401 && path.includes("/auth/login")) {
      message = "Invalid email or password";
    }
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = detailMessage(body, message);
    } catch {
      if (response.status >= 500) {
        message = "Backend error. Confirm uvicorn is running on port 8000.";
      }
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function login(identifier: string, password: string): Promise<User> {
  return request<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export async function logout(): Promise<void> {
  await request<{ status: string }>("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<User> {
  return request<User>("/api/auth/me");
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return request<DashboardMetrics>("/api/dashboard/metrics");
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>("/api/system/status");
}

export async function listSessions(): Promise<SessionSummary[]> {
  return request<SessionSummary[]>("/api/sessions");
}

export async function createSession(payload: SessionCreateRequest): Promise<SessionSummary> {
  return request<SessionSummary>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/api/sessions/${sessionId}`);
}

export async function startSession(sessionId: string): Promise<SessionSummary> {
  return request<SessionSummary>(`/api/sessions/${sessionId}/start`, { method: "POST" });
}

export async function cancelSession(sessionId: string): Promise<SessionSummary> {
  return request<SessionSummary>(`/api/sessions/${sessionId}/cancel`, { method: "POST" });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<{ status: string }>(`/api/sessions/${sessionId}`, { method: "DELETE" });
}
