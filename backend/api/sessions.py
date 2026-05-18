"""Sessions API - CRUD for conversation sessions"""
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

_sessions: dict = {}


class CreateSessionRequest(BaseModel):
    domain: str = "medical"
    title: Optional[str] = None


class DeleteSessionRequest(BaseModel):
    session_id: str


class RenameSessionRequest(BaseModel):
    title: str


@router.post("/sessions")
async def create_session(request: CreateSessionRequest):
    session_id = str(uuid.uuid4())[:8]
    session = {
        "id": session_id,
        "domain": request.domain,
        "title": request.title or "新对话",
        "tags": [],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "message_count": 0,
    }
    _sessions[session_id] = session
    return {
        "session_id": session_id,
        "created_at": session["created_at"],
    }


@router.get("/sessions")
async def list_sessions(user_id: Optional[str] = None):
    sessions = list(_sessions.values())
    return {
        "sessions": [
            {
                "id": s["id"],
                "domain": s["domain"],
                "title": s["title"],
                "tags": s.get("tags", []),
                "createdAt": s["created_at"],
                "updatedAt": s["updated_at"],
                "messageCount": s.get("message_count", 0),
            }
            for s in sessions
        ]
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "id": session["id"],
        "domain": session["domain"],
        "title": session["title"],
        "tags": session.get("tags", []),
        "createdAt": session["created_at"],
        "updatedAt": session["updated_at"],
        "messageCount": session.get("message_count", 0),
    }


@router.patch("/sessions/{session_id}")
async def rename_session(session_id: str, request: RenameSessionRequest):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    session["title"] = request.title
    session["updated_at"] = datetime.now().isoformat()
    return {"success": True, "title": request.title}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="会话不存在")
    del _sessions[session_id]
    return {"success": True}