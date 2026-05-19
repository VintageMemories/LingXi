"""
统一知识库导入管道
"""
import hashlib
import os
import re
from typing import List, Dict, Optional

from .base import RawKnowledgeEntry, DataSourceConfig
from .registry import DataSourceRegistry


def compute_fingerprint(entry: RawKnowledgeEntry) -> str:
    content = entry.get_fingerprint_content()
    return hashlib.md5(content.encode("utf-8")).hexdigest()


class ImportPipeline:
    def __init__(self, knowledge_path: str = "data/medical_knowledge.txt"):
        self.knowledge_path = knowledge_path
        self.stats = {
            "total_fetched": 0,
            "new_entries": 0,
            "updated_entries": 0,
            "skipped_entries": 0,
            "errors": 0,
        }

    def reset_stats(self):
        self.stats = {k: 0 for k in self.stats}

    async def import_from_source(
            self, source_name: str, config: DataSourceConfig,
            existing_fingerprints: Optional[Dict[str, str]] = None,
    ) -> Dict:
        self.reset_stats()

        adapter = DataSourceRegistry.create(source_name, config)
        if not adapter:
            raise ValueError(f"Unknown data source: '{source_name}'")
        if not adapter.validate_config():
            raise ValueError(f"Invalid configuration for data source: {source_name}")

        if existing_fingerprints is None:
            existing_fingerprints = self._load_existing_fingerprints()

        new_entries: List[RawKnowledgeEntry] = []
        updated_entries: List[RawKnowledgeEntry] = []

        async for entry in adapter.fetch_entries():
            self.stats["total_fetched"] += 1
            try:
                fingerprint = compute_fingerprint(entry)
                existing_fp = existing_fingerprints.get(entry.title)
                if existing_fp is None:
                    new_entries.append(entry)
                    existing_fingerprints[entry.title] = fingerprint
                elif existing_fp != fingerprint:
                    updated_entries.append(entry)
                    existing_fingerprints[entry.title] = fingerprint
                    self.stats["updated_entries"] += 1
                else:
                    self.stats["skipped_entries"] += 1
            except Exception as e:
                self.stats["errors"] += 1
                print(f"[导入错误] 条目 '{entry.title}' 处理失败: {e}")

        self.stats["new_entries"] = len(new_entries)

        return {
            "source": source_name,
            "metadata": adapter.get_metadata(),
            "stats": {**self.stats},
            "new_entries": len(new_entries),
            "updated_entries": len(updated_entries),
            "new_entry_titles": [e.title for e in new_entries[:10]],
            "updated_entry_titles": [e.title for e in updated_entries[:5]],
        }

    def _load_existing_fingerprints(self) -> Dict[str, str]:
        existing: Dict[str, str] = {}
        if not os.path.exists(self.knowledge_path):
            return existing
        try:
            with open(self.knowledge_path, 'r', encoding='utf-8') as f:
                content = f.read()
            sections = content.split('=' * 60)
            for section in sections:
                title_match = re.search(r'【疾病】([^\n]+)', section)
                if not title_match:
                    continue
                title = title_match.group(1)
                fingerprint = hashlib.md5(section.encode('utf-8')).hexdigest()
                existing[title] = fingerprint
        except Exception as e:
            print(f"[警告] 加载知识库指纹失败: {e}")
        return existing

    def save_entries_to_knowledge_base(
            self, entries: List[RawKnowledgeEntry], knowledge_path: Optional[str] = None
    ) -> int:
        path = knowledge_path or self.knowledge_path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        saved_count = 0
        with open(path, 'a', encoding='utf-8', newline='') as f:
            for entry in entries:
                text = entry.to_knowledge_text()
                if text:
                    f.write("\n" + "=" * 60 + "\n")
                    f.write(text + "\n")
                    f.write("=" * 60 + "\n")
                    f.flush()
                    saved_count += 1
        return saved_count