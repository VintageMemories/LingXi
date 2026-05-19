"""
数据处理管道
负责去重、过滤、验证
"""

import json
import os
import shutil
from typing import List, Dict, Set


class URLPipeline:
    """URL 去重管道"""
    
    def __init__(self, record_path: str):
        self.record_path = record_path
        self.processed_urls: Set[str] = self._load_processed()
    
    def _load_processed(self) -> Set[str]:
        """加载已处理的 URL"""
        if os.path.exists(self.record_path):
            try:
                with open(self.record_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return set(data)
            except (json.JSONDecodeError, FileNotFoundError):
                return set()
        return set()
    
    def save(self):
        """原子保存进度，防止断电损坏"""
        os.makedirs(os.path.dirname(self.record_path), exist_ok=True)
        temp_file = self.record_path + ".tmp"
        
        # 写入临时文件并强制刷新到磁盘
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(list(self.processed_urls), f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        
        # 原子替换
        if os.path.exists(self.record_path):
            os.remove(self.record_path)
        shutil.move(temp_file, self.record_path)
    
    def is_processed(self, url: str) -> bool:
        return url in self.processed_urls
    
    def mark_processed(self, url: str):
        self.processed_urls.add(url)
    
    def filter_new_urls(self, urls: List[str]) -> List[str]:
        return [url for url in urls if not self.is_processed(url)]


class DataPipeline:
    """数据过滤管道"""
    
    @staticmethod
    def filter_valid(data_list: List[Dict]) -> List[Dict]:
        """过滤有效数据"""
        valid = []
        for data in data_list:
            if not data.get('title'):
                continue
            
            has_content = any([
                data.get('summary'),
                data.get('etiology'),
                data.get('symptoms'),
                data.get('treatment'),
                data.get('raw_text')
            ])
            
            if has_content:
                valid.append(data)
        
        return valid
    
    @staticmethod
    def deduplicate(data_list: List[Dict]) -> List[Dict]:
        """按标题去重"""
        seen_titles = set()
        unique = []
        
        for data in data_list:
            title = data.get('title', '')
            if title and title not in seen_titles:
                seen_titles.add(title)
                unique.append(data)
        
        return unique