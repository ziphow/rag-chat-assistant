# 🧠 知源 AI — AI 智能对话助手

> 一个用于 **学习实践 FastAPI、LangChain 与 RAG** 的个人全栈项目。
>
> 通过 AI 聊天助手的形式，将「用户认证、多轮对话记忆、SSE 流式回复、图片 / 文件多模态分析、知识库 RAG 检索」等能力串成一条完整链路。
>
> **本人的学习重点在后端**（FastAPI 异步开发、LangChain 智能体编排、LangGraph 记忆、Chroma 向量检索）；前端界面与接口文档主要由 AI 辅助生成并持续美化，作为学习量产物的"可视化载体"。

## 🌐 项目演示地址：http://106.55.63.47/

---

## 🧭 项目学习历程

本项目遵循一套清晰的开发流程，见证了一个粗糙原型逐步演进为高完成度产品的过程：

```
① AI 生成简洁前端 + 接口文档
         │
         ▼
② 完成基础功能（认证 / 对话 / 消息）
         │
         ▼
③ 新增 RAG 知识库模块
         │
         ▼
④ 利用 AI 能力大幅美化前端界面
```

| 阶段 | 内容 | 成果 |
|:----:|------|------|
| **① 快速起步** | 用 AI 生成一版简洁可用的前端页面，并配套接口文档作为联调契约 | 纯 HTML / CSS / JS 页面 + `详细接口文档.md` |
| **② 基础功能** | 完成 JWT 认证、对话 CRUD、消息发送、文件上传等核心后端 | 可注册登录并完成多轮对话 |
| **③ RAG 模块** | 文档解析、向量化、Chroma 存储、检索注入，实现知识库问答 | 上传文档后按知识库精准回答 |
| **④ 界面美化** | 借助 AI 对前端进行大幅美学升级（玻璃拟态、艺术背景、GSAP 动效、KaTeX 渲染） | 高完成度的落地页与聊天应用 |

> 前端代码并非个人亲写，而是学习后端的"副产品"；真正投入精力的是 **FastAPI 后端** 与 **LangChain / RAG 流程** 的设计与实现。

---

## 📸 界面预览

<div align="center">
**落地页**（品牌入口 · 「让 AI 成为你的智能对话伙伴」）

<img src="docs/screenshots/landing-page.png" alt="落地页预览" width="700"/>

**登录页**（水墨山水 · 玻璃拟态表单 · 「从这里开始」）

<img src="docs/screenshots/login-page.png" alt="登录页预览" width="700"/>

</div>

> 以上界面由 AI 辅助设计生成（背景素材仅供个人学习使用），前端随后经过多轮迭代美化形成当前效果。

---

## ✨ 功能特性

| 功能 | 说明 | 状态 |
|------|------|:----:|
| 🔐 用户认证 | JWT 登录 / 注册，Token 黑名单退出机制 | ✅ |
| 💬 多轮对话 | 基于 LangGraph Checkpointer 的会话记忆，支持自动摘要 | ✅ |
| ⚡ 流式回复 | SSE 实时推送，打字机效果，零延迟体验 | ✅ |
| 🖼️ 图片分析 | 上传图片自动转 base64 传给多模态模型分析 | ✅ |
| 📄 文件分析 | 支持 PDF / Word / TXT / CSV，自动转文本供 AI 分析 | ✅ |
| 🌐 网页搜索 | 内置 Tavily 搜索与时间查询工具 | ✅ |
| 📚 知识库 RAG | 上传文档构建向量知识库，对话时指定知识库获取精准回答 | ✅ |
| 📑 AI 自动标题 | 首轮对话后自动生成长对话标题 | ✅ |
| 🗂️ 文件历史 | 按对话查看与下载发送过的图片 / 文件 | ✅ |
| 📝 Markdown 渲染 | 支持代码块、表格、列表、KaTeX 公式等格式渲染 | ✅ |

> ✅ = 已完成

---

## 🛠️ 技术栈

### 后端（学习重点）

