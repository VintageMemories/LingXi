"""
Configuration module for Lingxi backend.
Loads settings from environment variables with defaults.
"""
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # Auth
    secret_key: str = "lingxi-secret-key"

    # Database
    database_url: str = "data/lingxi.db"

    # LLM defaults
    default_model: str = "deepseek-chat"
    default_api_key: str = ""
    default_api_base_url: str = "https://api.deepseek.com"
    default_api_provider: str = "deepseek"

    # Domain
    default_domain: str = "medical"

    # Retrieval
    bm25_weight: float = 0.6
    vector_weight: float = 0.4
    top_k: int = 5
    rrf_k: int = 60

    # CORS
    cors_origins: list = field(default_factory=lambda: ["*"])

    @classmethod
    def from_env(cls) -> "Settings":
        """Load settings from environment variables."""
        return cls(
            host=os.getenv("LINGXI_HOST", "0.0.0.0"),
            port=int(os.getenv("LINGXI_PORT", "8000")),
            debug=os.getenv("LINGXI_DEBUG", "true").lower() == "true",
            secret_key=os.getenv("LINGXI_SECRET_KEY", "lingxi-secret-key"),
            database_url=os.getenv("LINGXI_DATABASE_URL", "data/lingxi.db"),
            default_model=os.getenv("LINGXI_DEFAULT_MODEL", "deepseek-chat"),
            default_api_key=os.getenv("LINGXI_API_KEY", ""),
            default_api_base_url=os.getenv("LINGXI_API_BASE_URL", "https://api.deepseek.com"),
            default_api_provider=os.getenv("LINGXI_API_PROVIDER", "deepseek"),
            default_domain=os.getenv("LINGXI_DEFAULT_DOMAIN", "medical"),
            bm25_weight=float(os.getenv("LINGXI_BM25_WEIGHT", "0.6")),
            vector_weight=float(os.getenv("LINGXI_VECTOR_WEIGHT", "0.4")),
            top_k=int(os.getenv("LINGXI_TOP_K", "5")),
            rrf_k=int(os.getenv("LINGXI_RRF_K", "60")),
        )


# Global settings instance
settings = Settings.from_env()