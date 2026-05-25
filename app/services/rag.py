"""XHS RAG - Vector store and Q&A"""
from typing import List, Optional
from loguru import logger
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from app.config import settings


class RAGService:
    def __init__(self, collection_name: str = "xhs_notes"):
        self.collection_name = collection_name

        try:
            from langchain_community.embeddings import DashScopeEmbeddings
            self.embeddings = DashScopeEmbeddings(
                dashscope_api_key=settings.dashscope_api_key,
                model=settings.embedding_model,
            )
        except ImportError:
            self.embeddings = OpenAIEmbeddings(
                api_key=settings.dashscope_api_key,
                base_url=settings.openai_base_url,
                model=settings.embedding_model,
                check_embedding_ctx_length=False,
            )

        self.vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=self.embeddings,
            persist_directory=settings.chroma_persist_directory,
        )

        self.llm = ChatOpenAI(
            api_key=settings.dashscope_api_key,
            base_url=settings.openai_base_url,
            model=settings.llm_model,
            temperature=0.5,
        )

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " "],
        )

        self.qa_prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个学习助手，基于用户收藏的小红书笔记内容来回答问题。

请遵循以下规则：
1. 根据提供的笔记内容来回答问题
2. 回答要自然、有条理，帮助用户理解技术内容
3. 可以引用相关的笔记标题作为来源
4. 如果多个笔记涉及相同话题，请综合它们的内容
5. 如果用户问的是技术问题，尽量给出具体的操作步骤

笔记内容：
{context}"""),
            ("human", "{question}")
        ])

        self.fallback_prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个友好的学习助手。用户在使用一个小红书收藏知识库系统。
当前知识库中没有找到与用户问题相关的内容。
请友好回应，建议用户构建更多收藏内容或换个问法。"""),
            ("human", "{question}")
        ])

    def _build_note_content(self, note_data: dict) -> str:
        """Build full text content from note data for embedding."""
        parts = []
        title = note_data.get("title", "")
        if title:
            parts.append(f"# {title}")
        content = note_data.get("content", "")
        if content and content.strip():
            parts.append(content.strip())
        tags = note_data.get("tags", [])
        if tags:
            parts.append(f"标签：{', '.join(tags)}")
        full = "\n\n".join(parts)
        if len(full.strip()) < 10:
            return ""
        return full

    def add_note_content(self, note_data: dict) -> int:
        """Add a single note to vector store. Returns chunk count."""
        note_id = note_data.get("note_id", "")
        title = note_data.get("title", "")
        full_content = self._build_note_content(note_data)
        if not full_content:
            logger.warning(f"[{note_id}] Content too short, skipping")
            return 0
        chunks = self.text_splitter.split_text(full_content)
        valid_chunks = [c for c in chunks if c and len(c.strip()) > 5]
        if not valid_chunks:
            return 0
        documents = []
        for i, chunk in enumerate(valid_chunks):
            doc = Document(
                page_content=chunk.strip(),
                metadata={
                    "note_id": note_id,
                    "title": title,
                    "chunk_index": i,
                    "category": note_data.get("category", ""),
                },
            )
            documents.append(doc)
        try:
            batch_size = 10
            for idx in range(0, len(documents), batch_size):
                self.vectorstore.add_documents(documents[idx:idx + batch_size])
            logger.info(f"[{note_id}] Added {len(documents)} chunks")
        except Exception as e:
            logger.error(f"[{note_id}] Add to vectorstore failed: {e}")
            raise
        return len(documents)

    def search(self, query: str, k: int = 5, note_ids: Optional[List[str]] = None) -> List[Document]:
        if not query or not query.strip():
            return []
        try:
            if note_ids:
                docs = self.vectorstore.similarity_search(query, k=k, filter={"note_id": {"$in": note_ids}})
            else:
                docs = self.vectorstore.similarity_search(query, k=k)
            return docs
        except Exception as e:
            logger.warning(f"Search failed: {e}")
            return []

    async def answer_question(self, question: str, k: int = 5, note_ids: Optional[List[str]] = None) -> dict:
        stats = self.get_collection_stats()
        if stats["total_chunks"] == 0:
            return await self._fallback_answer(question, "知识库暂无内容")
        docs = self.search(question, k=k, note_ids=note_ids)
        if not docs:
            return await self._fallback_answer(question, "未找到相关内容")
        context_parts = []
        seen_notes = set()
        sources = []
        for doc in docs:
            note_id = doc.metadata.get("note_id", "")
            title = doc.metadata.get("title", "")
            if doc.page_content.strip():
                context_parts.append(f"【{title}】\n{doc.page_content.strip()}")
            if note_id and note_id not in seen_notes:
                seen_notes.add(note_id)
                sources.append({"note_id": note_id, "title": title})
        if not context_parts:
            return {"answer": "检索到内容但无有效文本", "sources": sources}
        context = "\n\n---\n\n".join(context_parts)
        try:
            chain = (
                {"context": lambda _: context, "question": RunnablePassthrough()}
                | self.qa_prompt
                | self.llm
                | StrOutputParser()
            )
            answer = await chain.ainvoke(question)
            return {"answer": answer, "sources": sources}
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return {"answer": f"AI 回答失败: {e}", "sources": sources}

    async def _fallback_answer(self, question: str, reason: str) -> dict:
        try:
            chain = (
                {"question": RunnablePassthrough()}
                | self.fallback_prompt
                | self.llm
                | StrOutputParser()
            )
            answer = await chain.ainvoke(question)
            return {"answer": answer, "sources": []}
        except Exception as e:
            return {"answer": f"{reason}，请稍后再试。", "sources": []}

    def get_collection_stats(self) -> dict:
        try:
            collection = self.vectorstore._collection
            count = collection.count()
            result = collection.get(include=["metadatas"])
            note_ids = set()
            for meta in result.get("metadatas", []):
                if meta and "note_id" in meta:
                    note_ids.add(meta["note_id"])
            return {"total_chunks": count, "total_notes": len(note_ids), "collection_name": self.collection_name}
        except Exception as e:
            return {"total_chunks": 0, "total_notes": 0, "collection_name": self.collection_name}

    def delete_note(self, note_id: str):
        try:
            self.vectorstore._collection.delete(where={"note_id": note_id})
            logger.info(f"Deleted note from vectorstore: {note_id}")
        except Exception as e:
            logger.error(f"Delete note failed [{note_id}]: {e}")
            raise

    def clear_collection(self):
        try:
            self.vectorstore._collection.delete(where={})
            logger.info(f"Cleared vectorstore: {self.collection_name}")
        except Exception as e:
            logger.error(f"Clear failed: {e}")
