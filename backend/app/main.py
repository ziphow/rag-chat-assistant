import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.database import create_db_and_tables, engine
from app.routers.auth import router as auth_router
from app.routers.chats import router as chat_router
from app.routers.messages import router as message_router
from app.routers.files import router as file_router
from app.routers.knowledge_bases import router as knowledge_base_router
from app.services.file_utils import cleanup_orphan_uploads

# 定义 lifespan 上下文管理器
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时确保运行时目录存在：有则用，无则建（sqlite/chroma/uploads）
    for d in ("uploads", "data/checkpoint", "data/chroma_db"):
        os.makedirs(d, exist_ok=True)
    print("服务器启动成功")
    await create_db_and_tables() # 异步创建系统数据库表
    # 清理超过 24h 未被任何消息引用的孤儿上传文件（防占满小磁盘）
    try:
        await cleanup_orphan_uploads(engine, max_age_hours=24)
    except Exception as e:  # 清理失败不阻塞启动
        print(f"孤儿文件清理跳过: {e}")
    yield
    print("服务器关闭成功")


# 在创建 app 实例时传入 lifespan
app = FastAPI(lifespan=lifespan)

# 允许所有来源访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件目录（让图片 URL 可访问）
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 挂载路由
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(message_router)
app.include_router(file_router)
app.include_router(knowledge_base_router)
