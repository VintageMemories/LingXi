#!/usr/bin/env python3
"""
灵析 数据导入 CLI 工具
用于列出数据源、导入数据、查看导入状态。

使用方式：
    # 从 upload 目录运行
    python main.py list
    python main.py import --source a_hospital
    python main.py status

    # 从 backend 目录运行（通过 uv）
    uv run python ../upload/main.py list
"""

import argparse
import asyncio
import json
import os
import sys

# ---------------------------------------------------------------------------
# 路径设置：确保能导入 backend 中的模块
# ---------------------------------------------------------------------------
_UPLOAD_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_UPLOAD_DIR)
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "backend")

# 将 backend 目录加入 sys.path，使得 import api / core / ... 能正确解析
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# 将项目根目录也加入，使得 import upload / backend / ... 能正确解析
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)


# ---------------------------------------------------------------------------
# CLI 命令实现
# ---------------------------------------------------------------------------

def cmd_list(args):
    """列出所有已注册的数据源及其元信息"""
    from core.data_sources.registry import DataSourceRegistry

    sources = DataSourceRegistry.list_sources()

    if not sources:
        print("暂无已注册的数据源。")
        return

    print("\n" + "=" * 60)
    print("  已注册数据源列表")
    print("=" * 60)

    for src in sources:
        print(f"\n  名称: {src.get('name', 'N/A')}")
        print(f"  描述: {src.get('description', 'N/A')}")
        print(f"  类型: {src.get('source_type', 'N/A')}")
        print(f"  领域: {src.get('domain', 'N/A')}")
        print(f"  支持增量: {'是' if src.get('supports_incremental') else '否'}")
        print("-" * 40)

    print(f"\n共 {len(sources)} 个数据源\n")


def cmd_import(args):
    """从指定数据源导入数据到知识库"""
    from core.data_sources.registry import DataSourceRegistry
    from core.data_sources.base import DataSourceConfig, DataSourceType
    from core.data_sources.import_pipeline import ImportPipeline

    source_name = args.source
    domain = args.domain or "medical"
    max_entries = args.max_entries
    knowledge_path = args.knowledge_path or os.path.join(
        _BACKEND_DIR, "data", "medical_knowledge.txt"
    )

    # 检查数据源是否存在
    if not DataSourceRegistry.has_source(source_name):
        print(f"[错误] 数据源 '{source_name}' 未注册。")
        print("可用数据源:")
        for src in DataSourceRegistry.list_sources():
            print(f"  - {src.get('name', 'N/A')}")
        return

    # 构建配置
    source_type_map = {
        "a_hospital": DataSourceType.WEB_SCRAPER,
        "huatuo": DataSourceType.DATASET,
    }
    source_type = source_type_map.get(source_name, DataSourceType.WEB_SCRAPER)

    options = {}
    if source_name == "a_hospital":
        options["base_url"] = args.base_url or "https://www.a-hospital.com"
        options["delay"] = args.delay or 1.0
        options["list_urls"] = [
            args.list_url or "https://www.a-hospital.com/w/疾病列表"
        ]

    config = DataSourceConfig(
        name=source_name,
        source_type=source_type,
        domain=domain,
        max_entries=max_entries,
        options=options,
    )

    # 执行导入
    print("\n" + "=" * 60)
    print(f"  开始导入数据源: {source_name}")
    print("=" * 60)
    print(f"  领域: {domain}")
    print(f"  最大条目数: {max_entries or '无限制'}")
    print(f"  知识库路径: {knowledge_path}")
    print()

    pipeline = ImportPipeline(knowledge_path=knowledge_path)

    try:
        result = asyncio.run(pipeline.import_from_source(source_name, config))
    except KeyboardInterrupt:
        print("\n[中断] 用户中断导入操作。")
        return
    except Exception as e:
        print(f"\n[错误] 导入失败: {e}")
        return

    # 输出结果
    stats = result.get("stats", {})
    print(f"\n{'=' * 60}")
    print(f"  导入完成")
    print(f"{'=' * 60}")
    print(f"  数据源: {result.get('source', source_name)}")
    print(f"  总获取条目: {stats.get('total_fetched', 0)}")
    print(f"  新增条目: {stats.get('new_entries', 0)}")
    print(f"  更新条目: {stats.get('updated_entries', 0)}")
    print(f"  跳过条目: {stats.get('skipped_entries', 0)}")
    print(f"  错误条目: {stats.get('errors', 0)}")

    new_titles = result.get("new_entry_titles", [])
    if new_titles:
        print(f"\n  新增条目标题 (前 {len(new_titles)} 条):")
        for t in new_titles:
            print(f"    - {t}")

    updated_titles = result.get("updated_entry_titles", [])
    if updated_titles:
        print(f"\n  更新条目标题 (前 {len(updated_titles)} 条):")
        for t in updated_titles:
            print(f"    - {t}")

    print()


