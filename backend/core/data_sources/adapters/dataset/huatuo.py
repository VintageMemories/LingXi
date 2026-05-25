"""
华佗-26M 数据源适配器
"""
import asyncio
import ssl
import os
from typing import AsyncGenerator, Dict

# ====== 必须在导入 datasets 前设置 ======
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
os.environ['HF_HUB_ENABLE_HTTP1'] = '1'
ssl._create_default_https_context = ssl._create_unverified_context
# =======================================

from core.data_sources.base import DataSourceAdapter
from core.data_sources.config import DataSourceConfig, DataSourceType
from core.data_sources.entry import RawKnowledgeEntry


class HuatuoAdapter(DataSourceAdapter):
    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self.dataset_name = config.options.get("dataset_name", "FreedomIntelligence/huatuo_knowledge_graph_qa")
        self.split = config.options.get("split", "train")
        self.max_entries = config.max_entries

    def validate_config(self) -> bool:
        try:
            from datasets import load_dataset
            return True
        except ImportError:
            return False

    async def fetch_entries(self) -> AsyncGenerator[RawKnowledgeEntry, None]:
        from datasets import load_dataset

        dataset = load_dataset(self.dataset_name, split=self.split, streaming=True)
        count = 0

        def _collect_all():
            results = []
            nonlocal count
            for item in dataset:
                if self.max_entries and count >= self.max_entries:
                    break
                q = (item.get("questions") or [""])[0]
                a = (item.get("answers") or [""])[0]
                if not q or not a:
                    continue
                entry = RawKnowledgeEntry(
                    title=q[:50] + ("..." if len(q) > 50 else ""),
                    content=f"问：{q}\n答：{a}",
                    domain=self.config.domain,
                    category="问答",
                    summary=a[:200] if len(a) > 200 else a,
                    source="华佗-26M",
                    source_id=f"huatuo_{count}",
                    tags=["问答", "华佗", "医学知识图谱"],
                )
                results.append(entry)
                count += 1
            return results

        all_entries = await asyncio.to_thread(_collect_all)
        for entry in all_entries:
            yield entry

    def get_metadata(self) -> Dict:
        return {
            "name": "huatuo",
            "description": "华佗医学知识图谱问答数据集",
            "source_type": DataSourceType.DATASET.value,
            "domain": self.config.domain,
            "supports_incremental": True,
        }

    def supports_incremental(self) -> bool:
        return True