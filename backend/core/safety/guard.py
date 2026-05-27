"""
Safety guard module for Lingxi backend.
使用本地 ONNX 模型进行语义意图分类，替代关键词匹配
"""
import time
from typing import Dict, Any, Optional


class SafetyGuard:
    """基于语义理解的安全守卫"""

    # 紧急响应文案
    EMERGENCY_RESPONSES = {
        "emergency_medical": (
            "⚠️ 检测到可能的医疗紧急情况！\n\n"
            "请立即采取以下行动：\n"
            "1. 拨打 120 急救电话\n"
            "2. 保持患者呼吸道通畅\n"
            "3. 不要随意移动患者\n"
            "4. 等待专业急救人员到达\n\n"
            "时间就是生命，请立即行动！"
        ),
        "emergency_legal": (
            "⚠️ 检测到可能的人身安全威胁！\n\n"
            "请立即采取以下行动：\n"
            "1. 拨打 110 报警电话\n"
            "2. 尽量远离危险源\n"
            "3. 向周围人求助\n"
            "4. 保留证据\n\n"
            "您的安全最重要，请立即求助！"
        ),
    }

    def check(self, message: str, domain_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        使用本地模型进行意图分类

        Returns:
            {
                "blocked": bool,
                "emergency": bool,
                "emergency_type": str | None,  # "medical" | "legal"
                "intent": str,                   # 分类标签 id
                "intent_description": str,       # 分类标签描述
                "confidence": float,             # 置信度
                "message": str,                  # 拦截/紧急时的提示文案
            }
        """
        from core.intent.classifier import classify

        start = time.time()
        result = classify(message)
        print(f"[Safety] 分类耗时: {(time.time()-start)*1000:.0f}ms, 结果: {result['intent']}")

        intent = result["intent"]
        confidence = result["confidence"]

        # 紧急检测
        if intent == "emergency_medical":
            return {
                "blocked": False,
                "emergency": True,
                "emergency_type": "medical",
                "intent": intent,
                "intent_description": result["description"],
                "confidence": confidence,
                "message": self.EMERGENCY_RESPONSES["emergency_medical"],
            }

        if intent == "emergency_legal":
            if confidence < 0.7:  # 置信度不足时回退到正常意图
                return {
                    "blocked": False,
                    "emergency": False,
                    "emergency_type": None,
                    "intent": "out_of_domain",
                    "intent_description": result["description"],
                    "confidence": confidence,
                    "message": "",
                }
            return {
                "blocked": False,
                "emergency": True,
                "emergency_type": "legal",
                "intent": intent,
                "intent_description": result["description"],
                "confidence": confidence,
                "message": self.EMERGENCY_RESPONSES["emergency_legal"],
            }

        # 安全/违规内容拦截（细粒度标签 + 原始 blocked 标签）
        safety_labels = {"self_harm", "violence", "sexual_content", "illegal_activity", "hate_speech", "blocked"}
        if intent in safety_labels:
            return {
                "blocked": True,
                "emergency": False,
                "emergency_type": None,
                "intent": intent,
                "intent_description": result["description"],
                "confidence": confidence,
                "message": "⚠️ 您的问题涉及不安全内容，已被安全系统拦截。"
            }

        # 正常消息
        return {
            "blocked": False,
            "emergency": False,
            "emergency_type": None,
            "intent": intent,
            "intent_description": result["description"],
            "confidence": confidence,
            "message": "",
        }

    def add_disclaimer(self, text: str, domain_config: Optional[Dict[str, Any]] = None, is_rag_useful: bool = False) -> str:
        disclaimer = ""
        if domain_config:
            disclaimer = domain_config.get("safety", {}).get("disclaimer", "")
        if not disclaimer:
            return text
        if is_rag_useful:
            return f"{text}\n\n---\n⚠️ {disclaimer}"
        else:
            return f"{text}\n\n*以上为 AI 通用知识，仅供参考*"