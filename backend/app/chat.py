"""
聊天 SSE 端点
根据用户订阅方案走不同流程：
  Free  → 安全过滤 → LLM 通用对话（不检索知识库）
  Pro   → 安全过滤 → 知识库检索 → LLM 生成
  Agent → 安全过滤 → LangGraph 自主决策图
"""

import json
import uuid
import sqlite3
import os
from dotenv import load_dotenv


def _get_db_path() -> str:
    """从 DATABASE_URL 或默认路径获取 SQLite 文件绝对路径"""
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        db_url = "file:./prisma/dev.db"
    # 提取 file: 后的路径
    if db_url.startswith("file:"):
        rel_path = db_url[5:]
        if rel_path.startswith("./"):
            rel_path = rel_path[2:]
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        db_path = os.path.abspath(os.path.join(base, rel_path))
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        return db_path
    db_path = os.path.abspath(db_url)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return db_path


_DB_PATH = None


def init_chat_module():
    """在 FastAPI startup 事件中调用，加载环境变量并初始化数据库路径"""
    global _DB_PATH
    _ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
    if os.path.exists(_ENV_PATH):
        load_dotenv(_ENV_PATH)
        print(f"[DB] 已加载环境变量文件: {_ENV_PATH}")
    _DB_PATH = _get_db_path()
    print(f"[DB] 数据库路径: {_DB_PATH}")


def _save_message(session_id: str, role: str, content: str, model: str = "", intent: str = "", sources: str = ""):
    if not session_id or not content:
        print(f"[DB] 跳过保存：session_id={session_id}, role={role}, content_len={len(content)}")
        return
    try:
        conn = sqlite3.connect(_DB_PATH)
        conn.execute("""
                     CREATE TABLE IF NOT EXISTS Message (
                                                            id TEXT PRIMARY KEY,
                                                            sessionId TEXT NOT NULL,
                                                            role TEXT NOT NULL,
                                                            content TEXT NOT NULL,
                                                            model TEXT,
                                                            intent TEXT,
                                                            sources TEXT,
                                                            feedbackRating INTEGER,
                                                            feedbackComment TEXT,
                                                            createdAt DATETIME NOT NULL DEFAULT (datetime('now'))
                         )
                     """)
        msg_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO Message (id, sessionId, role, content, model, intent, sources, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            (msg_id, session_id, role, content, model, intent, sources)
        )
        conn.commit()
        count = conn.execute("SELECT COUNT(*) FROM Message WHERE sessionId = ?", (session_id,)).fetchone()[0]
        conn.close()
        print(f"[DB] 当前会话消息总数: {count}")
        print(f"[DB] 消息已保存：session={session_id}, role={role}, len={len(content)}")
    except Exception as e:
        print(f"[DB] 保存消息失败: {e}")


def _get_conversation_context(session_id: str, max_recent: int = 4) -> str:
    if not session_id:
        return ""
    try:
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT role, content FROM Message WHERE sessionId = ? ORDER BY createdAt ASC",
            (session_id,)
        ).fetchall()
        conn.close()
        if not rows:
            return ""
        total_pairs = len(rows) // 2
        if total_pairs <= max_recent:
            context = "## 对话历史\n"
            for r in rows:
                role = "用户" if r["role"] == "user" else "AI"
                content = r["content"][:300]
                context += f"- {role}: {content}\n"
            return context
        early_rows = rows[:-max_recent * 2]
        recent_rows = rows[-max_recent * 2:]
        early_text = ""
        for r in early_rows:
            role = "用户" if r["role"] == "user" else "AI"
            early_text += f"{role}: {r['content'][:200]}\n"
        summary_prompt = f"请将以下对话历史压缩为一段200字以内的摘要，保留关键信息：\n\n{early_text}"
        try:
            from langchain_core.messages import HumanMessage
            from core.llm.factory import _build_llm
            llm = _build_llm({})
            summary_response = llm.invoke([HumanMessage(content=summary_prompt)])
            summary = summary_response.content.strip()
        except Exception:
            summary = "（早期对话摘要生成失败）"
        context = f"## 早期对话摘要\n{summary}\n\n## 最近对话\n"
        for r in recent_rows:
            role = "用户" if r["role"] == "user" else "AI"
            content = r["content"][:300]
            context += f"- {role}: {content}\n"
        return context
    except Exception:
        return ""


