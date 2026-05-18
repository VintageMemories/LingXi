"""
数据源注册中心
"""
from typing import Dict, Type, Optional, List

from .base import DataSourceAdapter, DataSourceConfig, DataSourceType
from .a_hospital_adapter import AHospitalAdapter
from .huatuo_adapter import HuatuoAdapter


class DataSourceRegistry:
    _adapters: Dict[str, Type[DataSourceAdapter]] = {}
    _initialized = False

    @classmethod
    def _ensure_initialized(cls):
        if not cls._initialized:
            cls.register("a_hospital", AHospitalAdapter)
            cls.register("huatuo", HuatuoAdapter)
            cls._initialized = True

    @classmethod
    def register(cls, name: str, adapter_class: Type[DataSourceAdapter]):
        if not issubclass(adapter_class, DataSourceAdapter):
            raise TypeError(f"adapter_class must be a subclass of DataSourceAdapter")
        cls._adapters[name] = adapter_class

    @classmethod
    def get(cls, name: str) -> Optional[Type[DataSourceAdapter]]:
        cls._ensure_initialized()
        return cls._adapters.get(name)

    @classmethod
    def create(cls, name: str, config: DataSourceConfig) -> Optional[DataSourceAdapter]:
        adapter_class = cls.get(name)
        if not adapter_class:
            return None
        return adapter_class(config)

    @classmethod
    def list_sources(cls) -> List[Dict]:
        cls._ensure_initialized()
        result = []
        for name, adapter_class in cls._adapters.items():
            temp_config = DataSourceConfig(name=name, source_type=DataSourceType.WEB_SCRAPER)
            temp_instance = adapter_class(temp_config)
            result.append({"name": name, **temp_instance.get_metadata()})
        return result

    @classmethod
    def unregister(cls, name: str):
        cls._adapters.pop(name, None)

    @classmethod
    def has_source(cls, name: str) -> bool:
        cls._ensure_initialized()
        return name in cls._adapters


def get_registry() -> Type[DataSourceRegistry]:
    return DataSourceRegistry