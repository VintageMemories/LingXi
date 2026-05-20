"""
统一知识库导入管道
"""
from typing import List, Dict, Optional

from core.data_sources.base import DataSourceAdapter
from core.data_sources.config import DataSourceConfig
from core.data_sources.entry import RawKnowledgeEntry
from core.data_sources.registry import DataSourceRegistry
from core.data_sources.pipeline.dedup import compute_fingerprint, load_existing_fingerprints
from core.data_sources.pipeline.writer import append_to_knowledge_file


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
            raise ValueError(f"未知数据源: '{source_name}'")
        if not adapter.validate_config():
            raise ValueError(f"数据源配置无效: {source_name}")

        if existing_fingerprints is None:
            existing_fingerprints = load_existing_fingerprints(self.knowledge_path)

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
        all_to_save = new_entries + updated_entries
        if all_to_save:
            append_to_knowledge_file(all_to_save, self.knowledge_path)

        return {
            "source": source_name,
            "metadata": adapter.get_metadata(),
            "stats": {**self.stats},
            "new_entries": len(new_entries),
            "updated_entries": len(updated_entries),
            "new_entry_titles": [e.title for e in new_entries[:10]],
            "updated_entry_titles": [e.title for e in updated_entries[:5]],
        }