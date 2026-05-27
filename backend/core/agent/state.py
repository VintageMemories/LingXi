"""
Agent 共享状态定义
每个节点读取和写入同一个字典，LangGraph 自动合并节点返回值
"""

from typing import TypedDict, List, Annotated
import operator
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    query: str
    domain: str
    session_id: str
    messages: Annotated[List[BaseMessage], add_messages]
    safety_blocked: bool
    safety_message: str
    safety_emergency: bool
    tool_name: str
    tool_args: dict
    tool_result: str
    rag_context: str
    sources: List[dict]
    user_plan: str
    final_answer: str
    loop_count: Annotated[int, operator.add]          # 累加归约，自动递增
    llm_config: dict
    tool_call_history: Annotated[List[str], operator.add]  # 累加归约，自动追加
    next_action: str
    reflection_result: str
    reflection_hint: str
    retry_count: Annotated[int, operator.add]         # 当前查询重试次数，自动累加