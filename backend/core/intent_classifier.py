"""
Intent classifier module for Lingxi backend.
Simple intent classification based on keyword matching.
"""
from typing import Dict, Any, List, Optional


class IntentClassifier:
    """Simple intent classifier based on keyword matching."""

    def classify(self, message: str, domain_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify user intent based on keyword matching.
        Returns a dict with: intent, confidence, tools, needs_rag
        """
        intents = domain_config.get("intents", [])
        message_lower = message.lower()

        sorted_intents = sorted(intents, key=lambda x: x.get("priority", 999))

        best_match = None
        best_score = 0.0

        for intent_config in sorted_intents:
            keywords = intent_config.get("keywords", [])
            if not keywords:
                continue

            matches = sum(1 for kw in keywords if kw.lower() in message_lower)
            if matches == 0:
                continue

            score = matches / len(keywords)
            adjusted_score = min(1.0, score * 2 + matches * 0.1)

            if adjusted_score > best_score:
                best_score = adjusted_score
                best_match = intent_config

        if best_match:
            return {
                "intent": best_match["id"],
                "confidence": min(best_score, 0.95),
                "tools": best_match.get("tools", []),
                "needs_rag": best_match.get("use_rag", False),
            }

        # Default
        if sorted_intents:
            default_intent = sorted_intents[-1]
            return {
                "intent": default_intent["id"],
                "confidence": 0.3,
                "tools": default_intent.get("tools", []),
                "needs_rag": default_intent.get("use_rag", True),
            }

        return {"intent": "unknown", "confidence": 0.1, "tools": [], "needs_rag": False}