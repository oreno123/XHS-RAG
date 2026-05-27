"""XHS RAG - Auth Router (Cookie-based login + QR code login)"""
import uuid
import base64
import io
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.database import get_db
from app.models import XhsSession, LoginRequest, LoginResponse
from app.services.xhs import XhsService

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory store for active QR login sessions: {qr_id: {cookies, qr_url, code}}
_qr_sessions: dict[str, dict] = {}


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


@router.post("/qrcode/create")
async def create_qrcode():
    """Generate a QR code for Xiaohongshu app scanning."""
    from spider_xhs.apis.xhs_pc_login_apis import XHSLoginApi
    import qrcode as qr_lib

    login_api = XHSLoginApi()
    try:
        cookies = await asyncio.to_thread(login_api.generate_init_cookies)
        success, msg, qr_data = await asyncio.to_thread(login_api.generate_qrcode, cookies)
    except Exception as e:
        logger.error(f"QR code generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate QR code: {e}")

    if not success:
        raise HTTPException(status_code=500, detail=f"QR code error: {msg}")

    qr_id = qr_data["qr_id"]
    _qr_sessions[qr_id] = {
        "cookies": qr_data["cookies"],
        "qr_url": qr_data["qr_url"],
        "code": qr_data["code"],
    }

    # Generate QR code as base64 PNG
    qr = qr_lib.QRCode(box_size=10, border=2)
    qr.add_data(qr_data["qr_url"])
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return {"qr_id": qr_id, "qr_image": f"data:image/png;base64,{qr_b64}"}


@router.get("/qrcode/status/{qr_id}")
async def check_qrcode(qr_id: str, db: AsyncSession = Depends(get_db)):
    """Poll QR code scan status. Returns login session on success."""
    from spider_xhs.apis.xhs_pc_login_apis import XHSLoginApi

    session_data = _qr_sessions.get(qr_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="QR session not found or expired")

    login_api = XHSLoginApi()
    try:
        success, msg, cookies = await asyncio.to_thread(
            login_api.check_qrcode_status,
            qr_id, session_data["code"], session_data["cookies"],
        )
        session_data["cookies"] = cookies
    except Exception as e:
        return {"status": "error", "message": str(e)}

    if not success:
        if "过期" in msg:
            _qr_sessions.pop(qr_id, None)
            return {"status": "expired", "message": msg}
        return {"status": "waiting", "message": msg}

    # Scanned & confirmed — get user info and create session
    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
    _qr_sessions.pop(qr_id, None)

    try:
        service = XhsService(cookie_str)
        user_data = service.verify_cookie()
        user_id = str(user_data.get("user_id", ""))
        nickname = user_data.get("nickname", "")
        avatar = user_data.get("image", "")
    except Exception:
        # Fallback: try get_user_info from login API
        try:
            ok, info, cookies = await asyncio.to_thread(login_api.get_user_info, cookies)
            user_id = str((info.get("user_info") or {}).get("user_id", ""))
            nickname = (info.get("user_info") or {}).get("nickname", "")
            avatar = (info.get("user_info") or {}).get("image", "")
            cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        except Exception as e:
            logger.error(f"User info fetch failed after QR login: {e}")
            return {"status": "error", "message": f"Login succeeded but user info failed: {e}"}

    if not user_id:
        return {"status": "error", "message": "Could not get user ID"}

    session_id = str(uuid.uuid4())
    result = await db.execute(select(XhsSession).where(XhsSession.xhs_user_id == user_id))
    existing = result.scalar_one_or_none()
    if existing:
        existing.cookie = cookie_str
        existing.session_id = session_id
        existing.nickname = nickname
        existing.avatar = avatar
        existing.is_valid = True
    else:
        db.add(XhsSession(
            session_id=session_id, cookie=cookie_str,
            xhs_user_id=user_id, nickname=nickname, avatar=avatar,
        ))
    await db.commit()

    return {
        "status": "success",
        "session_id": session_id,
        "nickname": nickname,
        "avatar": avatar,
    }