"""XHS RAG - Data Models"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from enum import Enum

Base = declarative_base()


# ==================== SQLAlchemy Models ====================

class XhsSession(Base):
    """User session (Cookie-based auth)"""
    __tablename__ = "xhs_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), unique=True, index=True, nullable=False)
    cookie = Column(Text, nullable=False)
    xhs_user_id = Column(String(50), nullable=True)
    nickname = Column(String(100), nullable=True)
    avatar = Column(String(500), nullable=True)
    is_valid = Column(Boolean, default=True)
    last_active_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class Category(Base):
    """AI auto-generated categories"""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon_emoji = Column(String(10), nullable=True)
    note_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Note(Base):
    """Favorited Xiaohongshu notes"""
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    note_id = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False, default="")
    content = Column(Text, nullable=True)
    author = Column(String(100), nullable=True)
    author_avatar = Column(String(500), nullable=True)
    cover_url = Column(String(500), nullable=True)
    images = Column(JSON, nullable=True)
    video_url = Column(String(500), nullable=True)
    note_type = Column(String(20), default="normal")
    tags = Column(JSON, nullable=True)
    like_count = Column(Integer, default=0)
    collect_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    status = Column(String(20), default="pending")
    error_msg = Column(Text, nullable=True)
    synced_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    """Chat history"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), index=True, nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    note_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ==================== Pydantic Models (API) ====================

class LoginRequest(BaseModel):
    cookie: str

class LoginResponse(BaseModel):
    session_id: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None

class NoteInfoResponse(BaseModel):
    note_id: str
    title: str
    author: Optional[str] = None
    cover_url: Optional[str] = None
    note_type: str = "normal"
    tags: Optional[list] = None
    category_id: Optional[int] = None
    status: str = "pending"
    like_count: int = 0
    collect_count: int = 0

class NoteDetailResponse(BaseModel):
    note_id: str
    title: str
    content: Optional[str] = None
    author: Optional[str] = None
    author_avatar: Optional[str] = None
    cover_url: Optional[str] = None
    images: Optional[list] = None
    video_url: Optional[str] = None
    note_type: str = "normal"
    tags: Optional[list] = None
    like_count: int = 0
    collect_count: int = 0
    comment_count: int = 0
    category_id: Optional[int] = None

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon_emoji: Optional[str] = None
    note_count: int = 0

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    note_id: Optional[str] = None
    mode: str = "single"

class SyncRequest(BaseModel):
    session_id: str

class BuildStatusResponse(BaseModel):
    task_id: str
    status: str
    progress: float = 0
    total: int = 0
    processed: int = 0
    message: str = ""
