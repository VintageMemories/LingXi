"""
Agent 共享状态定义
每个节点读取和写入同一个字典，LangGraph 自动合并节点返回值
"""

from typing import TypedDict, List, Annotated
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
    tool_result: str
    rag_context: str
    sources: List[dict]
    user_plan: str
    final_answer: str
    loop_count: int
    llm_config: dict