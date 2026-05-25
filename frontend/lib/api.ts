export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("xhs_session");
      window.location.href = "/";
    }
    throw new Error("Session expired");
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }
  return response.json();
}

// ==================== Types ====================
export interface LoginResponse {
  session_id: string;
  nickname?: string;
  avatar?: string;
}

export interface NoteInfo {
  note_id: string;
  title: string;
  author?: string;
  cover_url?: string;
  note_type: string;
  tags?: string[];
  category_id?: number;
  status: string;
  like_count: number;
  collect_count: number;
}

export interface NoteDetail extends NoteInfo {
  content?: string;
  author_avatar?: string;
  images?: string[];
  video_url?: string;
  comment_count: number;
}

export interface CategoryInfo {
  id: number;
  name: string;
  description?: string;
  icon_emoji?: string;
  note_count: number;
}

export interface BuildStatus {
  task_id: string;
  status: string;
  progress: number;
  total: number;
  processed: number;
  message: string;
}

export interface SyncResult {
  added: number;
  existing: number;
  total: number;
}

// ==================== APIs ====================
export const authApi = {
  login: (cookie: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ cookie }) }),
  getSession: (sessionId: string) =>
    request<{ valid: boolean; user_info: { nickname: string; avatar: string } }>(`/auth/session/${sessionId}`),
  logout: (sessionId: string) =>
    request(`/auth/session/${sessionId}`, { method: "DELETE" }),
};

export const notesApi = {
  list: (sessionId: string, categoryId?: number) =>
    request<NoteInfo[]>(`/notes/list?session_id=${sessionId}${categoryId ? `&category_id=${categoryId}` : ""}`),
  detail: (noteId: string) =>
    request<NoteDetail>(`/notes/detail/${noteId}`),
  count: (sessionId: string) =>
    request<{ total: number; indexed: number; pending: number }>(`/notes/count?session_id=${sessionId}`),
};

export const categoryApi = {
  list: () => request<CategoryInfo[]>("/category/list"),
  stats: () => request<{ total_categories: number; total_notes: number; uncategorized: number }>("/category/stats"),
};

export const knowledgeApi = {
  sync: (sessionId: string) =>
    request<SyncResult>("/knowledge/sync", { method: "POST", body: JSON.stringify({ session_id: sessionId }) }),
  build: (sessionId: string) =>
    request<{ task_id: string; message: string; total: number }>("/knowledge/build", { method: "POST", body: JSON.stringify({ session_id: sessionId }) }),
  buildStatus: (taskId: string) =>
    request<BuildStatus>(`/knowledge/build/status/${taskId}`),
  stats: () => request<{ total_chunks: number; total_notes: number }>("/knowledge/stats"),
};

export const chatApi = {
  askStream: (question: string, sessionId?: string, noteId?: string, mode: string = "single") =>
    fetch(`${API_BASE_URL}/chat/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, session_id: sessionId, note_id: noteId, mode }),
    }),
  search: (query: string, k = 5) =>
    request<{ results: Array<{ note_id: string; title: string; content_preview: string }> }>(
      `/chat/search?query=${encodeURIComponent(query)}&k=${k}`,
      { method: "POST" }
    ),
};
