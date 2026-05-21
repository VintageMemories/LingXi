"""
工具执行器
供 Agent 图调用，通过注册中心动态加载和执行工具
"""
from typing import Dict, Any, Optional

from .registry import ToolRegistry


class ToolExecutor:
    """工具执行器，负责根据工具名动态加载并执行"""

    def __init__(self, domain: str):
        self.domain = domain

    def execute(self, tool_name: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        执行指定工具

        Args:
            tool_name: 工具唯一名称
            params: 传给工具的参数字典

        Returns:
            {
                "success": bool,
                "data": str,
                "tool": str,
                "error": str | None
            }
        """
        params = params or {}

        tool = ToolRegistry.create(tool_name)
        if not tool:
            return {
                "success": False,
                "data": f"工具 '{tool_name}' 未找到",
                "tool": tool_name,
                "error": "tool_not_found",
            }

        try:
            result = tool.execute(params)
            return {
                "success": True,
                "data": result.get("data", ""),
                "tool": tool_name,
                "error": None,
            }
        except Exception as e:
            return {
                "success": False,
                "data": f"工具执行失败: {str(e)}",
                "tool": tool_name,
                "error": str(e),
            }