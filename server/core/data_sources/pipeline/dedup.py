"""
去重策略模块
"""
import hashlib
import re
import os
from typing import Dict

from core.data_sources.entry import RawKnowledgeEntry


def compute_fingerprint(entry: RawKnowledgeEntry) -> str:
    """计算条目的 MD5 指纹"""
    content = entry.get_fingerprint_content()
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def load_existing_fingerprints(knowledge_path: str) -> Dict[str, str]:
    """从知识库文件中加载已有条目指纹"""
    existing: Dict[str, str] = {}
    if not os.path.exists(knowledge_path):
        return existing
    try:
        with open(knowledge_path, 'r', encoding='utf-8') as f:
            content = f.read()
        sections = content.split('=' * 60)
        for section in sections:
            title_match = re.search(r'【疾病】([^\n]+)', section)
            if not title_match:
                title_match = re.search(r'【法规】([^\n]+)', section)
            if not title_match:
                title_match = re.search(r'【金融】([^\n]+)', section)
            if title_match:
                title = title_match.group(1)
                fingerprint = hashlib.md5(section.encode('utf-8')).hexdigest()
                existing[title] = fingerprint
    except Exception as e:
        print(f"[去重] 加载指纹失败: {e}")
    return existing