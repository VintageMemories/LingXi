"""
A+医学百科数据源适配器
"""
import asyncio
from typing import AsyncGenerator, Dict, Optional

from .base import DataSourceAdapter, DataSourceConfig, DataSourceType, RawKnowledgeEntry


class AHospitalAdapter(DataSourceAdapter):
    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self.base_url = config.options.get("base_url", "https://www.a-hospital.com")
        self.delay = config.options.get("delay", 1.0)
        self.list_urls = config.options.get("list_urls", ["https://www.a-hospital.com/w/疾病列表"])

    def validate_config(self) -> bool:
        return bool(self.base_url and self.list_urls)

    async def fetch_entries(self) -> AsyncGenerator[RawKnowledgeEntry, None]:
        from .spider import AHospitalSpider

        spider = AHospitalSpider(base_url=self.base_url, delay=self.delay)

        for list_url in self.list_urls:
            links = await asyncio.to_thread(spider.get_disease_links, list_url)
            for url in links:
                soup = await asyncio.to_thread(spider.fetch, url)
                if not soup:
                    continue
                raw_data = await asyncio.to_thread(spider.parse_disease, soup, url)
                entry = self._convert_to_entry(raw_data)
                if entry and entry.title:
                    yield entry

    def _convert_to_entry(self, raw_data: Dict) -> Optional[RawKnowledgeEntry]:
        if not raw_data.get("title"):
            return None
        content_parts = []
        for field_name in ["summary", "etiology", "symptoms", "diagnosis", "treatment", "prevention"]:
            if raw_data.get(field_name):
                content_parts.append(raw_data[field_name])
        if not content_parts and raw_data.get("raw_text"):
            content_parts.append(raw_data["raw_text"])
        return RawKnowledgeEntry(
            title=raw_data["title"],
            content="\n\n".join(content_parts),
            domain=self.config.domain,
            category="疾病",
            summary=raw_data.get("summary", ""),
            etiology=raw_data.get("etiology", ""),
            symptoms=raw_data.get("symptoms", ""),
            diagnosis=raw_data.get("diagnosis", ""),
            treatment=raw_data.get("treatment", ""),
            prevention=raw_data.get("prevention", ""),
            source="A+医学百科",
            source_url=raw_data.get("url", ""),
            tags=["疾病", "医学百科"],
        )

    def get_metadata(self) -> Dict:
        return {
            "name": "A+医学百科",
            "description": "A+医学百科疾病数据爬虫",
            "source_type": DataSourceType.WEB_SCRAPER.value,
            "domain": self.config.domain,
            "base_url": self.base_url,
            "list_urls": self.list_urls,
            "delay": self.delay,
            "supports_incremental": False,
        }