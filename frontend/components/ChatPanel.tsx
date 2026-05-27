"use client";

import { useState, useRef, useEffect } from "react";
import { chatApi } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; sources?: Array<{ note_id: string; title: string }>; }
interface Props { sessionId: string; noteId: string | null; mode: "single" | "global"; onModeChange?: () => void; }

export default function ChatPanel({ sessionId, noteId, mode, onModeChange }: Props) {
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
    <aside className="w-96 border-l bg-white flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-bold text-ink">AI 助手</h2>
        <button onClick={() => onModeChange?.()} className="text-xs px-2 py-1 rounded border hover:bg-paper-2 text-muted">
          {modeLabel} ▾
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-8 space-y-3">
            <p className="text-muted text-sm">从你的收藏里找答案</p>
            <div className="space-y-2">
              {["最近收藏了什么AI工具？", "关于设计配色的笔记", "有什么副业相关的内容？"].map((q) => (
                <button key={q} onClick={() => { setInput(q); }} className="block w-full text-left text-xs bg-paper-2 hover:bg-paper-3 px-3 py-2 rounded-lg text-ink-soft">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg text-sm ${msg.role === "user" ? "bg-accent text-white" : "bg-paper-2 text-ink"}`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border text-xs text-muted">来源：{msg.sources.map((s, j) => (<span key={j} className="mr-1">[{s.title}]</span>))}</div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-left"><div className="inline-block bg-paper-2 px-3 py-2 rounded-lg text-sm text-muted">思考中...</div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t flex gap-2">
        <input className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-transparent" placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} disabled={loading} />
        <button onClick={handleSend} disabled={loading || !input.trim()} className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent-strong disabled:opacity-50">发送</button>
      </div>
    </aside>
  );
}
