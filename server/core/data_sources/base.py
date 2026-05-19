"""
数据源适配器基类
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class DataSourceType(str, Enum):
    WEB_SCRAPER = "web_scraper"
    DATASET = "dataset"
    API = "api"
    FILE_IMPORT = "file_import"
    DATABASE = "database"


@dataclass
class RawKnowledgeEntry:
    title: str
    content: str
    domain: str = "medical"
    category: str = ""
    summary: str = ""
    etiology: str = ""
    symptoms: str = ""
    diagnosis: str = ""
    treatment: str = ""
    prevention: str = ""
    legal_basis: str = ""
    applicable_scope: str = ""
    risk_level: str = ""
    investment_type: str = ""
    source: str = ""
    source_url: str = ""
    source_id: str = ""
    tags: List[str] = field(default_factory=list)
    language: str = "zh"
    extra: Dict = field(default_factory=dict)

    def get_fingerprint_content(self) -> str:
        parts = [self.title, self.content, self.summary, self.etiology,
                 self.symptoms, self.diagnosis, self.treatment, self.prevention,
                 self.legal_basis, self.applicable_scope, self.risk_level,
                 self.investment_type]
        return "|".join(p for p in parts if p)

    def to_knowledge_text(self) -> str:
        parts = []
        # 根据 domain 自适应前缀
        if self.domain == "legal":
            prefix = "【法规】"
        elif self.domain == "finance":
            prefix = "【金融】"
        else:
            prefix = "【疾病】"
        if self.title:
            parts.append(f"{prefix}{self.title}")
        if self.summary:
            parts.append(f"【概述】{self.summary}")
        if self.etiology:
            parts.append(f"【病因】{self.etiology}")
        if self.symptoms:
            parts.append(f"【症状】{self.symptoms}")
        if self.diagnosis:
            parts.append(f"【诊断】{self.diagnosis}")
        if self.treatment:
            parts.append(f"【治疗】{self.treatment}")
        if self.prevention:
            parts.append(f"【预防】{self.prevention}")
        if self.legal_basis:
            parts.append(f"【法律依据】{self.legal_basis}")
        if self.applicable_scope:
            parts.append(f"【适用范围】{self.applicable_scope}")
        if self.risk_level:
            parts.append(f"【风险等级】{self.risk_level}")
        if self.investment_type:
            parts.append(f"【投资类型】{self.investment_type}")
        if self.content and not any([self.summary, self.etiology, self.symptoms, self.legal_basis, self.applicable_scope, self.risk_level, self.investment_type]):
            parts.append(f"【内容】{self.content}")
        return "\n".join(parts)


@dataclass
class DataSourceConfig:
    name: str
    source_type: DataSourceType
    domain: str = "medical"
    batch_size: int = 100
    max_entries: Optional[int] = None
    options: Dict = field(default_factory=dict)


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