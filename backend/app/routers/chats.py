from fastapi import APIRouter, Depends, HTTPException

from sqlmodel import select,delete, Field, SQLModel
from sqlalchemy import func

from app.database import get_session,User,Chat,Message
from app.dependencies import get_current_user
from app.ai.agent import delete_checkpoints
from app.services.file_utils import delete_files_from_messages

router = APIRouter()

@router.get("/chats")
async def list_chats(current_user: User = Depends(get_current_user),
                     session=Depends(get_session)):
    stmt = (
        select(Chat, func.count(Message.id).label("message_count"))
        .outerjoin(Message, Message.chat_id == Chat.id)
        .where(Chat.user_id == current_user.id)
        .group_by(Chat.id)
        .order_by(Chat.updated_at.desc())
    )
    res = await session.exec(stmt)
    rows = res.all()

    return {
        "code": 200,
        "message": "成功",
        "data": [
            {
                "id": chat.id,
                "title": chat.title,
                "messageCount": msg_count,
                "createdAt": chat.created_at,
                "updatedAt": chat.updated_at,
            }
            for chat, msg_count in rows
        ]
    }

class NewChat(SQLModel):
    title: str = Field(default="新对话")
@router.post("/chats")
async def create_chat(new_chat: NewChat,
                    current_user: User = Depends(get_current_user),
                    session=Depends(get_session),):
    chat=Chat(
        user_id=current_user.id,
        title=new_chat.title,
    )
    session.add(chat)
    await session.flush()

    return {
        "code": 200,
        "message": "创建成功",
        "data": {
            "id": chat.id,
            "title": chat.title,
            "messageCount": 0,
            "createdAt": chat.created_at,
            "updatedAt": chat.updated_at,
        }
    }
@router.get("/chats/{chat_id}")
async def get_chat(chat_id: int,
                    current_user: User = Depends(get_current_user),
                   session=Depends(get_session)):
    # 先查对话，确认归属权
    chat = (await session.exec(select(Chat).where(Chat.id == chat_id))).first()
    if chat is None or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="对话不存在")

    stmt = select(Message).where(Message.chat_id == chat_id)
    res = await session.exec(stmt)
    rows = res.all()
    return {
        "code": 200,
        "message": "成功",
        "data":rows
    }

@router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: int,
                      current_user: User = Depends(get_current_user),
                      session=Depends(get_session)):
    # 先查对话，确认归属权
    chat = (await session.exec(select(Chat).where(Chat.id == chat_id))).first()
    if chat is None or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="对话不存在")

    # ★ [后端修改] 删除对话时，先收集消息中所有图片/文件 URL，清理磁盘上的本地文件
    msgs = (await session.exec(select(Message).where(Message.chat_id == chat_id))).all()
    delete_files_from_messages(msgs)

    # 清理 数据库 记录
    await session.exec(
        delete(Message).where(Message.chat_id == chat_id)
    )
    await session.exec(
        delete(Chat).where(Chat.id == chat_id)
    )

    # 清理 LangGraph 记忆
    await delete_checkpoints(chat_id)

    return {
        "code": 200,
        "message": "删除成功",
        "data": None
    }

@router.delete("/chats/{chat_id}/messages")
async def delete_messages(chat_id: int,
                          current_user: User = Depends(get_current_user),
                          session=Depends(get_session)):
    # 先查对话，确认归属权
    chat = (await session.exec(select(Chat).where(Chat.id == chat_id))).first()
    if chat is None or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="对话不存在")

    # ★ [后端修改] 清空消息时，先收集消息中所有图片/文件 URL，清理磁盘上的本地文件
    msgs = (await session.exec(select(Message).where(Message.chat_id == chat_id))).all()
    delete_files_from_messages(msgs)

    # 清理 数据库 记录
    await session.exec(
        delete(Message).where(Message.chat_id == chat_id)
    )
    # 清理 LangGraph 记忆
    await delete_checkpoints(chat_id)
    return {
        "code": 200,
        "message": "已清空消息",
        "data": None
    }


