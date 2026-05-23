"""
Agent 决策图（手动 ReAct 循环 + 反思可见）
安全过滤 → LLM 反思 → 工具执行（循环）→ 生成回答
"""
import json
import os
from typing import List
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from core.agent.state import AgentState
from core.llm.factory import create_llm
from core.safety.guard import SafetyGuard
from core.domain.manager import domain_manager
from core.tools.registry import ToolRegistry

_safety_guard = SafetyGuard()


def safety_check_node(state: AgentState) -> dict:
    """安全检测：识别敏感词和紧急情况"""
    config = domain_manager.get_domain_config(state["domain"])
    result = _safety_guard.check(state["query"], config)
    return {
        "safety_blocked": result["blocked"],
        "safety_message": result["message"],
        "safety_emergency": result["emergency"],
    }


def route_safety(state: AgentState) -> str:
    if state.get("safety_blocked"):
        return "blocked"
    if state.get("safety_emergency"):
        return "emergency"
    return "safe"


def emergency_response_node(state: AgentState) -> dict:
    """紧急情况直接返回预设提示"""
    config = domain_manager.get_domain_config(state["domain"])
    prompts = config.get("prompts", {}) or {}
    msg = prompts.get("emergency", "检测到紧急情况，请立即就医")
    return {"final_answer": msg}


def _get_system_prompt(domain: str) -> str:
    """获取领域系统提示词"""
    config = domain_manager.get_domain_config(domain)
    return (config.get("prompts", {}) or {}).get(
        "system", f"你是{domain}领域的助手，请基于提供的信息回答用户问题。"
    )


def _build_tool_schemas(domain: str) -> List[dict]:
    """构建原生 function calling 格式的工具 schema 列表"""
    from core.tools.registry import ToolRegistry
    tools = ToolRegistry.list_by_domain(domain)
    schemas = []
    for t in tools:
        schemas.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "传给工具的完整查询字符串"
                        }
                    },
                    "required": ["query"]
                }
            }
        })
    return schemas


