"use client";

import { NoteInfo } from "@/lib/api";

interface Props {
  notes: NoteInfo[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

export default function NoteGrid({ notes, selectedNoteId, onSelectNote }: Props) {
  if (notes.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted">暂无笔记，请先同步收藏</div>;
  }
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {notes.map((note) => (
          <button key={note.note_id} onClick={() => onSelectNote(note.note_id)} className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left ${selectedNoteId === note.note_id ? "ring-2 ring-accent" : ""}`}>
            {note.cover_url ? <img src={note.cover_url} alt={note.title} className="w-full aspect-[3/4] object-cover" /> : <div className="w-full aspect-[3/4] bg-paper-3 flex items-center justify-center text-muted">无封面</div>}
            <div className="p-2">
              <p className="text-sm font-medium text-ink line-clamp-2">{note.title || "无标题"}</p>
              <p className="text-xs text-muted mt-1">{note.author}</p>
              {note.tags && note.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {note.tags.slice(0, 3).map((tag, i) => (<span key={i} className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">{tag}</span>))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
