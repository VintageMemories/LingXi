"""
数据源适配器模块
"""
from .base import DataSourceAdapter
from .config import DataSourceConfig, DataSourceType
from .entry import RawKnowledgeEntry, compute_fingerprint
from .registry import DataSourceRegistry, get_registry
from .pipeline.importer import ImportPipeline
from .adapters.web.a_hospital import AHospitalAdapter
from .adapters.dataset.huatuo import HuatuoAdapter
from .spider import AHospitalSpider

__all__ = [
    "DataSourceAdapter",
    "DataSourceConfig",
    "DataSourceType",
    "RawKnowledgeEntry",
    "DataSourceRegistry",
    "get_registry",
    "ImportPipeline",
    "AHospitalAdapter",
    "HuatuoAdapter",
    "AHospitalSpider",
    "compute_fingerprint",
]