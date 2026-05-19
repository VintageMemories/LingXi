"""
知识库导入模块
功能：
1. 支持内容指纹去重，通过 MD5 校验内容变更。
2. 处理新的医学数据对象，存储到 JSONL 与统一知识库文件。
3. 提供内容更新检测与追加功能。
"""

import json
import os
import re
import sys
import hashlib
from typing import List, Dict
from .pipelines import DataPipeline

# 导入后端 RawKnowledgeEntry
_SERVER_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server")
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)
from core.data_sources.base import RawKnowledgeEntry


# ==========================================================
# 工具函数：内容指纹与现有知识库处理
# ==========================================================

def get_content_fingerprint(data: Dict) -> str:
    """计算疾病内容的 MD5 指纹"""
    # 汇总所有相关字段内容
    content = ""
    content += data.get('title', '')
    content += data.get('summary', '')
    content += data.get('etiology', '')
    content += data.get('symptoms', '')
    content += data.get('diagnosis', '')
    content += data.get('treatment', '')
    content += data.get('prevention', '')

    # 生成 MD5 摘要
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def get_existing_fingerprints(knowledge_path: str) -> Dict[str, str]:
    """
    提取知识库中的疾病标题与对应指纹（MD5）
    输出格式：{title: fingerprint}
    """
    existing = {}
    if not os.path.exists(knowledge_path):
        return existing

    with open(knowledge_path, 'r', encoding='utf-8') as f:
        content = f.read()

        # 按分隔符切分知识库内容
        sections = content.split('=' * 60)

        # 遍历提取标题和指纹
        for section in sections:
            title_match = re.search(r'【疾病】([^\n]+)', section)
            if not title_match:
                continue

            title = title_match.group(1)
            fingerprint = hashlib.md5(section.encode('utf-8')).hexdigest()
            existing[title] = fingerprint

    return existing


# ==========================================================
# 文件存储与追加逻辑
# ==========================================================

def save_to_jsonl(data_list: List[Dict], output_path: str):
    """
    将数据以 JSONL 格式存储到文件中
    参数：
        data_list: 待存储数据列表
        output_path: 输出文件路径
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        for data in data_list:
            f.write(json.dumps(data, ensure_ascii=False) + '\n')
            f.flush()
            os.fsync(f.fileno())

    print(f"[成功] 已保存 {len(data_list)} 条数据到 {output_path}")


def append_to_knowledge_base(data_list: List[Dict], knowledge_path: str):
    """
    将数据追加到知识库文件中（文本格式）
    参数：
        data_list: 待追加数据
        knowledge_path: 知识库路径
    """
    os.makedirs(os.path.dirname(knowledge_path), exist_ok=True)

    with open(knowledge_path, 'a', encoding='utf-8', newline='') as f:
        for data in data_list:
            entry = RawKnowledgeEntry(
                title=data.get("title", ""),
                content=data.get("content", ""),
                domain=data.get("domain", "medical"),
                category=data.get("category", ""),
                summary=data.get("summary", ""),
                etiology=data.get("etiology", ""),
                symptoms=data.get("symptoms", ""),
                diagnosis=data.get("diagnosis", ""),
                treatment=data.get("treatment", ""),
                prevention=data.get("prevention", ""),
                source=data.get("source", ""),
                source_url=data.get("url", ""),
            )
            text = entry.to_knowledge_text()
            if text:
                f.write("\n" + "=" * 60 + "\n")
                f.write(text + "\n")
                f.write("=" * 60 + "\n")
                f.flush()
                os.fsync(f.fileno())

    print(f"[成功] 已追加 {len(data_list)} 条数据到知识库 {knowledge_path}")


# ==========================================================
# 核心函数：数据导入知识库
# ==========================================================

def import_to_knowledge_base(
    data_list: List[Dict],
    knowledge_path: str = "data/medical_knowledge.txt",
    save_jsonl: bool = True,
    jsonl_path: str = "data/a_hospital/disease_data.jsonl"
):
    """
    导入数据到知识库（支持内容更新检测与去重）
    参数：
        data_list: 输入数据列表
        knowledge_path: 知识库保存路径（默认为统一文件）
        save_jsonl: 是否保存为 JSONL 格式
        jsonl_path: JSONL 文件路径
    流程：
    1. 过滤无效数据。
    2. 对当前批次数据去重。
    3. 对比已有数据，检测新增或更新。
    """
    # 1. 过滤无效数据
    valid_data = DataPipeline.filter_valid(data_list)
    print(f"[统计] 有效数据: {len(valid_data)}/{len(data_list)}")

    # 2. 当前批次去重
    unique_data = DataPipeline.deduplicate(valid_data)
    print(f"[统计] 当前批次去重后: {len(unique_data)}")

    # 3. 从现有知识库中提取指纹
    existing_fingerprints = get_existing_fingerprints(knowledge_path)
    print(f"[统计] 知识库已有疾病: {len(existing_fingerprints)}")

    # 4. 检测新增与更新数据
    new_data = []
    updated_data = []

    for data in unique_data:
        title = data.get("title", "")
        if not title:
            continue

        new_fingerprint = get_content_fingerprint(data)

        if title not in existing_fingerprints:
            # 新疾病数据
            new_data.append(data)
        elif existing_fingerprints[title] != new_fingerprint:
            # 已有疾病内容更新
            updated_data.append(data)
            print(f"  [更新] {title} 内容已变化，将重新导入")

    print(f"[统计] 新增疾病: {len(new_data)}")
    print(f"[统计] 更新疾病: {len(updated_data)}")

    # 5. 存储新增与更新数据
    all_to_save = new_data + updated_data
    if all_to_save:
        if save_jsonl:
            save_to_jsonl(all_to_save, jsonl_path)
        append_to_knowledge_base(all_to_save, knowledge_path)
    else:
        print("[完成] 没有新数据或更新数据需要导入")

    print(f"\n[完成] 导入完成！")
    return all_to_save