class NewTitle(SQLModel):
    title: str = Field(default="新对话")
@router.put("/chats/{chat_id}")
async def update_chat(chat_id: int,new_title:NewTitle,
                      current_user: User = Depends(get_current_user),
                      session=Depends(get_session)):
    # 先查对话，确认归属权
    chat = (await session.exec(select(Chat).where(Chat.id == chat_id))).first()
    if chat is None or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="对话不存在")

    chat.title = new_title.title
    session.add(chat)

    return {
        "code": 200,
        "message": "修改成功",
        "data": {
            "id": chat.id,
            "title":chat.title
        }
    }


from app.Schemas.model import UserMessage
from app.ai.title_generator import get_new_title
@router.get("/chats/{chat_id}/create_title")
async def create_title(chat_id: int,
                        current_user: User = Depends(get_current_user),
                        session=Depends(get_session)):
    # 先查对话，确认归属权
    chat = (await session.exec(select(Chat).where(Chat.id == chat_id))).first()
    if chat is None or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="对话不存在")

    stmt = select(Message).where(Message.chat_id == chat_id,Message.role=="user")
    res = (await session.exec(stmt)).first()

    user_message = UserMessage(
        chat_id=chat_id,
        content = res.content,
        images=res.images,
        files=res.files,
    )

    new_title = get_new_title(user_message)

    chat = await session.get(Chat, chat.id)
    if chat:
        chat.title = new_title


    return {
        "code": 200,
        "message": "修改成功",
        "data": {
            "id": chat.id,
            "title": chat.title
        }
    }


# ===================================================================
# 【后端新增】文件查询接口
#   GET /files/sent            本用户所有对话中发送的文件（按对话分组）
#   GET /chats/{chat_id}/files 单个对话中发送的文件
# ===================================================================

@router.get("/files/sent")
async def list_sent_files(current_user: User = Depends(get_current_user),
                          session=Depends(get_session)):
    """获取当前用户所有对话中作为消息发送的文件（图片 + 文件），按对话分组返回。"""
    # 联表查询该用户所有 user 消息（images / files 为 JSON 字段）
    stmt = (
        select(Message, Chat.title)
        .join(Chat, Message.chat_id == Chat.id)
        .where(Chat.user_id == current_user.id)
        .where(Message.role == "user")
        .order_by(Message.created_at.desc())
    )
    rows = (await session.exec(stmt)).all()

    # 按对话分组聚合图片与文件
    grouped = {}
    for msg, chat_title in rows:
        if not msg.images and not msg.files:
            continue
        if msg.chat_id not in grouped:
            grouped[msg.chat_id] = {
                "chat_id": msg.chat_id,
                "chat_title": chat_title,
                "images": [],
                "files": [],
            }
        grouped[msg.chat_id]["images"].extend(msg.images or [])
        grouped[msg.chat_id]["files"].extend(msg.files or [])

    return {
        "code": 200,
        "message": "成功",
        "data": list(grouped.values()),
    }


@router.get("/chats/{chat_id}/files")
async def list_chat_files(chat_id: int,
                          current_user: User = Depends(get_current_user),
                          session=Depends(get_session)):
    """获取单个对话中作为消息发送的文件（图片 + 文件）。"""
    # 先校验对话归属权
    chat = (await session.exec(select(Chat).where(Chat.id == chat_id))).first()
    if chat is None or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="对话不存在")

    stmt = (
        select(Message)
        .where(Message.chat_id == chat_id, Message.role == "user")
        .order_by(Message.created_at.desc())
    )
    rows = (await session.exec(stmt)).all()

    images, files = [], []
    for msg in rows:
        if msg.images:
            images.extend(msg.images)
        if msg.files:
            files.extend(msg.files)

    return {
        "code": 200,
        "message": "成功",
        "data": {"chat_title": chat.title, "images": images, "files": files},
    }