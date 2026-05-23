"""
工具执行器
基于注册中心动态加载和执行工具，供 Agent 图调用
"""
from typing import Dict, Any, Optional

from .registry import ToolRegistry


class ToolExecutor:
    """工具执行器，根据工具名动态加载并执行"""

    def __init__(self, domain: str):
        self.domain = domain

    def get_available_tools_description(self) -> str:
        """生成 LLM 可读的工具列表描述"""
        return ToolRegistry.get_tools_description(self.domain)

    def get_available_tool_names(self) -> list:
        """返回当前领域可用的工具名称列表"""
        tools = ToolRegistry.list_by_domain(self.domain)
        return [t["name"] for t in tools]

    def execute(self, tool_name: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        执行指定工具

        Args:
            tool_name: 工具唯一名称
            params: 传给工具的参数字典

        Returns:
            {"success": bool, "data": str, "tool": str, "error": str | None}
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