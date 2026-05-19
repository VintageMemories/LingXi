"""
Safety guard module for Lingxi backend.
Checks for emergency/blocked keywords and filters unsafe content.
"""
from typing import Dict, Any


class SafetyGuard:
    """Safety guard that checks for emergency/blocked keywords."""

    def check(self, message: str, domain_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check message for safety concerns.
        Returns dict with: blocked, emergency, message
        """
        safety_config = domain_config.get("safety", {})
        blocked_keywords = safety_config.get("blocked_keywords", [])
        emergency_keywords = safety_config.get("emergency_keywords", [])
        emergency_response = safety_config.get("emergency_response", "⚠️ 检测到紧急情况，请立即求助！")

        # Check for blocked content
        for keyword in blocked_keywords:
            if keyword in message:
                return {
                    "blocked": True,
                    "emergency": False,
                    "message": "⚠️ 您的消息包含不当内容，已自动过滤。如果您需要帮助，请拨打心理援助热线或联系专业人士。",
                }

        # Check for emergency keywords
        for keyword in emergency_keywords:
            if keyword in message:
                return {
                    "blocked": False,
                    "emergency": True,
                    "message": emergency_response,
                }

        return {"blocked": False, "emergency": False, "message": ""}

    def add_disclaimer(self, text: str, domain_config: Dict[str, Any], is_rag_useful: bool = False) -> str:
        disclaimer = domain_config.get("safety", {}).get("disclaimer", "")
        if not disclaimer:
            return text
        if is_rag_useful:
            return f"{text}\n\n---\n⚠️ {disclaimer}"
        else:
            return f"{text}\n\n*以上为 AI 通用知识，仅供参考*"