| 技术 | 用途 |
|------|------|
| [FastAPI](https://fastapi.tiangolo.com/) | 异步 Web 框架，SSE 流式响应 |
| [LangChain](https://www.langchain.com/) | LLM 应用框架与智能体编排 |
| [LangGraph](https://langchain-ai.github.io/langgraph/) | 对话状态图、Checkpointer 会话记忆、消息摘要中间件 |
| [SQLModel](https://sqlmodel.tiangolo.com/) | ORM 与数据库操作（基于 SQLAlchemy async） |
| [ChromaDB](https://www.trychroma.com/) | 向量数据库（RAG），embedding 由 `langchain-chroma` 提供 |
| MySQL (`aiomysql`) | 业务数据库（可切换 SQLite） |
| 通义千问 | 对话 / 摘要 / 标题 / 向量嵌入模型（DashScope OpenAI 兼容协议） |

### 前端（AI 辅助生成与美化）

| 技术 | 用途 |
|------|------|
| HTML / CSS / JavaScript | 原生实现，无框架依赖 |
| GSAP | 页面与组件动画 |
| KaTeX | 数学公式渲染 |
| SSE | 流式接收 AI 回复 |

---

## 🧠 模型与智能体说明

对话由 LangGraph 编排的 **Agent** 驱动，核心模型为 `qwen3.7-plus`（通过 DashScope 的 OpenAI 兼容接口调用）：

- **qwen3.7-plus** — 主对话模型（启用思考 `enable_thinking=true`）
- **qwen3.7-max** — 摘要中间件与标题生成模型
- **qwen3.7-text-embedding** — RAG 文档向量化嵌入模型
- **内置工具**：`get_time`（时间查询）、`TavilySearch`（网页搜索）

RAG 流程：上传文档 → 后台解析（PDF / DOCX / TXT / MD / CSV）→ 递归分块 → DashScope 向量化 → 存入 Chroma（每个知识库一个 collection）→ 对话时按相似度检索 Top-K 片段注入上下文。

---

## 📁 项目结构

```
rag-chat-assistant/
├── backend/                          # ← 学习重点：FastAPI + LangChain + RAG
│   ├── app/
│   │   ├── ai/
│   │   │   ├── agent.py              🤖 智能体创建、LangGraph 记忆、摘要中间件
│   │   │   └── title_generator.py    📝 AI 对话标题生成
│   │   ├── rag/
│   │   │   ├── document_loader.py    📄 文档加载与分块
│   │   │   ├── vector_store.py       📦 Chroma 向量存储管理
│   │   │   └── rag.py                🔍 知识库检索
│   │   ├── routers/
│   │   │   ├── auth.py               🔐 登录、注册、退出、当前用户
│   │   │   ├── chats.py              💬 对话 CRUD、清空、文件历史
│   │   │   ├── messages.py           📨 SSE 流式发送消息
│   │   │   ├── files.py              📁 文件上传
│   │   │   └── knowledge_bases.py    📚 知识库 CRUD、文档上传与删除
│   │   ├── services/
│   │   │   ├── auth_service.py       🎟️ JWT 生成与验证
│   │   │   ├── security.py           🔒 bcrypt 密码哈希
│   │   │   ├── sse_stream.py         ⚡ SSE 流式生成器
│   │   │   └── file_utils.py         🖼️ 图片 base64、文件转文本、附件清理
│   │   ├── Schemas/model.py          📋 Pydantic 请求模型（UserMessage 等）
│   │   ├── config.py                 ⚙️ 环境变量配置
│   │   ├── database.py               🗄️ SQLModel 模型与会话管理
│   │   ├── dependencies.py           🔗 依赖注入（当前用户、Token 黑名单）
│   │   └── main.py                   🚀 FastAPI 应用入口（CORS、静态目录）
│   ├── .env.example                  📋 环境变量模板
│   ├── pyproject.toml                📦 项目元数据与依赖（PEP 621）
│   └── requirements.txt              📦 pip 依赖清单
├── frontend/                         # AI 辅助生成与美化的界面
│   ├── index.html                    🌐 页面结构（落地页 + 认证 + 聊天应用）
│   ├── styles.css                    🎨 样式
│   ├── app.js                        ⚡ 应用初始化与事件绑定
│   ├── js/                           # 认证、对话、SSE、知识库、文件、主题等模块
│   ├── assets/                       🖼️ 静态素材（背景、头像、特性图）
│   └── 详细接口文档.md                📖 前后端 API 对接文档
├── docs/
│   ├── screenshots/                  📸 界面预览截图
│   └── *.md                          📚 学习笔记（FastAPI / LangChain / RAG / SQLModel）
└── README.md
```

---

## 🚀 快速开始

### 📋 环境要求

- **Python ≥ 3.14**
- 包管理工具：[uv](https://github.com/astral-sh/uv)（推荐）或 pip

### 🔧 后端启动

**1. 进入后端目录并安装依赖**

```bash
cd backend
uv venv
uv pip install -r requirements.txt
# 或用 pip： pip install -e .
```

**2. 配置环境变量**

```bash
cp .env.example .env
# 编辑 .env，填入你的 API 密钥
```

<details>
<summary>📝 查看 .env 需要填什么</summary>

| 变量名 | 说明 | 必填 |
|--------|------|:----:|
| `DASHSCOPE_API_KEY` | 阿里云通义千问 API 密钥 | ✅ |
| `DASHSCOPE_BASE_URL` | DashScope OpenAI 兼容 API 地址 | ✅ |
| `DASHSCOPE_WORKSPACE_BASE_URL` | 工作空间向量模型接口地址 | ✅* |
| `TAVILY_API_KEY` | Tavily 搜索 API 密钥 | ✅ |
| `DATABASE_URL` | MySQL 连接串（如 `mysql+aiomysql://user:pass@localhost:3306/dbname`） | ✅ |
| `SECRET_KEY` | JWT 签名密钥 | ✅ |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token 有效期（分钟，默认 1440） | 否 |

> *向量嵌入若使用默认通义千问 `text-embedding` 系列模型可不需要；由 `DASHSCOPE_BASE_URL` 提供。

</details>

**3. 启动服务**

```bash
uv run uvicorn app.main:app --reload
```

| 服务 | 地址 |
|------|------|
| 后端 API | http://127.0.0.1:8000 |
| 交互式文档（Swagger） | http://127.0.0.1:8000/docs |

> 数据库 `create_db_and_tables` 默认在 `main.py` 中被注释，首次启动前可按需启用，或自行建表。

### 🌐 前端启动

前端是纯静态文件，用本地 HTTP 服务器启动以获得最佳体验（避免 CORS 问题）：

```bash
cd frontend
python -m http.server 5500
```

然后访问 http://localhost:5500 。（或在 VS Code 中右键 `index.html` → Open with Live Server）

---

## 📖 API 接口概览

> 完整接口文档见 [frontend/详细接口文档.md](frontend/详细接口文档.md)

### 认证模块

| 方法 | 路径 | 说明 | 认证 |
|:----:|------|------|:----:|
| POST | `/auth/register` | 用户注册 | 否 |
| POST | `/auth/login` | 用户登录 | 否 |
| GET | `/auth/me` | 获取当前用户 | 是 |
| POST | `/auth/logout` | 退出登录 | 是 |

### 对话与消息模块

| 方法 | 路径 | 说明 |
|:----:|------|------|
| GET | `/chats` | 获取对话列表 |
| POST | `/chats` | 创建对话 |
| GET | `/chats/{chat_id}` | 获取对话消息 |
| PUT | `/chats/{chat_id}` | 修改标题 |
| GET | `/chats/{chat_id}/create_title` | AI 自动生成标题 |
| DELETE | `/chats/{chat_id}` | 删除对话 |
| DELETE | `/chats/{chat_id}/messages` | 清空对话消息 |
| POST | `/message/send` | 发送消息（SSE 流式） |

### 文件模块

| 方法 | 路径 | 说明 |
|:----:|------|------|
| POST | `/files/upload` | 上传文件 |
| GET | `/files/sent` | 所有对话发送的文件 |
| GET | `/chats/{chat_id}/files` | 单个对话的文件 |

### 知识库模块（RAG）

| 方法 | 路径 | 说明 |
|:----:|------|------|
| POST | `/knowledge-bases` | 创建知识库 |
| GET | `/knowledge-bases` | 获取知识库列表 |
| DELETE | `/knowledge-bases/{kb_id}` | 删除知识库 |
| POST | `/knowledge-bases/{kb_id}/documents` | 上传文档（异步处理） |
| GET | `/knowledge-bases/{kb_id}/documents` | 获取文档列表 |
| DELETE | `/knowledge-bases/{kb_id}/documents/{doc_id}` | 删除文档 |

---

## 🔑 环境变量说明

| 变量名 | 说明 | 获取方式 |
|--------|------|---------|
| `DASHSCOPE_API_KEY` | 阿里云通义千问 API 密钥 | [DashScope 控制台](https://dashscope.console.aliyun.com/) |
| `DASHSCOPE_BASE_URL` | DashScope OpenAI 兼容 API 地址 | 固定值，见 `.env.example` |
| `DASHSCOPE_WORKSPACE_BASE_URL` | 工作空间（百炼）向量模型接口 | 控制台获取 |
| `TAVILY_API_KEY` | Tavily 搜索 API 密钥 | [Tavily 官网](https://tavily.com/) |
| `DATABASE_URL` | 数据库连接字符串 | MySQL 或 SQLite，见 `.env.example` |
| `SECRET_KEY` | JWT 签名密钥 | 自行生成随机字符串 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token 有效期（分钟） | 可留默认 |

---

## 📚 学习笔记

`docs/` 目录存放了学习过程中沉淀的技术笔记：

- `fastapi_tutorial.md` — FastAPI 异步开发
- `langchain_objects_detailed.md` / `langchain_objects_tree_reference.md` / `langchain_v1_api_guide.md` — LangChain 对象与 API
- `RAG教程.md` — RAG 检索增强生成
- `sqlmodel_tutorial.md` / `sqlmodel_api_reference.md` — SQLModel 数据建模

---

## 📄 License

本项目采用 MIT 协议开源，可自由使用、修改和分发。

---

## 🙋 说明

**这是一个个人学习项目**，用于实践 FastAPI + LangChain + RAG 全栈开发。代码与文档会随学习进度持续更新。

> 项目所有背景素材仅供个人学习使用，具体版权归属见各素材来源。