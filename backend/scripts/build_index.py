"""
离线构建知识库索引（分块 + 向量化 + 稀疏权重）
运行方式：
    cd backend
    uv run python scripts/build_index.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.tools.builtin.knowledge_search import KnowledgeSearchTool

def build():
    print("正在切块并构建索引...")
    KnowledgeSearchTool._build_index()
    print("索引构建完成！")

if __name__ == "__main__":
    build()