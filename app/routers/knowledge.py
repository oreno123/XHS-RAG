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
    """Sync favorites from Xiaohongshu. Runs as background task with progress."""
    cookie = await _get_cookie(db, req.session_id)
    task_id = str(uuid.uuid4())
    _tasks[task_id] = {
        "status": "running",
        "progress": 0,
        "total": 0,
        "processed": 0,
        "message": "正在获取收藏列表...",
    }
    asyncio.create_task(_run_sync(task_id, cookie))
    return {"task_id": task_id, "message": "Sync started"}


async def _run_sync(task_id: str, cookie: str):
    """Sync: fetch collect list + detail for each note, write everything to DB."""
    try:
        service = XhsService(cookie)
        import time as _time

        # Phase 1: fetch collect list
        _tasks[task_id]["message"] = "正在获取收藏列表..."
        raw_notes = await asyncio.to_thread(service.get_collect_notes)
        parsed = await asyncio.to_thread(service.parse_collect_notes, raw_notes)
        total = len(parsed)
        _tasks[task_id]["total"] = total
        _tasks[task_id]["message"] = f"获取到 {total} 条收藏，正在拉取详情..."

        delay = 0.3
        added = 0
        existing = 0
        cookie_expired = False

        for i, note_data in enumerate(parsed):
            if cookie_expired:
                break

            # Phase 2: fetch detail for each note
            if not note_data.get("content"):
                try:
                    note_url = service.build_note_url(
                        note_data["note_id"], note_data.get("xsec_token", "")
                    )
                    raw_detail = await asyncio.to_thread(service.get_note_detail, note_url)
                    detail = service.parse_note_detail(note_data["note_id"], raw_detail)
                    if detail.get("content"):
                        note_data["content"] = detail["content"]
                    if detail.get("images"):
                        note_data["images"] = detail["images"]
                    if detail.get("video_url"):
                        note_data["video_url"] = detail["video_url"]
                    if detail.get("tags"):
                        note_data["tags"] = detail["tags"]
                    delay = max(0.2, delay - 0.05)
                except Exception as e:
                    err = str(e)
                    if "过期" in err or "-100" in err:
                        cookie_expired = True
                        logger.warning(f"Cookie expired at {i+1}/{total}")
                    else:
                        delay = min(5.0, delay * 2)
                        logger.warning(f"Detail failed: {e}, delay={delay:.1f}s")

            # Phase 3: write to DB
            async with get_db_context() as db:
                result = await db.execute(select(Note).where(Note.note_id == note_data["note_id"]))
                db_note = result.scalar_one_or_none()
                if db_note:
                    # Update existing note with any new data
                    if note_data.get("content") and not db_note.content:
                        db_note.content = note_data["content"]
                    if note_data.get("images") and not db_note.images:
                        db_note.images = note_data["images"]
                    if note_data.get("video_url") and not db_note.video_url:
                        db_note.video_url = note_data["video_url"]
                    if note_data.get("tags") and not db_note.tags:
                        db_note.tags = note_data["tags"]
                    existing += 1
                else:
                    db.add(Note(
                        note_id=note_data["note_id"],
                        title=note_data["title"],
                        content=note_data.get("content", ""),
                        author=note_data.get("author", ""),
                        author_avatar=note_data.get("author_avatar", ""),
                        cover_url=note_data.get("cover_url", ""),
                        images=note_data.get("images", []),
                        video_url=note_data.get("video_url", ""),
                        note_type=note_data.get("note_type", "normal"),
                        tags=note_data.get("tags", []),
                        like_count=note_data.get("like_count", 0),
                        collect_count=note_data.get("collect_count", 0),
                        comment_count=note_data.get("comment_count", 0),
                        status="pending",
                    ))
                    added += 1
                await db.commit()

            _tasks[task_id]["processed"] = i + 1
            _tasks[task_id]["progress"] = (i + 1) / total * 100
            title_preview = note_data.get("title", "")[:25] or note_data["note_id"][:10]
            _tasks[task_id]["message"] = f"{i + 1}/{total} {title_preview}"
            await asyncio.sleep(delay)

        if cookie_expired and added + existing < total:
            _tasks[task_id]["status"] = "partial"
            _tasks[task_id]["message"] = f"Cookie过期，已同步 {added + existing}/{total} 条。重新扫码后再同步可继续。"
        else:
            _tasks[task_id]["status"] = "completed"
            _tasks[task_id]["message"] = f"同步完成：新增 {added} 条，已有 {existing} 条"

    except Exception as e:
        logger.error(f"Sync task failed: {e}")
        _tasks[task_id]["status"] = "failed"
        _tasks[task_id]["message"] = f"同步失败: {e}"


@router.get("/sync/status/{task_id}", response_model=BuildStatusResponse)
async def sync_status(task_id: str):
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


@router.post("/build")
async def build_knowledge(req: SyncRequest, db: AsyncSession = Depends(get_db)):
    """Build knowledge base: classify + vectorize all unprocessed notes."""
    cookie = await _get_cookie(db, req.session_id)
    task_id = str(uuid.uuid4())

    todo_count = await db.scalar(
        select(func.count(Note.id)).where(Note.status.in_(["pending", "synced"]))
    ) or 0

    if todo_count == 0:
        return {"task_id": task_id, "message": "No notes to index", "total": 0}

    _tasks[task_id] = {
        "status": "running",
        "progress": 0,
        "total": todo_count,
        "processed": 0,
        "message": "Starting...",
    }

    asyncio.create_task(_run_index(task_id, cookie))
    return {"task_id": task_id, "message": "Build started", "total": todo_count}


async def _run_index(task_id: str, cookie: str):
    """Background task: classify + vectorize notes. No detail API calls needed."""
    classifier = ClassifierService()
    rag = RAGService()

    try:
        async with get_db_context() as db:
            result = await db.execute(
                select(Note).where(Note.status == "pending").order_by(Note.id)
            )
            notes = result.scalars().all()

        total = len(notes)
        _tasks[task_id]["total"] = total

        for i, note in enumerate(notes):
            try:
                title = note.title or ""
                content = note.content or ""
                tags = note.tags or []

                # Classify
                async with get_db_context() as db:
                    cat_result = await db.execute(select(Category.name))
                    existing_cats = [row[0] for row in cat_result.all()]

                category_name = await classifier.classify(
                    title=title,
                    content_preview=(content or title)[:500],
                    tags=tags,
                    existing_categories=existing_cats,
                )

                # Find or create category
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

                # Update note status
                async with get_db_context() as db:
                    db_result = await db.execute(select(Note).where(Note.note_id == note.note_id))
                    db_note = db_result.scalar_one()
                    db_note.category_id = category_id
                    db_note.status = "indexed"
                    await db.commit()

                # Vectorize
                rag.add_note_content({
                    "note_id": note.note_id,
                    "title": title,
                    "content": content,
                    "tags": tags,
                    "category": category_name,
                })

                _tasks[task_id]["processed"] = i + 1
                _tasks[task_id]["progress"] = (i + 1) / total * 100
                _tasks[task_id]["message"] = f"{i + 1}/{total} {title[:25]}"

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
        _tasks[task_id]["message"] = f"入库完成 {_tasks[task_id]['processed']}/{total} 条"

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
