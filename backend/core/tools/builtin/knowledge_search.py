"""
知识库检索工具
调用 VectorRetriever（BGE-M3 混合检索），支持结构化切块与磁盘索引加载
"""
import os
import re
from typing import Dict, Any, List
from ..base import BaseTool


MEDICAL_SECTIONS = [
    "疾病", "概述", "病因", "症状", "诊断", "治疗", "预防",
    "药物", "手术", "检查", "科室", "急救", "副作用", "禁忌",
    "相互作用", "用法用量", "适应症", "并发症", "护理", "康复",
    "预后", "流行病学", "病理", "生理", "分类", "定义", "鉴别诊断"
]


class KnowledgeSearchTool(BaseTool):
    _retriever = None

    @classmethod
    def _init_retriever(cls):
        if cls._retriever is not None:
            return
        try:
            from core.retrieval.vector import VectorRetriever

            cls._retriever = VectorRetriever()

            index_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
                "data", "index"
            )

            if os.path.exists(os.path.join(index_dir, "dense.npy")):
                if cls._retriever.load_index(index_dir):
                    cls._retriever._load_model()  # 确保模型已加载，用于后续查询
                    print(f"[KnowledgeSearch] 已从磁盘加载索引，共 {len(cls._retriever.documents)} 个 Chunk")
                    return

            # 索引不存在，在线构建（首次启动或离线脚本调用时）
            knowledge_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
                "data", "medical_knowledge.txt"
            )
            if not os.path.exists(knowledge_path):
                print(f"[KnowledgeSearch] 知识库文件不存在: {knowledge_path}")
                return
            documents = cls._load_and_chunk(knowledge_path)
            if not documents:
                print("[KnowledgeSearch] 知识库文件为空或无有效条目")
                return
            cls._retriever.index(documents)
            print(f"[KnowledgeSearch] 在线构建索引完成，共 {len(documents)} 个 Chunk")

        except Exception as e:
            print(f"[KnowledgeSearch] 初始化检索器失败: {e}")

    @classmethod
    def _build_index(cls):
        """供离线脚本调用，完成切块、索引构建并保存到磁盘"""
        from core.retrieval.vector import VectorRetriever

        knowledge_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
            "data", "medical_knowledge.txt"
        )
        documents = cls._load_and_chunk(knowledge_path)
        retriever = VectorRetriever()
        retriever.index(documents)

        index_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
            "data", "index"
        )
        retriever.save_index(index_dir)
        print(f"[KnowledgeSearch] 索引已保存到 {index_dir}")

    @classmethod
    def get_retriever(cls):
        """返回已初始化的检索器实例，供外部直接调用"""
        cls._init_retriever()
        return cls._retriever

    @classmethod
    def _load_and_chunk(cls, path: str) -> List[Dict[str, Any]]:
        chunks = []
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            raw_entries = content.split("=" * 60)
            for entry in raw_entries:
                entry = entry.strip()
                if not entry:
                    continue
                chunks.extend(cls._chunk_entry(entry))
        except Exception as e:
            print(f"[KnowledgeSearch] 解析知识库文件失败: {e}")
        return chunks

    @classmethod
    def _chunk_entry(cls, entry_text: str) -> List[Dict[str, Any]]:
        has_markers = any(f"【{s}】" in entry_text for s in MEDICAL_SECTIONS)
        if has_markers:
            return cls._chunk_by_sections(entry_text)
        else:
            return cls._chunk_by_paragraphs(entry_text)

    @classmethod
    def _chunk_by_sections(cls, entry_text: str) -> List[Dict[str, Any]]:
        chunks = []

        # --- 1. 专门提取【疾病】字段内容作为主标题 ---
        main_title = ""
        disease_pattern = "【疾病】"
        if disease_pattern in entry_text:
            start = entry_text.find(disease_pattern) + len(disease_pattern)
            remaining = entry_text[start:]
            # 找到【疾病】内容结束的位置（下一个字段标记）
            next_positions = []
            for sec in MEDICAL_SECTIONS:
                pos = remaining.find(f"【{sec}】")
                if pos > 0:  # 注意：是下一个字段，所以位置必须大于0
                    next_positions.append(pos)
            end = min(next_positions) if next_positions else len(remaining)
            disease_content = remaining[:end].strip()
            if disease_content:
                # 取疾病内容的前80字作为主标题，去除换行符
                main_title = disease_content.replace("\n", " ").strip()[:80]

        # --- 2. 遍历所有字段，生成Chunk ---
        for section in MEDICAL_SECTIONS:
            pattern = f"【{section}】"
            if pattern not in entry_text:
                continue

            start = entry_text.find(pattern) + len(pattern)
            remaining = entry_text[start:]
            next_positions = []
            for other_sec in MEDICAL_SECTIONS:
                pos = remaining.find(f"【{other_sec}】")
                if pos >= 0:
                    next_positions.append(pos)
            end = min(next_positions) if next_positions else len(remaining)
            content = remaining[:end].strip()

            if content:
                # --- 3. 关键修改：重写标题 ---
                if main_title:
                    # 如果有主标题，生成 "疾病名 - 字段" 的标题
                    chunk_title = f"{main_title} - {section}"
                else:
                    # 没有主标题（只有【概述】），沿用旧逻辑
                    chunk_title = section

                chunks.append({
                    "title": chunk_title,
                    "content": content,
                    "source": "medical_knowledge"
                })
        return chunks

    @classmethod
    def _chunk_by_paragraphs(cls, entry_text: str) -> List[Dict[str, Any]]:
        paragraphs = [p.strip() for p in entry_text.split("\n\n") if p.strip()]
        chunks = []
        buffer = ""
        for p in paragraphs:
            if len(buffer) + len(p) < 500:
                buffer += p + "\n"
            else:
                if buffer:
                    chunks.append({"title": "", "content": buffer.strip(), "source": "medical_knowledge"})
                buffer = p + "\n"
        if buffer:
            chunks.append({"title": "", "content": buffer.strip(), "source": "medical_knowledge"})
        for chunk in chunks:
            if not chunk["title"]:
                chunk["title"] = chunk["content"][:50]
        return chunks

    @property
    def name(self) -> str:
        return "knowledge_search"

    @property
    def description(self) -> str:
        return "搜索专业知识库，根据当前领域自动检索相关知识，返回与查询匹配的条目。"

    @property
    def domain(self) -> str:
        return "builtin"

    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = params.get("query", "")
        retry_count = params.get("retry_count", 0)

        if not query:
            return {"status": "failed", "data": "请提供搜索内容"}

        self._init_retriever()
        if self._retriever is None:
            return {"status": "failed", "data": "知识库尚未初始化，请先导入数据"}

        try:
            results = self._retriever.search(query, top_k=5)

            # 动态阈值：首次严格，后续逐渐放宽
            base_threshold = 0.3
            dynamic_threshold = max(0.1, base_threshold - retry_count * 0.1)  # 每次重试降低 0.1，最低 0.1

            if not results or results[0].get("score", 0) < dynamic_threshold:
                return {"status": "success", "data": "未找到相关内容，建议调整关键词或查询其他来源。"}

            lines = []
            for i, r in enumerate(results):
                title = r.get("title", "无标题")
                content = r.get("content", "")[:500]
                lines.append(f"[{i+1}] {title}\n{content}")

            return {"status": "success", "data": "\n\n".join(lines)}
        except Exception as e:
            return {"status": "failed", "data": f"知识库检索失败: {str(e)}"}