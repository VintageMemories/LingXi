"""
LingXi Agent 决策图 v2.0 - 监督者模式 + 反思节点
企业级提示词设计，简洁清晰，可观测性强
"""
import json
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


# ───────────────────────── 监督者节点 ─────────────────────────
def supervisor_node(state: AgentState) -> dict:
    """分析问题，决定：调用工具 或 直接回答。"""
    llm = create_llm(state)
    domain = state["domain"]
    config = domain_manager.get_domain_config(domain)
    system_prompt = config.get("prompts", {}).get("system", f"你是{domain}领域的助手")

    tool_list = ToolRegistry.list_by_domain(domain)
    tool_names = [t["name"] for t in tool_list]
    tool_desc = "\n".join([f"- {t['name']}: {t['description'].split(chr(10))[0]}" for t in tool_list])

    called_tools = state.get("tool_call_history", [])
    called_tools_str = ", ".join(called_tools) if called_tools else "无"
    reflection_hint = state.get("reflection_hint", "")
    retry_count = state.get("retry_count", 0)

    hint_text = ""
    if reflection_hint:
        hint_text = f"\n【铁律】上一次反思节点明确建议：{reflection_hint}\n你必须严格按照此建议选择下一步工具。"

    prompt = f"""## 角色
你是{domain}领域的智能助手。

## 可用工具
{tool_desc}

## 工作流程（严格遵守）
1. **首次尝试**：直接使用用户问题或稍作优化后调用 knowledge_search。
2. **收到重写指令**：如果反思节点建议你“重写查询词”，你必须：
   - 分析为什么上次检索失败（如：关键词太窄、太泛、缺少专业术语等）
   - 重新构造一个更精准的查询词
   - 再次调用 knowledge_search
3. **重试限制**：最多重试 2 次。当前已是第 {retry_count} 次重试。
4. **直接回答**：如果已有足够信息，或达到重试上限，直接输出 ANSWER。

## 已尝试工具
{called_tools_str}
{hint_text}

## 用户问题
{state['query']}

## 输出格式
- 调用工具：输出 JSON {{"action": "tool", "tool_name": "工具名", "arguments": {{"query": "完整查询"}}}}
- 直接回答：输出 ANSWER"""

    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content.strip()

    if content == "ANSWER" or not content.startswith("{"):
        print(f"{'─'*40}\n[Supervisor] 决策：直接回答\n{'─'*40}")
        return {"next_action": "answer"}

    try:
        decision = json.loads(content)
        tool_name = decision.get("tool_name", "")
        arguments = decision.get("arguments", {})
        if tool_name not in tool_names:
            print(f"{'─'*40}\n[Supervisor] 工具 {tool_name} 不在可用列表中，改为直接回答\n{'─'*40}")
            return {"next_action": "answer"}
        print(f"{'─'*40}\n[Supervisor] 决策：调用 {tool_name} (查询: {str(arguments.get('query', ''))[:100]})\n{'─'*40}")
        return {
            "next_action": "tool",
            "tool_name": tool_name,
            "tool_args": arguments,
        }
    except json.JSONDecodeError:
        print(f"{'─'*40}\n[Supervisor] JSON 解析失败，改为直接回答\n{'─'*40}")
        return {"next_action": "answer"}

def route_supervisor(state: AgentState) -> str:
    action = state.get("next_action", "answer")
    if action == "tool":
        return "researcher"
    return "answerer"

