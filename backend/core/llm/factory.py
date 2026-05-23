"""
LLM 工厂 - 使用 init_chat_model 创建兼容实例，确保异步稳定
"""
import os
import httpx
from langchain.chat_models import init_chat_model
from core.agent.state import AgentState


def _build_llm(config: dict):
    """内部函数：根据配置字典创建 LLM 实例，设置同步/异步客户端"""
    model = config.get("model") or os.getenv("LLM_MODEL", "deepseek-chat")
    api_key = config.get("api_key") or os.getenv("LLM_API_KEY", "")
    base_url = config.get("api_base") or os.getenv("LLM_API_BASE", "https://api.deepseek.com")
    base_url = base_url.rstrip("/")
    provider = config.get("provider", "deepseek")

    timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0)

    # DeepSeek 模型：优先使用 langchain_deepseek 原生库，正确处理推理模式
    if provider == "deepseek" or "deepseek" in base_url:
        try:
            from langchain_deepseek import ChatDeepSeek
            llm = ChatDeepSeek(
                model=model,
                api_key=api_key,
                api_base=base_url,
                temperature=0.7,
                timeout=60,
            )
            llm.http_client = httpx.Client(verify=False, timeout=timeout)
            llm.http_async_client = httpx.AsyncClient(verify=False, timeout=timeout)
            return llm
        except ImportError:
            pass  # 回退到 init_chat_model

    # 非 DeepSeek 模型，使用 init_chat_model
    llm = init_chat_model(
        model,
        model_provider="openai",
        base_url=base_url,
        api_key=api_key,
        temperature=0.7,
    )

    llm.http_client = httpx.Client(verify=False, timeout=timeout)
    llm.http_async_client = httpx.AsyncClient(verify=False, timeout=timeout)
    return llm


def create_llm(state: AgentState):
    """供 Agent 图节点使用，从 state 中提取 llm_config"""
    return _build_llm(state.get("llm_config", {}))


def create_llm_from_config(llm_config: dict):
    """供 Free/Pro 流程直接使用，传入配置字典"""
    return _build_llm(llm_config)