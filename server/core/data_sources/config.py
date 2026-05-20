"""
数据源配置模型
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional


class DataSourceType(str, Enum):
    WEB_SCRAPER = "web_scraper"
    DATASET = "dataset"
    API = "api"
    FILE_IMPORT = "file_import"


@dataclass
class DataSourceConfig:
    name: str
    source_type: DataSourceType
    domain: str = "medical"
    batch_size: int = 100
    max_entries: Optional[int] = None
    options: Dict = field(default_factory=dict)