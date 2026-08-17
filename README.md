# 🤖 AI Chat Assistant

> 基于 FastAPI + LangChain 的 AI 智能对话助手，支持多轮对话记忆、图片分析、流式回复、知识库 RAG 检索。前端使用原生 HTML/CSS/JavaScript 实现。

---

## ✨ 功能特性

| 功能 | 说明 | 状态 |
|------|------|:----:|
| 🔐 用户认证 | JWT 登录/注册，Token 黑名单退出机制 | ✅ |
| 💬 多轮对话 | 基于 LangGraph Checkpointer 的会话记忆，支持自动摘要 | ✅ |
| ⚡ 流式回复 | SSE 实时推送，打字机效果，零延迟体验 | ✅ |
| 🖼️ 图片分析 | 上传图片后自动转 base64 传给视觉模型分析 | ✅ |
| 📁 文件管理 | 支持 PDF、Word、TXT 等文档上传 | ✅ |
| 🔍 知识库 RAG | 上传文档构建向量知识库，对话时指定知识库获取精准回答 | 🚧 |
| 🛠️ 工具调用 | 内置网页搜索（Tavily）和时间查询工具 | ✅ |
| 📝 Markdown 渲染 | 支持代码块、表格、列表等格式的消息渲染 | ✅ |

> 🚧 = 开发中　✅ = 已完成

---

## 🛠️ 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| ![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white) | 异步 Web 框架 |
| ![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?logo=langchain&logoColor=white) | LLM 应用框架与智能体编排 |
| ![SQLModel](https://img.shields.io/badge/SQLModel-CC0000?logo=sqlmodel&logoColor=white) | ORM 与数据库操作 |
| ![ChromaDB](https://img.shields.io/badge/ChromaDB-FF6F00?logo=chroma&logoColor=white) | 向量数据库（RAG） |
| ![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white) | 轻量级数据库 |
| 通义千问 | LLM 与 Embedding 模型 |

### 前端

| 技术 | 用途 |
|------|------|
| HTML / CSS / JavaScript | 原生实现，无框架依赖 |
| SSE | 流式接收 AI 回复 |
| Markdown | 实时渲染消息内容 |

---

## 📁 项目结构

```
ai-chat-assistant/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── agent.py              🤖 智能体创建、记忆、摘要中间件
│   │   │   ├── vector_store.py       📦 Chroma 向量存储管理
│   │   │   └── document_loader.py    📄 文档加载与分块
│   │   ├── routers/
│   │   │   ├── auth.py               🔐 登录、注册、退出
│   │   │   ├── chats.py              💬 对话 CRUD
│   │   │   ├── messages.py           📨 消息发送、SSE 流式回复
│   │   │   ├── files.py              📁 文件上传
│   │   │   └── knowledge_bases.py    📚 知识库管理（开发中）
│   │   ├── services/
│   │   │   └── security.py           🔒 密码哈希、JWT 生成与验证
│   │   ├── config.py                 ⚙️ 配置项
│   │   ├── database.py               🗄️ 数据库模型与会话管理
│   │   ├── dependencies.py           🔗 依赖注入（获取当前用户等）
│   │   └── main.py                   🚀 FastAPI 应用入口
│   ├── test/
│   ├── .env.example                  📋 环境变量模板
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/
│   ├── index.html                    🌐 页面结构
│   ├── app.js                        ⚡ 前端逻辑
│   ├── styles.css                    🎨 样式
│   ├── ai-avatar.jpg                 🖼️ AI 头像
│   └── 详细接口文档.md                📖 API 文档
└── README.md
```

---

## 🚀 快速开始

### 📋 环境要求

- ![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
- [uv](https://github.com/astral-sh/uv)（推荐的包管理工具）

### 🔧 后端启动

**1. 克隆仓库**

```bash
git clone https://github.com/your-username/ai-chat-assistant.git
cd ai-chat-assistant/backend
```

**2. 创建虚拟环境并安装依赖**

```bash
uv venv
uv pip install -r requirements.txt
```

**3. 配置环境变量**

```bash
cp .env.example .env
# 编辑 .env，填入你的 API 密钥
```

<details>
<summary>📝 查看 .env 需要填什么</summary>

| 变量名 | 说明 | 必填 |
|--------|------|:----:|
| `DASHSCOPE_API_KEY` | 阿里云通义千问 API 密钥 | ✅ |
| `DASHSCOPE_BASE_URL` | DashScope API 地址 | ✅ |
| `TAVILY_API_KEY` | Tavily 搜索 API 密钥 | ✅ |
| `SECRET_KEY` | JWT 签名密钥 | ✅ |

</details>

**4. 启动服务**

```bash
uv run uvicorn app.main:app --reload
```

| 服务 | 地址 |
|------|------|
| 后端 API | http://127.0.0.1:8000 |
| 交互式文档 (Swagger) | http://127.0.0.1:8000/docs |

### 🌐 前端启动

前端是纯静态文件，直接用浏览器打开 `frontend/index.html` 即可。

> ⚠️ 如果遇到 CORS 跨域问题，建议用本地 HTTP 服务器启动：

```bash
# 方式一：VS Code 中右键 index.html → Open with Live Server
# 方式二：用 Python 内置 HTTP 服务器
cd frontend
python -m http.server 5500
```

然后访问 http://localhost:5500

---

## 📖 API 接口

> 完整接口文档见 [frontend/详细接口文档.md](frontend/详细接口文档.md)

### 认证模块

| 方法 | 路径 | 说明 |
|:----:|------|------|
| `POST` | `/auth/register` | 用户注册 |
| `POST` | `/auth/login` | 用户登录 |
| `POST` | `/auth/logout` | 退出登录 |
| `GET` | `/auth/me` | 获取当前用户信息 |

### 对话模块

| 方法 | 路径 | 说明 |
|:----:|------|------|
| `GET` | `/chats` | 获取对话列表 |
| `POST` | `/chats` | 创建对话 |
| `GET` | `/chats/{chat_id}` | 获取对话详情 |
| `DELETE` | `/chats/{chat_id}` | 删除对话 |

### 消息模块

| 方法 | 路径 | 说明 |
|:----:|------|------|
| `POST` | `/message/send` | 发送消息（SSE 流式回复） |
| `POST` | `/files/upload` | 上传文件 |

### 知识库模块（开发中）

| 方法 | 路径 | 说明 |
|:----:|------|------|
| `POST` | `/knowledge-bases` | 创建知识库 🚧 |
| `GET` | `/knowledge-bases` | 获取知识库列表 🚧 |

---

## 🔑 环境变量说明

| 变量名 | 说明 | 获取方式 |
|--------|------|---------|
| `DASHSCOPE_API_KEY` | 阿里云通义千问 API 密钥 | [DashScope 控制台](https://dashscope.console.aliyun.com/) |
| `DASHSCOPE_BASE_URL` | DashScope API 地址 | 固定值，见 `.env.example` |
| `TAVILY_API_KEY` | Tavily 搜索 API 密钥 | [Tavily 官网](https://tavily.com/) |
| `SECRET_KEY` | JWT 签名密钥 | 自行生成随机字符串 |
| `DATABASE_URL` | 数据库连接字符串 | 默认 SQLite，无需修改 |

---

## 📸 功能预览

<details>
<summary>🖥️ 点击查看功能截图</summary>

> 截图待补充

</details>

---

## 📜 License

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

本项目采用 MIT 协议开源，可自由使用、修改和分发。

---

## 🙋 说明

这是一个学习阶段的项目，用于实践 FastAPI + LangChain 全栈开发。代码和文档会随学习进度持续更新。
