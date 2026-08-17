from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship, JSON
from sqlalchemy import Text, func, Column, DateTime

# ---------- 用户表 ----------
class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(max_length=50, unique=True, nullable=False)
    email: str = Field(max_length=100, unique=True, nullable=False)
    password_hash: str = Field(nullable=False)
    avatar: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(
        default_factory=datetime.now,
        sa_column=Column(DateTime, server_default=func.now())
    )

    # 关系
    chats: List["Chat"] = Relationship(back_populates="user")


# ---------- 对话表 ----------
class Chat(SQLModel, table=True):
    __tablename__ = "chats"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False)  # 外键，非空
    title: str = Field(max_length=200, nullable=False)
    created_at: datetime = Field(
        default_factory=datetime.now,
        sa_column=Column(DateTime, server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=datetime.now,
        sa_column=Column(DateTime, server_default=func.now(), onupdate=func.now())
    )

    # 关系
    user: User = Relationship(back_populates="chats")
    messages: List["Message"] = Relationship(back_populates="chat")


# ---------- 消息表 ----------
class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: int = Field(foreign_key="chats.id", nullable=False)  # 外键，非空
    role: str = Field(max_length=10, nullable=False)   # "user" 或 "ai"
    content: str = Field(sa_type=Text, nullable=False) # 使用 TEXT 类型
    images: Optional[list] = Field(default=None, sa_type=JSON)  # JSON 字段，可为空
    files: Optional[list] = Field(default=None, sa_type=JSON)   # JSON 字段，可为空
    created_at: datetime = Field(
        default_factory=datetime.now,
        sa_column=Column(DateTime, server_default=func.now())
    )

    # 关系
    chat: Chat = Relationship(back_populates="messages")


#------创建表--------
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine


#加载环境变量
load_dotenv()

#创建异步引擎
engine = create_async_engine(
    os.getenv("DATABASE_URL"), echo=True
)

# 异步创建表
async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


from sqlmodel.ext.asyncio.session import AsyncSession
# 获取异步 Session 的依赖项
async def get_session() -> AsyncSession:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        try:
            yield session
            await session.commit()  # 正常结束后自动提交
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


