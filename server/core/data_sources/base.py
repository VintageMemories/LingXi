"""
数据源适配器基类
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Optional

from .config import DataSourceConfig
from .entry import RawKnowledgeEntry


class DataSourceAdapter(ABC):
    def __init__(self, config: DataSourceConfig):
        self.config = config

    @abstractmethod
    def validate_config(self) -> bool:
        pass

    @abstractmethod
    async def fetch_entries(self) -> AsyncGenerator[RawKnowledgeEntry, None]:
        if False:
            yield

    @abstractmethod
    def get_metadata(self) -> Dict:
        pass

    def estimate_total(self) -> Optional[int]:
        return None

    def supports_incremental(self) -> bool:
        return False

    async def fetch_updates(self, last_fingerprint: str = "") -> AsyncGenerator[RawKnowledgeEntry, None]:
        return
        yield