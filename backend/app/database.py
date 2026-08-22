from typing import Optional, List
from datetime import datetime
from enum import Enum
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
    thinking: Optional[str] = Field(default=None, sa_type=Text) # AI 的思考过程，可为空
    images: Optional[list] = Field(default=None, sa_type=JSON)  # JSON 字段，可为空
    files: Optional[list] = Field(default=None, sa_type=JSON)   # JSON 字段，可为空
    created_at: datetime = Field(
        default_factory=datetime.now,
        sa_column=Column(DateTime, server_default=func.now())
    )

    # 关系
    chat: Chat = Relationship(back_populates="messages")

# ---------------------------------------RAG模块相关表-----------------------------------------
# ------------------------ 知识库表 --------------------
class KnowledgeBases(SQLModel, table=True):
    __tablename__ = "knowledge_bases"

    id: Optional[int] = Field(default=None, primary_key=True,description="自增主键")
    user_id: int = Field(foreign_key="users.id", nullable=False,description="所属用户")
    name: str = Field(..., nullable=False,max_length=100,description="知识库名称")
    description:str=Field(default="暂无描述",max_length=1000,nullable=False,description="知识库描述")
    created_at: datetime = Field(
        default_factory=datetime.now,description="创建时间",
        sa_column=Column(DateTime, server_default=func.now())
    )
    updated_at: datetime = Field(
        default_factory=datetime.now,description="修改时间",
        sa_column=Column(DateTime, server_default=func.now(), onupdate=func.now())
    )

# ------------------------ 知识库文档表 --------------------
class DocStatus(str, Enum):
    processing = "processing"
    success = "success"
    failed = "failed"

class KnowledgeDocuments(SQLModel, table=True):
    __tablename__ = "knowledge_documents"

    id: Optional[int] = Field(default=None, primary_key=True,description="自增主键")
    kb_id:int = Field(foreign_key="knowledge_bases.id", nullable=False,description="外键，所属知识库")
    filename:str=Field(...,max_length=255,description="原始文件名")
    file_path:str=Field(...,max_length=500,description="服务器存储路径")
    file_size:int=Field(...,description="文件大小（字节）")
    status: DocStatus = Field(default=DocStatus.processing, description="处理状态")
    chunk_count:int=Field(...,description="分块数量")
    created_at: datetime = Field(
        default_factory=datetime.now, description="创建时间",
        sa_column=Column(DateTime, server_default=func.now())
    )

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


