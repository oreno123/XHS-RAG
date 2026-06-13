"use client";

import { useState, useRef, useEffect } from "react";
import { chatApi } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; sources?: Array<{ note_id: string; title: string }>; }
interface Props {
  sessionId: string;
  noteId: string | null;
  mode: "single" | "global";
  onModeChange?: () => void;
  open: boolean;
  onClose: () => void;
}

export default function ChatPanel({ sessionId, noteId, mode, onModeChange, open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const response = await chatApi.askStream(question, sessionId, noteId || undefined, mode);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");
      let assistantContent = "";
      let sources: Message["sources"] = [];
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const sourceIdx = text.indexOf("[[SOURCES_JSON]]");
        if (sourceIdx !== -1) {
          assistantContent += text.substring(0, sourceIdx);
          try { sources = JSON.parse(text.substring(sourceIdx + "[[SOURCES_JSON]]".length)); } catch {}
        } else { assistantContent += text; }
        setMessages((prev) => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1] = { role: "assistant", content: assistantContent, sources }; return newMsgs; });
      }
    } catch (e: any) { setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${e.message}` }]); }
    finally { setLoading(false); }
  };

  const modeLabel = mode === "single" ? "当前笔记" : "全部收藏";
  const placeholder = mode === "single" && noteId
    ? "对这条笔记提问..."
    : "搜一下收藏内容，比如「N8N 工作流」";

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 w-[400px] max-w-full transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ background: "rgba(13, 11, 8, 0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderLeft: "1px solid rgba(138,117,96,0.12)" }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-bold text-ink text-sm">AI 助手</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => onModeChange?.()} className="text-xs px-2.5 py-1 rounded-lg border border-border text-ink-soft hover:text-ink hover:border-accent/30 transition">
            {modeLabel} ▾
          </button>
          <button onClick={onClose} className="text-muted hover:text-ink transition text-lg leading-none">✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: "calc(100vh - 130px)" }}>
        {messages.length === 0 && (
          <div className="text-center mt-12 space-y-3">
            <p className="text-muted text-sm">从你的收藏里找答案</p>
            <div className="space-y-2">
              {["最近收藏了什么AI工具？", "关于设计配色的笔记", "有什么副业相关的内容？"].map((q) => (
                <button key={q} onClick={() => { setInput(q); }} className="block w-full text-left text-xs bg-paper-3/50 hover:bg-paper-3 px-3 py-2.5 rounded-lg text-ink-soft transition">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div className={`inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm ${
              msg.role === "user"
                ? "bg-accent text-white"
                : "bg-paper-3/60 text-ink"
            }`}>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border text-xs text-muted">
                  来源：{msg.sources.map((s, j) => (<span key={j} className="mr-1">[{s.title}]</span>))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-left">
            <div className="inline-block bg-paper-3/60 px-3 py-2 rounded-xl text-sm text-muted">思考中...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <input
          className="flex-1 bg-paper-3/50 border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent/40 transition"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()} className="bg-accent text-white px-4 py-2 rounded-xl text-sm hover:bg-accent-strong disabled:opacity-50 transition active:scale-[0.97]">
          发送
        </button>
      </div>
    </div>
  );
}
