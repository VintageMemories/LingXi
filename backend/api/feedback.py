"""Feedback API - Feedback collection"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

_feedbacks: list = []


class FeedbackRequest(BaseModel):
    session_id: str
    message_id: Optional[str] = None
    rating: int  # 1: thumbs up, -1: thumbs down
    comment: Optional[str] = None
    query: Optional[str] = None
    response: Optional[str] = None
    intent: Optional[str] = None
    domain: Optional[str] = None


@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    if not request.session_id or request.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="缺少必要参数或评分无效")

    feedback = {
        "session_id": request.session_id,
        "message_id": request.message_id,
        "rating": request.rating,
        "comment": request.comment,
        "query": request.query,
        "response": request.response,
        "intent": request.intent,
        "domain": request.domain,
        "created_at": __import__("datetime").datetime.now().isoformat(),
    }
    _feedbacks.append(feedback)
    return {"success": True}


@router.get("/feedback")
async def get_feedback_stats(domain: Optional[str] = None):
    feedbacks = _feedbacks
    if domain:
        feedbacks = [f for f in feedbacks if f.get("domain") == domain]

    total = len(feedbacks)
    positive = sum(1 for f in feedbacks if f["rating"] == 1)
    negative = sum(1 for f in feedbacks if f["rating"] == -1)

    return {
        "total": total,
        "positive": positive,
        "negative": negative,
        "satisfaction_rate": round(positive / total * 100, 1) if total > 0 else 0,
    }