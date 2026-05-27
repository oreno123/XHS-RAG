"""XHS RAG - Notes Router"""
import httpx
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger
from urllib.parse import urlparse

from app.database import get_db
from app.models import Note, Category, NoteInfoResponse, NoteDetailResponse, XhsSession

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


@router.get("/video/proxy")
async def proxy_video(url: str, session_id: str = Query(...)):
    """Proxy video through backend to add correct Referer/Cookie headers."""
    # Get cookie from session
    db_gen = get_db()
    db = await db_gen.__anext__()
    try:
        result = await db.execute(
            select(XhsSession.cookie).where(XhsSession.session_id == session_id, XhsSession.is_valid == True)
        )
        row = result.first()
    finally:
        await db.close()

    if not row:
        # Try without cookie - some CDN URLs work without auth
        pass

    cookie_str = row[0] if row else ""
    cookies = {}
    if cookie_str:
        for pair in cookie_str.split("; "):
            if "=" in pair:
                k, v = pair.split("=", 1)
                cookies[k] = v

    parsed = urlparse(url)
    referer = f"{parsed.scheme}://{parsed.hostname}/"

    async def stream():
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            async with client.stream("GET", url, headers={
                "Referer": referer,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            }, cookies=cookies) as resp:
                if resp.status_code != 200:
                    yield f"Error: HTTP {resp.status_code}".encode()
                    return
                content_type = resp.headers.get("content-type", "video/mp4")
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk

    return StreamingResponse(stream(), media_type="video/mp4")