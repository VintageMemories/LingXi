"""
数据源适配器模块 (data_sources)
"""
from .base import DataSourceType, RawKnowledgeEntry, DataSourceConfig, DataSourceAdapter
from .a_hospital_adapter import AHospitalAdapter
from .huatuo_adapter import HuatuoAdapter
from .spider import AHospitalSpider
from .registry import DataSourceRegistry, get_registry
from .import_pipeline import ImportPipeline, compute_fingerprint

__all__ = [
    "DataSourceAdapter",
    "DataSourceRegistry",
    "ImportPipeline",
    "DataSourceType",
    "DataSourceConfig",
    "RawKnowledgeEntry",
    "AHospitalAdapter",
    "HuatuoAdapter",
    "AHospitalSpider",
    "compute_fingerprint",
    "get_registry",
]