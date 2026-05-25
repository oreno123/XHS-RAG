"use client";

import { useState, useEffect } from "react";
import { categoryApi, CategoryInfo, knowledgeApi } from "@/lib/api";

interface Props {
  sessionId: string;
  onSelectCategory: (categoryId: number | null) => void;
  selectedCategoryId: number | null;
}

export default function CategorySidebar({ sessionId, onSelectCategory, selectedCategoryId }: Props) {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const loadCategories = async () => {
    try { setCategories(await categoryApi.list()); } catch {}
  };

  useEffect(() => { loadCategories(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setStatusMsg("正在同步收藏...");
    try {
      const result = await knowledgeApi.sync(sessionId);
      setStatusMsg(`同步完成：新增 ${result.added} 条，已有 ${result.existing} 条`);
      loadCategories();
    } catch (e: any) { setStatusMsg(`同步失败: ${e.message}`); }
    finally { setSyncing(false); }
  };

  const handleBuild = async () => {
    setBuilding(true);
    setStatusMsg("开始入库...");
    try {
      const result = await knowledgeApi.build(sessionId);
      if (result.total === 0) { setStatusMsg("没有待处理的笔记"); setBuilding(false); return; }
      const poll = setInterval(async () => {
        try {
          const status = await knowledgeApi.buildStatus(result.task_id);
          setStatusMsg(`${status.message} (${status.processed}/${status.total})`);
          if (status.status === "completed" || status.status === "failed") { clearInterval(poll); setBuilding(false); loadCategories(); }
        } catch { clearInterval(poll); setBuilding(false); }
      }, 3000);
    } catch (e: any) { setStatusMsg(`入库失败: ${e.message}`); setBuilding(false); }
  };

  return (
    <aside className="w-56 border-r bg-gray-50 flex flex-col h-full">
      <div className="p-4 border-b"><h2 className="font-bold text-gray-800">分类</h2></div>
      <nav className="flex-1 overflow-y-auto p-2">
        <button onClick={() => onSelectCategory(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${selectedCategoryId === null ? "bg-red-50 text-red-600 font-medium" : "hover:bg-gray-100 text-gray-700"}`}>全部笔记</button>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => onSelectCategory(cat.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex justify-between ${selectedCategoryId === cat.id ? "bg-red-50 text-red-600 font-medium" : "hover:bg-gray-100 text-gray-700"}`}>
            <span>{cat.icon_emoji || "📁"} {cat.name}</span>
            <span className="text-gray-400">{cat.note_count}</span>
          </button>
        ))}
      </nav>
      {statusMsg && <div className="px-3 py-2 text-xs text-gray-500 border-t">{statusMsg}</div>}
      <div className="p-3 border-t space-y-2">
        <button onClick={handleSync} disabled={syncing || building} className="w-full bg-red-500 text-white py-2 rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">{syncing ? "同步中..." : "同步收藏"}</button>
        <button onClick={handleBuild} disabled={syncing || building} className="w-full bg-white text-red-500 border border-red-300 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">{building ? "入库中..." : "开始入库"}</button>
      </div>
    </aside>
  );
}
