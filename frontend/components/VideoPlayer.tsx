"use client";

import { API_BASE_URL } from "@/lib/api";

interface Props { url: string; poster?: string; sessionId?: string; }

export default function VideoPlayer({ url, poster, sessionId }: Props) {
  if (!url) return null;

  // Route through backend proxy to handle XHS CDN auth
  let videoSrc = url;
  if (sessionId && url.includes("xhscdn.com")) {
    videoSrc = `${API_BASE_URL}/notes/video/proxy?url=${encodeURIComponent(url)}&session_id=${sessionId}`;
  }

  return <video src={videoSrc} poster={poster} controls referrerPolicy="no-referrer" className="w-full max-h-[60vh] rounded-lg bg-black" playsInline>Your browser does not support video playback.</video>;
}
