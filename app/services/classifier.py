"""XHS RAG - AI Classifier Service"""
import re
from typing import Optional
from loguru import logger
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from app.config import settings


class ClassifierService:
    def __init__(self):
        self.llm = ChatOpenAI(
            api_key=settings.dashscope_api_key,
            base_url=settings.openai_base_url,
            model=settings.llm_model,
            temperature=0,
        )

    async def classify(self, title: str, content_preview: str, tags: list[str], existing_categories: list[str]) -> str:
        """Classify a note into a category. Returns category name."""
        prompt = self._build_prompt(title, content_preview, tags, existing_categories)
        try:
            chain = self.llm | StrOutputParser()
            result = await chain.ainvoke(prompt)
            category_name = self._parse_category_name(result)
            logger.info(f"Classified '{title}' -> '{category_name}'")
            return category_name
        except Exception as e:
            logger.error(f"Classification failed: {e}")
            return "未分类"

    def _build_prompt(self, title: str, content_preview: str, tags: list[str], existing_categories: list[str]) -> str:
        cats_str = "、".join(existing_categories) if existing_categories else "暂无分类"
        tags_str = "、".join(tags) if tags else "无"
        return f"""你是一个内容分类助手。根据以下小红书笔记内容，给出一个分类名称。
分类应该简洁（2-4个字），例如：Python、前端、设计、美食、旅行、健身、职场、摄影。
优先归入已有分类。如果现有分类都不合适，就创建新分类。只返回分类名称，不要解释。

现有分类列表：{cats_str}

笔记标题：{title}
笔记内容：{content_preview}
笔记标签：{tags_str}"""

    def _parse_category_name(self, raw: str) -> str:
        """Extract clean category name from LLM response."""
        text = raw.strip()
        for pattern in [r'【(.+?)】', r'「(.+?)」', r'\[(.+?)\]', r'分类[：:]\s*(.+)']:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        cleaned = text.strip().strip('"\'""''')
        if len(cleaned) <= 10:
            return cleaned
        return cleaned[:4]
