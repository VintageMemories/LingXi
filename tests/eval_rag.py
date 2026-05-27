import sys
import os
import json
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from eval_data import eval_dataset
from core.tools.builtin.knowledge_search import KnowledgeSearchTool


def run_evaluation():
    backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
    os.chdir(backend_dir)

    print("=" * 60)
    print("  RAG 系统离线评估 (基于 100 条华佗数据)")
    print("=" * 60)
    print()

    print("正在加载知识库索引...")
    KnowledgeSearchTool._init_retriever()
    retriever = KnowledgeSearchTool._retriever
    if retriever is None:
        print("错误: 检索器初始化失败，请先运行 build_index.py")
        return

    search_tool = KnowledgeSearchTool()

    # 按类别分组统计
    category_stats = defaultdict(lambda: {"total": 0, "hits": 0, "mrr_sum": 0.0})
    results_log = []
    safety_samples = []  # 单独收集安全样本

    for i, sample in enumerate(eval_dataset, 1):
        question = sample["question"]
        category = sample.get("category", "unknown")
        relevant_ids = set(sample.get("relevant_chunk_ids", []))
        is_negative = sample.get("negative", False) or category == "negative"

        # 安全样本：跳过检索评估，单独收集
        if category == "safety":
            safety_samples.append(sample)
            continue

        # 通过 execute 方法检索
        result = search_tool.execute({"query": question})
        data = result.get("data", "")

        rejection_phrases = ["未找到相关内容", "建议调整关键词或查询其他来源", "知识库中暂无相关信息"]
        is_rejected = any(phrase in data for phrase in rejection_phrases) if data else True

        hit = False
        best_rank = None

        if is_negative:
            hit = is_rejected
        else:
            if not is_rejected and data:
                import re
                matches = re.findall(r'\[\d+\]\s*(.+?)(?:\n|$)', data)
                retrieved_ids = [m.strip() for m in matches]
                if relevant_ids and any(rid in retrieved_ids for rid in relevant_ids):
                    hit = True
                    for rank, rid in enumerate(retrieved_ids, 1):
                        if rid in relevant_ids:
                            best_rank = rank
                            break

        stat = category_stats[category]
        stat["total"] += 1
        if hit:
            stat["hits"] += 1
            if best_rank:
                stat["mrr_sum"] += 1.0 / best_rank

        log_entry = {
            "id": i,
            "question": question,
            "category": category,
            "hit": hit,
            "best_rank": best_rank,
            "rejected": is_rejected,
            "response_preview": data[:200] if data else "（空）",
        }
        results_log.append(log_entry)

        status = "✅" if hit else "❌"
        print(f"[{i}/{len(eval_dataset)}] {status} [{category}] {question[:50]}...")

    # 输出分类评估报告
    print()
    print("=" * 60)
    print("  分类评估报告 (检索层)")
    print("=" * 60)
    for cat in ["positive", "negative", "boundary"]:
        stat = category_stats.get(cat)
        if not stat or stat["total"] == 0:
            continue
        hit_rate = stat["hits"] / stat["total"]
        mrr = stat["mrr_sum"] / stat["total"] if stat["total"] > 0 else 0
        label_map = {
            "positive": "正面样本 (应召回)",
            "negative": "负面样本 (应拒答)",
            "boundary": "边界样本 (复杂场景)"
        }
        print(f"\n  {label_map.get(cat, cat)}:")
        print(f"    样本数: {stat['total']}")
        print(f"    命中数: {stat['hits']}")
        metric_name = "拒答成功率" if cat == "negative" else "命中率"
        print(f"    {metric_name}: {hit_rate:.2%}")
        if cat == "positive":
            print(f"    MRR: {mrr:.4f}")

    # 安全样本说明
    if safety_samples:
        print()
        print("=" * 60)
        print("  安全样本 (应通过 SafetyGuard 拦截)")
        print("=" * 60)
        print(f"    样本数: {len(safety_samples)}")
        print("    说明: 安全样本需通过 SafetyGuard 单独测试，不计入检索评估。")
        print("    请在工具包中选择 [6] Test SafetyGuard 进行安全拦截测试。")

    # 保存详细报告
    report = {
        "summary": {
            "total_retrieval": len(eval_dataset) - len(safety_samples),
            "safety_samples_separate": len(safety_samples),
            "categories": {cat: {"total": s["total"], "hits": s["hits"], "success_rate": round(s["hits"]/s["total"], 4)} for cat, s in category_stats.items()}
        },
        "details": results_log,
        "safety_samples_note": "安全样本需通过 SafetyGuard 单独测试，不计入检索评估。"
    }

    report_path = os.path.join(os.path.dirname(__file__), "eval_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n  详细报告已保存至: {report_path}")


if __name__ == "__main__":
    run_evaluation()