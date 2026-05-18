"""
Tool executor module for Lingxi backend.
"""
from typing import Dict, Any, List, Optional


class ToolExecutor:
    def __init__(self, domain_config: Dict[str, Any]):
        self.domain_config = domain_config
        self.tools = {t["name"]: t for t in domain_config.get("tools", [])}

    async def execute(self, tool_name: str, query: str) -> Dict[str, Any]:
        if tool_name not in self.tools:
            return {"success": False, "data": f"Tool '{tool_name}' not found", "tool": tool_name}

        tool_config = self.tools[tool_name]
        domain_name = self.domain_config.get("domain", {}).get("name", "助手")
        result_data = self._generate_stub_result(tool_name, query, domain_name)
        return {"success": True, "data": result_data, "tool": tool_name}

    def _generate_stub_result(self, tool_name: str, query: str, domain_name: str) -> str:
        tool_results = {
            "symptom_checker": f"症状分析：基于您的描述「{query[:30]}...」，初步分析如下：\n1. 可能与常见疾病相关\n2. 建议进一步检查\n3. 如症状持续，建议就医",
            "drug_query": f"药品查询：关于「{query[:30]}...」的药品信息：\n1. 请遵医嘱用药\n2. 注意药品禁忌和副作用\n3. 如有不良反应，请立即停药并就医",
            "checkup_interpreter": f"体检解读：关于「{query[:30]}...」的指标解读：\n1. 建议结合临床情况综合判断\n2. 异常指标需复查\n3. 详细解读请咨询主治医生",
            "appointment_guide": f"就诊建议：基于「{query[:30]}...」，建议：\n1. 可先到全科/内科初诊\n2. 根据初诊结果转专科\n3. 急诊请直接前往急诊科",
            "department_advisor": f"科室介绍：关于「{query[:30]}...」：\n1. 该科室主要诊疗相关疾病\n2. 出诊时间请查询医院官网\n3. 建议提前预约挂号",
            "emergency_detector": "⚠️ 紧急情况检测：检测到可能需要紧急处理的情况，请立即拨打120！",
            "contract_review": f"合同审查：关于「{query[:30]}...」：\n1. 建议仔细阅读合同条款\n2. 注意违约责任和争议解决条款\n3. 重要合同建议由律师审核",
            "labor_dispute": f"劳动纠纷分析：关于「{query[:30]}...」：\n1. 收集相关证据\n2. 可先与用人单位协商\n3. 协商不成可申请劳动仲裁",
            "property_dispute": f"财产纠纷分析：关于「{query[:30]}...」：\n1. 保留相关证据材料\n2. 建议咨询专业律师\n3. 注意诉讼时效",
            "criminal_defense": f"刑事辩护咨询：关于「{query[:30]}...」：\n1. 有权保持沉默\n2. 有权委托辩护律师\n3. 建议立即联系律师",
            "investment_advisor": f"投资建议：关于「{query[:30]}...」：\n1. 投资有风险，需谨慎决策\n2. 建议分散投资降低风险\n3. 量力而行",
            "insurance_advisor": f"保险咨询：关于「{query[:30]}...」：\n1. 根据实际需求选择险种\n2. 仔细阅读保险条款\n3. 如实告知健康状况",
        }
        return tool_results.get(tool_name, f"工具执行结果：正在分析「{query[:30]}...」\n— {domain_name}")