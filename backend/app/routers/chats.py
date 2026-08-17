from fastapi import APIRouter, Depends,Form, HTTPException

from sqlmodel import select,delete,update, Field, SQLModel
from sqlalchemy import func

from app.database import get_session,User,Chat,Message
from app.dependencies import get_current_user

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
    #print("当前用户是：", current_user.id)
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
    #print("当前对话是：", chat_id)
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

    await session.exec(
        delete(Message).where(Message.chat_id == chat_id)
    )
    await session.exec(
        delete(Chat).where(Chat.id == chat_id)
    )

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

    await session.exec(
        delete(Message).where(Message.chat_id == chat_id)
    )
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


from app.ai.title_generator import get_new_title
@router.get("/chats/{chat_id}/craete_title")
async def create_title(chat_id: int,
                        current_user: User = Depends(get_current_user),
                        session=Depends(get_session)):
    # 先查对话，确认归属权
    chat = (await session.exec(select(Chat).where(Chat.id == chat_id))).first()
    if chat is None or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="对话不存在")

    stmt = select(Message.content).where(Message.chat_id == chat_id,Message.role=="user")
    res = (await session.exec(stmt)).first()
    print(type(res))
    new_title = get_new_title(res)

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