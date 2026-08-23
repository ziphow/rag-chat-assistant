# 知源 AI — 智能知识助手

一个基于 **FastAPI + LangChain** 构建的 RAG（检索增强生成）对话应用，围绕知识库提供智能问答，并支持图片分析与文件解析。前端是一个长滚动单页应用（含 3D 画廊落地页与聊天工作台），由 **Nginx** 托管，前后端统一同源部署。（当前版本 **v1.2.0**，开源仓库见网页「关于」面板或文末链接）

## ✨ 功能特性

- **智能对话**：基于大模型的多轮对话，支持思考过程展示与 **SSE 流式输出**
- **知识库问答**：上传文档到知识库，基于 **RAG + Chroma 向量检索**精准回答
- **图片分析 / 文件解析**：上传图片、PDF、Word 等文件，AI 直接理解内容
- **图片与文件上传**：支持选择 / 粘贴 / 拖拽，本地磁盘存储（单文件 ≤ 10MB）
- **联网搜索**：Agent 内置 **Tavily** 网页搜索工具
- **模型额度自动切换**：LLM 优先列表用尽后自动切换下一可用模型
- **画廊轮播**：登录页 3D 圆柱画廊，滚动 / 滑动可触发旋转
- **多用户体系**：注册 / 登录 / **JWT 鉴权** / 动态头像
- **对话管理**：新建 / 重命名 / 删除 / 清空对话，按时间排序
- **关于弹窗**：登录页与聊天页均可打开，含开源仓库、版本、技术栈、免责声明与侵权联系

## 🚀 技术栈

- **前端**：原生 HTML / CSS / JavaScript，GSAP 动画，KaTeX 公式渲染，3D 画廊，移动端响应式适配
- **后端**：FastAPI，LangChain + LangGraph（RAG / Agent 链路），Chroma 向量库，SSE 流式输出，JWT 鉴权，SQLModel / SQLAlchemy 异步 ORM
- **存储**：MySQL 8（关系数据）；上传的图片与文件存本地磁盘，向量库持久化于 `data/chroma_db`
- **部署**：Docker / Docker Compose，Nginx 反向代理 + 静态托管，GitHub Actions 智能 CI/CD

## 📁 项目结构

```
frontend/              前端静态资源（HTML/CSS/JS）与 Nginx 配置
  └─ js/               业务模块（chat / auth / knowledge-base / file-upload / gallery …）
backend/app            后端 FastAPI 应用（routers / ai / rag / services / Schemas 分层）
backend/.env.example   环境变量模板
compose.yaml           服务编排（frontend / backend / db）
docs/                  学习笔记、接口文档与截图
tools/                 本地开发工具（真机预览代理）
```

## 🚀 快速开始

### 环境要求
- Docker & Docker Compose
- 一个 OpenAI 兼容或 DashScope 的大模型 API（走 `.env` 配置）

### 启动步骤
1. 复制环境变量模板并填写密钥：
   ```bash
   cp backend/.env.example backend/.env
   # 编辑 backend/.env：填入模型 API Key、数据库密码、JWT SECRET_KEY 等
   ```
2. 启动全部服务：
   ```bash
   docker compose up -d --build
   ```
3. 访问 `http://localhost`（或服务器公网 IP），注册账号即可使用。

## 🔧 配置说明

- `backend/.env`：应用密钥、模型 API Key（DeepSeek / 阿里千问 DashScope / Tavily 搜索）、JWT、模型优先级等
- `DATABASE_URL`：MySQL 连接串（`compose.yaml` 会自动注入指向容器内 `db` 服务）
- 关键变量：`DASHSCOPE_API_KEY`、`TAVILY_API_KEY`、`SECRET_KEY`、`BACKEND_BASE_URL`（部署同源时留空 `""`）、`LLM_MODEL_PRIORITY` / `TITLE_MODEL_PRIORITY` / `EMBEDDING_MODEL`
- 向量嵌入使用 DashScope 的 `qwen` 系模型，向量库为 Chroma（持久化于 `data/chroma_db`）

## 🔌 主要接口

- 认证：`/auth/login` `/auth/register` `/auth/me` `/auth/logout`
- 对话：`/chats` 及 `/chats/{chat_id}/messages` 等（消息发送走 SSE 流式 `/message/send`）
- 文件：`/files/upload`（≤10MB、白名单类型）
- 知识库：`/knowledge-bases` 及文档上传 / 删除接口

## 🤝 贡献

欢迎提 Issue / PR。主要分支：`main`。改动 `.py/.js/.html/.css/Dockerfile` 会触发智能自动部署（仅文档改动不会部署）。

## 📄 许可证 / 免责声明

本项目仅用于**个人学习与交流**，不作为生产级服务使用。AI 生成内容仅供参考，请自行核实重要信息。

**素材与版权**：登录页画廊壁纸素材来源为【哲风壁纸 / 样片日记 / 个人学习用途】；如内容或素材涉及您的版权、需要删除，请邮件至 **lihao.dev@outlook.com**，核实后及时处理。

## 📧 联系

- 邮箱：lihao.dev@outlook.com
- 仓库：github.com/ziphow/rag-chat-assistant