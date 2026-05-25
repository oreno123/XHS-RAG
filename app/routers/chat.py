"""XHS RAG - Chat Router (streaming Q&A)"""
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from loguru import logger
from openai import OpenAI

from app.config import settings
from app.models import ChatRequest
from app.services.rag import RAGService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/ask")
async def ask(req: ChatRequest):
    """Non-streaming Q&A."""
    rag = RAGService()
    note_ids = [req.note_id] if req.note_id and req.mode == "single" else None
    result = await rag.answer_question(req.question, k=5, note_ids=note_ids)
    return result


@router.post("/ask/stream")
async def ask_stream(req: ChatRequest):
    """Streaming Q&A with source citations."""
    rag = RAGService()
    note_ids = [req.note_id] if req.note_id and req.mode == "single" else None

    docs = rag.search(req.question, k=5, note_ids=note_ids)

    if not docs:
        client = OpenAI(api_key=settings.dashscope_api_key, base_url=settings.openai_base_url)
        def generate_fallback():
            stream = client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": "你是一个友好的学习助手。知识库中没有找到相关内容，请友好回应并建议用户换个问法。"},
                    {"role": "user", "content": req.question},
                ],
                stream=True,
            )
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        return StreamingResponse(generate_fallback(), media_type="text/plain")

    context_parts = []
    sources = []
    seen_notes = set()
    for doc in docs:
        note_id = doc.metadata.get("note_id", "")
        title = doc.metadata.get("title", "")
        if doc.page_content.strip():
            context_parts.append(f"【{title}】\n{doc.page_content.strip()}")
        if note_id and note_id not in seen_notes:
            seen_notes.add(note_id)
            sources.append({"note_id": note_id, "title": title})

    context = "\n\n---\n\n".join(context_parts)
    client = OpenAI(api_key=settings.dashscope_api_key, base_url=settings.openai_base_url)

    def generate():
        stream = client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": f"""你是一个学习助手，基于用户收藏的小红书笔记内容来回答问题。
回答要自然、有条理。如果用户问技术问题，给出具体步骤。

笔记内容：
{context}"""},
                {"role": "user", "content": req.question},
            ],
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
        yield f"\n[[SOURCES_JSON]]{json.dumps(sources, ensure_ascii=False)}"

    return StreamingResponse(generate(), media_type="text/plain")


@router.post("/search")
async def search_notes(query: str, k: int = 5):
    """Search notes without LLM generation."""
    rag = RAGService()
    docs = rag.search(query, k=k)
    results = []
    seen = set()
    for doc in docs:
        note_id = doc.metadata.get("note_id", "")
        if note_id not in seen:
            seen.add(note_id)
            results.append({
                "note_id": note_id,
                "title": doc.metadata.get("title", ""),
                "content_preview": doc.page_content[:200],
            })
    return {"results": results}
