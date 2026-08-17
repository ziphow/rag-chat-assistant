from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import json
from datetime import datetime

from langchain_core.messages import AIMessageChunk, HumanMessage
from sqlmodel import select, Field
from pydantic import BaseModel

from app.database import get_session,User,Chat,Message
from app.dependencies import get_current_user
from app.ai.agent import get_agent
from app.services.image_utils import image_url_to_base64

router = APIRouter()


class Image(BaseModel):
    url: str | None=Field(description="图片url")
    name: str| None=Field(description="图片名称")
class File(BaseModel):
    fileId: str | None = Field(description="文件")
    name: str | None = Field(description="文件名称")
    size: int | None = Field(description="文件大小")
class UserMessages(BaseModel):
    chat_id: int=Field(...,description="对话 ID")
    content: str | None =Field(description="文本消息内容（与图片/文件至少有一个）")
    images:list[Image] | None=Field(description="图片数组，每项包含 url、name")
    files: list[File] | None = Field(description="文件数组，每项包含 fileId、name、size")

@router.post("/message/send")
async def send_messages(message: UserMessages,
                        current_user: User = Depends(get_current_user),
                        session=Depends(get_session)):
    # 验证权限
    chat = (await session.exec(select(Chat).where(Chat.id == message.chat_id))).first()
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作该对话")

    # 1. 保存用户消息
    user_message = Message(
        chat_id=message.chat_id, role="user", content=message.content,
        images=[img.model_dump() for img in message.images] if message.images else None,
        files=[f.model_dump() for f in message.files] if message.files else None,
    )
    session.add(user_message)
    await session.flush()

    # 2. 定义生成器函数，逐块产出 SSE 事件
    async def event_stream():
        yield f"data: {json.dumps({'type': 'start'})}\n\n"

        full_content = ""
        # 构造消息
        content_blocks = []
        if message.content:
            content_blocks.append({"type": "text", "text": message.content})
        if message.images:
            for img in message.images:
                content_blocks.append({
                    "type": "image_url",
                    "image_url": {"url": image_url_to_base64(img.url)}
                })
        human_message = HumanMessage(content=content_blocks)
        # 用 stream_mode="messages" 拿到 token 级别流式
        agent = await get_agent()
        async for msg, metadata in agent.astream(
            {
                "messages": [human_message]
            },
            stream_mode="messages",
            config={"configurable": {"thread_id": user_message.chat_id}},
        ):
            # ★ 只处理 AI 消息块，跳过工具消息(ToolMessage)等
            if not isinstance(msg, AIMessageChunk):
                continue
            # ★ 跳过工具调用请求（content 为空的是工具调用指令，不是回复内容）
            content = getattr(msg, 'content', None)
            if not content:
                continue

            full_content += content
            yield f"data: {json.dumps({'type': 'chunk', 'content': content})}\n\n"

        # 保存 AI 消息
        ai_message = Message(chat_id=message.chat_id, role="ai", content=full_content)
        session.add(ai_message)
        #更新时间
        current_chat = (await session.exec(select(Chat).where(Chat.id == message.chat_id))).first()
        chat.updated_at = datetime.now()
        session.add(current_chat)
        await session.flush()
        await session.commit()

        # 发送 done 事件
        yield f"data: {json.dumps({'type': 'done', 'messageId': ai_message.id})}\n\n"

    # 3. 返回 StreamingResponse
    return StreamingResponse(event_stream(), media_type="text/event-stream")

