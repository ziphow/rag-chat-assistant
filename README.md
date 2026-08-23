# 知源 AI — 智能知识助手

> 一个围绕**知识库问答**构建的 RAG（检索增强生成）对话应用，也能看图、解析文档、联网搜索。

「知源 AI」基于 **FastAPI + LangChain** 实现，前端是原生 HTML/CSS/JS 的单页应用（长滚动落地页 + 聊天工作台），由 **Nginx** 托管并与后端**同源反代**部署。项目包含功能完整的登录注册、多轮对话（SSE 流式 + 思考过程）、知识库向量检索、图片/文件上传与 AI 理解，以及一个可交互的 3D 画廊落地页。

- 版本：**v1.2.0** · 许可：[MIT](LICENSE) · 部署：Docker Compose + GitHub Actions
- 截图：[落地页](docs/screenshots/landing-page.png) · [登录页](docs/screenshots/login-page.png)

---

## ✨ 功能特性

- **智能多轮对话**：基于大模型，**SSE 流式输出** + **思考过程展示**（think），可折叠
- **知识库问答（RAG）**：上传文档入库，**Chroma 向量检索**精准回答
- **图片分析 / 文件解析**：上传图片、PDF、Word、Excel 等，AI 直接理解内容
- **图片与文件上传**：支持选择 / 粘贴 / 拖拽，**本地磁盘存储**，单文件 ≤ 10MB
- **联网搜索**：Agent 内置 **Tavily** 网页搜索工具
- **模型额度自动切换**：优先列表用尽后固化切换到下一可用模型
- **多用户体系**：注册 / 登录 / **JWT 鉴权** / 动态头像
- **对话管理**：新建 / 重命名 / 删除 / 清空对话，按时间排序
- **3D 画廊落地页**：滚动 / 滑动可旋转的圆柱画廊，内置 AI 生成壁纸
- **「关于」弹窗**：登录页与聊天页均可打开，含开源仓库、版本、技术栈、免责声明与侵权联系

---

## 🚀 技术栈

| 层 | 技术 |
|:--|:--|
| **前端** | 原生 HTML / CSS / JavaScript · GSAP 动画 · KaTeX 公式渲染 · 3D 画廊 · 移动端响应式适配 |
| **后端** | FastAPI · LangChain 1.3 · LangGraph · Chroma 向量库 · DashScope（通义千问）· Tavily 搜索 · SSE 流式 · JWT |
| **数据库** | MySQL 8（SQLModel / SQLAlchemy 异步 ORM）· 上传文件与向量库存本地磁盘 |
| **部署** | Docker / Docker Compose · Nginx 反向代理 + 静态托管 · GitHub Actions 智能 CI/CD |

---

## 📁 项目结构

```
frontend/                 前端静态资源（HTML/CSS/JS）与 Nginx 配置
  ├─ nginx.conf           静态托管 + 后端 API /uploads 反代
  ├─ index.html           单页：登录页 + 聊天工作台
  └─ js/                  业务模块（chat/auth/knowledge-base/file-upload/gallery …）
backend/app               后端 FastAPI 主应用
  ├─ routers/             路由入口（auth/chats/messages/files/knowledge_bases）
  ├─ ai/                  LLM 额度切换、Agent、思考补丁、标题生成
  ├─ rag/                 文档加载、Chroma 向量库、RAG 检索链路
  ├─ services/            鉴权、SSE 流式、文件工具
  ├─ Schemas/             请求/响应模型
  ├─ database.py          数据模型（User/Chat/Message/Knowledge）与异步引擎
  └─ config.py            集中环境变量配置
backend/.env.example      后端环境变量模板
compose.yaml              服务编排（db / backend / frontend）
docs/                     学习笔记、接口文档、截图
tools/preview-proxy.js    本地真机预览代理（开发工具）
```

---

## 🚀 快速开始

### 1. 配置环境变量
```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env：填入模型 API Key、JWT SECRET_KEY 等
```

### 2. 启动全部服务
```bash
docker compose up -d --build
```
- 访问 `http://localhost`（或服务器公网 IP）即进入「知源 AI」
- `compose.yaml` 已自动注入 `DATABASE_URL`（指向容器内 MySQL：`rag_chat` 库）与 `BACKEND_BASE_URL=""`（前后端同源，文件走相对路径）

### 3. 账号
在登录页自行注册新账号即可使用（JWT 鉴权，24h 有效）。

---

## 🔧 环境变量说明

> 后端读取 `backend/.env`；MySQL 相关变量可由根目录 `.env` 或 shell 环境覆盖。

