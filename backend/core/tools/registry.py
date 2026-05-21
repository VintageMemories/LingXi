"""
工具注册中心
自动扫描 builtin/ 和各领域目录，注册所有 BaseTool 子类
"""
import importlib
import pkgutil
import os
from typing import Dict, Type, Optional, List

from .base import BaseTool


class ToolRegistry:
    _tools: Dict[str, Type[BaseTool]] = {}
    _initialized = False

    @classmethod
    def _ensure_initialized(cls):
        if not cls._initialized:
            cls._discover_tools()
            cls._initialized = True

    @classmethod
    def _discover_tools(cls):
        """自动扫描 tools/ 下所有子目录，注册 BaseTool 子类"""
        tools_dir = os.path.dirname(os.path.abspath(__file__))

        for root, dirs, files in os.walk(tools_dir):
            # 跳过 __pycache__ 等隐藏目录
            dirs[:] = [d for d in dirs if not d.startswith('__') and d != 'services']

            for file in files:
                if not file.endswith('.py') or file.startswith('__'):
                    continue

                module_path = os.path.join(root, file)
                rel_path = os.path.relpath(module_path, tools_dir)
                module_name = rel_path.replace(os.sep, '.')[:-3]

                # 跳过 base 和 registry 自身
                if module_name in ('base', 'registry'):
                    continue

                try:
                    spec = importlib.util.spec_from_file_location(
                        f"tools.{module_name}", module_path
                    )
                    if spec and spec.loader:
                        module = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(module)

                        for attr_name in dir(module):
                            attr = getattr(module, attr_name)
                            if (
                                    isinstance(attr, type)
                                    and issubclass(attr, BaseTool)
                                    and attr is not BaseTool
                            ):
                                instance = attr()
                                cls._tools[instance.name] = attr
                                print(f"[工具注册] ✓ {instance.name} ({instance.domain})")
                except Exception as e:
                    print(f"[工具注册] 加载失败 {module_name}: {e}")

    @classmethod
    def get(cls, name: str) -> Optional[Type[BaseTool]]:
        """根据名称获取工具类"""
        cls._ensure_initialized()
        return cls._tools.get(name)

    @classmethod
    def create(cls, name: str) -> Optional[BaseTool]:
        """根据名称创建工具实例"""
        tool_class = cls.get(name)
        if not tool_class:
            return None
        return tool_class()

    @classmethod
    def list_all(cls) -> List[Dict]:
        """列出所有已注册工具的元信息"""
        cls._ensure_initialized()
        result = []
        for name, tool_class in cls._tools.items():
            instance = tool_class()
            result.append({
                "name": instance.name,
                "description": instance.description,
                "domain": instance.domain,
            })
        return result

    @classmethod
    def list_by_domain(cls, domain: str) -> List[Dict]:
        """列出指定领域的所有工具"""
        return [t for t in cls.list_all() if t["domain"] == domain or t["domain"] == "builtin"]

    @classmethod
    def get_tools_description(cls, domain: str) -> str:
        """生成 LLM 可读的工具描述列表"""
        tools = cls.list_by_domain(domain)
        if not tools:
            return "（无可用工具）"

        lines = []
        for t in tools:
            lines.append(f"- {t['name']}: {t['description']}")
        return "\n".join(lines)