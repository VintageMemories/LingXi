"""
Session memory management.
"""
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

_sessions: Dict[str, Dict[str, Any]] = {}


async def create_session(domain: str = "medical", title: Optional[str] = None) -> str:
    session_id = str(uuid.uuid4())[:8]
    _sessions[session_id] = {
        "id": session_id,
        "domain": domain,
        "title": title or "新对话",
        "messages": [],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    return session_id


async def add_message(session_id: str, role: str, content: str) -> bool:
    session = _sessions.get(session_id)
    if not session:
        return False
    session["messages"].append({"role": role, "content": content, "timestamp": datetime.now().isoformat()})
    session["updated_at"] = datetime.now().isoformat()
    return True


async def get_history(session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    session = _sessions.get(session_id)
    if not session:
        return []
    return session["messages"][-limit:]


async def update_last_assistant(session_id: str, content: str) -> bool:
    session = _sessions.get(session_id)
    if not session:
        return False
    for msg in reversed(session["messages"]):
        if msg["role"] == "assistant":
            msg["content"] = content
            session["updated_at"] = datetime.now().isoformat()
            return True
    return False


async def update_session_title(session_id: str, title: str) -> bool:
    session = _sessions.get(session_id)
    if not session:
        return False
    session["title"] = title
    session["updated_at"] = datetime.now().isoformat()
    return True


async def clear_session(session_id: str) -> bool:
    if session_id in _sessions:
        del _sessions[session_id]
        return True
    return False


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    return _sessions.get(session_id)


async def list_sessions(domain: Optional[str] = None) -> List[Dict[str, Any]]:
    sessions = list(_sessions.values())
    if domain:
        sessions = [s for s in sessions if s["domain"] == domain]
    return sorted(sessions, key=lambda x: x["updated_at"], reverse=True)