def cmd_status(args):
    """查看知识库当前状态"""
    knowledge_path = args.knowledge_path or os.path.join(
        _BACKEND_DIR, "data", "medical_knowledge.txt"
    )

    print("\n" + "=" * 60)
    print("  知识库状态")
    print("=" * 60)
    print(f"  知识库路径: {knowledge_path}")

    if not os.path.exists(knowledge_path):
        print("  状态: 文件不存在（尚未导入数据）")
        print()
        return

    # 统计条目数
    entry_count = 0
    file_size = os.path.getsize(knowledge_path)

    with open(knowledge_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("【疾病】") or line.startswith("问题："):
                entry_count += 1

    print(f"  文件大小: {file_size / 1024:.1f} KB")
    print(f"  知识条目数: {entry_count}")
    print()

    # 显示 JSONL 文件状态
    jsonl_path = os.path.join(_BACKEND_DIR, "data", "a_hospital", "disease_data.jsonl")
    if os.path.exists(jsonl_path):
        jsonl_count = 0
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for _ in f:
                jsonl_count += 1
        print(f"  JSONL 数据: {jsonl_count} 条 ({jsonl_path})")
    else:
        print(f"  JSONL 数据: 未找到")

    # 检查进度文件
    record_dir = os.path.join(_UPLOAD_DIR, "record")
    progress_file = os.path.join(record_dir, "progress.json")
    if os.path.exists(progress_file):
        with open(progress_file, "r", encoding="utf-8") as f:
            progress = json.load(f)
        print(f"\n  华佗导入进度:")
        print(f"    已扫描: {progress.get('skipped', 0)} 条")
        print(f"    已保存: {progress.get('saved', 0)} 条")
    else:
        print(f"\n  华佗导入进度: 无进度记录")

    # 列出可用数据源
    try:
        from core.data_sources.registry import DataSourceRegistry
        sources = DataSourceRegistry.list_sources()
        if sources:
            print(f"\n  可用数据源:")
            for src in sources:
                print(f"    - {src.get('name', 'N/A')} ({src.get('source_type', 'N/A')})")
    except Exception:
        pass

    print()


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def build_parser():
    parser = argparse.ArgumentParser(
        prog="lingxi-import",
        description="灵析 数据导入 CLI 工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # list 命令
    list_parser = subparsers.add_parser("list", help="列出所有已注册的数据源")
    list_parser.set_defaults(func=cmd_list)

    # import 命令
    import_parser = subparsers.add_parser("import", help="从数据源导入数据")
    import_parser.add_argument(
        "--source", "-s",
        required=True,
        help="数据源名称 (例如: a_hospital, huatuo)",
    )
    import_parser.add_argument(
        "--domain", "-d",
        default="medical",
        help="目标领域 (默认: medical)",
    )
    import_parser.add_argument(
        "--max-entries",
        type=int,
        default=None,
        help="最大导入条目数 (默认: 无限制)",
    )
    import_parser.add_argument(
        "--knowledge-path",
        default=None,
        help="知识库文件路径",
    )
    # a_hospital 特有参数
    import_parser.add_argument(
        "--base-url",
        default=None,
        help="A+医学百科基础URL (仅 a_hospital)",
    )
    import_parser.add_argument(
        "--delay",
        type=float,
        default=None,
        help="请求间隔秒数 (仅 a_hospital, 默认: 1.0)",
    )
    import_parser.add_argument(
        "--list-url",
        default=None,
        help="疾病列表页URL (仅 a_hospital)",
    )
    import_parser.set_defaults(func=cmd_import)

    # status 命令
    status_parser = subparsers.add_parser("status", help="查看知识库导入状态")
    status_parser.add_argument(
        "--knowledge-path",
        default=None,
        help="知识库文件路径",
    )
    status_parser.set_defaults(func=cmd_status)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()
