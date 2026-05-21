"""
意图分类器
加载本地 ONNX 模型，通过零样本分类判断用户意图
"""
import os
import numpy as np
from typing import Optional, Dict, List, Tuple
import onnxruntime as ort
from transformers import AutoTokenizer

_MODEL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "models", "multilingual-e5-small"
)

_MODEL_PATH = os.path.join(_MODEL_DIR, "onnx", "model_quantized.onnx")

# 全局实例（懒加载）
_tokenizer = None
_session = None


def _get_tokenizer():
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = AutoTokenizer.from_pretrained(_MODEL_DIR)
    return _tokenizer


def _get_session():
    global _session
    if _session is None:
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        _session = ort.InferenceSession(_MODEL_PATH, sess_options, providers=['CPUExecutionProvider'])
    return _session


def _mean_pooling(token_embeddings: np.ndarray, attention_mask: np.ndarray) -> np.ndarray:
    input_mask_expanded = np.expand_dims(attention_mask, axis=-1)
    input_mask_expanded = np.broadcast_to(input_mask_expanded, token_embeddings.shape)
    sum_embeddings = np.sum(token_embeddings * input_mask_expanded, axis=1)
    sum_mask = np.clip(np.sum(input_mask_expanded, axis=1), a_min=1e-9, a_max=None)
    return sum_embeddings / sum_mask


def _encode(texts: List[str]) -> np.ndarray:
    tokenizer = _get_tokenizer()
    session = _get_session()

    encoded = tokenizer(texts, padding=True, truncation=True, max_length=512, return_tensors="np")
    ort_inputs = {
        "input_ids": encoded["input_ids"],
        "attention_mask": encoded["attention_mask"],
    }
    input_names = [inp.name for inp in session.get_inputs()]
    if "token_type_ids" in input_names:
        ort_inputs["token_type_ids"] = encoded.get("token_type_ids",
                                                   np.zeros_like(encoded["input_ids"]))

    outputs = session.run(None, ort_inputs)
    token_embeddings = outputs[0]
    embeddings = _mean_pooling(token_embeddings, encoded["attention_mask"])
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    return embeddings / np.clip(norms, a_min=1e-9, a_max=None)


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.dot(a, b.T)


def classify(
        query: str,
        labels: Optional[List[Tuple[str, str]]] = None
) -> Dict:
    from core.intent.labels import ALL_LABELS as _default_labels

    if labels is None:
        labels = _default_labels

    label_ids = [l[0] for l in labels]
    label_texts = [l[1] for l in labels]

    query_prefixed = f"query: {query}"
    label_prefixed = [f"passage: {t}" for t in label_texts]

    query_vec = _encode([query_prefixed])
    label_vecs = _encode(label_prefixed)

    scores = _cosine_similarity(query_vec, label_vecs)[0]
    best_idx = int(np.argmax(scores))

    exp_scores = np.exp(scores - np.max(scores))
    confidence = float(exp_scores[best_idx] / np.sum(exp_scores))

    return {
        "intent": label_ids[best_idx],
        "description": label_texts[best_idx],
        "confidence": confidence,
        "scores": {label_ids[i]: float(scores[i]) for i in range(len(labels))},
    }

def warmup():
    """服务启动时调用，提前加载模型和分词器，避免首次请求延迟"""
    print("[Intent] 正在加载意图分类模型...")
    _get_tokenizer()
    _get_session()
    # 跑一次空推理触发 JIT 优化
    _encode(["预热测试"])
    print("[Intent] 模型加载完成")