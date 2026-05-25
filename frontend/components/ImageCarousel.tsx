"use client";

import { useState } from "react";

interface Props { images: string[]; }

export default function ImageCarousel({ images }: Props) {
  const [current, setCurrent] = useState(0);
  if (!images || images.length === 0) return null;
  return (
    <div className="relative">
      <img src={images[current]} alt="" className="w-full max-h-[60vh] object-contain bg-black rounded-lg" />
      {images.length > 1 && (
        <>
          <button onClick={() => setCurrent((c) => (c > 0 ? c - 1 : images.length - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full">‹</button>
          <button onClick={() => setCurrent((c) => (c < images.length - 1 ? c + 1 : 0))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full">›</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">{current + 1} / {images.length}</div>
        </>
      )}
    </div>
  );
}