# ───────────────────────── 研究员节点 ─────────────────────────
def researcher_node(state: AgentState) -> dict:
    """执行工具调用，记录工具到历史，递增循环计数"""
    domain = state["domain"]
    tool_name = state.get("tool_name", "")
    tool_args = state.get("tool_args", {})

    if not tool_args and state.get("query"):
        tool_args = {"query": state["query"]}

    # 如果是 knowledge_search，传入当前重试次数
    if tool_name == "knowledge_search":
        tool_args["retry_count"] = state.get("retry_count", 0)

    instance = ToolRegistry.create(tool_name)
    if not instance:
        return {
            "tool_result": json.dumps({"status": "failed", "message": f"工具 '{tool_name}' 不存在"}),
            "loop_count": 1,
        }

    print(f"[Researcher] 执行工具: {tool_name}，参数: {json.dumps(tool_args, ensure_ascii=False)[:200]}")
    result = instance.execute(tool_args)

    if isinstance(result, dict) and "data" in result:
        data = result["data"]
    else:
        data = str(result)

    print(f"[Researcher] 结果预览: {str(data)[:200]}")
    return {
        "tool_result": data,
        "tool_call_history": [tool_name],
        "loop_count": 1,
    }

def route_after_researcher(state: AgentState) -> str:
    return "reflector"

# ───────────────────────── 反思节点 ─────────────────────────
def reflector_node(state: AgentState) -> dict:
    """评估工具返回质量，给出评分和建议"""
    llm = create_llm(state)
    tool_result = state.get("tool_result", "")
    query = state["query"]

    if not tool_result:
        return {"reflection_result": "failed", "reflection_hint": "工具返回为空，必须换工具"}

    failure_keywords = ["查询失败", "HTTP Error", "所有搜索接口均不可达"]
    if any(kw in str(tool_result) for kw in failure_keywords):
        return {"reflection_result": "failed", "reflection_hint": "工具返回明确失败信息，必须更换为其他工具"}

    if "needs_more_info" in str(tool_result):
        return {"reflection_result": "retry", "reflection_hint": "工具需要更多参数，请根据提示修改参数后重试"}

    prompt = f"""评估以下工具返回结果的质量。

用户问题：{query}
工具返回：{str(tool_result)[:1000]}

评判标准：
- high: 结果中至少有一条直接回答了用户问题（即使后面有其他不相关的结果混杂）
- low: 结果中有部分相关的信息，但所有条目都不够完整
- failed: 所有结果都与用户问题完全无关

只回复一个单词：high / low / failed"""

    response = llm.invoke([HumanMessage(content=prompt)])
    evaluation = response.content.strip().lower()

    # 重写查询的 hint
    hint_map = {
        "high": "",
        "low": "结果不够全面，请重写查询词（更具体或更泛化）后重新调用 knowledge_search。",
        "failed": "检索结果不相关，请分析原因并重写查询词后再次搜索。"
    }
    hint = hint_map.get(evaluation, "结果质量不明，建议重新查询")

    print(f"[Reflector] 质量评估: {evaluation} | 建议: {hint}")
    # 返回时递增 retry_count
    retry_increment = 1 if evaluation in ("low", "failed") else 0
    return {
        "reflection_result": evaluation,
        "reflection_hint": hint,
        "retry_count": retry_increment
    }

def route_reflector(state: AgentState) -> str:
    result = state.get("reflection_result", "failed")
    total_calls = state.get("loop_count", 0)
    max_retries = 3

    if result == "high" or total_calls >= max_retries:
        print(f"{'─'*40}\n[Reflector] 进入回答节点 (质量: {result}, 调用次数: {total_calls})\n{'─'*40}")
        return "answerer"
    print(f"[Reflector] 返回监督者重新决策 (质量: {result}, 调用次数: {total_calls})")
    return "supervisor"

# ───────────────────────── 回答者节点 ─────────────────────────
def answerer_node(state: AgentState) -> dict:
    return {"final_answer": "__STREAMING_TRIGGER__"}

# ───────────────────────── 编译图 ─────────────────────────
def create_agent_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("reflector", reflector_node)
    workflow.add_node("answerer", answerer_node)

    workflow.set_entry_point("supervisor")

    workflow.add_conditional_edges(
        "supervisor", route_supervisor,
        {"researcher": "researcher", "answerer": "answerer"}
    )

    workflow.add_edge("researcher", "reflector")
    workflow.add_conditional_edges(
        "reflector", route_reflector,
        {"supervisor": "supervisor", "answerer": "answerer"}
    )

    workflow.add_edge("answerer", END)

    return workflow.compile()