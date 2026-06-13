"use client";

import { useEffect, useState } from "react";
import CategorySidebar from "@/components/CategorySidebar";
import NoteGrid from "@/components/NoteGrid";
import NoteDetailComponent from "@/components/NoteDetail";
import ChatPanel from "@/components/ChatPanel";
import { notesApi, NoteInfo, NoteDetail as NoteDetailType } from "@/lib/api";

export default function WorkspacePage() {
  const [sessionId, setSessionId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteDetail, setNoteDetail] = useState<NoteDetailType | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"single" | "global">("single");

  useEffect(() => {
    const sid = localStorage.getItem("xhs_session");
    if (!sid) { window.location.href = "/"; return; }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    notesApi.list(sessionId, selectedCategoryId || undefined)
      .then(setNotes)
      .catch(() => {});
  }, [sessionId, selectedCategoryId]);

  useEffect(() => {
    if (!selectedNoteId) { setNoteDetail(null); return; }
    notesApi.detail(selectedNoteId).then(setNoteDetail).catch(() => {});
  }, [selectedNoteId]);

  if (!sessionId) return null;

  const goBack = () => { setSelectedNoteId(null); setNoteDetail(null); };

  return (
    <div className="h-screen flex relative overflow-hidden bg-paper">
      {/* Sidebar */}
      {sidebarOpen && (
        <CategorySidebar
          sessionId={sessionId}
          onSelectCategory={(id) => { setSelectedCategoryId(id); goBack(); }}
          selectedCategoryId={selectedCategoryId}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 glass border-b border-border">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="text-ink-soft hover:text-ink transition text-lg" title="打开侧边栏">☰</button>
          )}
          <span className="text-sm text-muted">
            {selectedNoteId && noteDetail ? noteDetail.title?.slice(0, 30) || "笔记详情" : `全部笔记${notes.length ? ` (${notes.length})` : ""}`}
          </span>
          <div className="flex-1" />
          {selectedNoteId && noteDetail && (
            <button onClick={() => setChatMode(chatMode === "single" ? "global" : "single")} className="text-xs px-3 py-1.5 rounded-lg border border-border text-ink-soft hover:text-ink hover:border-accent/30 transition">
              {chatMode === "single" ? "当前笔记" : "全局搜索"}
            </button>
          )}
        </div>

        {/* Content area */}
        {selectedNoteId && noteDetail ? (
          <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <button onClick={goBack} className="mb-4 text-sm text-ink-soft hover:text-accent transition flex items-center gap-1">
              ← 返回列表
            </button>
            <NoteDetailComponent note={noteDetail} sessionId={sessionId} />
          </div>
        ) : (
          <div className="p-4">
            <NoteGrid notes={notes} selectedNoteId={selectedNoteId} onSelectNote={setSelectedNoteId} />
          </div>
        )}
      </main>

      {/* Chat overlay */}
      <ChatPanel
        sessionId={sessionId}
        noteId={selectedNoteId}
        mode={chatMode}
        onModeChange={() => setChatMode(chatMode === "single" ? "global" : "single")}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Chat toggle FAB */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-accent text-white shadow-lg hover:bg-accent-strong active:scale-95 transition flex items-center justify-center text-lg"
          title="AI 助手"
        >
          💬
        </button>
      )}
    </div>
  );
}
