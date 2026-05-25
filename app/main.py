"""XHS RAG - Main Application"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys

from app.config import settings, ensure_directories
from app.database import init_db


logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG" if settings.debug else "INFO",
)
logger.add("logs/app.log", rotation="10 MB", retention="7 days", level="DEBUG")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("XHS RAG starting...")
    ensure_directories()
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("XHS RAG shutting down")


app = FastAPI(
    title="XHS RAG - Xiaohongshu Knowledge Base",
    description="Turn your Xiaohongshu favorites into a searchable, AI-powered knowledge base.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import auth, notes, knowledge, chat, category

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(knowledge.router)
app.include_router(chat.router)
app.include_router(category.router)


@app.get("/")
async def root():
    return {"message": "XHS RAG", "version": "0.1.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
    )
