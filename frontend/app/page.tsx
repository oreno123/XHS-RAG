"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const [tab, setTab] = useState<"qrcode" | "cookie">("qrcode");
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  const [qrImage, setQrImage] = useState("");
  const [qrId, setQrId] = useState("");
  const [qrStatus, setQrStatus] = useState<"loading" | "waiting" | "scanned" | "expired" | "error">("loading");
  const [qrMessage, setQrMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanCookie = (raw: string) => raw.replace(/[\r\n]+/g, "").replace(/\s+/g, " ").trim();
  const consoleSnippet = 'copy(await cookieStore.getAll().then(cs=>cs.map(c=>c.name+"="+c.value).join("; ")))';

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async (sessionId: string, nickname?: string, avatar?: string) => {
    localStorage.setItem("xhs_session", sessionId);
    if (nickname) localStorage.setItem("xhs_user", JSON.stringify({ nickname, avatar }));
    window.location.href = "/workspace";
  };

  const fetchQrCode = useCallback(async () => {
    setQrStatus("loading");
    setQrMessage("");
    try {
      const data = await authApi.createQrcode();
      setQrImage(data.qr_image);
      setQrId(data.qr_id);
      setQrStatus("waiting");
      setQrMessage("打开小红书APP扫描二维码");
    } catch (e: any) {
      setQrStatus("error");
      setQrMessage(e.message || "二维码生成失败");
    }
  }, []);

  useEffect(() => {
    if (tab !== "qrcode" || !qrId) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await authApi.checkQrcode(qrId);
        if (data.status === "success" && data.session_id) {
          setQrStatus("scanned");
          setQrMessage("登录成功!");
          if (pollRef.current) clearInterval(pollRef.current);
          await handleLogin(data.session_id, data.nickname, data.avatar);
        } else if (data.status === "expired") {
          setQrStatus("expired");
          setQrMessage("二维码已过期，点击刷新");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "error") {
          setQrStatus("error");
          setQrMessage(data.message || "登录失败");
          if (pollRef.current) clearInterval(pollRef.current);
        } else {
          if (data.message?.includes("确认")) {
            setQrStatus("scanned");
            setQrMessage("请在手机上确认登录");
          }
        }
      } catch {
        // network hiccup
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, qrId]);

  useEffect(() => {
    if (tab === "qrcode") fetchQrCode();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab, fetchQrCode]);

  // Dual-layer background: fluid (base) + particles (overlay)
  useEffect(() => {
    document.documentElement.style.background = '#0d0b08';
    document.body.style.background = 'transparent';

    // Fluid config — XHS red on warm dark
    (window as any).FluidBg = {
      TRANSPARENT: false,
      BACK_COLOR: { r: 13, g: 11, b: 8 },
      SPLAT_INTENSITY: 0.035,
      SPLAT_BURST: 0.85,
      SPLAT_FORCE: 2000,
      SPLAT_RADIUS: 0.35,
      DENSITY_DISSIPATION: 0.998,
      VELOCITY_DISSIPATION: 0.1,
      CURL: 15,
      BLOOM: false,
      SHADING: false,
      COLORFUL: true,
      COLOR_UPDATE_SPEED: 3,
    };

    // Particle config — XHS red
    (window as any).ParticleBg = {
      COUNT: 6000,
      COLOR: [0.996, 0.173, 0.333],
      COLOR_FAR: [0.35, 0.06, 0.12],
      POINT_SCALE: 200,
      SPREAD: 9,
      DEPTH: 9,
    };

    let loaded = 0;
    const onAllReady = () => {
      loaded++;
      if (loaded < 2) return;
      const canvases = document.querySelectorAll('canvas');
      // last inserted = index 0 (particle), first = index 1 (fluid)
      if (canvases[0]) canvases[0].style.zIndex = '1';
      if (canvases[1]) canvases[1].style.zIndex = '0';
      if ((window as any).FluidBg?.multipleSplats) {
        (window as any).FluidBg.multipleSplats(Math.floor(Math.random() * 3) + 6);
      }
    };

    const fluidScript = document.createElement('script');
    fluidScript.src = '/fluid-bg.js';
    fluidScript.async = true;
    fluidScript.onload = onAllReady;
    document.body.appendChild(fluidScript);

    const particleScript = document.createElement('script');
    particleScript.src = '/particle-bg.js';
    particleScript.async = true;
    particleScript.onload = onAllReady;
    document.body.appendChild(particleScript);

    return () => {
      if ((window as any).FluidBg?.destroy) (window as any).FluidBg.destroy();
      if ((window as any).ParticleBg?.destroy) (window as any).ParticleBg.destroy();
      document.documentElement.style.background = '';
      document.body.style.background = '';
      if (fluidScript.parentNode) fluidScript.parentNode.removeChild(fluidScript);
      if (particleScript.parentNode) particleScript.parentNode.removeChild(particleScript);
    };
  }, []);

  const handleCookieLogin = async () => {
    const cleaned = cleanCookie(cookie);
    if (!cleaned) return;
    setLoading(true);
    setError("");
    try {
      const result = await authApi.login(cleaned);
      await handleLogin(result.session_id, result.nickname, result.avatar);
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Warm light palette for dark background
  const ink = {
    900: "#f0e6d2", 700: "#c4b49a", 500: "#8a7560", 400: "#6b5a48",
    300: "#4a3a28", 200: "#2a2015", 100: "#1a1510",
  };
  const accent = "#FE2C55";
  const accentDk = "#E0244A";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative z-10 select-none">

      {/* ==================== LEFT: HERO ==================== */}
      <div className="flex-1 flex flex-col justify-center py-12 lg:py-0" style={{ paddingLeft: '10%', paddingRight: '4%' }}>
        <div className="mx-auto w-full" style={{ maxWidth: 560 }}>
        {/* Eyebrow */}
        <div
          className={`text-[10px] tracking-[0.35em] uppercase mb-8 transition-all duration-1000 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "100ms", color: `rgba(200,180,150,0.2)` }}
        >
          XHS Collection
        </div>

        {/* Title */}
        <h1
          className={`mb-8 transition-all duration-1000 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "250ms" }}
        >
          <span
            className="block text-[clamp(20px,2.5vw,32px)] font-light mb-3"
            style={{ color: `rgba(200,180,150,0.45)`, letterSpacing: "0.08em" }}
          >
            小红书
          </span>
          <span
            className="block text-[clamp(48px,7vw,100px)] leading-[1.05]"
            style={{
              fontFamily: "STXingkai, cursive",
              letterSpacing: "-0.03em",
              background: `linear-gradient(180deg, #f0e6d2 0%, #8a7560 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            收藏知识库
          </span>
        </h1>

        {/* Description */}
        <p
          className={`text-[15px] font-light max-w-md mb-14 transition-all duration-1000 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "400ms", color: `rgba(200,180,150,0.3)`, letterSpacing: "0.03em", lineHeight: 1.7 }}
        >
          把散落的收藏整理成可搜索、可分类、可对话的个人知识库
        </p>

        {/* Feature list */}
        <div
          className={`flex flex-col gap-3.5 transition-all duration-1000 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "550ms" }}
        >
          {[
            "语义搜索 — 用自然语言找收藏",
            "智能分类 — AI 自动归类笔记",
            "对话问答 — 针对收藏内容提问",
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3 text-xs" style={{ color: `rgba(200,180,150,0.22)`, letterSpacing: "0.03em" }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `rgba(254,44,85,0.4)` }} />
              {text}
            </div>
          ))}
        </div>
        </div>
      </div>
      <div
        className={`w-full lg:w-[440px] xl:w-[480px] flex items-center justify-center px-6 py-12 lg:py-0 lg:border-l transition-all duration-700 ease-out ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
        style={{ transitionDelay: "400ms", borderColor: `rgba(200,180,150,0.06)` }}
      >
        <div
          className="w-full max-w-sm p-8 rounded-2xl"
          style={{
            background: `rgba(20,17,12,0.7)`,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: `1px solid rgba(200,180,150,0.1)`,
            boxShadow: `0 0 0 1px rgba(254,44,85,0.04), 0 12px 48px rgba(0,0,0,0.45)`,
          }}
        >
          <h2
            className="text-lg font-semibold mb-1 text-center"
            style={{ fontFamily: "STXingkai, cursive", color: "#f0e6d2", letterSpacing: "0.02em" }}
          >
            登录
          </h2>
          <p className="text-xs text-center mb-6" style={{ color: ink[500] }}>
            使用小红书账号验证身份
          </p>

          {/* Tabs */}
          <div className="flex mb-6" style={{ borderBottom: `1px solid rgba(200,180,150,0.12)` }}>
            {(["qrcode", "cookie"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 pb-2.5 text-xs transition-all duration-200 ${tab === t ? "font-medium" : ""}`}
                style={{
                  color: tab === t ? accentDk : ink[400],
                  borderBottom: tab === t ? `2px solid ${accent}` : "2px solid transparent",
                }}
              >
                {t === "qrcode" ? "扫码登录" : "Cookie 登录"}
              </button>
            ))}
          </div>

          {/* QR code panel */}
          {tab === "qrcode" && (
            <div className="flex flex-col items-center">
              {qrImage ? (
                <div className="relative p-3 rounded-xl" style={{ background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  <img
                    src={qrImage}
                    alt="QR Code"
                    className={`w-44 h-44 rounded-lg transition-opacity duration-300 ${qrStatus === "expired" || qrStatus === "error" ? "opacity-20" : ""}`}
                  />
                  {(qrStatus === "expired" || qrStatus === "error") && (
                    <button
                      onClick={fetchQrCode}
                      className="absolute inset-3 rounded-lg flex items-center justify-center font-medium text-sm transition-colors hover:opacity-80"
                      style={{ background: `rgba(20,17,12,0.85)`, color: "#f0e6d2" }}
                    >
                      点击刷新
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-44 h-44 flex items-center justify-center rounded-xl" style={{ background: ink[100], border: `1px solid ${ink[200]}` }}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: "transparent" }} />
                    <span className="text-xs" style={{ color: ink[500] }}>生成中</span>
                  </div>
                </div>
              )}
              <p className="mt-4 text-xs" style={{ color: qrStatus === "error" ? "#ef4444" : qrStatus === "scanned" ? accent : ink[500] }}>
                {qrMessage}
              </p>
            </div>
          )}

          {/* Cookie panel */}
          {tab === "cookie" && (
            <div className="text-left">
              <textarea
                className="w-full rounded-xl p-3.5 text-sm h-28 resize-none focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  background: "#fff",
                  border: `1px solid ${ink[200]}`,
                  color: ink[900],
                  "--tw-ring-color": "rgba(254,44,85,0.3)",
                } as any}
                placeholder="a1=xxx; webId=xxx; web_session=xxx"
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
              />
              <details className="text-xs mt-3" style={{ color: ink[500] }}>
                <summary className="cursor-pointer font-medium" style={{ color: ink[700] }}>
                  如何获取 Cookie？
                </summary>
                <div className="mt-2.5 pl-1">
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: "rgba(254,44,85,0.05)",
                      border: "1px solid rgba(254,44,85,0.12)",
                      color: accentDk,
                    }}
                  >
                    <p className="font-medium mb-1.5">Console 一行代码</p>
                    <p>1. 打开并登录 <a href="https://www.xiaohongshu.com" target="_blank" className="underline">xiaohongshu.com</a></p>
                    <p>2. F12 → Console，粘贴：</p>
                    <div
                      className="rounded-lg p-2.5 mt-1.5 font-mono text-[11px] break-all select-all cursor-pointer"
                      style={{ background: "#fff", color: ink[900], border: `1px solid ${ink[200]}` }}
                      onClick={() => navigator.clipboard.writeText(consoleSnippet)}
                    >
                      {consoleSnippet}
                    </div>
                    <p className="mt-1.5">3. Cookie 已复制到剪贴板，回来粘贴</p>
                  </div>
                </div>
              </details>
              {error && <p className="text-xs mt-2.5" style={{ color: "#ef4444" }}>{error}</p>}
              <button
                onClick={handleCookieLogin}
                disabled={loading || !cookie.trim()}
                className="w-full mt-5 py-3 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
                style={{ background: accent }}
              >
                {loading ? "验证中..." : "登录"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