| 变量 | 说明 |
|:--|:--|
| `DASHSCOPE_API_KEY` | 阿里云通义千问 API Key（对话 / 多模态） |
| `DASHSCOPE_BASE_URL` | 千问兼容模式地址（默认 `…/compatible-mode/v1`） |
| `DASHSCOPE_WORKSPACE_BASE_URL` | 向量模型工作空间地址 |
| `DEEPSEEK_API_KEY` | 深度求索 API Key（可选） |
| `TAVILY_API_KEY` | Tavily 网页搜索 Key（Agent 工具） |
| `DATABASE_URL` | MySQL 连接串（compose 会自动覆盖指向 `db` 服务） |
| `SECRET_KEY` | JWT 密钥，**生产务必改为随机长字符串** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token 有效期（默认 1440 = 24h） |
| `BACKEND_BASE_URL` | 文件访问基础地址；部署同源时留空 `""` |
| `LLM_MODEL_PRIORITY` | 对话模型优先列表（逗号分隔，额度用尽自动切换） |
| `TITLE_MODEL_PRIORITY` | 标题生成模型优先列表 |
| `EMBEDDING_MODEL` | 文本嵌入模型（默认 qwen 系） |
| `MYSQL_ROOT_PASSWORD` / `MYSQL_DATABASE` | 根 `.env` 中 MySQL 密码与库名 |

> 向量嵌入使用 DashScope（`LangChain` 的 `DashScopeEmbeddings`），向量库为 Chroma，持久化于 `data/chroma_db`。

---

## 🔌 API 概览

| 模块 | 端点 |
|:--|:--|
| 认证 | `POST /auth/login` · `POST /auth/register` · `GET /auth/me` · `POST /auth/logout` |
| 对话 | `GET/POST /chats` · `GET/PUT/DELETE /chats/{chat_id}` · `DELETE /chats/{chat_id}/messages` · `GET /chats/{chat_id}/create_title` · `GET /chats/{chat_id}/files` · `GET /files/sent` |
| 消息 | `POST /message/send`（SSE 流式，支持 images/files） |
| 文件 | `POST /files/upload` |
| 知识库 | `POST/GET /knowledge-bases` · `POST/GET /knowledge-bases/{kb_id}/documents` · `DELETE /knowledge-bases/{kb_id}/documents/{doc_id}` · `DELETE /knowledge-bases/{kb_id}` |

> 完整请求/响应字段见 [docs/详细接口文档.md](docs/详细接口文档.md)。

---

## 💻 本地开发（不依赖 Docker）

前端 `config.js` 会自动判断后端地址：
- 通过 `file://` 直接打开，或访问 `localhost`/`127.0.0.1` → 指向本地后端 `http://127.0.0.1:8000`
- 其他域名访问 → 走**同源相对路径**（生产部署，经 nginx 反代）

典型流程：本地起后端 `uvicorn app.main:app --reload --port 8000`，用任意静态服务器打开 `frontend` 即可。

**真机预览**：开发 `tools/preview-proxy.js` 可将前端静态资源（本地最新代码）+ 线上后端 API 一起代理到一个局域网地址，手机连同一 Wi-Fi 即实时实测，无需每次部署。

---

## 📦 上传与文件存储

- 上传文件存于本地磁盘 `./backend/uploads`（compose 中已挂载持久化卷）
- **单文件 ≤ 10MB**，类型为白名单（图片 / 常用文档 / 压缩包），文件名用 UUID 防路径穿越
- 删除对话 / 知识库文档会**同步清理磁盘文件**；应用启动时自动清理**未被任何消息引用且超 24h** 的孤儿文件，避免小磁盘被占满

---

## ⚙️ 部署与 CI/CD

- 服务组成：`db`(MySQL) + `backend`(FastAPI, 仅内部) + `frontend`(Nginx, 暴露 80)
- **GitHub Actions**（`.github/workflows/deploy.yml`）：push 到 `main` 触发，智能分析本次改动：
  - 改动 `backend/` → 重建 `backend`
  - 改动 `frontend/` → 重建 `frontend`
  - 改动 `compose.yaml` / `Dockerfile` → 重建全部
  - 仅 `.md` / `docs` → 跳过部署
- 服务器前置：开放安全组端口 80（HTTP）与 22（SSH）；配置 SSH Deploy Key 与仓库 `Secrets`（`SERVER_SSH_KEY` / `SERVER_HOST` / `SERVER_USER` / `SERVER_PORT`）

---

## 🖼️ 素材与版权

- 登录页画廊壁纸素材来源：**哲风壁纸 · 样片日记 · 个人学习用途**
- 如页面内容或素材涉及您的版权、需要删除，请邮件至 **lihao.dev@outlook.com**，核实后及时处理。

## 📄 免责声明

本项目仅用于**个人学习与交流**，不作为生产级服务使用。AI 生成内容仅供参考，请自行核实重要信息；因使用产生的任何后果，本项目不承担相关责任。

---

## 🤝 贡献

欢迎提交 Issue / Pull Request。主要分支：`main`。

## 📧 联系

- 邮箱：lihao.dev@outlook.com