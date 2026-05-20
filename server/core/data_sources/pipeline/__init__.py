"""
导入管道模块
提供可组合的去重、写入策略
"""
from .importer import ImportPipeline
from .dedup import compute_fingerprint