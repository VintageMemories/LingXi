"""Lingxi Backend API"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.chat import router as chat_router
from app.domains import router as domains_router
from app.health import router as health_router
from app.auth import router as auth_router

app = FastAPI(
    title="灵析 Lingxi API",
    description="领域通用智能体框架 API - Domain-General Agent Framework",
    version="1.0.0",
)

# CORS
from core.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(auth_router, prefix="/api", tags=["Auth"])
app.include_router(domains_router, prefix="/api", tags=["Domains"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])


@app.on_event("startup")
async def startup():
    from core.intent.classifier import warmup
    warmup()
    from app.chat import init_chat_module
    init_chat_module()
    # 预加载知识库索引
    from core.tools.builtin.knowledge_search import KnowledgeSearchTool
    KnowledgeSearchTool._init_retriever()
    print("  ✅ Lingxi API 服务已启动")


@app.on_event("shutdown")
async def shutdown():
    print("  🔴 Lingxi API 服务已停止")