import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from core.safety.guard import SafetyGuard
from core.domain.manager import domain_manager
from core.agent.graph import create_agent_graph
from core.tools.builtin.knowledge_search import KnowledgeSearchTool
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

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
        "model": request.headers.get("X-Model", ""),
        "api_key": request.headers.get("X-API-Key", ""),
        "api_base": request.headers.get("X-API-Base-URL", ""),
        "provider": request.headers.get("X-API-Provider", "deepseek"),
    }
    if not session_id:
        async def no_session_gen():
            yield _sse("error", {"message": "会话未创建，请刷新页面后重试"})
            await flush()
        return StreamingResponse(no_session_gen(), media_type="text/event-stream")
    config = domain_manager.get_domain_config(domain)
    if not config:
        async def err_gen():
            yield _sse("error", {"message": "领域配置不存在"})
            await flush()
        return StreamingResponse(err_gen(), media_type="text/event-stream")
    # 安全过滤（仅使用当前消息）
    safety_result = _safety_guard.check(message, config)
    if safety_result["blocked"]:
        async def blocked_gen():
            for chunk in _stream_text(safety_result["message"]):
                yield chunk
                await flush()
            yield _done("blocked", session_id)
            await flush()
        return StreamingResponse(blocked_gen(), media_type="text/event-stream")
    if safety_result["emergency"]:
        async def emergency_gen():
            for chunk in _stream_text(safety_result["message"]):
                yield chunk
                await flush()
            yield _done("emergency", session_id, emergency=True)
            await flush()
        return StreamingResponse(emergency_gen(), media_type="text/event-stream")
    # 领域越界检测（非 Agent 流程）
    if user_plan != "agent":
        intent = safety_result.get("intent", "")
        intent_domain = None
        if intent.startswith("medical_"):
            intent_domain = "medical"
        elif intent.startswith("legal_"):
            intent_domain = "legal"
        elif intent.startswith("finance_"):
            intent_domain = "finance"
        if intent == "out_of_domain":
            async def out_of_domain_gen():
                msg = "⚠️ 您的问题超出了我目前的知识范围。\n\n我是医小助（医疗）、法小助（法律）、金小助（金融）领域的智能助手，请尝试咨询这些领域的问题。"
                for chunk in _stream_text(msg):
                    yield chunk
                    await flush()
                yield _done("out_of_domain", session_id, classified_intent=intent)
                await flush()
            return StreamingResponse(out_of_domain_gen(), media_type="text/event-stream")
        if intent_domain and intent_domain != domain:
            domain_names = {"medical": "医小助", "legal": "法小助", "finance": "金小助"}
            current_name = domain_names.get(domain, domain)
            suggested_name = domain_names.get(intent_domain, intent_domain)
            async def cross_domain_gen():
                msg = f"⚠️ 您的问题属于【{suggested_name}】领域，建议切换到 {suggested_name} 后再咨询。\n\n当前您在【{current_name}】下，可以点击左上角切换领域。"
                for chunk in _stream_text(msg):
                    yield chunk
                    await flush()
                yield _done("cross_domain", session_id, classified_intent=intent, suggested_domain=intent_domain)
                await flush()
            return StreamingResponse(cross_domain_gen(), media_type="text/event-stream")
    # 分流
    if user_plan == "agent":
        return await _handle_agent(request, message, domain, session_id, llm_config)
    elif user_plan == "pro":
        return await _handle_pro(request, message, domain, session_id, llm_config, config)
    else:
        return await _handle_free(request, message, domain, session_id, llm_config, config)


# ──────────────── Free 流程 ────────────────
async def _handle_free(request: Request, message: str, domain: str, session_id: str, llm_config: dict, config: dict, is_new_session: bool = False):
    async def event_generator():
        yield _sse("start", {"message": "开始处理..."})
        await flush()
        if not llm_config.get("api_key"):
            for chunk in _stream_text("⚠️ 您还没有配置 API Key。请前往设置 → 模型页面，选择大模型提供商并填写 API Key。"):
                yield chunk
                await flush()
            yield _done("no_api_key", session_id)
            await flush()
            return
        if not llm_config.get("model"):
            for chunk in _stream_text("⚠️ 请在设置中选择一个模型，然后重新发送消息。"):
                yield chunk
                await flush()
            yield _done("no_model", session_id)
            await flush()
            return
        domain_name = config.get("domain", {}).get("display_name", "AI助手")
        system_prompt = (config.get("prompts", {}) or {}).get("system", f"你是{domain_name}，请友好地回答用户问题。注意：你只能基于通用知识回答，不能提供专业建议。")
        context = _get_conversation_context(session_id)
        if context:
            system_prompt = f"{system_prompt}\n\n{context}"
        from langchain_core.messages import SystemMessage, HumanMessage
        from core.llm.factory import create_llm_from_config
        import time
        llm = create_llm_from_config(llm_config)
        cancel_event = asyncio.Event()
        async def watch_disconnect():
            while not cancel_event.is_set():
                if await request.is_disconnected():
                    cancel_event.set()
                    try:
                        await llm.http_async_client.aclose()
                    except Exception:
                        pass
                    break
                await asyncio.sleep(0.1)
        cancel_task = asyncio.ensure_future(watch_disconnect())
        full_answer = ""
        try:
            async for chunk in llm.astream([SystemMessage(content=system_prompt), HumanMessage(content=message)]):
                if cancel_event.is_set():
                    full_answer += " [已中断]"
                    break
                text = chunk.content if hasattr(chunk, "content") else ""
                if text:
                    full_answer += text
                    yield _sse("content", {"text": text})
                    await flush()
        except Exception as e:
            yield _sse("error", {"message": f"LLM 调用失败: {str(e)}"})
            await flush()
            return
        cancel_task.cancel()
        try:
            await cancel_task
        except asyncio.CancelledError:
            pass
        _save_message(session_id, "user", message)
        _save_message(session_id, "assistant", full_answer, model=llm_config.get("model", ""), intent="free_chat")
        yield _sse("done", {"intent": "free_chat", "confidence": 0.9, "sources": [], "from_llm": True})
        await flush()
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no", "Content-Encoding": "identity"})


