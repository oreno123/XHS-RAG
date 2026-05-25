"use client";

interface Props { url: string; poster?: string; }

export default function VideoPlayer({ url, poster }: Props) {
  if (!url) return null;
  return <video src={url} poster={poster} controls className="w-full max-h-[60vh] rounded-lg bg-black" playsInline>Your browser does not support video playback.</video>;
}
