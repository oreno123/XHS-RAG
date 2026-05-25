"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!cookie.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await authApi.login(cookie.trim());
      localStorage.setItem("xhs_session", result.session_id);
      if (result.nickname) localStorage.setItem("xhs_user", JSON.stringify(result));
      window.location.href = "/workspace";
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">小红书收藏知识库</h1>
        <p className="text-gray-500 mb-6">把收藏变成可对话的知识库</p>
        <div className="text-left mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">粘贴小红书 Cookie</label>
          <textarea
            className="w-full border rounded-lg p-3 text-sm h-32 resize-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            placeholder="从浏览器开发者工具 → Application → Cookies 复制小红书的 Cookie..."
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">打开 xiaohongshu.com → F12 → Application → Cookies → 复制全部 cookie</p>
        </div>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading || !cookie.trim()}
          className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "验证中..." : "登录"}
        </button>
      </div>
    </div>
  );
}
