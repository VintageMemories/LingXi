"""
数据解析与清洗模块
"""

import re
from typing import Dict


class DiseaseParser:
    """疾病数据解析器"""
    
    @staticmethod
    def clean_text(text: str) -> str:
        """清洗文本"""
        if not text:
            return ""
        
        text = re.sub(r'\[\d+\]', '', text)
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    @staticmethod
    def to_knowledge_text(data: Dict) -> str:
        """将疾病数据转换为知识库文本格式"""
        parts = []
        
        if data.get('title'):
            parts.append(f"【疾病】{data['title']}")
        
        if data.get('summary'):
            parts.append(f"【概述】{data['summary']}")
        
        if data.get('etiology'):
            parts.append(f"【病因】{data['etiology']}")
        
        if data.get('symptoms'):
            parts.append(f"【症状】{data['symptoms']}")
        
        if data.get('diagnosis'):
            parts.append(f"【诊断】{data['diagnosis']}")
        
        if data.get('treatment'):
            parts.append(f"【治疗】{data['treatment']}")
        
        if data.get('prevention'):
            parts.append(f"【预防】{data['prevention']}")
        
        if data.get('raw_text') and not any([data.get(k) for k in ['summary', 'etiology', 'symptoms']]):
            parts.append(f"【内容】{data['raw_text']}")
        
        return '\n'.join(parts)