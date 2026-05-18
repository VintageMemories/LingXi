"""Auth API - Simple JWT authentication"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import bcrypt
import jwt
from datetime import datetime, timedelta

from core.config import settings

router = APIRouter()

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"

# In-memory user store (replace with database in production)
_users_db: dict = {}


class AuthRequest(BaseModel):
    action: str  # "login" or "register"
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    plan: str = "free"


def create_token(user_id: str, email: str) -> str:
    payload = {
        "userId": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=1),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/auth")
async def auth_handler(request: AuthRequest):
    if request.action == "register":
        if not request.email or not request.password:
            raise HTTPException(status_code=400, detail="邮箱和密码不能为空")

        if request.email in _users_db:
            raise HTTPException(status_code=409, detail="邮箱已注册")

        password_hash = bcrypt.hashpw(
            request.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        user_id = f"user_{len(_users_db) + 1}"
        user = {
            "id": user_id,
            "email": request.email,
            "name": request.name or request.email.split("@")[0],
            "password_hash": password_hash,
            "plan": "free",
        }
        _users_db[request.email] = user

        token = create_token(user_id, request.email)
        return {
            "success": True,
            "user": UserResponse(**user).model_dump(),
            "token": token,
        }

    elif request.action == "login":
        if not request.email or not request.password:
            raise HTTPException(status_code=400, detail="邮箱和密码不能为空")

        user = _users_db.get(request.email)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

        if not bcrypt.checkpw(
                request.password.encode("utf-8"), user["password_hash"].encode("utf-8")
        ):
            raise HTTPException(status_code=401, detail="密码错误")

        token = create_token(user["id"], user["email"])
        return {
            "success": True,
            "user": UserResponse(**user).model_dump(),
            "token": token,
        }

    raise HTTPException(status_code=400, detail="未知操作")


@router.get("/auth")
async def get_user(user_id: str = None):
    if not user_id:
        raise HTTPException(status_code=401, detail="未提供用户ID")

    for user in _users_db.values():
        if user["id"] == user_id:
            return UserResponse(**user).model_dump()

    raise HTTPException(status_code=404, detail="用户不存在")