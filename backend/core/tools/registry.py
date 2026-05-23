"""
工具注册中心
自动扫描 builtin/ 和各领域目录，注册所有 BaseTool 子类
"""
import importlib
import os
from typing import Dict, Type, Optional, List, Any
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
    def _detect_and_read(cls, file_path: str) -> str:
        """根据文件头部 BOM 或常见编码探测，返回解码后的源码字符串（已去除 BOM 字符）"""
        with open(file_path, 'rb') as f:
            raw = f.read()
        source = ""  # 初始化，避免未赋值警告
        # 检查 UTF-16 BOM
        if raw.startswith(b'\xff\xfe'):
            source = raw.decode('utf-16-le')
        elif raw.startswith(b'\xfe\xff'):
            source = raw.decode('utf-16-be')
        else:
            # 尝试常见编码
            for enc in ('utf-8-sig', 'utf-8', 'gbk', 'latin-1'):
                try:
                    source = raw.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                # 最终兜底
                source = raw.decode('utf-8', errors='replace')
        # 去除可能残留的 BOM 字符
        return source.lstrip('\ufeff')

    CORE_TOOLS = 'core.tools'  # 类常量

    @classmethod
    def _discover_tools(cls):
        """自动扫描 tools/ 下所有子目录，注册 BaseTool 子类"""
        import sys

        tools_dir = os.path.dirname(os.path.abspath(__file__))
        # 向上找到 core 目录（backend/core），用于构建真实的包路径
        core_dir = os.path.dirname(os.path.dirname(tools_dir))  # backend/core

        # 确保 core 和 core.tools 在 sys.modules 中存在
        if 'core' not in sys.modules:
            mod = type(sys)('core')
            mod.__path__ = [core_dir]
            sys.modules['core'] = mod
        if cls.CORE_TOOLS not in sys.modules:
            mod = type(sys)(cls.CORE_TOOLS)
            mod.__path__ = [tools_dir]
            sys.modules[cls.CORE_TOOLS] = mod

        for root, dirs, files in os.walk(tools_dir):
            # 跳过 __pycache__ 等隐藏目录
            dirs[:] = [d for d in dirs if not d.startswith('__') and d != 'services']

            for file in files:
                if not file.endswith('.py') or file.startswith('__'):
                    continue

                module_path = os.path.join(root, file)
                rel_path = os.path.relpath(module_path, tools_dir)
                # 构建相对于 tools/ 的模块路径，例如 builtin.knowledge_search
                local_name = rel_path.replace(os.sep, '.')[:-3]  # 去除 .py

                # 跳过非工具模块
                if local_name in ('base', 'registry', 'executor'):
                    continue

                # 完整模块名：core.tools.builtin.knowledge_search
                full_module_name = f"{cls.CORE_TOOLS}.{local_name}" if local_name else cls.CORE_TOOLS

                try:
                    # 为子包创建占位模块（如 core.tools.builtin）
                    if local_name:
                        parts = local_name.split('.')
                        for i in range(1, len(parts) + 1):
                            sub_pkg = cls.CORE_TOOLS + '.' + '.'.join(parts[:i])
                            if sub_pkg not in sys.modules:
                                pkg_mod = type(sys)(sub_pkg)
                                pkg_mod.__path__ = [os.path.join(tools_dir, *parts[:i])]
                                sys.modules[sub_pkg] = pkg_mod

                    # 读取并编译源码
                    source = cls._detect_and_read(module_path)
                    code_obj = compile(source, module_path, 'exec')

                    spec = importlib.util.spec_from_file_location(full_module_name, module_path)  # type: ignore[arg-type]
                    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
                    module.__name__ = full_module_name
                    module.__package__ = full_module_name.rsplit('.', 1)[0] if '.' in full_module_name else ''
                    sys.modules[full_module_name] = module  # 注册模块，使其可被导入

                    exec(code_obj, module.__dict__)

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
                    print(f"[工具注册] 加载失败 {local_name}: {e}")

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
            desc = t['description'].split('\n')[0]
            lines.append(f"- {t['name']}: {desc}")
        return "\n".join(lines)

    @classmethod
    def get_tools_schema(cls, domain: str) -> List[Dict[str, Any]]:
        """
        为指定领域生成 LLM 可用的工具 schema 列表，
        格式兼容 OpenAI function calling / LangChain tools 参数。
        """
        cls._ensure_initialized()
        schemas = []
        for name, tool_class in cls._tools.items():
            instance = tool_class()
            if instance.domain != domain and instance.domain != "builtin":
                continue
            schema = {
                "type": "function",
                "function": {
                    "name": instance.name,
                    "description": instance.description,
                    "parameters": instance.parameters_schema
                }
            }
            schemas.append(schema)
        return schemas

    @classmethod
    def get_langchain_tools(cls, domain: str) -> list:
        """返回 LangChain 兼容的工具对象列表"""
        from langchain_core.tools import tool

        cls._ensure_initialized()
        tools = []
        for name, tool_class in cls._tools.items():
            instance = tool_class()
            if instance.domain != domain and instance.domain != "builtin":
                continue

            @tool(name, description=instance.description)
            def _tool(query: str = "", **kwargs: Any) -> str:
                params = {"query": query, **kwargs}
                result = instance.execute(params)
                return result["data"]

            tools.append(_tool)
        return tools