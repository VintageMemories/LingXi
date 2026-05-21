"""
灵析 (Lingxi) - 领域通用智能体框架
Domain-General Agent Framework

Run this file directly: python main.py
Or with uv: uv run main.py
"""

import uvicorn
import os
import sys

# ---------------------------------------------------------------------------
# 确保 backend 目录在 sys.path 和工作目录中
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

os.chdir(_BACKEND_DIR)


def main():
    """Main entry point for the Lingxi backend server."""

    print("\n" + "=" * 60)
    print("  🔮 灵析 Lingxi - 领域通用智能体框架")
    print("  Domain-General Agent Framework v1.0.0")
    print("=" * 60)
    print()

    host = "0.0.0.0"
    port = 8000

    print(f"  🌐 访问地址: http://localhost:{port}")
    print(f"  📡 API 文档: http://localhost:{port}/docs")
    print()
    print("  按 Ctrl+C 停止服务器")
    print("=" * 60)
    print()

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()