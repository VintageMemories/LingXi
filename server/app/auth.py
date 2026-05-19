"""Auth API - JWT authentication with SQLite"""
import os
import sqlite3
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.config import settings

router = APIRouter()

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"

# 数据库路径：指向 prisma/dev.db
_SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_SERVER_DIR, "..", "prisma", "dev.db")


def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_user_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS User (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            passwordHash TEXT NOT NULL,
            plan TEXT DEFAULT 'free',
            avatar TEXT,
            devMode INTEGER DEFAULT 0,
            dailyUsage INTEGER DEFAULT 0,
            lastUsageDate TEXT,
            promptTokens INTEGER DEFAULT 0,
            completionTokens INTEGER DEFAULT 0,
            totalTokens INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()


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
    conn = _get_conn()
    _init_user_table(conn)

    if request.action == "register":
        if not request.email or not request.password:
            raise HTTPException(status_code=400, detail="邮箱和密码不能为空")

        existing = conn.execute("SELECT id FROM User WHERE email = ?", (request.email,)).fetchone()
        if existing:
            conn.close()
            raise HTTPException(status_code=409, detail="邮箱已注册")

        password_hash = bcrypt.hashpw(
            request.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        user_id = str(uuid.uuid4())
        name = request.name or request.email.split("@")[0]
        now = datetime.utcnow().isoformat()

        conn.execute(
            "INSERT INTO User (id, email, name, passwordHash, plan, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, request.email, name, password_hash, "free", now, now),
        )
        conn.commit()
        conn.close()

        token = create_token(user_id, request.email)
        return {
            "success": True,
            "user": {"id": user_id, "email": request.email, "name": name, "plan": "free"},
            "token": token,
        }

    elif request.action == "login":
        if not request.email or not request.password:
            raise HTTPException(status_code=400, detail="邮箱和密码不能为空")

        row = conn.execute("SELECT id, email, name, passwordHash, plan FROM User WHERE email = ?", (request.email,)).fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="用户不存在")

        if not bcrypt.checkpw(
                request.password.encode("utf-8"), row["passwordHash"].encode("utf-8")
        ):
            conn.close()
            raise HTTPException(status_code=401, detail="密码错误")

        conn.close()
        token = create_token(row["id"], row["email"])
        return {
            "success": True,
            "user": {"id": row["id"], "email": row["email"], "name": row["name"], "plan": row["plan"]},
            "token": token,
        }

    conn.close()
    raise HTTPException(status_code=400, detail="未知操作")


@router.get("/auth")
async def get_user(user_id: str = None):
    if not user_id:
        raise HTTPException(status_code=401, detail="未提供用户ID")

    conn = _get_conn()
    _init_user_table(conn)
    row = conn.execute("SELECT id, email, name, plan FROM User WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    return {"id": row["id"], "email": row["email"], "name": row["name"], "plan": row["plan"]}