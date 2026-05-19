"""
LLM 工厂
根据用户请求中的配置动态创建 LLM 实例，每个用户可能用不同的 API Key 和模型
"""

import os
import httpx
from langchain_openai import ChatOpenAI
from core.agent.state import AgentState


def create_llm(state: AgentState) -> ChatOpenAI:
    config = state.get("llm_config", {})
    model = config.get("model") or os.getenv("LLM_MODEL", "deepseek-chat")
    api_key = config.get("api_key") or os.getenv("LLM_API_KEY", "")
    base_url = config.get("api_base") or os.getenv("LLM_API_BASE", "")

    kwargs = {
        "model": model,
        "temperature": 0.7,
        "request_timeout": httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
        "http_client": httpx.Client(verify=False),
    }
    if api_key:
        kwargs["api_key"] = api_key
    if base_url:
        kwargs["base_url"] = base_url

    return ChatOpenAI(**kwargs)