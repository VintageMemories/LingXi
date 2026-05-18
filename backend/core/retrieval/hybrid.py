"""
Hybrid retrieval combining BM25 + Vector with RRF.
"""
from typing import List, Dict, Any, Optional

from core.retrieval.bm25 import BM25Retriever
from core.retrieval.vector import VectorRetriever


class HybridRetriever:
    def __init__(self, bm25_weight: float = 0.6, vector_weight: float = 0.4, rrf_k: int = 60):
        self.bm25 = BM25Retriever()
        self.vector = VectorRetriever()
        self.bm25_weight = bm25_weight
        self.vector_weight = vector_weight
        self.rrf_k = rrf_k

    def index(self, documents: List[Dict[str, Any]]):
        self.bm25.index(documents)
        self.vector.index(documents)

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self.bm25.documents and not self.vector.documents:
            return []
        fetch_k = min(top_k * 3, 20)
        bm25_results = self.bm25.search(query, top_k=fetch_k)
        vector_results = self.vector.search(query, top_k=fetch_k)

        doc_scores: Dict[str, float] = {}
        doc_data: Dict[str, Dict[str, Any]] = {}

        for rank, result in enumerate(bm25_results):
            key = result["title"]
            rrf_score = self.bm25_weight / (self.rrf_k + rank + 1)
            doc_scores[key] = doc_scores.get(key, 0) + rrf_score
            doc_data[key] = result

        for rank, result in enumerate(vector_results):
            key = result["title"]
            rrf_score = self.vector_weight / (self.rrf_k + rank + 1)
            doc_scores[key] = doc_scores.get(key, 0) + rrf_score
            if key not in doc_data:
                doc_data[key] = result

        sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
        results = []
        for key, score in sorted_docs[:top_k]:
            result = doc_data[key].copy()
            result["score"] = score
            result["source"] = "hybrid"
            results.append(result)
        return results