"use client";

import { useState, useEffect, useRef } from "react";
import { categoryApi, CategoryInfo, knowledgeApi } from "@/lib/api";

interface Props {
  sessionId: string;
  onSelectCategory: (categoryId: number | null) => void;
  selectedCategoryId: number | null;
  onClose: () => void;
}

function ProgressBar({ progress, label, phase }: { progress: number; label: string; phase?: string }) {
  return (
    <div className="px-3 py-2 border-t border-border">
      {phase && <div className="text-xs font-medium text-ink-soft mb-0.5">{phase}</div>}
      <div className="flex justify-between text-xs text-muted mb-1">
        <span className="truncate flex-1">{label}</span>
        <span className="ml-2 shrink-0">{Math.round(progress)}%</span>
      </div>
      <div className="h-1 bg-paper-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function CategorySidebar({ sessionId, onSelectCategory, selectedCategoryId, onClose }: Props) {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [search, setSearch] = useState("");
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

  const handlePush = async () => {
    setPushing(true);
    setStatusMsg("正在推送...");
    try {
      const result = await knowledgeApi.push(sessionId);
      const channels = Object.entries(result.results || {});
      const ok = channels.filter(([, v]) => v.status === "ok").length;
      setStatusMsg(ok > 0 ? `已推送到 ${ok} 个渠道` : "推送失败，检查配置");
    } catch (e: any) {
      setStatusMsg(`推送失败: ${e.message}`);
    }
    setPushing(false);
  };

  useEffect(() => () => stopPoll(), []);

  const filtered = search
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <aside className="w-56 glass flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-bold text-ink text-sm">分类</h2>
        <button onClick={onClose} className="text-muted hover:text-ink transition text-lg leading-none">✕</button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="搜索分类..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-paper-3/50 border border-border rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent/40 transition"
        />
      </div>

      {/* Category list */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <button
          onClick={() => onSelectCategory(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition ${
            selectedCategoryId === null
              ? "bg-accent/15 text-accent font-medium"
              : "hover:bg-paper-3 text-ink-soft"
          }`}
        >
          全部笔记
        </button>
        {filtered.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 flex justify-between transition ${
              selectedCategoryId === cat.id
                ? "bg-accent/15 text-accent font-medium"
                : "hover:bg-paper-3 text-ink-soft"
            }`}
          >
            <span className="truncate">{cat.icon_emoji || "📁"} {cat.name}</span>
            <span className="text-muted text-xs shrink-0 ml-1">{cat.note_count}</span>
          </button>
        ))}
      </nav>

      {/* Progress */}
      {(syncing || building) && progress > 0 && (
        <ProgressBar progress={progress} label={statusMsg} phase={syncing ? "同步收藏" : "AI 入库"} />
      )}
      {statusMsg && !syncing && !building && !pushing && (
        <div className="px-3 py-2 text-xs text-muted border-t border-border">{statusMsg}</div>
      )}

      {/* Action buttons */}
      <div className="p-3 border-t border-border space-y-1.5">
        <button onClick={handleSync} disabled={syncing || building} className="w-full bg-accent text-white py-1.5 rounded-lg text-xs hover:bg-accent-strong disabled:opacity-50 transition active:scale-[0.98]">
          {syncing ? "同步中..." : "同步收藏"}
        </button>
        <button onClick={handleBuild} disabled={syncing || building} className="w-full bg-paper-3 text-ink-soft py-1.5 rounded-lg text-xs hover:bg-paper-2 disabled:opacity-50 transition active:scale-[0.98]">
          {building ? "入库中..." : "开始入库"}
        </button>
        <button onClick={handlePush} disabled={syncing || building || pushing} className="w-full text-muted hover:text-ink-soft py-1.5 rounded-lg text-xs hover:bg-paper-3 disabled:opacity-50 transition active:scale-[0.98]">
          {pushing ? "推送中..." : "推送回顾"}
        </button>
      </div>
    </aside>
  );
}
