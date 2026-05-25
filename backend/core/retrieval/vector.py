"""
向量检索 + 稀疏权重检索，基于 BGE-M3 的 FlagEmbedding
"""
from typing import List, Dict, Any, Optional
import numpy as np
import os
import json
from sklearn.metrics.pairwise import cosine_similarity


class VectorRetriever:
    def __init__(self):
        self.model = None
        self.dense_embeddings: Optional[np.ndarray] = None      # 稠密向量
        self.sparse_embeddings: Optional[List[Dict[int, float]]] = None  # 稀疏词权重
        self.documents: List[Dict[str, Any]] = []

    def _load_model(self):
        if self.model is None:
            from FlagEmbedding import BGEM3FlagModel
            self.model = BGEM3FlagModel("./models/bge-m3", use_fp16=False)

    def index(self, documents: List[Dict[str, Any]]):
        self.documents = documents
        if not documents:
            return
        self._load_model()
        texts = [f"{doc.get('title', '')} {doc.get('content', '')}" for doc in documents]
        output = self.model.encode(
            texts, batch_size=24, max_length=512,
            return_dense=True, return_sparse=True
        )
        self.dense_embeddings = output["dense_vecs"]
        self.sparse_embeddings = output["lexical_weights"]

    def save_index(self, save_dir: str):
        os.makedirs(save_dir, exist_ok=True)
        np.save(os.path.join(save_dir, "dense.npy"), self.dense_embeddings)
        # 稀疏权重存储为 JSON
        sparse_list = [ {int(k): float(v) for k, v in w.items()} for w in self.sparse_embeddings ]
        with open(os.path.join(save_dir, "sparse.json"), "w", encoding="utf-8") as f:
            json.dump(sparse_list, f, ensure_ascii=False)
        with open(os.path.join(save_dir, "documents.json"), "w", encoding="utf-8") as f:
            json.dump(self.documents, f, ensure_ascii=False, indent=2)

    def load_index(self, save_dir: str) -> bool:
        dense_path = os.path.join(save_dir, "dense.npy")
        sparse_path = os.path.join(save_dir, "sparse.json")
        docs_path = os.path.join(save_dir, "documents.json")
        if not all(os.path.exists(p) for p in [dense_path, sparse_path, docs_path]):
            return False
        self.dense_embeddings = np.load(dense_path)
        with open(sparse_path, "r", encoding="utf-8") as f:
            sparse_list = json.load(f)
            self.sparse_embeddings = [{int(k): v for k, v in w.items()} for w in sparse_list]
        with open(docs_path, "r", encoding="utf-8") as f:
            self.documents = json.load(f)
        return True

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if self.model is None or self.dense_embeddings is None or self.sparse_embeddings is None:
            return []
        # 查询编码
        output = self.model.encode([query], return_dense=True, return_sparse=True)
        q_dense = output["dense_vecs"][0]
        q_sparse = output["lexical_weights"][0]

        # 稠密相似度
        dense_scores = cosine_similarity([q_dense], self.dense_embeddings)[0]

        # 稀疏分数 (内积)
        sparse_scores = np.zeros(len(self.documents))
        for i, doc_weights in enumerate(self.sparse_embeddings):
            score = 0.0
            for tid, w in q_sparse.items():
                if tid in doc_weights:
                    score += w * doc_weights[tid]
            sparse_scores[i] = score

        # 归一化后加权混合 (0.5 / 0.5)
        dense_max = dense_scores.max() + 1e-9
        sparse_max = sparse_scores.max() + 1e-9
        combined = 0.5 * (dense_scores / dense_max) + 0.5 * (sparse_scores / sparse_max)

        top_indices = np.argsort(combined)[::-1][:top_k]
        results = []
        for idx in top_indices:
            if combined[idx] > 0:
                doc = self.documents[idx]
                results.append({
                    "title": doc.get("title", ""),
                    "content": doc.get("content", ""),
                    "source": doc.get("source", "vector"),
                    "score": float(combined[idx]),
                })
        return results