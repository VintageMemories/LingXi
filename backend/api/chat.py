"""Chat API - SSE streaming chat endpoint"""
import asyncio
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from core.domain_config import domain_manager
from core.safety_guard import SafetyGuard
from core.intent_classifier import IntentClassifier
from core.llm_client import LLMClient

router = APIRouter()

safety_guard = SafetyGuard()
intent_classifier = IntentClassifier()
llm_client = LLMClient()

# In-memory session store
_sessions: dict = {}

SSE_MEDIA_TYPE = "text/event-stream"


class ChatRequest(BaseModel):
    message: str
    domain: str = "medical"
    session_id: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    api_base_url: Optional[str] = None
    api_provider: Optional[str] = None
    images: Optional[List[str]] = None


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _sse_done(intent: str, session_id: str, **extra: object) -> str:
    payload = {"type": "done", "intent": intent, "session_id": session_id, **extra}
    return _sse_event(payload)


async def _yield_streaming_text(text: str, session_id: str, intent: str, **done_extra: object):
    for chunk in _simulate_stream(text):
        yield _sse_event({"type": "content", "text": chunk})
        await asyncio.sleep(0.02)
    yield _sse_done(intent, session_id, **done_extra)


def _add_user_message(session_id: str, message: str):
    _sessions[session_id]["messages"].append({"role": "user", "content": message})


def _add_assistant_message(session_id: str, content: str):
    _sessions[session_id]["messages"].append({"role": "assistant", "content": content})


async def _handle_safety_block(safety_result: dict, session_id: str):
    async for event in _yield_streaming_text(
            safety_result["message"], session_id, "blocked"
    ):
        yield event


async def _handle_emergency(safety_result: dict, intent_result: dict, config: dict, session_id: str, message: str):
    emergency_msg = config.get("prompts", {}).get(
        "emergency", "⚠️ 检测到紧急情况，请立即拨打急救电话！"
    )
    _add_user_message(session_id, message)
    _add_assistant_message(session_id, emergency_msg)
    async for event in _yield_streaming_text(
            emergency_msg, session_id, "emergency", emergency=True
    ):
        yield event


async def _handle_greeting(config: dict, session_id: str, message: str):
    domain_name = config["domain"]["name"]
    display_name = config["domain"]["display_name"]
    greeting_msg = f"您好！我是{domain_name}，{display_name}。请问有什么可以帮您的？"
    _add_user_message(session_id, message)
    _add_assistant_message(session_id, greeting_msg)
    async for event in _yield_streaming_text(greeting_msg, session_id, "greeting"):
        yield event


async def _handle_out_of_scope(config: dict, session_id: str, message: str):
    oos_msg = config.get("prompts", {}).get(
        "out_of_scope", "您的问题可能与当前领域无关。建议您咨询相关领域的专业人士。"
    )
    _add_user_message(session_id, message)
    _add_assistant_message(session_id, oos_msg)
    async for event in _yield_streaming_text(oos_msg, session_id, "out_of_scope"):
        yield event


async def _handle_llm_generation(request: ChatRequest, config: dict, session_id: str, message: str, intent_result: dict):
    # Tool execution status
    if intent_result.get("tools"):
        yield _sse_event({"type": "tool_start", "tools": intent_result["tools"], "message": "正在分析您的问题..."})

    # Retrieval status
    if intent_result.get("needs_rag"):
        yield _sse_event({"type": "retrieval_start", "message": "正在检索知识库..."})

    # Add user message
    _add_user_message(session_id, message)

    # Build system prompt
    system_prompt = config.get("prompts", {}).get(
        "system",
        f"你是{config['domain']['name']}，一个专业的{config['domain']['display_name']}。请基于你的专业知识回答用户的问题。"
    )

    # Build messages for LLM
    messages = [{"role": "system", "content": system_prompt}]
    history = _sessions[session_id]["messages"][-10:]
    for msg in history:
        if msg["role"] != "system":
            messages.append(msg)

    # Try LLM call
    full_answer = ""
    try:
        async for chunk in llm_client.stream_chat(
                messages,
                model=request.model,
                api_key=request.api_key,
                api_base_url=request.api_base_url,
                api_provider=request.api_provider,
        ):
            full_answer += chunk
            yield _sse_event({"type": "content", "text": chunk})
    except Exception as e:
        # LLM 调用失败，返回友好提示（不加免责声明）
        error_msg = str(e)
        if 'No API key' in error_msg or 'API' in error_msg:
            fallback = "⚠️ 您还没有配置 AI 模型 API Key。\n\n请前往**设置 → 模型**页面，输入您的 API Key（支持 DeepSeek、OpenAI、通义千问等）。\n\n配置完成后即可获得 AI 智能回复。"
        else:
            fallback = _generate_fallback_response(message, config, intent_result)
        for chunk in _simulate_stream(fallback):
            full_answer += chunk
            yield _sse_event({"type": "content", "text": chunk})
            await asyncio.sleep(0.02)
        _add_assistant_message(session_id, full_answer)
        yield _sse_done(intent_result["intent"], session_id, confidence=intent_result.get("confidence", 0.5), sources=[])
        return

    # LLM 调用成功，添加免责声明
    disclaimer = config.get("safety", {}).get("disclaimer", "")
    if disclaimer:
        disclaimer_text = f"\n\n---\n⚠️ {disclaimer}"
        full_answer += disclaimer_text
        yield _sse_event({"type": "content", "text": disclaimer_text})

    # Update session
    _add_assistant_message(session_id, full_answer)

    # Done signal
    yield _sse_done(
        intent_result["intent"],
        session_id,
        confidence=intent_result.get("confidence", 0.5),
        sources=[],
    )


