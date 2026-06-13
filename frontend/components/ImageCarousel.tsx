"use client";

import { useState } from "react";

interface Props { images: string[]; }

export default function ImageCarousel({ images }: Props) {
  const [current, setCurrent] = useState(0);
  if (!images || images.length === 0) return null;
  return (
    <div className="relative rounded-xl overflow-hidden bg-paper-3">
      <img src={images[current]} alt="" referrerPolicy="no-referrer" className="w-full max-h-[55vh] object-contain" />
      {images.length > 1 && (
        <>
          <button onClick={() => setCurrent((c) => (c > 0 ? c - 1 : images.length - 1))} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-lg transition">‹</button>
          <button onClick={() => setCurrent((c) => (c < images.length - 1 ? c + 1 : 0))} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-lg transition">›</button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs px-2.5 py-1 rounded-full">{current + 1} / {images.length}</div>
        </>
      )}
    </div>
  );
}
