"""XHS RAG - Knowledge Router (sync + index pipeline)"""
import asyncio
import uuid
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger

from app.database import get_db, get_db_context
from app.models import XhsSession, Note, Category, SyncRequest, BuildStatusResponse
from app.services.xhs import XhsService
from app.services.classifier import ClassifierService
from app.services.rag import RAGService

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

_tasks: dict[str, dict] = {}


async def _get_cookie(db: AsyncSession, session_id: str) -> str:
    result = await db.execute(
        select(XhsSession).where(XhsSession.session_id == session_id, XhsSession.is_valid == True)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    return session.cookie


@router.post("/sync")
async def sync_favorites(req: SyncRequest, db: AsyncSession = Depends(get_db)):
    """Sync favorites from Xiaohongshu. Creates pending notes."""
    cookie = await _get_cookie(db, req.session_id)
    try:
        service = XhsService(cookie)
        raw_notes = service.get_collect_notes()
        parsed = service.parse_collect_notes(raw_notes)
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {e}")

    added = 0
    existing = 0
    for note_data in parsed:
        result = await db.execute(select(Note).where(Note.note_id == note_data["note_id"]))
        existing_note = result.scalar_one_or_none()
        if existing_note:
            existing += 1
            continue
        note = Note(
            note_id=note_data["note_id"],
            title=note_data["title"],
            author=note_data.get("author", ""),
            author_avatar=note_data.get("author_avatar", ""),
            cover_url=note_data.get("cover_url", ""),
            note_type=note_data.get("note_type", "normal"),
            tags=note_data.get("tags", []),
            like_count=note_data.get("like_count", 0),
            collect_count=note_data.get("collect_count", 0),
            comment_count=note_data.get("comment_count", 0),
            status="pending",
        )
        db.add(note)
        added += 1
    await db.commit()
    return {"added": added, "existing": existing, "total": len(parsed)}


@router.post("/build")
async def build_knowledge(req: SyncRequest, db: AsyncSession = Depends(get_db)):
    """Build knowledge base: fetch details + classify + vectorize all pending notes."""
    cookie = await _get_cookie(db, req.session_id)
    task_id = str(uuid.uuid4())

    pending_count = await db.scalar(
        select(func.count(Note.id)).where(Note.status == "pending")
    ) or 0

    if pending_count == 0:
        return {"task_id": task_id, "message": "No pending notes to index", "total": 0}

    _tasks[task_id] = {
        "status": "running",
        "progress": 0,
        "total": pending_count,
        "processed": 0,
        "message": "Starting...",
    }

    asyncio.create_task(_run_index(task_id, cookie))
    return {"task_id": task_id, "message": "Build started", "total": pending_count}


async def _run_index(task_id: str, cookie: str):
    """Background task: fetch detail -> classify -> vectorize each pending note."""
    service = XhsService(cookie)
    classifier = ClassifierService()
    rag = RAGService()

    try:
        # Get pending notes
        async with get_db_context() as db:
            result = await db.execute(select(Note).where(Note.status == "pending").order_by(Note.id))
            pending_notes = result.scalars().all()

        total = len(pending_notes)
        _tasks[task_id]["total"] = total

        for i, note in enumerate(pending_notes):
            try:
                # 1. Fetch detail
                note_url = service.build_note_url(note.note_id)
                raw_detail = service.get_note_detail(note_url)
                detail = service.parse_note_detail(note.note_id, raw_detail)

                # 2. Get existing categories
                async with get_db_context() as db:
                    cat_result = await db.execute(select(Category.name))
                    existing_cats = [row[0] for row in cat_result.all()]

                # 3. Classify
                category_name = await classifier.classify(
                    title=detail.get("title", note.title),
                    content_preview=(detail.get("content", "") or "")[:500],
                    tags=detail.get("tags", []),
                    existing_categories=existing_cats,
                )

                # 4. Find or create category
                category_id = None
                async with get_db_context() as db:
                    cat_result = await db.execute(select(Category).where(Category.name == category_name))
                    category = cat_result.scalar_one_or_none()
                    if not category:
                        category = Category(name=category_name)
                        db.add(category)
                        await db.commit()
                        await db.refresh(category)
                    category_id = category.id

                # 5. Update note in DB
                async with get_db_context() as db:
                    db_result = await db.execute(select(Note).where(Note.note_id == note.note_id))
                    db_note = db_result.scalar_one()
                    db_note.title = detail.get("title", note.title)
                    db_note.content = detail.get("content", "")
                    db_note.images = detail.get("images", [])
                    db_note.video_url = detail.get("video_url", "")
                    db_note.note_type = detail.get("note_type", "normal")
                    db_note.tags = detail.get("tags", [])
                    db_note.category_id = category_id
                    db_note.status = "indexed"
                    await db.commit()

                # 6. Vectorize
                note_for_rag = {
                    "note_id": note.note_id,
                    "title": detail.get("title", note.title),
                    "content": detail.get("content", ""),
                    "tags": detail.get("tags", []),
                    "category": category_name,
                }
                rag.add_note_content(note_for_rag)

                _tasks[task_id]["processed"] = i + 1
                _tasks[task_id]["progress"] = (i + 1) / total * 100
                _tasks[task_id]["message"] = f"Indexed: {detail.get('title', note.note_id)[:30]}"

                await asyncio.sleep(service._interval)

            except Exception as e:
                logger.error(f"Index failed for {note.note_id}: {e}")
                async with get_db_context() as db:
                    db_result = await db.execute(select(Note).where(Note.note_id == note.note_id))
                    db_note = db_result.scalar_one_or_none()
                    if db_note:
                        db_note.status = "error"
                        db_note.error_msg = str(e)
                        await db.commit()

        _tasks[task_id]["status"] = "completed"
        _tasks[task_id]["message"] = f"Done. Indexed {_tasks[task_id]['processed']}/{total} notes."

    except Exception as e:
        logger.error(f"Build task failed: {e}")
        _tasks[task_id]["status"] = "failed"
        _tasks[task_id]["message"] = str(e)


@router.get("/build/status/{task_id}", response_model=BuildStatusResponse)
async def build_status(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return BuildStatusResponse(
        task_id=task_id,
        status=task["status"],
        progress=task["progress"],
        total=task["total"],
        processed=task["processed"],
        message=task["message"],
    )


@router.get("/stats")
async def knowledge_stats():
    rag = RAGService()
    return rag.get_collection_stats()


@router.delete("/clear")
async def clear_knowledge():
    rag = RAGService()
    rag.clear_collection()
    return {"message": "Knowledge base cleared"}
