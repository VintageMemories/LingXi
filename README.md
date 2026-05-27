# 🧠 灵析 (LingXi) – 领域通用智能体框架

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![LangGraph](https://img.shields.io/badge/LangGraph-1.2.0-orange)
![License](https://img.shields.io/badge/license-AGPL--3.0-red)

> **重要提示**：本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 许可证。这意味着如果你部署此软件并作为网络服务提供，你必须将你的修改开源。请确保你理解并遵守该许可证的条款。

---

## 📖 项目简介

**灵析 (LingXi)** 是一个面向医疗、法律、金融等垂直领域的智能对话助手。它结合了 **检索增强生成 (RAG)** 和 **自主智能体 (Agent)** 技术，能够利用本地知识库提供专业、可靠的回答，并通过内置的“反思”机制不断优化答案质量。

*   **RAG 部分**：当你提问时，系统会先在本地知识库中搜索相关信息，再将搜索到的内容提供给大语言模型，从而让模型能够回答需要专业资料的问题，避免凭空编造。
*   **Agent 部分**：系统具备调用外部工具的能力（例如查询药品信息、天气等），并能自我评估执行结果，决定是否需要重试或调整策略，就像一个会思考的助手。

无论你是想学习 AI 应用开发，还是快速搭建一个领域问答系统，灵析都是一个理想的起点。

---

## ✨ 核心特性

*   **🧠 多领域支持**：内置医疗、法律、金融三个领域，可一键切换。每个领域的提示词、工具和安全规则都是独立配置的。目前医疗领域已具备完整的知识库和工具链，法律和金融领域已搭建框架，暂未填充专属数据与工具。
*   **🔍 混合检索 RAG**：采用尖端的 **BGE-M3** 模型实现“稠密向量 + 稀疏词权重”的混合检索，结合智能分块技术，确保能精准找到答案。
*   **🤖 监督者模式 Agent**：基于 **LangGraph** 构建的 `Supervisor → Researcher → Reflector → Answerer` 决策图，拥有自我反思和重试能力，避免死循环。
*   **💼 三种服务模式**：
    *   **Free**：纯大模型对话，不查询知识库，适合常识性问题。
    *   **Pro**：大模型 + 知识库检索，适合需要专业资料支持的问题。
    *   **Agent**：全功能智能体，可调用工具、反思、自动重试，适合复杂问题。
*   **📚 企业级知识库管理**：支持离线构建索引、一键导入公开数据集、通用文档切块器（无需担心数据格式）。
*   **⚡ 前后端分离**：后端 FastAPI + 前端 Next.js 16，通过 SSE 实现流式响应，可实时看到 AI 的“思考”过程和工具调用状态。
*   **🧠 记忆系统**：Free/Pro 模式具备“混合记忆”（滑动窗口 + 摘要），Agent 模式自动加载历史对话，让交流不再“失忆”。
*   **🛡️ 安全与意图分类**：使用本地 ONNX 模型进行意图分类，能实时识别紧急状况、敏感内容或领域越界。
*   **🔌 插件式工具系统**：极低的扩展门槛，可快速添加新的功能工具（如医保查询、医院定位等）。
*   **📊 高度可观测**：统一的日志格式，清晰展示 `[Supervisor]` 的决策、`[Researcher]` 的调用和 `[Reflector]` 的评估全过程。
*   **🌐 多模型支持**：后端 LLM 工厂支持 DeepSeek、OpenAI、通义千问、智谱等兼容 OpenAI 接口的模型。目前仅对 DeepSeek 进行了完整测试，其他模型理论上可用，但可能需要微调配置。
*   **🧪 专业评估体系**：内置 RAG 评估工具包 (`rag_toolkit.bat`)，支持模型完整性检查、索引构建、Hit Rate@5 评估和相似度阈值校准。

---

## 🏛️ 技术架构

| 后端核心流程 (Agent 决策图) | 检索流程 (RAG Pipeline) |
|:---:|:---:|
| <img width="2510" height="2910" alt="后端核心流程 (Agent 决策图)" src="https://github.com/user-attachments/assets/669a4a47-a6f1-4adb-9736-f320582c4e79" /> | <img width="3572" height="5826" alt="RAG 检索流程" src="https://github.com/user-attachments/assets/3cfd71aa-7f87-4e88-b88f-b5880d294eaa" /> |

---

## 🌳 项目结构

```text
LingXi/
├── backend/                        # 后端代码 (FastAPI)
│   ├── app/                        # API 路由层
│   │   ├── __init__.py             # FastAPI 应用实例与启动事件
│   │   ├── auth.py                 # 用户登录/注册
│   │   ├── chat.py                 # 聊天核心逻辑 (Free/Pro/Agent)
│   │   ├── domains.py              # 领域管理API
│   │   └── health.py               # 健康检查端点
│   ├── core/                       # 核心业务逻辑
│   │   ├── agent/                  # Agent 决策图与状态
│   │   │   ├── graph.py            # 监督者模式 Agent 图
│   │   │   └── state.py            # Agent 共享状态定义
│   │   ├── config.py               # 全局配置管理
│   │   ├── data_sources/           # 数据源适配器与导入管道
│   │   ├── domain/                 # 领域配置加载
│   │   │   └── manager.py
│   │   ├── intent/                 # 意图分类器
│   │   │   ├── classifier.py
│   │   │   └── labels.py
│   │   ├── llm/                    # LLM 工厂
│   │   │   └── factory.py          # 支持 DeepSeek/OpenAI 等多模型
│   │   ├── retrieval/              # 检索模块
│   │   │   └── vector.py           # BGE-M3 混合检索器
│   │   ├── safety/                 # 安全守卫
│   │   │   └── guard.py
│   │   └── tools/                  # 插件式工具系统
│   │       ├── base.py             # 工具抽象基类
│   │       ├── registry.py         # 自动工具注册中心
│   │       ├── builtin/            # 内置/通用工具
│   │       │   ├── knowledge_search.py  # 知识库检索核心
│   │       │   └── weather_query.py
│   │       ├── medical/            # 医疗领域专用工具
│   │       └── executor.py
│   ├── data/                       # 知识库与索引 (运行时数据，Git忽略)
│   ├── domains/                    # 领域 YAML 配置文件
│   ├── models/                     # 本地模型存储 (Git忽略)
│   ├── scripts/                    # 工具脚本
│   │   ├── build_index.py          # 离线索引构建
│   │   └── rag_toolkit.bat         # RAG 诊断与评估工具包
│   ├── main.py                     # 后端启动入口
│   └── pyproject.toml              # Python 项目依赖
├── src/                            # 前端代码 (Next.js 16)
│   ├── app/                        # 页面、API路由
│   ├── components/                 # UI组件 (shadcn/ui)
│   ├── hooks/                      # 自定义 React Hooks
│   ├── lib/                        # 工具函数、国际化
│   └── stores/                     # Zustand 状态管理
├── tests/                          # 评估测试
│   ├── __init__.py
│   ├── eval_data.py                # 评估数据集
│   └── eval_rag.py                 # 离线评估脚本
├── prisma/
│   └── schema.prisma               # 数据库模型定义
├── public/                         # 静态资源
├── .env.example                    # 环境变量模板
├── package.json                    # 前端依赖
└── README.md
```

---

## 🚀 安装与使用指南

### 环境要求

*   **Python 3.11+** (推荐 3.11)
*   **Node.js 18+**
*   **Git**
*   **uv** (Python 包管理工具)
*   **硬盘空间**: 至少 10GB 可用空间 (用于模型和知识库)
*   **内存**: 至少 8GB RAM

### 1. 克隆仓库

```bash
git clone https://github.com/VintageMemories/LingXi.git
cd LingXi
```

### 2. 后端依赖安装

```bash
cd backend
uv sync
```

### 3. 配置 LLM 与模型

**方式一：前端 UI 配置 (强烈推荐)**
启动前端后，点击右上角齿轮图标进入 **设置 → 模型** 页面。你可以在此处填写模型提供商、API Key、Base URL、选择模型等，所有配置仅保存在本地浏览器中，不会上传服务器。**配置完成后，后端将从每次请求的 Header 中读取这些信息，无需修改后端 `.env` 文件。**

**方式二：后端环境变量**
如果你习惯使用环境变量，可在项目根目录下复制 `.env.example` 为 `.env`，按需填写：
```env
LLM_MODEL="deepseek-chat"
LLM_API_KEY="sk-你的DeepSeek API Key"
LLM_API_BASE="https://api.deepseek.com"
LLM_API_PROVIDER="deepseek"
```

### 4. 下载 Embedding 模型 (BGE-M3)

> 务必下载到本地，不要依赖在线加载。

**国内用户推荐 (ModelScope)**
```bash
uv run modelscope download --model BAAI/bge-m3 --local_dir ./models/bge-m3
```
**国际用户 (HuggingFace Hub)**
```bash
uv run hf download BAAI/bge-m3 --local-dir ./models/bge-m3
```
下载完成后，验证模型可用：
```bash
uv run python -c "from FlagEmbedding import BGEM3FlagModel; m = BGEM3FlagModel('./models/bge-m3', use_fp16=False); print('模型加载成功，输出维度:', m.encode(['测试']).get('dense_vecs').shape)"
```
若输出 `模型加载成功，输出维度: (1, 1024)`，即表示成功。

**清理空间 (可选)**：删除 ONNX 目录及临时下载文件。

### 5. 初始化数据库

```bash
npx prisma db push
```
或后端首次启动时自动创建。

### 6. 导入知识库数据

```bash
uv run python -m core.data_sources.cli import --source huatuo --domain medical --max-entries 1000
```
### 7. 构建离线索引

```bash
uv run python scripts/build_index.py
```
### 8. 启动后端

```bash
uv run python main.py
```
服务运行在 `http://localhost:8000`，API 文档 `http://localhost:8000/docs`。

### 9. 启动前端

在项目根目录新建终端：
```bash
npm install
npm run dev
```
前端运行在 `http://localhost:3000`。

---

## 📡 API 接口概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat` | 主聊天接口，支持 SSE 流式响应 |
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/auth` | 用户注册/登录 |
| `GET` | `/api/domains` | 获取所有领域配置 |
| `POST` | `/api/knowledge` | 知识库管理（分页查询、删除） |
| `POST` | `/api/seed/bulk` | 批量导入种子知识 |
| `POST` | `/api/sessions` | 创建/获取会话 |
| `GET` | `/api/sessions/:id` | 获取会话详情与消息 |

完整 OpenAPI 文档访问 `http://localhost:8000/docs`。

---

## 🧪 RAG 诊断工具包

项目内置了 `rag_toolkit.bat`，提供一站式 RAG 系统诊断与评估：

| 选项 | 功能 | 说明 |
|------|------|------|
| `[1]` | 检查模型完整性 | 验证 BGE-M3 模型是否加载正常 |
| `[2]` | 构建离线索引 | 重新切块并构建检索索引 |
| `[3]` | 运行 RAG 评估 | 运行 30 条分层测试，输出 Hit Rate@5 与 MRR |
| `[4]` | 校准相似度阈值 | 对比正面/负面样本的最高分数，辅助设定拒答阈值 |
| `[5]` | 全部执行 (1-2-3) | 一键完成模型检查、索引构建、评估 |
| `[6]` | 测试 SafetyGuard | 验证安全拦截（自杀、暴力、违规内容）是否生效 |

---

## ❓ 常见问题 (FAQ)

**Q: 为什么我提问后 Agent 一直在重试，最后给了一个笼统的回答？**  
A: 这通常是因为知识库中没有足够匹配的数据。建议检查知识库是否已导入，索引是否构建。观察 `[Reflector]` 日志，若经常判为 `low`，可调整 `graph.py` 中 `reflector_node` 的提示词或放宽标准。

**Q: 工具注册失败，日志中出现 `invalid character` 或 `null byte`？**  
A: 文件编码损坏。用 VS Code 重新打开文件，通过“通过编码重新保存”选择 `UTF-8` 修复。

**Q: 如何添加新工具？**  
A: 在 `backend/core/tools/<领域>/` 下创建 `.py` 文件，继承 `BaseTool` 并实现必要方法，工具注册中心会自动发现。

**Q: 支持哪些大模型？**  
A: 后端 LLM 工厂支持所有兼容 OpenAI 接口的模型，内置了 DeepSeek 的原生支持。在设置页面填写对应的 API Key 和 Base URL 即可。

---

## 📜 许可证

本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)**。完整文本参见 `LICENSE` 文件。

---

## 🙏 致谢

*   [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) — 嵌入模型
*   [华佗-26M](https://huggingface.co/datasets/FreedomIntelligence/huatuo_knowledge_graph_qa) — 医学知识数据集
*   [LangGraph](https://github.com/langchain-ai/langgraph) — Agent 框架
*   [shadcn/ui](https://ui.shadcn.com) — 前端 UI 组件
*   [ModelScope](https://modelscope.cn) — 国内模型下载平台
