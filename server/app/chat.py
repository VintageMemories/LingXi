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

# 加载项目根目录的 .env 文件
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
if os.path.exists(_ENV_PATH):
    load_dotenv(_ENV_PATH)
    print(f"[DB] 已加载环境变量文件: {_ENV_PATH}")

# 数据库连接（与 Prisma 共用 SQLite 文件）
import re

def _get_db_path() -> str:
    """从 DATABASE_URL 解析 SQLite 文件路径，兼容 Prisma 格式"""
    # 当前文件: server/app/chat.py
    # 项目根目录: server/../ = 项目根
    _current_file = os.path.abspath(__file__)                # server/app/chat.py
    _server_dir = os.path.dirname(os.path.dirname(_current_file))  # server/
    _project_root = os.path.dirname(_server_dir)                   # 项目根目录

    db_url = os.getenv("DATABASE_URL", "file:./prisma/dev.db")
    match = re.search(r'file:(.+)', db_url)
    if match:
        path = match.group(1)
        if not os.path.isabs(path):
            # 相对路径基于项目根目录解析
            path = os.path.join(_project_root, path)
        resolved = os.path.abspath(path)
        print(f"[DB] 解析 DATABASE_URL={db_url} -> {resolved}")
        return resolved

    # fallback: 默认路径，与 Prisma schema 中 datasource 默认值一致
    default_path = os.path.join(_project_root, "prisma", "dev.db")
    resolved = os.path.abspath(default_path)
    print(f"[DB] 使用默认路径 -> {resolved}")
    return resolved

_DB_PATH = _get_db_path()
print(f"[DB] 数据库路径: {_DB_PATH}")

def _save_message(session_id: str, role: str, content: str, model: str = "", intent: str = "", sources: str = ""):
    """将一条消息直接写入 Message 表（自动建表）"""
    if not session_id or not content:
        print(f"[DB] 跳过保存：session_id={session_id}, role={role}, content_len={len(content)}")
        return
    try:
        conn = sqlite3.connect(_DB_PATH)
        # 确保表存在（与 Prisma schema 一致）
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
        # 验证写入
        count = conn.execute("SELECT COUNT(*) FROM Message WHERE sessionId = ?", (session_id,)).fetchone()[0]
        conn.close()
        print(f"[DB] 当前会话消息总数: {count}")
        print(f"[DB] 消息已保存：session={session_id}, role={role}, len={len(content)}")
    except Exception as e:
        print(f"[DB] 保存消息失败: {e}")
import asyncio
import jwt
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from core.config import settings
from core.safety.guard import SafetyGuard
from core.domain.manager import domain_manager
from core.retrieval.hybrid import HybridRetriever
from core.agent.graph import create_agent_graph, AgentState

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

    is_new_session = not session_id
    if not session_id:
        # 前端应该已经创建了会话，这里不应该出现；如果出现则返回错误
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

    # 第一步：安全过滤
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
        emergency_msg = (config.get("prompts", {}) or {}).get(
            "emergency", "检测到紧急情况，请立即就医"
        )
        async def emergency_gen():
            for chunk in _stream_text(emergency_msg):
                yield chunk
                await flush()
            yield _done("emergency", session_id, emergency=True)
            await flush()
        return StreamingResponse(emergency_gen(), media_type="text/event-stream")

    # 第二步：根据订阅方案分流
    if user_plan == "agent":
        return await _handle_agent(request, message, domain, session_id, llm_config, is_new_session)
    elif user_plan == "pro":
        return await _handle_pro(request, message, domain, session_id, llm_config, config, is_new_session)
    else:
        return await _handle_free(request, message, domain, session_id, llm_config, config, is_new_session)


# ═══════════════════════════════════════════
# Free 流程：LLM 通用对话，不检索知识库
# ═══════════════════════════════════════════

