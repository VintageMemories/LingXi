"""
路由模块 - 已迁移

此文件中的路由功能已由 backend/api/ 模块统一管理。
原路由（聊天、模型选择、Token 验证等）现在分布在：

  - backend/api/chat.py      → 聊天接口 (SSE 流式响应)
  - backend/api/auth.py      → 认证接口
  - backend/api/health.py    → 健康检查
  - backend/api/domains.py   → 领域切换
  - backend/api/knowledge.py → 知识库管理
  - backend/api/sessions.py  → 会话管理
  - backend/api/feedback.py  → 反馈收集

如需启动后端服务，请使用：
  cd backend && uv run main.py
  或
  cd backend && python main.py
"""

# 此文件不再包含任何路由定义。
# 如需添加新路由，请在 backend/api/ 目录下创建新模块，
# 并在 backend/api/__init__.py 中注册。
