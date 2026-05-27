"use client";

import { useEffect, useState } from "react";
import CategorySidebar from "@/components/CategorySidebar";
import NoteGrid from "@/components/NoteGrid";
import NoteDetailComponent from "@/components/NoteDetail";
import ChatPanel from "@/components/ChatPanel";
import FullscreenToggle from "@/components/FullscreenToggle";
import { notesApi, NoteInfo, NoteDetail as NoteDetailType } from "@/lib/api";

export default function WorkspacePage() {
  const [sessionId, setSessionId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteDetail, setNoteDetail] = useState<NoteDetailType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatMode, setChatMode] = useState<"single" | "global">("single");

  useEffect(() => {
    const sid = localStorage.getItem("xhs_session");
    console.log("[WORKSPACE] session from localStorage:", sid);
    if (!sid) { console.log("[WORKSPACE] No session, redirecting to /"); window.location.href = "/"; return; }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    console.log("[WORKSPACE] Fetching notes, sessionId:", sessionId);
    notesApi.list(sessionId, selectedCategoryId || undefined)
      .then((notes) => { console.log("[WORKSPACE] Notes loaded:", notes.length); setNotes(notes); })
      .catch((e) => { console.error("[WORKSPACE] Notes fetch error:", e); });
  }, [sessionId, selectedCategoryId]);

  useEffect(() => {
    if (!selectedNoteId) { setNoteDetail(null); return; }
    notesApi.detail(selectedNoteId).then(setNoteDetail).catch(() => {});
  }, [selectedNoteId]);

  if (!sessionId) return null;

  return (
    <div className="h-screen flex">
      {!isFullscreen && (
        <CategorySidebar
          sessionId={sessionId}
          onSelectCategory={(id) => { setSelectedCategoryId(id); setSelectedNoteId(null); setNoteDetail(null); }}
          selectedCategoryId={selectedCategoryId}
        />
      )}
      <main className="flex-1 flex flex-col relative bg-paper-2">
        {selectedNoteId && noteDetail ? (
          <>
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={() => setIsFullscreen(!isFullscreen)} />
            <NoteDetailComponent note={noteDetail} sessionId={sessionId} />
            {!isFullscreen && (
              <div className="p-3 border-t flex gap-2 bg-white">
                <button onClick={() => { setSelectedNoteId(null); setNoteDetail(null); }} className="text-sm text-muted hover:text-ink-soft">← 返回列表</button>
                <div className="flex-1" />
                <button onClick={() => setChatMode(chatMode === "single" ? "global" : "single")} className="text-xs px-3 py-1 rounded border hover:bg-paper-2">
                  {chatMode === "single" ? "当前笔记" : "全局搜索"} | 切换
                </button>
              </div>
            )}
          </>
        ) : (
          <NoteGrid notes={notes} selectedNoteId={selectedNoteId} onSelectNote={setSelectedNoteId} />
        )}
      </main>
      {!isFullscreen && <ChatPanel sessionId={sessionId} noteId={selectedNoteId} mode={chatMode} onModeChange={() => setChatMode(chatMode === "single" ? "global" : "single")} />}
    </div>
  );
}
