"""
BM25 retrieval implementation using scikit-learn's TfidfVectorizer.
"""
import math
from typing import List, Dict, Any, Optional

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class BM25Retriever:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.doc_matrix: Optional[np.ndarray] = None
        self.documents: List[Dict[str, Any]] = []
        self.avg_doc_len: float = 0.0

    def index(self, documents: List[Dict[str, Any]]):
        self.documents = documents
        if not documents:
            return
        texts = [f"{doc.get('title', '')} {doc.get('content', '')}" for doc in documents]
        self.avg_doc_len = np.mean([len(t) for t in texts]) if texts else 1.0
        self.vectorizer = TfidfVectorizer(lowercase=True, max_features=10000, ngram_range=(1, 2))
        self.doc_matrix = self.vectorizer.fit_transform(texts)

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self.vectorizer or not self.documents:
            return []
        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.doc_matrix).flatten()
        doc_lengths = np.array([len(f"{doc.get('title', '')} {doc.get('content', '')}") for doc in self.documents])
        norm_factors = (self.k1 * (1 - self.b + self.b * doc_lengths / max(self.avg_doc_len, 1)))
        bm25_scores = similarities * norm_factors / (similarities + norm_factors)
        top_indices = np.argsort(bm25_scores)[::-1][:top_k]
        results = []
        for idx in top_indices:
            if bm25_scores[idx] > 0:
                doc = self.documents[idx]
                results.append({
                    "title": doc.get("title", ""),
                    "content": doc.get("content", ""),
                    "source": doc.get("source", "bm25"),
                    "score": float(bm25_scores[idx]),
                })
        return results