# ──────────────── Pro 流程 ────────────────
async def _handle_pro(request: Request, message: str, domain: str, session_id: str, llm_config: dict, config: dict, is_new_session: bool = False):
    async def event_generator():
        yield _sse("start", {"message": "正在处理..."})
        await flush()
        if not llm_config.get("api_key"):
            for chunk in _stream_text("⚠️ 您还没有配置 API Key。请前往设置 → 模型页面，选择大模型提供商并填写 API Key。"):
                yield chunk
                await flush()
            yield _done("no_api_key", session_id)
            await flush()
            return
        if not llm_config.get("model"):
            for chunk in _stream_text("⚠️ 请在设置中选择一个模型，然后重新发送消息。"):
                yield chunk
                await flush()
            yield _done("no_model", session_id)
            await flush()
            return
        yield _sse("retrieval_start", {"message": "正在检索知识库..."})
        await flush()
        retriever = KnowledgeSearchTool.get_retriever()
        results = retriever.search(message) if retriever else []
        if results:
            rag_context = "\n\n".join(f"[{i+1}] {r['title']}\n{r.get('content', '')}" for i, r in enumerate(results))
            sources = [{"title": r["title"], "source": r.get("source", "unknown")} for r in results]
        else:
            rag_context = ""
            sources = []
        domain_name = config.get("domain", {}).get("display_name", "AI助手")
        system_prompt = (config.get("prompts", {}) or {}).get("system", f"你是{domain_name}，请基于知识库回答用户问题")
        context = _get_conversation_context(session_id)
        if context:
            system_prompt = f"{system_prompt}\n\n{context}"
        from langchain_core.messages import SystemMessage, HumanMessage
        from core.llm.factory import create_llm_from_config
        llm = create_llm_from_config(llm_config)
        user_prompt = message
        if rag_context:
            user_prompt = f"【知识库参考资料】\n{rag_context}\n\n【用户问题】\n{message}"
        cancel_event = asyncio.Event()
        async def watch_disconnect():
            while not cancel_event.is_set():
                if await request.is_disconnected():
                    cancel_event.set()
                    try:
                        await llm.http_async_client.aclose()
                    except Exception:
                        pass
                    break
                await asyncio.sleep(0.1)
        cancel_task = asyncio.ensure_future(watch_disconnect())
        full_answer = ""
        try:
            async for chunk in llm.astream([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]):
                if cancel_event.is_set():
                    full_answer += " [已中断]"
                    break
                text = chunk.content if hasattr(chunk, "content") else ""
                if text:
                    full_answer += text
                    yield _sse("content", {"text": text})
                    await flush()
        except Exception as e:
            yield _sse("error", {"message": f"LLM 调用失败: {str(e)}"})
            await flush()
            return
        finally:
            cancel_task.cancel()
            try:
                await cancel_task
            except asyncio.CancelledError:
                pass
        _save_message(session_id, "user", message)
        _save_message(session_id, "assistant", full_answer, model=llm_config.get("model", ""), intent="pro_rag", sources=json.dumps(sources) if sources else "")
        yield _sse("done", {"intent": "pro_rag", "confidence": 0.9, "sources": sources, "from_llm": True})
        await flush()
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no", "Content-Encoding": "identity"})


