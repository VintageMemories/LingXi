"""Stats API"""
from fastapi import APIRouter

router = APIRouter()

# 这里简单返回静态数据，后续可接数据库
@router.get("/stats")
async def get_stats():
    return {
        "total": 228,
        "byDomain": {
            "medical": 160,
            "legal": 40,
            "finance": 28
        }
    }