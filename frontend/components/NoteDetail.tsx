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
    <div className="pb-8">
      {/* Media */}
      {note.note_type === "video" && note.video_url ? (
        <VideoPlayer url={note.video_url} poster={note.cover_url} sessionId={sessionId} />
      ) : note.images && note.images.length > 0 ? (
        <ImageCarousel images={note.images} />
      ) : note.cover_url ? (
        <img src={note.cover_url} alt="" referrerPolicy="no-referrer" className="w-full max-h-[50vh] object-contain rounded-xl" />
      ) : null}

      {/* Title */}
      <h1 className="text-2xl font-bold text-ink mt-6 leading-tight">{note.title || "无标题"}</h1>

      {/* Author & Stats */}
      <div className="flex items-center gap-3 mt-3 text-sm text-muted">
        {note.author_avatar && <img src={note.author_avatar} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-border" />}
        <span className="text-ink-soft">{note.author}</span>
        <span className="ml-auto flex items-center gap-3">
          <span>❤ {note.like_count}</span>
          <span>⭐ {note.collect_count}</span>
          <span>💬 {note.comment_count}</span>
        </span>
      </div>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {note.tags.map((tag, i) => (
            <span key={i} className="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded-full">{tag}</span>
          ))}
        </div>
      )}

      {/* Content */}
      {note.content && (
        <div className="mt-6 px-5 py-4 rounded-xl bg-paper-2/80 text-ink leading-[1.8] whitespace-pre-wrap text-[15px] max-w-2xl">
          {note.content}
        </div>
      )}
    </div>
  );
}
