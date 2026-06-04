"use client";

import { NoteDetail as NoteDetailType } from "@/lib/api";
import VideoPlayer from "./VideoPlayer";
import ImageCarousel from "./ImageCarousel";

interface Props {
  note: NoteDetailType;
  sessionId?: string;
}

export default function NoteDetail({ note, sessionId }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {note.note_type === "video" && note.video_url ? (
        <VideoPlayer url={note.video_url} poster={note.cover_url} sessionId={sessionId} />
      ) : note.images && note.images.length > 0 ? (
        <ImageCarousel images={note.images} />
      ) : note.cover_url ? (
        <img src={note.cover_url} alt="" referrerPolicy="no-referrer" className="w-full max-h-[60vh] object-contain rounded-lg" />
      ) : null}
      <h1 className="text-xl font-bold text-ink mt-4">{note.title || "无标题"}</h1>
      <div className="flex items-center gap-3 mt-2 text-sm text-muted">
        {note.author_avatar && <img src={note.author_avatar} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-full" />}
        <span>{note.author}</span>
        <span>❤ {note.like_count}</span>
        <span>⭐ {note.collect_count}</span>
        <span>💬 {note.comment_count}</span>
      </div>
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1 mt-3 flex-wrap">
          {note.tags.map((tag, i) => (<span key={i} className="text-sm bg-accent/10 text-accent px-2 py-1 rounded">#{tag}</span>))}
        </div>
      )}
      {note.content && <div className="mt-4 text-ink-soft leading-relaxed whitespace-pre-wrap text-sm">{note.content}</div>}
    </div>
  );
}
