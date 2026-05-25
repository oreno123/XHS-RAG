"""XHS RAG - Configuration"""
from pydantic_settings import BaseSettings
from pydantic import Field, AliasChoices
import os


class Settings(BaseSettings):
    # DashScope / LLM
    dashscope_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("DASHSCOPE_API_KEY", "OPENAI_API_KEY"),
    )
    openai_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        env="OPENAI_BASE_URL",
    )
    llm_model: str = Field(default="qwen-plus", env="LLM_MODEL")
    embedding_model: str = Field(default="text-embedding-v3", env="EMBEDDING_MODEL")

    # App
    app_host: str = Field(default="0.0.0.0", env="APP_HOST")
    app_port: int = Field(default=8000, env="APP_PORT")
    debug: bool = Field(default=True, env="DEBUG")

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./data/xhs_rag.db",
        env="DATABASE_URL",
    )

    # ChromaDB
    chroma_persist_directory: str = Field(
        default="./data/chroma_db",
        env="CHROMA_PERSIST_DIRECTORY",
    )

    # Rate limiting
    xhs_request_interval: float = Field(default=3.0, env="XHS_REQUEST_INTERVAL")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()


def ensure_directories():
    dirs = ["data", settings.chroma_persist_directory, "logs"]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
