from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LIFEOS Planner API"
    app_env: str = "dev"
    database_url: str = "sqlite:///./lifeos.db"
    chroma_path: str = "./chroma"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    llm_provider: str = "huggingface"
    huggingface_api_token: str = ""
    huggingface_model: str = "meta-llama/Llama-3.1-8B-Instruct"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    retrieval_k: int = 6

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @cached_property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