def agent_node(state: AgentState) -> dict:
    """LLM 反思 + 决策节点：输出思考过程，然后给出结构化行动"""
    llm = create_llm(state)
    system_prompt = _get_system_prompt(state["domain"])
    tool_schemas = _build_tool_schemas(state["domain"])

    # 构建历史消息
    messages = [SystemMessage(content=system_prompt)]
    for msg in state.get("messages", []):
        if isinstance(msg, (HumanMessage, AIMessage, ToolMessage)):
            messages.append(msg)

    # 统计已调用工具次数（从 AIMessage 的 tool_calls 数量）
    tool_call_count = sum(
        1 for m in messages if isinstance(m, AIMessage) and hasattr(m, "tool_calls") and m.tool_calls
    )
    max_tool_calls = 5
    remaining = max_tool_calls - tool_call_count

    if remaining <= 0:
        answer = f"已达到工具调用上限（{max_tool_calls}次），请基于已有信息回答用户问题：{state['query']}"
        print(f"[Agent] 工具调用已达上限 {max_tool_calls}，强制回答")
        return {"final_answer": answer, "messages": []}

    # 反思提示词，要求 LLM 先分析再给出行动 JSON
    reflection_prompt = (
        f"【第 {tool_call_count + 1}/{max_tool_calls} 次决策】\n"
        "请严格按以下步骤操作：\n"
        "1. 先评估上一次工具调用返回的结果（如果有）。如果结果已足够，直接给出最终回答。\n"
        "2. 如果结果不足，解释需要补充什么信息，然后选择一个合适的工具调用。\n"
        "3. 绝对不要重复调用同一个工具。\n"
        "4. 最终回答时，请用专业、清晰的语言回答。\n\n"
        "输出格式要求：\n"
        "- 如果直接回答，在消息开头写上 [最终回答]，然后输出你的回答。\n"
        "- 如果需要调用工具，在消息开头写上 [调用工具]，然后紧跟一行 JSON，格式如下：\n"
        '{"tool_name": "工具名", "arguments": {"query": "完整查询字符串"}}\n'
        f"用户问题：{state['query']}"
    )
    messages.append(HumanMessage(content=reflection_prompt))

    # 调用 LLM（不绑定工具，完全依靠 prompt 控制输出格式）
    response = llm.invoke(messages)
    content = response.content if hasattr(response, "content") else ""

    # 解析 LLM 输出
    if not content:
        # 空响应，兜底
        print("[Agent] LLM 返回空内容，强制回答")
        return {"final_answer": "很抱歉，我暂时无法处理您的问题。", "messages": []}

    content_stripped = content.strip()
    print(f"[Agent] 第 {tool_call_count + 1} 次决策输出: {content_stripped[:200]}...")

    if content_stripped.startswith("[最终回答]"):
        # 提取答案（去掉 [最终回答] 标记）
        answer = content_stripped[len("[最终回答]"):].strip()
        if not answer:
            answer = "很抱歉，我暂时无法回答您的问题。"
        print(f"[Agent] 第 {tool_call_count + 1} 次决策：直接回答，长度 {len(answer)}")
        return {"final_answer": answer, "messages": [AIMessage(content=content_stripped)]}

    elif content_stripped.startswith("[调用工具]"):
        # 尝试提取 JSON
        try:
            # 找到第一个 '{' 开始的 JSON 字符串
            json_start = content_stripped.index('{')
            json_str = content_stripped[json_start:]
            tool_info = json.loads(json_str)
            tool_name = tool_info.get("tool_name", "")
            arguments = tool_info.get("arguments", {})
            if not tool_name:
                raise ValueError("缺少 tool_name")

            # 构造一个 AIMessage 包含一个 tool_call，以便 ToolNode 执行
            tool_call_msg = AIMessage(
                content=content_stripped,  # 保留完整反思内容
                tool_calls=[{
                    "name": tool_name,
                    "args": arguments,
                    "id": f"call_{tool_call_count}"
                }]
            )
            print(f"[Agent] 第 {tool_call_count + 1} 次决策调用: {tool_name}")
            return {"messages": [tool_call_msg]}
        except (json.JSONDecodeError, ValueError, IndexError) as e:
            print(f"[Agent] 解析工具调用 JSON 失败: {e}")
            # 如果解析失败，当做最终回答处理
            return {"final_answer": content_stripped, "messages": [AIMessage(content=content_stripped)]}

    else:
        # 格式不符合预期，按最终回答处理
        print("[Agent] 输出格式不符合预期，按回答处理")
        return {"final_answer": content_stripped, "messages": [AIMessage(content=content_stripped)]}


def route_after_agent(state: AgentState) -> str:
    """Agent 节点后的路由：有 final_answer 则结束，有 tool_calls 则执行工具"""
    if state.get("final_answer"):
        return "end"
    last_msg = state["messages"][-1] if state.get("messages") else None
    if last_msg and hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        return "tools"
    return "end"


def create_agent_graph():
    """构建手动 ReAct 循环的 Agent 图"""
    workflow = StateGraph(AgentState)

    # 获取所有医疗工具（用于 ToolNode）
    tools = ToolRegistry.get_langchain_tools("medical")

    workflow.add_node("safety_check", safety_check_node)
    workflow.add_node("emergency_response", emergency_response_node)
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", ToolNode(tools))

    workflow.set_entry_point("safety_check")

    workflow.add_conditional_edges(
        "safety_check", route_safety,
        {"blocked": END, "emergency": "emergency_response", "safe": "agent"}
    )
    workflow.add_edge("emergency_response", END)

    workflow.add_conditional_edges(
        "agent", route_after_agent,
        {"tools": "tools", "end": END}
    )
    workflow.add_edge("tools", "agent")  # 工具执行后回到 agent 继续反思

    return workflow.compile()