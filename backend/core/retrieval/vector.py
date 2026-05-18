"""
Vector retrieval module.
"""
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class VectorRetriever:
    def __init__(self):
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.doc_matrix: Optional[np.ndarray] = None
        self.documents: List[Dict[str, Any]] = []

    def index(self, documents: List[Dict[str, Any]]):
        self.documents = documents
        if not documents:
            return
        texts = [f"{doc.get('title', '')} {doc.get('content', '')}" for doc in documents]
        self.vectorizer = TfidfVectorizer(lowercase=True, max_features=5000, ngram_range=(1, 1))
        self.doc_matrix = self.vectorizer.fit_transform(texts)

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not self.vectorizer or not self.documents:
            return []
        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.doc_matrix).flatten()
        top_indices = np.argsort(similarities)[::-1][:top_k]
        results = []
        for idx in top_indices:
            if similarities[idx] > 0:
                doc = self.documents[idx]
                results.append({
                    "title": doc.get("title", ""),
                    "content": doc.get("content", ""),
                    "source": doc.get("source", "vector"),
                    "score": float(similarities[idx]),
                })
        return results