from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.database import create_db_and_tables
from app.routers.auth import router as auth_router
from app.routers.chats import router as chat_router
from app.routers.messages import router as message_router
from app.routers.files import router as file_router

# 定义 lifespan 上下文管理器
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("服务器启动成功")
    await create_db_and_tables() # 异步创建系统数据库表
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
