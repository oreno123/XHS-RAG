"""XHS RAG - Category Router"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import Category, Note, CategoryResponse

router = APIRouter(prefix="/category", tags=["category"])


@router.get("/list", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.note_count.desc()))
    categories = result.scalars().all()
    for cat in categories:
        actual_count = await db.scalar(
            select(func.count(Note.id)).where(Note.category_id == cat.id, Note.status != "removed")
        )
        cat.note_count = actual_count or 0
    await db.commit()
    return categories


@router.get("/stats")
async def category_stats(db: AsyncSession = Depends(get_db)):
    total_categories = await db.scalar(select(func.count(Category.id)))
    total_notes = await db.scalar(select(func.count(Note.id)).where(Note.status == "indexed"))
    uncategorized = await db.scalar(
        select(func.count(Note.id)).where(Note.category_id == None, Note.status == "indexed")
    )
    return {
        "total_categories": total_categories or 0,
        "total_notes": total_notes or 0,
        "uncategorized": uncategorized or 0,
    }