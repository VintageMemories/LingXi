"""
Agent 决策图
安全过滤 → LLM 思考 → 执行工具/检索 → 再思考 → 生成回答
"""

from typing import List
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage
from core.agent.state import AgentState
from core.llm.factory import create_llm
from core.safety.guard import SafetyGuard
from core.domain.manager import domain_manager
from core.tools.executor import ToolExecutor
from core.retrieval.hybrid import HybridRetriever


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


def agent_think_node(state: AgentState) -> dict:
    """LLM 自主决策下一步操作"""
    config = domain_manager.get_domain_config(state["domain"])
    tools = config.get("tools", [])

    tools_list = [f"- {t['name']}: {t.get('description', '')}" for t in tools]
    tools_list.append("- search_knowledge: 搜索专业知识库")
    tools_list.append("- answer: 信息已足够，直接回答用户")

    prompt = f"""你是专业的AI助手。根据用户问题决定下一步行动。

当前领域：{config.get('domain', {}).get('display_name', '')}

可用操作：
{chr(10).join(tools_list)}

用户问题：{state['query']}

已有信息：
工具结果：{state.get('tool_result', '') or '无'}
知识库：{state.get('rag_context', '') or '无'}

已循环次数：{state.get('loop_count', 0)} / 5

请只回复以下格式之一：
ANSWER
USE_TOOL: <工具名>
SEARCH_KNOWLEDGE"""

    llm = create_llm(state)
    response = llm.invoke([HumanMessage(content=prompt)])
    decision = response.content.strip()
    print(f"[Agent Think] 循环 {state.get('loop_count', 0) + 1}, LLM 决策: {decision}")

    return {
        "tool_name": decision,
        "loop_count": state.get("loop_count", 0) + 1,
    }


def route_agent_action(state: AgentState) -> str:
    decision = state.get("tool_name", "")
    if decision.startswith("USE_TOOL"):
        return "execute_tool"
    if "SEARCH_KNOWLEDGE" in decision:
        return "search_knowledge"
    return "generate_answer"


def execute_tool_node(state: AgentState) -> dict:
    """执行 LLM 选择的领域工具"""
    config = domain_manager.get_domain_config(state["domain"])
    executor = ToolExecutor(config)

    tool_name = state.get("tool_name", "").replace("USE_TOOL:", "").strip()
    result = executor.execute(tool_name, state["query"])

    return {
        "tool_result": result["data"] if result["success"] else f"工具执行失败: {result['data']}"
    }


def search_knowledge_node(state: AgentState) -> dict:
    """从知识库检索相关内容"""
    config = domain_manager.get_domain_config(state["domain"])
    retriever = HybridRetriever()
    results = retriever.search(state["query"])

    if results:
        context = "\n\n".join(
            f"[{i+1}] {r['title']}\n{r.get('content', '')}" for i, r in enumerate(results)
        )
        sources: List[dict] = [{"title": r["title"], "source": r.get("source", "unknown")} for r in results]
        return {"rag_context": context, "sources": sources}

    return {"rag_context": "", "sources": []}


def generate_answer_node(state: AgentState) -> dict:
    """汇总所有信息生成最终回答"""
    config = domain_manager.get_domain_config(state["domain"])
    domain_name = config.get("domain", {}).get("display_name", "智能助手")
    system_prompt = (config.get("prompts", {}) or {}).get(
        "system", f"你是{domain_name}，请基于提供的信息回答用户问题"
    )

    parts = []
    if state.get("tool_result"):
        parts.append(f"【工具分析结果】\n{state['tool_result']}")
    if state.get("rag_context"):
        parts.append(f"【知识库参考资料】\n{state['rag_context']}")

    user_prompt = state["query"]
    if parts:
        user_prompt = f"{chr(10).join(parts)}\n\n【用户问题】\n{state['query']}"

    llm = create_llm(state)
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    return {"final_answer": response.content}


def create_agent_graph():
    """构建并编译 Agent 决策图"""
    workflow = StateGraph(AgentState)

    workflow.add_node("safety_check", safety_check_node)
    workflow.add_node("emergency_response", emergency_response_node)
    workflow.add_node("agent_think", agent_think_node)
    workflow.add_node("execute_tool", execute_tool_node)
    workflow.add_node("search_knowledge", search_knowledge_node)
    workflow.add_node("generate_answer", generate_answer_node)

    workflow.set_entry_point("safety_check")

    workflow.add_conditional_edges(
        "safety_check", route_safety,
        {"blocked": END, "emergency": "emergency_response", "safe": "agent_think"}
    )

    workflow.add_edge("emergency_response", END)

    workflow.add_conditional_edges(
        "agent_think", route_agent_action,
        {
            "execute_tool": "execute_tool",
            "search_knowledge": "search_knowledge",
            "generate_answer": "generate_answer",
        }
    )

    workflow.add_edge("execute_tool", "agent_think")
    workflow.add_edge("search_knowledge", "agent_think")
    workflow.add_edge("generate_answer", END)

    return workflow.compile()