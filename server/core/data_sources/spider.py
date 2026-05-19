"""
A+医学百科爬虫核心类
功能：
1. 负责解析疾病列表和详情页。
2. 支持高效爬取，为后续知识库构建和导入提供数据。
3. User-Agent 动态轮换，避免被封禁。
"""

import time
import re
import random
from typing import List, Dict, Optional, Set
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import requests


# ==========================================================
# 全局配置
# ==========================================================
USER_AGENTS = [
    # 多个 User-Agent 轮换，降低被封风险
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]

class AHospitalSpider:
    """A+医学百科疾病爬虫"""
    
    def __init__(self, base_url: str = "https://www.a-hospital.com", delay: float = 1.0):
        """
        初始化爬虫工具
        
        参数：
            base_url: 起始网站，即目标网站
            delay: 每次请求的间隔（秒），防止过快访问
        """
        self.base_url = base_url
        self.delay = delay
        self.session = requests.Session()
        self.visited_urls: Set[str] = set()
        self._update_headers()
    
    def _update_headers(self):
        """动态更新请求头，设置随机的 User-Agent"""
        self.session.headers.update({
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
        })
    
    def fetch(self, url: str, max_retries: int = 3) -> Optional[BeautifulSoup]:
        """
        发送 HTTP 请求并获取页面内容
        
        参数：
            url: 目标地址
            max_retries: 请求出错时的最大重试次数
        
        返回：
            若成功，返回 BeautifulSoup 对象；若失败，返回 None。
        """
        for attempt in range(max_retries):
            time.sleep(self.delay)  # 加入请求间隔

            # 更新 User-Agent
            self._update_headers()

            try:
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                response.encoding = 'utf-8'
                return BeautifulSoup(response.text, 'html.parser')

            except requests.RequestException as e:
                print(f"[警告] 请求失败 (第 {attempt + 1}/{max_retries} 次): {e}")
                if attempt < max_retries - 1:
                    print(f"  等待 {5 * (attempt + 1)} 秒后重试...")
                    time.sleep(5 * (attempt + 1))
        
        print(f"[错误] 请求多次尝试失败：{url}")
        return None
    
    def get_disease_links(self, list_url: str) -> List[str]:
        """
        从疾病列表页提取所有疾病详情链接

        参数：
            list_url: 疾病分类页的链接

        返回：
            一个包含疾病详情页 URL 的列表
        """
        print(f"[列表] 获取疾病链接: {list_url}")
        soup = self.fetch(list_url)
        if not soup:
            return []

        # 病例分类过滤规则
        blacklist = [
            "首页", "疾病列表", "疾病分类", "常见疾病", "分类", "列表", "A+医学百科"
        ]
        
        links = []
        content_div = soup.find('div', id='bodyContent')
        if content_div:
            for link in content_div.find_all('a', href=True):
                href = link['href']
                link_text = link.text.strip()
                if href.startswith('/w/') and not ':' in href and link_text not in blacklist:
                    links.append(urljoin(self.base_url, href))
    
        print(f"  找到 {len(links)} 个疾病链接")
        return links

    def parse_disease(self, soup: BeautifulSoup, url: str) -> Dict:
        """
        解析疾病详情页面内容

        参数：
            soup: BeautifulSoup 页面对象
            url: 当���页面的链接，记录入爬取结果

        返回：
            表示疾病信息的字典
        """
        data = {
            'url': url,
            'title': '',
            'summary': '',
            'etiology': '',
            'symptoms': '',
            'diagnosis': '',
            'treatment': '',
            'prevention': '',
            'raw_text': ''
        }

        # 提取标题
        title_tag = soup.find('h1', id='firstHeading')
        if title_tag:
            data['title'] = title_tag.text.strip()
        
        # 提取内容
        content_div = soup.find('div', id='bodyContent')
        if not content_div:
            return data
        
        all_text_parts, current_section, section_content = [], None, []
        for element in content_div.find_all(['h2', 'h3', 'p', 'ul', 'ol']):
            if element.name in ['h2', 'h3']:
                if current_section and section_content:
                    data[current_section] = self._clean_text(' '.join(section_content))
                
                current_section = self._map_section(element.text.strip().lower())
                section_content = []
            
            elif current_section and element.name in ['p', 'ul', 'ol']:
                section_content.append(element.text.strip())

        if current_section and section_content:  # 保存最后的 section
            data[current_section] = self._clean_text(' '.join(section_content))
        if not any([data['summary'], data['etiology'], data['symptoms']]):
            data['raw_text'] = self._clean_text(' '.join(all_text_parts))
        
        return data

    def _map_section(self, header_text: str) -> Optional[str]:
        """对标题映射到预定义的字段"""
        if '概述' in header_text or '简介' in header_text:
            return 'summary'
        elif '病因' in header_text or '发病' in header_text:
            return 'etiology'
        elif '症状' in header_text or '表现' in header_text:
            return 'symptoms'
        elif '诊断' in header_text or '检查' in header_text:
            return 'diagnosis'
        elif '治疗' in header_text:
            return 'treatment'
        elif '预防' in header_text:
            return 'prevention'
        return None

    def _clean_text(self, text: str) -> str:
        """清理文本内容：去除引用、空格等"""
        return re.sub(r'\[\d+\]', '', text).strip()