"use client";

import { useState, useEffect, useRef } from "react";
import { categoryApi, CategoryInfo, knowledgeApi } from "@/lib/api";

interface Props {
  sessionId: string;
  onSelectCategory: (categoryId: number | null) => void;
  selectedCategoryId: number | null;
}

function ProgressBar({ progress, label, phase }: { progress: number; label: string; phase?: string }) {
  return (
    <div className="px-3 py-2 border-t">
      {phase && <div className="text-xs font-medium text-ink-soft mb-0.5">{phase}</div>}
      <div className="flex justify-between text-xs text-muted mb-1">
        <span className="truncate flex-1">{label}</span>
        <span className="ml-2 shrink-0">{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 bg-paper-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function CategorySidebar({ sessionId, onSelectCategory, selectedCategoryId }: Props) {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCategories = async () => {
    try { setCategories(await categoryApi.list()); } catch {}
  };

  useEffect(() => { loadCategories(); }, []);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollTask = async (taskId: string, onDone: () => void) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const isSync = syncing;
        const status = isSync
          ? await knowledgeApi.syncStatus(taskId)
          : await knowledgeApi.buildStatus(taskId);
        setStatusMsg(status.message);
        setProgress(status.progress);
        if (status.status === "completed" || status.status === "failed" || status.status === "partial") {
          stopPoll();
          onDone();
        }
      } catch {
        stopPoll();
        onDone();
      }
    }, 1500);
  };

  const handleSync = async () => {
    setSyncing(true);
    setProgress(0);
    setStatusMsg("正在获取收藏列表...");
    try {
      const result = await knowledgeApi.sync(sessionId);
      if (result.task_id) {
        await pollTask(result.task_id, () => {
          setSyncing(false);
          loadCategories();
        });
      }
    } catch (e: any) {
      setStatusMsg(`同步失败: ${e.message}`);
      setSyncing(false);
    }
  };

  const handleBuild = async () => {
    setBuilding(true);
    setProgress(0);
    setStatusMsg("开始入库...");
    try {
      const result = await knowledgeApi.build(sessionId);
      if (result.total === 0) { setStatusMsg("没有待处理的笔记"); setBuilding(false); return; }
      if (result.task_id) {
        await pollTask(result.task_id, () => {
          setBuilding(false);
          loadCategories();
        });
      }
    } catch (e: any) {
      setStatusMsg(`入库失败: ${e.message}`);
      setBuilding(false);
    }
  };

  useEffect(() => () => stopPoll(), []);

  return (
    <aside className="w-56 border-r bg-paper flex flex-col h-full">
      <div className="p-4 border-b"><h2 className="font-bold text-ink">分类</h2></div>
      <nav className="flex-1 overflow-y-auto p-2">
        <button onClick={() => onSelectCategory(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${selectedCategoryId === null ? "bg-accent/10 text-accent-strong font-medium" : "hover:bg-paper-2 text-ink-soft"}`}>全部笔记</button>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => onSelectCategory(cat.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex justify-between ${selectedCategoryId === cat.id ? "bg-accent/10 text-accent-strong font-medium" : "hover:bg-paper-2 text-ink-soft"}`}>
            <span>{cat.icon_emoji || "📁"} {cat.name}</span>
            <span className="text-muted">{cat.note_count}</span>
          </button>
        ))}
      </nav>
      {(syncing || building) && progress > 0 && (
        <ProgressBar progress={progress} label={statusMsg} phase={syncing ? "同步收藏" : "AI 入库"} />
      )}
      {statusMsg && !syncing && !building && (
        <div className="px-3 py-2 text-xs text-muted border-t">{statusMsg}</div>
      )}
      <div className="p-3 border-t space-y-2">
        <button onClick={handleSync} disabled={syncing || building} className="w-full bg-accent text-white py-2 rounded-lg text-sm hover:bg-accent-strong disabled:opacity-50">
          {syncing ? "同步中..." : "同步收藏"}
        </button>
        <button onClick={handleBuild} disabled={syncing || building} className="w-full bg-white text-accent border border-accent/40 py-2 rounded-lg text-sm hover:bg-accent/5 disabled:opacity-50">
          {building ? "入库中..." : "开始入库"}
        </button>
      </div>
    </aside>
  );
}