async def generate_sse(request: ChatRequest):
    """Generate SSE stream for chat response."""
    try:
        message = request.message.strip()
        if not message:
            yield _sse_event({"type": "error", "message": "消息不能为空"})
            return

        # Get domain config
        domain_id = request.domain
        config = domain_manager.get_domain_config(domain_id)
        if not config:
            yield _sse_event({"type": "error", "message": "领域配置不存在"})
            return

        # Session management
        session_id = request.session_id or str(uuid.uuid4())[:8]

        if session_id not in _sessions:
            _sessions[session_id] = {
                "id": session_id,
                "domain": domain_id,
                "messages": [],
                "created_at": datetime.now().isoformat(),
            }

        # Step 1: Safety check
        safety_result = safety_guard.check(message, config)
        if safety_result["blocked"]:
            async for event in _handle_safety_block(safety_result, session_id):
                yield event
            return

        # Step 2: Intent classification
        intent_result = intent_classifier.classify(message, config)

        # Step 3: Emergency handling
        if safety_result["emergency"] or intent_result["intent"] == "emergency":
            async for event in _handle_emergency(safety_result, intent_result, config, session_id, message):
                yield event
            return

        # Step 4: Greeting handling
        if intent_result["intent"] == "greeting":
            async for event in _handle_greeting(config, session_id, message):
                yield event
            return

        # Step 5: Out of scope
        if intent_result["intent"] == "out_of_scope":
            async for event in _handle_out_of_scope(config, session_id, message):
                yield event
            return

        # Step 6+: LLM generation
        async for event in _handle_llm_generation(request, config, session_id, message, intent_result):
            yield event

    except Exception as e:
        yield _sse_event({"type": "error", "message": f"生成回答时出错: {str(e)}"})


def _simulate_stream(text: str, chunk_size: int = 3):
    for i in range(0, len(text), chunk_size):
        yield text[i : i + chunk_size]


def _generate_fallback_response(message: str, config: dict, intent_result: dict) -> str:
    domain_name = config["domain"]["name"]
    intent = intent_result.get("intent", "unknown")

    if intent in ["symptom", "drug_query", "checkup", "medical_query"]:
        return (
            f"关于您的问题「{message[:30]}{'...' if len(message) > 30 else ''}」，"
            f"我需要更多信息来给您准确的回答。\n\n"
            f"建议您：\n"
            f"1. 提供更详细的症状描述\n"
            f"2. 前往正规医疗机构就诊\n"
            f"3. 如有紧急情况，请立即拨打120\n\n"
            f"— {domain_name}"
        )
    elif intent in ["contract_review", "labor_dispute", "legal_query"]:
        return (
            f"关于您的问题「{message[:30]}{'...' if len(message) > 30 else ''}」，"
            f"这涉及到专业的法律问题。\n\n"
            f"建议您：\n"
            f"1. 咨询专业律师获取法律意见\n"
            f"2. 保留相关证据材料\n"
            f"3. 注意诉讼时效\n\n"
            f"— {domain_name}"
        )
    elif intent in ["investment", "insurance", "finance_query"]:
        return (
            f"关于您的问题「{message[:30]}{'...' if len(message) > 30 else ''}」，"
            f"这涉及到专业的金融问题。\n\n"
            f"温馨提示：\n"
            f"1. 投资有风险，决策需谨慎\n"
            f"2. 建议咨询持牌金融顾问\n"
            f"3. 注意风险分散\n\n"
            f"— {domain_name}"
        )
    else:
        return (
            f"感谢您的提问。关于「{message[:30]}{'...' if len(message) > 30 else ''}」，"
            f"我正在处理中。如果您需要更详细的回答，请提供更多上下文信息。\n\n"
            f"— {domain_name}"
        )


@router.post("/chat")
async def chat_handler(request: ChatRequest):
    return StreamingResponse(
        generate_sse(request),
        media_type=SSE_MEDIA_TYPE,
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/sessions")
async def list_chat_sessions():
    """List all in-memory chat sessions."""
    return {
        "sessions": [
            {
                "id": s["id"],
                "domain": s["domain"],
                "message_count": len(s["messages"]),
                "created_at": s["created_at"],
            }
            for s in _sessions.values()
        ]
    }