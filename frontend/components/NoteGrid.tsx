"use client";

import { NoteInfo } from "@/lib/api";

interface Props {
  notes: NoteInfo[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

export default function NoteGrid({ notes, selectedNoteId, onSelectNote }: Props) {
  if (notes.length === 0) {
    return <div className="flex items-center justify-center h-96 text-muted text-sm">暂无笔记，请先同步收藏</div>;
  }
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 space-y-3">
      {notes.map((note) => (
        <button
          key={note.note_id}
          onClick={() => onSelectNote(note.note_id)}
          className={`break-inside-avoid w-full rounded-xl overflow-hidden text-left group transition-all duration-200 ${
            selectedNoteId === note.note_id
              ? "ring-2 ring-accent shadow-lg shadow-accent/10"
              : "glass hover:ring-1 hover:ring-accent/20 hover:-translate-y-0.5"
          }`}
        >
          {note.cover_url ? (
            <div className="relative overflow-hidden">
              <img
                src={note.cover_url}
                alt={note.title}
                referrerPolicy="no-referrer"
                className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                style={{ aspectRatio: 'auto', maxHeight: '320px' }}
              />
              {/* Gradient overlay with title */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-10 pb-2 px-3">
                <p className="text-sm font-medium text-white line-clamp-2 drop-shadow">{note.title || "无标题"}</p>
              </div>
            </div>
          ) : (
            <div className="w-full py-8 px-3 flex flex-col justify-center">
              <p className="text-sm font-medium text-ink line-clamp-3">{note.title || "无标题"}</p>
              {note.author && <p className="text-xs text-muted mt-2">{note.author}</p>}
            </div>
          )}
          {/* Bottom info */}
          {(note.author || (note.tags && note.tags.length > 0)) && note.cover_url && (
            <div className="px-3 py-2">
              {note.author && <p className="text-xs text-muted truncate">{note.author}</p>}
              {note.tags && note.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {note.tags.slice(0, 2).map((tag, i) => (
                    <span key={i} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
