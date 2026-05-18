"""Lingxi Backend API"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.chat import router as chat_router
from api.sessions import router as sessions_router
from api.knowledge import router as knowledge_router
from api.domains import router as domains_router
from api.health import router as health_router
from api.auth import router as auth_router
from api.feedback import router as feedback_router
from api.stats import router as stats_router

app = FastAPI(
    title="灵析 Lingxi API",
    description="领域通用智能体框架 API - Domain-General Agent Framework",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(auth_router, prefix="/api", tags=["Auth"])
app.include_router(domains_router, prefix="/api", tags=["Domains"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])
app.include_router(sessions_router, prefix="/api", tags=["Sessions"])
app.include_router(knowledge_router, prefix="/api", tags=["Knowledge"])
app.include_router(feedback_router, prefix="/api", tags=["Feedback"])
app.include_router(stats_router, prefix="/api", tags=["Stats"])


@app.on_event("startup")
async def startup():
    print("  ✅ Lingxi API 服务已启动")


@app.on_event("shutdown")
async def shutdown():
    print("  🔴 Lingxi API 服务已停止")