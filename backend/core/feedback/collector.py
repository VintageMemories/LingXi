"""
Feedback collector module for Lingxi backend.
"""
from datetime import datetime
from typing import Dict, Any, List, Optional

_feedbacks: List[Dict[str, Any]] = []


async def add_feedback(feedback: Dict[str, Any]) -> bool:
    feedback["created_at"] = datetime.now().isoformat()
    _feedbacks.append(feedback)
    return True


async def get_feedback_stats(domain: Optional[str] = None) -> Dict[str, Any]:
    feedbacks = _feedbacks
    if domain:
        feedbacks = [f for f in feedbacks if f.get("domain") == domain]
    total = len(feedbacks)
    positive = sum(1 for f in feedbacks if f.get("rating") == 1)
    negative = sum(1 for f in feedbacks if f.get("rating") == -1)
    intent_counts: Dict[str, int] = {}
    for f in feedbacks:
        intent = f.get("intent", "unknown")
        intent_counts[intent] = intent_counts.get(intent, 0) + 1
    return {
        "total": total,
        "positive": positive,
        "negative": negative,
        "satisfaction_rate": round(positive / total * 100, 1) if total > 0 else 0,
        "intent_distribution": intent_counts,
    }


async def get_recent_feedback(limit: int = 50, domain: Optional[str] = None) -> List[Dict[str, Any]]:
    feedbacks = _feedbacks
    if domain:
        feedbacks = [f for f in feedbacks if f.get("domain") == domain]
    return feedbacks[-limit:]