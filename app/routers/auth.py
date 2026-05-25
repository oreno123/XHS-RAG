"""XHS RAG - Auth Router (Cookie-based login)"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.database import get_db
from app.models import XhsSession, LoginRequest, LoginResponse
from app.services.xhs import XhsService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login_with_cookie(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login by pasting XHS cookie from browser."""
    cookie = req.cookie.strip()
    if not cookie:
        raise HTTPException(status_code=400, detail="Cookie is empty")

    try:
        service = XhsService(cookie)
        user_data = service.verify_cookie()
    except Exception as e:
        logger.error(f"Cookie verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Cookie invalid: {e}")

    user_id = str(user_data.get("user_id", ""))
    nickname = user_data.get("nickname", "")
    avatar = user_data.get("image", "")

    session_id = str(uuid.uuid4())

    result = await db.execute(select(XhsSession).where(XhsSession.xhs_user_id == user_id))
    existing = result.scalar_one_or_none()

    if existing:
        existing.cookie = cookie
        existing.session_id = session_id
        existing.nickname = nickname
        existing.avatar = avatar
        existing.is_valid = True
    else:
        session = XhsSession(
            session_id=session_id,
            cookie=cookie,
            xhs_user_id=user_id,
            nickname=nickname,
            avatar=avatar,
        )
        db.add(session)

    await db.commit()
    return LoginResponse(session_id=session_id, nickname=nickname, avatar=avatar)


@router.get("/session/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(XhsSession).where(XhsSession.session_id == session_id, XhsSession.is_valid == True)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Session not found or expired")
    return {"valid": True, "user_info": {"nickname": session.nickname, "avatar": session.avatar}}


@router.delete("/session/{session_id}")
async def logout(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(XhsSession).where(XhsSession.session_id == session_id))
    session = result.scalar_one_or_none()
    if session:
        session.is_valid = False
        await db.commit()
    return {"message": "Logged out"}