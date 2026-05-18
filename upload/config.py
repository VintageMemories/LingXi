"""
数据导入配置模块
"""
import os
import sys

_UPLOAD_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_UPLOAD_DIR)
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "backend")


class UploadSettings:
    DATA_DIR: str = os.path.join(_BACKEND_DIR, "data")
    KNOWLEDGE_FILE: str = os.path.join(DATA_DIR, "medical_knowledge.txt")
    A_HOSPITAL_BASE_URL: str = "https://www.a-hospital.com"
    A_HOSPITAL_DELAY: float = 1.0
    A_HOSPITAL_LIST_URLS: list = ["https://www.a-hospital.com/w/疾病列表"]
    HUATUO_DATASET_NAME: str = "FreedomIntelligence/huatuo_knowledge_graph_qa"
    HUATUO_SAVE_INTERVAL: int = 100
    RECORD_DIR: str = os.path.join(_UPLOAD_DIR, "record")
    FORBIDDEN_TERMS: list = ["自杀", "安乐死", "毒品", "过量服用"]

    @classmethod
    def get_backend_settings(cls):
        if _BACKEND_DIR not in sys.path:
            sys.path.insert(0, _BACKEND_DIR)
        from core.config import settings
        return settings


upload_settings = UploadSettings()