async def _handle_free(request: Request, message: str, domain: str, session_id: str,
                       llm_config: dict, config: dict, is_new_session: bool):
    """免费版：LLM 通用对话，不检索知识库"""
    async def event_generator():
        try:
            # 立即发送一个 start 事件，确保前端不会超时断开
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
            system_prompt = (config.get("prompts", {}) or {}).get(
                "system", f"你是{domain_name}，请友好地回答用户问题。注意：你只能基于通用知识回答，不能提供专业建议。"
            )

            from langchain_core.messages import SystemMessage, HumanMessage
            from core.llm.factory import create_llm_from_config
            import time

            print(f"[Free] 开始创建 LLM 实例, model={llm_config.get('model')}, base_url={llm_config.get('api_base')}")
            llm = create_llm_from_config(llm_config)
            print("[Free] LLM 实例创建完成，准备调用 ainvoke...")

            # 创建取消事件和监听客户端断开的后台任务
            cancel_event = asyncio.Event()
            async def watch_disconnect():
                while not cancel_event.is_set():
                    if await request.is_disconnected():
                        cancel_event.set()
                        print("[Free] 客户端断开，正在关闭 LLM HTTP 连接...")
                        try:
                            await llm.http_async_client.aclose()
                            print("[Free] LLM HTTP 连接已关闭")
                        except Exception:
                            print("[Free] 关闭 LLM HTTP 连接时出错（可忽略）")
                        break
                    await asyncio.sleep(0.1)
            cancel_task = asyncio.ensure_future(watch_disconnect())

            t0 = time.time()
            full_answer = ""
            try:
                async for chunk in llm.astream([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=message),
                ]):
                    if cancel_event.is_set():
                        full_answer += " [已中断]"
                        break
                    text = chunk.content if hasattr(chunk, "content") else ""
                    if text:
                        full_answer += text
                        yield _sse("content", {"text": text})
                        await flush()
                if cancel_event.is_set():
                    print(f"[Free] LLM 调用被用户中断，已生成 {len(full_answer)} 字符")
                else:
                    print(f"[Free] LLM 流式调用成功，耗时 {time.time()-t0:.2f}s，回答长度 {len(full_answer)}")
            except Exception as invoke_error:
                import traceback
                traceback.print_exc()
                error_msg = f"LLM 调用失败: {str(invoke_error)}"
                print(f"[Free] {error_msg}")
                yield _sse("error", {"message": error_msg})
                await flush()
                return

            cancel_task.cancel()
            try: await cancel_task
            except asyncio.CancelledError: pass

            # 持久化消息，确保历史可查
            _save_message(session_id, "user", message)
            _save_message(session_id, "assistant", full_answer,
                          model=llm_config.get("model", ""),
                          intent="free_chat")

            yield _sse("done", {
                "intent": "free_chat",
                "confidence": 0.9,
                "sources": [],
                "from_llm": True,
            })
            await flush()

        except Exception as e:
            import traceback
            traceback.print_exc()
            error_msg = f"服务请求失败: {str(e)}"
            yield _sse("error", {"message": error_msg})
            await flush()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        }
    )


# ═══════════════════════════════════════════
# Pro 流程：知识库检索 → LLM 生成
# ═══════════════════════════════════════════

async def _handle_pro(request: Request, message: str, domain: str, session_id: str,
                      llm_config: dict, config: dict, is_new_session: bool):
    """Pro 版：知识库检索 → LLM 生成回答（不走 Agent 决策）"""
    async def event_generator():
        try:
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

            from langchain_core.messages import SystemMessage, HumanMessage
            from core.llm.factory import create_llm_from_config
            import time

            print(f"[Pro] 开始创建 LLM 实例, model={llm_config.get('model')}, base_url={llm_config.get('api_base')}")
            llm = create_llm_from_config(llm_config)

            user_prompt = message
            if rag_context:
                user_prompt = f"【知识库参考资料】\n{rag_context}\n\n【用户问题】\n{message}"

            print("[Pro] LLM 实例创建完成，准备调用 ainvoke...")
            # 创建取消事件和监听客户端断开的后台任务
            cancel_event = asyncio.Event()
            async def watch_disconnect():
                while not cancel_event.is_set():
                    if await request.is_disconnected():
                        cancel_event.set()
                        print("[Pro] 客户端断开，正在关闭 LLM HTTP 连接...")
                        try:
                            await llm.http_async_client.aclose()
                            print("[Pro] LLM HTTP 连接已关闭")
                        except Exception:
                            print("[Pro] 关闭 LLM HTTP 连接时出错（可忽略）")
                        break
                    await asyncio.sleep(0.1)
            cancel_task = asyncio.ensure_future(watch_disconnect())

            t0 = time.time()
            full_answer = ""
            try:
                async for chunk in llm.astream([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]):
                    if cancel_event.is_set():
                        full_answer += " [已中断]"
                        break
                    text = chunk.content if hasattr(chunk, "content") else ""
                    if text:
                        full_answer += text
                        yield _sse("content", {"text": text})
                        await flush()
                if cancel_event.is_set():
                    print(f"[Pro] LLM 调用被用户中断，已生成 {len(full_answer)} 字符")
                else:
                    print(f"[Pro] LLM 流式调用成功，耗时 {time.time()-t0:.2f}s，回答长度 {len(full_answer)}")
            except Exception as invoke_error:
                import traceback
                traceback.print_exc()
                error_msg = f"LLM 调用失败: {str(invoke_error)}"
                print(f"[Pro] {error_msg}")
                yield _sse("error", {"message": error_msg})
                await flush()
                return
            finally:
                cancel_task.cancel()
                try: await cancel_task
                except asyncio.CancelledError: pass

            # 持久化消息，确保历史可查
            _save_message(session_id, "user", message)
            _save_message(session_id, "assistant", full_answer,
                          model=llm_config.get("model", ""),
                          intent="pro_rag",
                          sources=json.dumps(sources) if sources else "")

            yield _sse("done", {
                "intent": "pro_rag",
                "confidence": 0.9,
                "sources": sources,
                "from_llm": True,
            })
            await flush()

        except Exception as e:
            import traceback
            traceback.print_exc()
            error_msg = f"服务请求失败: {str(e)}"
            yield _sse("error", {"message": error_msg})
            await flush()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        }
    )


