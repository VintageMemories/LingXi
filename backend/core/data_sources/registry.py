"""
数据源注册中心 - 自动发现 adapters/ 目录下的所有适配器
"""
import importlib
import pkgutil
import os
from typing import Dict, Type, Optional, List

from .base import DataSourceAdapter
from .config import DataSourceConfig, DataSourceType


class DataSourceRegistry:
    _adapters: Dict[str, Type[DataSourceAdapter]] = {}
    _initialized = False

    @classmethod
    def _ensure_initialized(cls):
        if not cls._initialized:
            cls._discover_adapters()
            cls._initialized = True

    @classmethod
    def _discover_adapters(cls):
        """自动扫描 adapters 目录及其子目录，注册所有 DataSourceAdapter 子类"""
        try:
            from core.data_sources import adapters as pkg
            pkg_path = pkg.__path__
        except (ImportError, AttributeError):
            cls._fallback_register()
            return

        found = False

        # 递归遍历 adapters/ 下所有 Python 模块
        for root, dirs, files in os.walk(pkg_path[0]):
            # 跳过 __pycache__ 等目录
            dirs[:] = [d for d in dirs if not d.startswith('__')]

            for file in files:
                if not file.endswith('.py') or file.startswith('__'):
                    continue

                # 计算相对于 adapters 包的模块路径
                rel_path = os.path.relpath(os.path.join(root, file), pkg_path[0])
                module_path = rel_path.replace(os.sep, '.')[:-3]  # 去掉 .py
                full_module_name = pkg.__name__ + '.' + module_path

                try:
                    module = importlib.import_module(full_module_name)
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if (
                                isinstance(attr, type)
                                and issubclass(attr, DataSourceAdapter)
                                and attr is not DataSourceAdapter
                        ):
                            temp_config = DataSourceConfig(
                                name="__discovery__",
                                source_type=DataSourceType.WEB_SCRAPER,
                            )
                            try:
                                instance = attr(temp_config)
                                metadata = instance.get_metadata()
                                name = metadata.get("name", attr.__name__)
                                cls.register(name, attr)
                                found = True
                            except Exception:
                                cls.register(attr.__name__, attr)
                                found = True
                except Exception as e:
                    print(f"[注册中心] 加载模块 {full_module_name} 失败: {e}")

        if not found:
            cls._fallback_register()

    @classmethod
    def _fallback_register(cls):
        """降级方案：硬编码注册已知适配器"""
        try:
            from core.data_sources.adapters.web.a_hospital import AHospitalAdapter
            cls.register("a_hospital", AHospitalAdapter)
        except ImportError:
            pass
        try:
            from core.data_sources.adapters.dataset.huatuo import HuatuoAdapter
            cls.register("huatuo", HuatuoAdapter)
        except ImportError:
            pass

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
    def has_source(cls, name: str) -> bool:
        cls._ensure_initialized()
        return name in cls._adapters

    @classmethod
    def get_metadata(cls, name: str) -> Optional[Dict]:
        """获取指定数据源的元数据，不创建完整实例"""
        cls._ensure_initialized()
        adapter_class = cls._adapters.get(name)
        if not adapter_class:
            return None
        temp_config = DataSourceConfig(name=name, source_type=DataSourceType.WEB_SCRAPER)
        try:
            instance = adapter_class(temp_config)
            return instance.get_metadata()
        except Exception:
            return None


def get_registry() -> Type[DataSourceRegistry]:
    return DataSourceRegistry