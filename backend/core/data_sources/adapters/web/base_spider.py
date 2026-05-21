"""
通用网页爬虫基类
提供 UA 轮换、重试、HTML 解析等基础能力
"""

import time
import re
import random
from typing import List, Dict, Optional, Set
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import requests


USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]


class BaseSpider:
    """通用网页爬虫基类"""

    def __init__(self, base_url: str, delay: float = 1.0):
        self.base_url = base_url
        self.delay = delay
        self.session = requests.Session()
        self.visited_urls: Set[str] = set()
        self._update_headers()

    def _update_headers(self):
        self.session.headers.update({
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Connection': 'keep-alive',
        })

    def fetch(self, url: str, max_retries: int = 3) -> Optional[BeautifulSoup]:
        for attempt in range(max_retries):
            time.sleep(self.delay)
            self._update_headers()
            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                response.encoding = 'utf-8'
                return BeautifulSoup(response.text, 'html.parser')
            except requests.RequestException as e:
                print(f"[爬虫] 请求失败 (第 {attempt + 1}/{max_retries} 次): {e}")
                if attempt < max_retries - 1:
                    time.sleep(5 * (attempt + 1))
        print(f"[爬虫] 多次重试后仍失败: {url}")
        return None

    def get_links(self, list_url: str, prefix: str = '/w/', blacklist: Optional[List[str]] = None) -> List[str]:
        """从列表页提取链接"""
        soup = self.fetch(list_url)
        if not soup:
            return []
        blacklist = blacklist or []
        links = []
        content_div = soup.find('div', id='bodyContent')
        if content_div:
            for link in content_div.find_all('a', href=True):
                href = link['href']
                text = link.text.strip()
                if href.startswith(prefix) and ':' not in href and text not in blacklist:
                    links.append(urljoin(self.base_url, href))
        return links

    def parse_sections(self, soup: BeautifulSoup, section_map: Dict[str, str]) -> Dict[str, str]:
        """通用章节解析"""
        result = {key: '' for key in section_map.values()}
        result['raw_text'] = ''
        result['title'] = ''

        title_tag = soup.find('h1', id='firstHeading')
        if title_tag:
            result['title'] = title_tag.text.strip()

        content_div = soup.find('div', id='bodyContent')
        if not content_div:
            return result

        current_section = None
        section_content = []

        for element in content_div.find_all(['h2', 'h3', 'p', 'ul', 'ol']):
            if element.name in ['h2', 'h3']:
                if current_section and section_content:
                    result[current_section] = self._clean_text(' '.join(section_content))
                header_text = element.text.strip().lower()
                current_section = None
                for keyword, field in section_map.items():
                    if keyword in header_text:
                        current_section = field
                        break
                section_content = []
            elif current_section and element.name in ['p', 'ul', 'ol']:
                section_content.append(element.text.strip())

        if current_section and section_content:
            result[current_section] = self._clean_text(' '.join(section_content))

        return result

    def _clean_text(self, text: str) -> str:
        return re.sub(r'\[\d+\]', '', text).strip()


# 向后兼容别名
AHospitalSpider = BaseSpider