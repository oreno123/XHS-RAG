"""XHS RAG - Notes Router"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger

from app.database import get_db
from app.models import Note, Category, NoteInfoResponse, NoteDetailResponse

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/list", response_model=list[NoteInfoResponse])
async def list_notes(
    category_id: int | None = None,
    status: str | None = None,
    session_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    query = select(Note)
    if category_id is not None:
        query = query.where(Note.category_id == category_id)
    if status:
        query = query.where(Note.status == status)
    query = query.where(Note.status != "removed").order_by(Note.synced_at.desc())
    result = await db.execute(query)
    notes = result.scalars().all()
    return notes


@router.get("/detail/{note_id}", response_model=NoteDetailResponse)
async def get_note_detail(note_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.note_id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.get("/count")
async def count_notes(
    session_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(select(func.count(Note.id)).where(Note.status != "removed"))
    indexed = await db.scalar(select(func.count(Note.id)).where(Note.status == "indexed"))
    pending = await db.scalar(select(func.count(Note.id)).where(Note.status == "pending"))
    return {"total": total or 0, "indexed": indexed or 0, "pending": pending or 0}