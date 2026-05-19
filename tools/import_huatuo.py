"""
华佗-26M 数据集导入脚本（支持断电续传，零重复，原子保存）
"""

# ========== 解决 SSL 证书问题 ==========
import ssl
import os
import json
import shutil

os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
ssl._create_default_https_context = ssl._create_unverified_context

from datasets import load_dataset

# ========== 获取项目根目录 ==========
_TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_TOOLS_DIR)

# ========== 配置参数 ==========
# 知识库文件路径（统一知识库）
DATA_DIR = os.path.join(_PROJECT_ROOT, "backend", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "medical_knowledge.txt")

# huatuo 数据源目录
HUATUO_DIR = _TOOLS_DIR

# record 目录（存放进度记录）
RECORD_DIR = os.path.join(HUATUO_DIR, "record")
os.makedirs(RECORD_DIR, exist_ok=True)

# 进度文件路径
PROGRESS_FILE = os.path.join(RECORD_DIR, "progress.json")

SAVE_INTERVAL = 100  # 每 100 条保存一次进度


def count_existing_qa_pairs(file_path: str) -> int:
    """统计文件中已有的问答对数量"""
    if not os.path.exists(file_path):
        return 0
    
    count = 0
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('问题：'):
                count += 1
    return count


def load_progress() -> tuple:
    """加载进度：返回 (已扫描数, 已保存数)"""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('skipped', 0), data.get('saved', 0)
        except (json.JSONDecodeError, FileNotFoundError):
            return 0, 0
    return 0, 0


def save_progress(skipped: int, saved: int):
    """保存进度，防止断电损坏"""
    os.makedirs(os.path.dirname(PROGRESS_FILE), exist_ok=True)
    temp_file = PROGRESS_FILE + ".tmp"
    
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump({'skipped': skipped, 'saved': saved}, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)
    shutil.move(temp_file, PROGRESS_FILE)


def main():
    print("=" * 60)
    print("华佗-26M 数据集导入工具（断电续传/零重复/原子保存）")
    print("=" * 60)
    print(f"知识库路径: {OUTPUT_FILE}")
    print(f"进度记录目录: {RECORD_DIR}")
    print()
    
    actual_saved = count_existing_qa_pairs(OUTPUT_FILE)
    print(f"[精准恢复] 目标文件中已存在 {actual_saved} 条数据")
    
    last_skipped, last_saved = load_progress()
    print(f"[快速恢复] 进度文件记录已扫描 {last_skipped} 条")
    
    start_skip_from = last_skipped if last_skipped <= actual_saved else actual_saved
    
    print(f"[最终决策] 本次将从数据集的第 {start_skip_from + 1} 条开始扫描")
    print(f"[最终决策] 将从目标文件的末尾（第 {actual_saved + 1} 条）开始写入")
    print()
    
    print("正在加载华佗数据集...")
    try:
        dataset = load_dataset(
            "FreedomIntelligence/huatuo_knowledge_graph_qa",
            split="train",
            streaming=True
        )
    except Exception as e:
        print(f"加载失败: {e}")
        return
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    print("正在获取数据...")
    print("(将一直运行直到数据集结束，按 Ctrl+C 可正常中断)")
    print()
    
    count = actual_saved
    scanned = 0
    
    try:
        with open(OUTPUT_FILE, "a", encoding="utf-8", newline='') as f:
            for item in dataset:
                scanned += 1
            
                if scanned <= start_skip_from:
                    if scanned % 100000 == 0:
                        print(f"  快速跳过中... 已跳过 {scanned} 条")
                    continue
            
                if scanned <= actual_saved:
                    continue
            
                q_list = item.get("questions", [])
                question = q_list[0] if q_list else ""
            
                a_list = item.get("answers", [])
                answer = a_list[0] if a_list else ""
            
                if not question or not answer:
                    continue
            
                f.write(f"问题：{question}\n")
                f.write(f"回答：{answer}\n")
                f.write("\n")
                count += 1
            
                if count % 10 == 0:
                    f.flush()
                    os.fsync(f.fileno())
            
                if count % SAVE_INTERVAL == 0:
                    save_progress(scanned, count)
                    new_saved = count - actual_saved
                    new_scanned = scanned - start_skip_from
                    print(f"  已保存: {count} 条 (本次扫描 {new_scanned} 条，新增 {new_saved} 条)")
                
    except KeyboardInterrupt:
        print("\n\n用户中断，正在保存进度...")
        save_progress(scanned, count)
        print(f"进度已保存: 数据集扫描至 {scanned} 条，共写入 {count} 条")
        print("\n下次运行将继续从此处开始")
        return
    
    save_progress(scanned, count)
    
    print()
    print(f"数据集扫描总数: {scanned} 条")
    print(f"最终写入数量: {count} 条")
    print()
    print("=" * 60)
    print("数据集已全部导入完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()