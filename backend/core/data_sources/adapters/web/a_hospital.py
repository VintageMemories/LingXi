"""
A+医学百科数据源适配器
"""
import asyncio
from typing import AsyncGenerator, Dict, Optional

from core.data_sources.base import DataSourceAdapter
from core.data_sources.config import DataSourceConfig, DataSourceType
from core.data_sources.entry import RawKnowledgeEntry
from core.data_sources.adapters.web.base_spider import BaseSpider


class AHospitalAdapter(DataSourceAdapter):
    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self.base_url = config.options.get("base_url", "https://www.a-hospital.com")
        self.delay = config.options.get("delay", 1.0)
        self.list_urls = config.options.get(
            "list_urls",
            [
                "https://www.a-hospital.com/w/%E7%96%BE%E7%97%85%E5%88%86%E7%B1%BB",
                "https://www.a-hospital.com/w/%E7%96%BE%E7%97%85%E5%88%97%E8%A1%A8",
                "https://www.a-hospital.com/index.php/%E7%96%BE%E7%97%85%E5%88%97%E8%A1%A8"
            ],
        )

    def validate_config(self) -> bool:
        return bool(self.base_url and self.list_urls)

    async def fetch_entries(self) -> AsyncGenerator[RawKnowledgeEntry, None]:
        spider = BaseSpider(base_url=self.base_url, delay=self.delay)
        section_map = {
            '概述': 'summary', '简介': 'summary',
            '病因': 'etiology', '发病': 'etiology',
            '症状': 'symptoms', '表现': 'symptoms',
            '诊断': 'diagnosis', '检查': 'diagnosis',
            '治疗': 'treatment',
            '预防': 'prevention',
        }
        blacklist = ["首页", "疾病列表", "疾病分类", "常见疾病", "分类", "列表", "A+医学百科"]

        # 如果列表页获取失败，尝试从常见疾病列表页获取链接
        for list_url in self.list_urls:
            soup = await asyncio.to_thread(spider.fetch, list_url)
            if soup:
                # 直接从列表页提取链接
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    text = link.text.strip()
                    if '/index.php/' in href or '/w/' in href:
                        if ':' not in href and text not in blacklist and len(text) > 1:
                            full_url = self.base_url + href if href.startswith('/') else href
                            if full_url not in spider.visited_urls:
                                spider.visited_urls.add(full_url)
                                page_soup = await asyncio.to_thread(spider.fetch, full_url)
                                if page_soup:
                                    data = await asyncio.to_thread(spider.parse_sections, page_soup, section_map)
                                    data['url'] = full_url
                                    entry = self._to_entry(data)
                                    if entry and entry.title:
                                        yield entry
        else:
            # 如果列表页获取失败，尝试使用备用方案：直接尝试一些常见疾病URL
            if not soup:
                # 备用URL列表（通过首页可能链接到的疾病页面）
                backup_urls = [
                    "https://www.a-hospital.com/w/%E9%AB%98%E8%A1%80%E5%8E%8B",
                    "https://www.a-hospital.com/w/%E7%B3%96%E5%B0%BF%E7%97%85",
                    "https://www.a-hospital.com/w/%E5%86%A0%E5%BF%83%E7%97%85",
                ]
                for url in backup_urls:
                    page_soup = await asyncio.to_thread(spider.fetch, url)
                    if page_soup:
                        data = await asyncio.to_thread(spider.parse_sections, page_soup, section_map)
                        data['url'] = url
                        entry = self._to_entry(data)
                        if entry and entry.title:
                            yield entry

    def _to_entry(self, data: Dict) -> Optional[RawKnowledgeEntry]:
        if not data.get("title"):
            return None
        content_parts = []
        for field in ["summary", "etiology", "symptoms", "diagnosis", "treatment", "prevention"]:
            if data.get(field):
                content_parts.append(data[field])
        if not content_parts and data.get("raw_text"):
            content_parts.append(data["raw_text"])
        return RawKnowledgeEntry(
            title=data["title"],
            content="\n\n".join(content_parts),
            domain=self.config.domain,
            category="疾病",
            summary=data.get("summary", ""),
            etiology=data.get("etiology", ""),
            symptoms=data.get("symptoms", ""),
            diagnosis=data.get("diagnosis", ""),
            treatment=data.get("treatment", ""),
            prevention=data.get("prevention", ""),
            source="A+医学百科",
            source_url=data.get("url", ""),
            tags=["疾病", "医学百科"],
        )

    def get_metadata(self) -> Dict:
        return {
            "name": "a_hospital",
            "description": "A+医学百科疾病数据爬虫",
            "source_type": DataSourceType.WEB_SCRAPER.value,
            "domain": self.config.domain,
            "supports_incremental": False,
        }