"use client";

interface Props { isFullscreen: boolean; onToggle: () => void; }

export default function FullscreenToggle({ isFullscreen, onToggle }: Props) {
  return (
    <button onClick={onToggle} className="absolute top-3 right-3 z-10 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/70 text-lg" title={isFullscreen ? "退出全屏" : "全屏"}>
      {isFullscreen ? "✕" : "⛶"}
    </button>
  );
}
