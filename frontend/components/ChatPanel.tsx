"use client";

import { useState, useRef, useEffect } from "react";
import { chatApi } from "@/lib/api";

interface Message { role: "user" | "assistant"; content: string; sources?: Array<{ note_id: string; title: string }>; }
interface Props { sessionId: string; noteId: string | null; mode: "single" | "global"; }

export default function ChatPanel({ sessionId, noteId, mode }: Props) {
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

  return (
    <aside className="w-96 border-l bg-white flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-bold text-gray-800">AI 助手</h2>
        <span className="text-xs text-gray-400">{mode === "single" ? "当前笔记" : "全局搜索"}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && <p className="text-gray-400 text-sm text-center mt-8">{noteId ? "对这条笔记提问吧" : "选择笔记后可以提问"}</p>}
        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg text-sm ${msg.role === "user" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-800"}`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">来源：{msg.sources.map((s, j) => (<span key={j} className="mr-1">[{s.title}]</span>))}</div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-left"><div className="inline-block bg-gray-100 px-3 py-2 rounded-lg text-sm text-gray-400">思考中...</div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t flex gap-2">
        <input className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent" placeholder="输入问题..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} disabled={loading} />
        <button onClick={handleSend} disabled={loading || !input.trim()} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">发送</button>
      </div>
    </aside>
  );
}
