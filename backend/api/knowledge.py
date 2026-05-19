"""Knowledge API - Knowledge base search and management"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

_knowledge_entries: list = []
_next_id = 1

class KnowledgeEntry(BaseModel):
    title: str
    content: str
    domain: str
    category: Optional[str] = None
    source: Optional[str] = None


class DeleteEntryRequest(BaseModel):
    id: int


@router.get("/knowledge")
async def list_knowledge(
        domain: Optional[str] = None,
        search: Optional[str] = None,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
):
    global _next_id

    entries = _knowledge_entries
    if domain and domain != "全部":
        entries = [e for e in entries if e["domain"] == domain]
    if search:
        entries = [e for e in entries if search.lower() in e["title"].lower()]

    total = len(entries)
    start = (page - 1) * limit
    end = start + limit
    page_entries = entries[start:end]

    counts: dict = {}
    for e in _knowledge_entries:
        counts[e["domain"]] = counts.get(e["domain"], 0) + 1

    return {
        "entries": page_entries,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": max(1, (total + limit - 1) // limit),
        "countsByDomain": counts,
    }


@router.post("/knowledge")
async def add_knowledge(entry: KnowledgeEntry):
    global _next_id
    new_entry = {
        "id": _next_id,
        "title": entry.title,
        "content": entry.content,
        "domain": entry.domain,
        "category": entry.category,
        "source": entry.source,
        "created_at": __import__("datetime").datetime.now().isoformat(),
    }
    _knowledge_entries.append(new_entry)
    _next_id += 1
    return {"success": True, "id": new_entry["id"]}


@router.delete("/knowledge")
async def delete_knowledge(request: DeleteEntryRequest):
    global _knowledge_entries
    original_len = len(_knowledge_entries)
    _knowledge_entries = [e for e in _knowledge_entries if e["id"] != request.id]
    if len(_knowledge_entries) == original_len:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    return {"success": True}