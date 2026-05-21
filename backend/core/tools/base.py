"""
工具基类
每个具体工具继承此类，实现 execute 方法
"""
from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseTool(ABC):
    """所有 Agent 可调用工具的抽象基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        """工具唯一标识，LLM 通过此名称调用"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """工具的自然语言描述，LLM 据此判断何时使用此工具"""
        pass

    @property
    @abstractmethod
    def domain(self) -> str:
        """所属领域：builtin / medical / legal / finance"""
        pass

    @abstractmethod
    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行工具，返回结构化结果

        Returns:
            {
                "success": bool,
                "data": str,       # 人类可读的结果文本
                "error": str | None  # 失败时的错误信息
            }
        """
        pass