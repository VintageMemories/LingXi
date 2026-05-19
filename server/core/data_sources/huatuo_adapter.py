"""
华佗-26M 数据源适配器
"""
import asyncio
import ssl
import os
from typing import AsyncGenerator, Dict, Optional

from .base import DataSourceAdapter, DataSourceConfig, DataSourceType, RawKnowledgeEntry


class HuatuoAdapter(DataSourceAdapter):
    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self.dataset_name = config.options.get("dataset_name", "FreedomIntelligence/huatuo_knowledge_graph_qa")
        self.split = config.options.get("split", "train")
        self.max_entries = config.max_entries

    def validate_config(self) -> bool:
        try:
            from datasets import load_dataset  # noqa: F401
            return True
        except ImportError:
            return False

    async def fetch_entries(self) -> AsyncGenerator[RawKnowledgeEntry, None]:
        os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
        ssl._create_default_https_context = ssl._create_unverified_context

        from datasets import load_dataset

        dataset = load_dataset(self.dataset_name, split=self.split, streaming=True)

        count = 0
        def _iterate():
            nonlocal count
            for item in dataset:
                if self.max_entries and count >= self.max_entries:
                    break
                questions = item.get("questions", [])
                answers = item.get("answers", [])
                question = questions[0] if questions else ""
                answer = answers[0] if answers else ""
                if not question or not answer:
                    continue
                entry = RawKnowledgeEntry(
                    title=question[:50] + ("..." if len(question) > 50 else ""),
                    content=f"问：{question}\n答：{answer}",
                    domain=self.config.domain,
                    category="问答",
                    summary=answer[:200] if len(answer) > 200 else answer,
                    source="华佗-26M",
                    source_id=f"huatuo_{count}",
                    tags=["问答", "华佗", "医学知识图谱"],
                )
                count += 1
                yield entry

        iterator = _iterate()
        while True:
            try:
                entry = await asyncio.to_thread(next, iterator)
                yield entry
            except StopIteration:
                break

    def get_metadata(self) -> Dict:
        return {
            "name": "华佗-26M",
            "description": "华佗医学知识图谱问答数据集",
            "source_type": DataSourceType.DATASET.value,
            "domain": self.config.domain,
            "dataset_name": self.dataset_name,
            "split": self.split,
            "max_entries": self.max_entries,
            "supports_incremental": True,
        }

    def supports_incremental(self) -> bool:
        return True