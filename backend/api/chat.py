"""
聊天 SSE 端点
根据用户订阅方案走不同流程：
  Free  → 安全过滤 → LLM 通用对话（不检索知识库）
  Pro   → 安全过滤 → 知识库检索 → LLM 生成
  Agent → 安全过滤 → LangGraph 自主决策图
"""

import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from core.safety.guard import SafetyGuard
from core.domain.manager import domain_manager
from core.retrieval.hybrid import HybridRetriever
from core.agent.graph import create_agent_graph, AgentState
from core.memory.session import create_session, update_session_title

router = APIRouter()
_safety_guard = SafetyGuard()


@router.post("/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message", "")
    session_id = body.get("session_id")
    domain = body.get("domain", "medical")

    user_plan = request.headers.get("X-User-Plan", "free")

    llm_config = {
        "model": request.headers.get("X-Model", "deepseek-chat"),
        "api_key": request.headers.get("X-API-Key", ""),
        "api_base": request.headers.get("X-API-Base-URL", ""),
        "provider": request.headers.get("X-API-Provider", "deepseek"),
    }

    is_new_session = not session_id
    if not session_id:
        session_id = await create_session(domain)

    config = domain_manager.get_domain_config(domain)
    if not config:
        async def err_gen():
            yield _sse("error", {"message": "领域配置不存在"})
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    # 第一步：安全过滤
    safety_result = _safety_guard.check(message, config)

    if safety_result["blocked"]:
        async def blocked_gen():
            for chunk in _stream_text(safety_result["message"]):
                yield chunk
            yield _done("blocked", session_id)
        return StreamingResponse(blocked_gen(), media_type="text/event-stream")

    if safety_result["emergency"]:
        emergency_msg = (config.get("prompts", {}) or {}).get(
            "emergency", "检测到紧急情况，请立即就医"
        )
        async def emergency_gen():
            for chunk in _stream_text(emergency_msg):
                yield chunk
            yield _done("emergency", session_id, emergency=True)
        return StreamingResponse(emergency_gen(), media_type="text/event-stream")

    # 第二步：根据订阅方案分流
    if user_plan == "agent":
        return await _handle_agent(message, domain, session_id, llm_config, is_new_session)
    elif user_plan == "pro":
        return await _handle_pro(message, domain, session_id, llm_config, config, is_new_session)
    else:
        return await _handle_free(message, domain, session_id, llm_config, config, is_new_session)


# ═══════════════════════════════════════════
# Free 流程：LLM 通用对话，不检索知识库
# ═══════════════════════════════════════════

