"""
知识条目模型 + 指纹计算 + 格式化
"""
import hashlib
from dataclasses import dataclass, field
from typing import List, Dict


@dataclass
class RawKnowledgeEntry:
    title: str
    content: str
    domain: str = "medical"
    category: str = ""
    summary: str = ""
    etiology: str = ""
    symptoms: str = ""
    diagnosis: str = ""
    treatment: str = ""
    prevention: str = ""
    legal_basis: str = ""
    applicable_scope: str = ""
    risk_level: str = ""
    investment_type: str = ""
    source: str = ""
    source_url: str = ""
    source_id: str = ""
    tags: List[str] = field(default_factory=list)
    language: str = "zh"
    extra: Dict = field(default_factory=dict)

    def get_fingerprint_content(self) -> str:
        parts = [self.title, self.content, self.summary, self.etiology,
                 self.symptoms, self.diagnosis, self.treatment, self.prevention,
                 self.legal_basis, self.applicable_scope, self.risk_level,
                 self.investment_type]
        return "|".join(p for p in parts if p)

    def to_knowledge_text(self) -> str:
        parts = []
        if self.domain == "legal":
            prefix = "【法规】"
        elif self.domain == "finance":
            prefix = "【金融】"
        else:
            prefix = "【疾病】"

        field_map = [
            (prefix, self.title),
            ("【概述】", self.summary),
            ("【病因】", self.etiology),
            ("【症状】", self.symptoms),
            ("【诊断】", self.diagnosis),
            ("【治疗】", self.treatment),
            ("【预防】", self.prevention),
            ("【法律依据】", self.legal_basis),
            ("【适用范围】", self.applicable_scope),
            ("【风险等级】", self.risk_level),
            ("【投资类型】", self.investment_type),
        ]
        for label, value in field_map:
            if value:
                parts.append(f"{label}{value}")

        has_specific = any([self.summary, self.etiology, self.symptoms,
                            self.legal_basis, self.applicable_scope,
                            self.risk_level, self.investment_type])
        if self.content and not has_specific:
            parts.append(f"【内容】{self.content}")

        return "\n".join(parts)


def compute_fingerprint(entry: RawKnowledgeEntry) -> str:
    content = entry.get_fingerprint_content()
    return hashlib.md5(content.encode("utf-8")).hexdigest()