# ═══════════════════════════════════════════
# Agent 流程：LangGraph 自主决策图
# ═══════════════════════════════════════════

async def _handle_agent(request: Request, message: str, domain: str, session_id: str,
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
        last_node = ""
        full_answer = ""
        final_sources = []

        # 创建取消事件和监听客户端断开的后台任务
        from core.llm.factory import create_llm_from_config
        llm_temp = create_llm_from_config(llm_config)  # 仅用于获取异步客户端
        cancel_event = asyncio.Event()
        async def watch_disconnect():
            while not cancel_event.is_set():
                if await request.is_disconnected():
                    cancel_event.set()
                    print("[Agent] 客户端断开，正在关闭 LLM HTTP 连接...")
                    try:
                        await llm_temp.http_async_client.aclose()
                        print("[Agent] LLM HTTP 连接已关闭")
                    except Exception:
                        print("[Agent] 关闭 LLM HTTP 连接时出错（可忽略）")
                    break
                await asyncio.sleep(0.1)
        cancel_task = asyncio.ensure_future(watch_disconnect())

        try:
            async for event in graph.astream(initial_state):
                if cancel_event.is_set():
                    full_answer += " [已中断]"
                    break
                for node_name, node_data in event.items():
                    if node_name != last_node:
                        last_node = node_name

                        if node_name == "execute_tool":
                            tool_name = node_data.get("tool_name", "")
                            yield _sse("tool_start", {
                                "tools": [tool_name.replace("USE_TOOL:", "").strip()],
                                "message": "正在分析您的问题..."
                            })
                            await flush()

                        elif node_name == "search_knowledge":
                            yield _sse("retrieval_start", {"message": "正在检索知识库..."})
                            await flush()

                        elif node_name == "generate_answer":
                            answer = node_data.get("final_answer", "")
                            if answer:
                                full_answer = answer
                                final_sources = node_data.get("sources", [])
                                for chunk in _stream_text(answer):
                                    yield chunk
                                    await flush()

                        elif node_name == "safety_check":
                            if node_data.get("safety_blocked"):
                                msg = node_data.get("safety_message", "")
                                full_answer = msg
                                for chunk in _stream_text(msg):
                                    yield chunk
                                    await flush()

                        elif node_name == "emergency_response":
                            answer = node_data.get("final_answer", "")
                            full_answer = answer
                            for chunk in _stream_text(answer):
                                yield chunk
                                await flush()

            cancel_task.cancel()
            try: await cancel_task
            except asyncio.CancelledError: pass

            # 持久化消息，确保历史可查
            _save_message(session_id, "user", message)
            _save_message(session_id, "assistant", full_answer,
                          model=llm_config.get("model", ""),
                          intent="agent",
                          sources=json.dumps(final_sources) if final_sources else "")

            yield _sse("done", {
                "intent": "agent",
                "confidence": 0.9,
                "sources": final_sources,
                "from_llm": True,
            })
            await flush()

        except Exception as e:
            yield _sse("error", {"message": f"处理失败: {str(e)}"})
            await flush()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        }
    )


# ═══════════════════════════════════════════
# SSE 工具函数
# ═══════════════════════════════════════════

async def flush():
    """让出事件循环，强制立即推送缓冲数据"""
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