async def _handle_free(message: str, domain: str, session_id: str,
                       llm_config: dict, config: dict, is_new_session: bool):
    """免费版：LLM 通用对话，不检索知识库"""
    async def event_generator():
        if not llm_config.get("api_key"):
            for chunk in _stream_text("⚠️ 您还没有配置 API Key。请前往设置 → 模型页面，选择大模型提供商并填写 API Key。"):
                yield chunk
            yield _done("no_api_key", session_id)
            return

        domain_name = config.get("domain", {}).get("display_name", "AI助手")
        system_prompt = (config.get("prompts", {}) or {}).get(
            "system", f"你是{domain_name}，请友好地回答用户问题。注意：你只能基于通用知识回答，不能提供专业建议。"
        )

        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatOpenAI(
            model=llm_config["model"] or "deepseek-chat",
            api_key=llm_config["api_key"],
            base_url=llm_config["api_base"] or None,
            temperature=0.7,
        )

        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=message),
        ])
        full_answer = response.content

        for chunk in _stream_text(full_answer):
            yield chunk

        if is_new_session:
            title = message.strip()[:20] + ("..." if len(message.strip()) > 20 else "")
            await update_session_title(session_id, title)

        yield _sse("done", {
            "intent": "free_chat",
            "confidence": 0.9,
            "sources": [],
            "session_id": session_id,
            "from_llm": True,
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


# ═══════════════════════════════════════════
# Pro 流程：知识库检索 → LLM 生成
# ═══════════════════════════════════════════

async def _handle_pro(message: str, domain: str, session_id: str,
                      llm_config: dict, config: dict, is_new_session: bool):
    """Pro 版：知识库检索 → LLM 生成回答（不走 Agent 决策）"""
    async def event_generator():
        if not llm_config.get("api_key"):
            for chunk in _stream_text("⚠️ 您还没有配置 API Key。请前往设置 → 模型页面，选择大模型提供商并填写 API Key。"):
                yield chunk
            yield _done("no_api_key", session_id)
            return

        yield _sse("retrieval_start", {"message": "正在检索知识库..."})

        retriever = HybridRetriever()
        results = retriever.search(message)

        if results:
            rag_context = "\n\n".join(
                f"[{i+1}] {r['title']}\n{r.get('content', '')}"
                for i, r in enumerate(results)
            )
            sources = [{"title": r["title"], "source": r.get("source", "unknown")} for r in results]
        else:
            rag_context = ""
            sources = []

        domain_name = config.get("domain", {}).get("display_name", "AI助手")
        system_prompt = (config.get("prompts", {}) or {}).get(
            "system", f"你是{domain_name}，请基于知识库回答用户问题"
        )

        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatOpenAI(
            model=llm_config["model"] or "deepseek-chat",
            api_key=llm_config["api_key"],
            base_url=llm_config["api_base"] or None,
            temperature=0.7,
        )

        user_prompt = message
        if rag_context:
            user_prompt = f"【知识库参考资料】\n{rag_context}\n\n【用户问题】\n{message}"

        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        full_answer = response.content

        for chunk in _stream_text(full_answer):
            yield chunk

        if is_new_session:
            title = message.strip()[:20] + ("..." if len(message.strip()) > 20 else "")
            await update_session_title(session_id, title)

        yield _sse("done", {
            "intent": "pro_rag",
            "confidence": 0.9,
            "sources": sources,
            "session_id": session_id,
            "from_llm": True,
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


# ═══════════════════════════════════════════
# Agent 流程：LangGraph 自主决策图
# ═══════════════════════════════════════════

async def _handle_agent(message: str, domain: str, session_id: str,
                        llm_config: dict, is_new_session: bool):
    """Agent 版：LLM 自主决定调用工具、检索知识库、循环直到能回答"""
    initial_state: AgentState = {
        "query": message,
        "domain": domain,
        "session_id": session_id,
        "messages": [],
        "safety_blocked": False,
        "safety_message": "",
        "safety_emergency": False,
        "tool_name": "",
        "tool_result": "",
        "rag_context": "",
        "sources": [],
        "user_plan": "agent",
        "final_answer": "",
        "loop_count": 0,
        "llm_config": llm_config,
    }

    async def event_generator():
        if not llm_config.get("api_key"):
            for chunk in _stream_text("⚠️ 您还没有配置 API Key。请前往设置 → 模型页面，选择大模型提供商并填写 API Key。"):
                yield chunk
            yield _done("no_api_key", session_id)
            return

        graph = create_agent_graph()
        last_node = ""
        full_answer = ""
        final_sources = []

        try:
            async for event in graph.astream(initial_state):
                for node_name, node_data in event.items():
                    if node_name != last_node:
                        last_node = node_name

                        if node_name == "execute_tool":
                            tool_name = node_data.get("tool_name", "")
                            yield _sse("tool_start", {
                                "tools": [tool_name.replace("USE_TOOL:", "").strip()],
                                "message": "正在分析您的问题..."
                            })

                        elif node_name == "search_knowledge":
                            yield _sse("retrieval_start", {"message": "正在检索知识库..."})

                        elif node_name == "generate_answer":
                            answer = node_data.get("final_answer", "")
                            if answer:
                                full_answer = answer
                                final_sources = node_data.get("sources", [])
                                for chunk in _stream_text(answer):
                                    yield chunk

                        elif node_name == "safety_check":
                            if node_data.get("safety_blocked"):
                                msg = node_data.get("safety_message", "")
                                full_answer = msg
                                for chunk in _stream_text(msg):
                                    yield chunk

                        elif node_name == "emergency_response":
                            answer = node_data.get("final_answer", "")
                            full_answer = answer
                            for chunk in _stream_text(answer):
                                yield chunk

            if is_new_session and message:
                title = message.strip()[:20] + ("..." if len(message.strip()) > 20 else "")
                await update_session_title(session_id, title)

            yield _sse("done", {
                "intent": "agent",
                "confidence": 0.9,
                "sources": final_sources,
                "session_id": session_id,
                "from_llm": True,
            })

        except Exception as e:
            yield _sse("error", {"message": f"处理失败: {str(e)}"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


# ═══════════════════════════════════════════
# SSE 工具函数
# ═══════════════════════════════════════════

def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({**data, 'type': event_type}, ensure_ascii=False)}\n\n"


def _stream_text(text: str, chunk_size: int = 3):
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(_sse("content", {"text": text[i:i + chunk_size]}))
    return chunks


def _done(intent: str, session_id: str, **extra) -> str:
    payload = {"type": "done", "intent": intent, "session_id": session_id, **extra}
    return _sse("done", payload)