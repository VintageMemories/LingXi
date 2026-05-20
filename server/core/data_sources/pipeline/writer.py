"""
写入策略模块
"""
import os
from typing import List, Optional

from core.data_sources.entry import RawKnowledgeEntry


def append_to_knowledge_file(entries: List[RawKnowledgeEntry], knowledge_path: str) -> int:
    """追加条目到知识库文本文件"""
    os.makedirs(os.path.dirname(knowledge_path) if os.path.dirname(knowledge_path) else '.', exist_ok=True)
    saved = 0
    with open(knowledge_path, 'a', encoding='utf-8', newline='') as f:
        for entry in entries:
            text = entry.to_knowledge_text()
            if text:
                f.write("\n" + "=" * 60 + "\n")
                f.write(text + "\n")
                f.write("=" * 60 + "\n")
                f.flush()
                saved += 1
    return saved