# ──────────────── Agent 流程 ────────────────
async def _handle_agent(request: Request, message: str, domain: str, session_id: str, llm_config: dict, is_new_session: bool = False):
    context_messages = []
    try:
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT role, content FROM Message WHERE sessionId = ? ORDER BY createdAt ASC LIMIT 10", (session_id,)).fetchall()
        for r in rows:
            role = r["role"]
            content = r["content"]
            if len(content) > 500:
                content = content[:500] + "..."
            if role == "user":
                context_messages.append(HumanMessage(content=content))
            else:
                context_messages.append(AIMessage(content=content))
        conn.close()
    except Exception:
        pass
    initial_state = {
        "query": message,
        "domain": domain,
        "session_id": session_id,
        "messages": context_messages,
        "safety_blocked": False,
        "safety_message": "",
        "safety_emergency": False,
        "tool_name": "",
        "tool_args": {},
        "tool_result": "",
        "rag_context": "",
        "sources": [],
        "user_plan": "agent",
        "final_answer": "",
        "loop_count": 0,
        "llm_config": llm_config,
        "tool_call_history": [],
        "next_action": "",
        "reflection_result": "",
        "reflection_hint": "",
    }
    async def event_generator():
        yield _sse("start", {"message": "正在处理..."})
        await flush()
        if not llm_config.get("api_key"):
            for chunk in _stream_text("⚠️ 您还没有配置 API Key。请前往设置 → 模型页面，选择大模型提供商并填写 API Key。"):
                yield chunk
                await flush()
            yield _done("no_api_key", session_id)
            await flush()
            return
        if not llm_config.get("model"):
            for chunk in _stream_text("⚠️ 请在设置中选择一个模型，然后重新发送消息。"):
                yield chunk
                await flush()
            yield _done("no_model", session_id)
            await flush()
            return
        graph = create_agent_graph()
        full_answer = ""
        final_sources = []
        from core.llm.factory import create_llm_from_config
        llm_temp = create_llm_from_config(llm_config)
        cancel_event = asyncio.Event()
        async def watch_disconnect():
            while not cancel_event.is_set():
                if await request.is_disconnected():
                    cancel_event.set()
                    try:
                        await llm_temp.http_async_client.aclose()
                    except Exception:
                        pass
                    break
                await asyncio.sleep(0.1)
        cancel_task = asyncio.ensure_future(watch_disconnect())
        try:
            async for event in graph.astream(initial_state, config={"recursion_limit": 50}):
                if cancel_event.is_set():
                    full_answer += " [已中断]"
                    break
                for node_name, node_data in event.items():
                    if node_name == "supervisor":
                        pass
                    elif node_name == "researcher":
                        tool_name = node_data.get("tool_name", "")
                        if tool_name:
                            yield _sse("tool_start", {"tools": [tool_name], "message": f"已调用: {tool_name}"})
                            await flush()
                    elif node_name == "reflector":
                        pass
                    elif node_name == "answerer":
                        if node_data.get("final_answer") == "__STREAMING_TRIGGER__":
                            config_obj = domain_manager.get_domain_config(domain)
                            system_prompt = (config_obj.get("prompts", {}) or {}).get("system", f"你是{domain}领域的助手，请基于提供的信息回答用户问题。")
                            tool_result_text = initial_state.get("tool_result", "")
                            parts = []
                            if tool_result_text:
                                parts.append(f"【工具分析结果】\n{tool_result_text}")
                            if initial_state.get("rag_context"):
                                parts.append(f"【知识库参考资料】\n{initial_state['rag_context']}")
                            user_prompt = message
                            if parts:
                                user_prompt = f"{chr(10).join(parts)}\n\n【用户问题】\n{message}"
                            stream_messages = [SystemMessage(content=system_prompt)]
                            stream_messages.extend(context_messages)
                            stream_messages.append(HumanMessage(content=user_prompt))
                            streaming_llm = create_llm_from_config(llm_config)
                            async for chunk in streaming_llm.astream(stream_messages):
                                if cancel_event.is_set():
                                    break
                                text = chunk.content if hasattr(chunk, "content") else ""
                                if text:
                                    full_answer += text
                                    yield _sse("content", {"text": text})
                                    await flush()
        except Exception as e:
            yield _sse("error", {"message": f"处理失败: {str(e)}"})
            await flush()
        cancel_task.cancel()
        try:
            await cancel_task
        except asyncio.CancelledError:
            pass
        if not full_answer or not full_answer.strip():
            full_answer = f"很抱歉，我暂时无法处理您的问题「{message}」。请稍后重试或尝试更明确的提问。"
            for chunk in _stream_text(full_answer):
                yield chunk
                await flush()
        _save_message(session_id, "user", message)
        _save_message(session_id, "assistant", full_answer, model=llm_config.get("model", ""), intent="agent", sources=json.dumps(final_sources) if final_sources else "")
        yield _sse("done", {"intent": "agent", "confidence": 0.9, "sources": final_sources, "from_llm": True})
        await flush()
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no", "Content-Encoding": "identity"})


# ──────────────── SSE 工具函数 ────────────────
async def flush():
    await asyncio.sleep(0)


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