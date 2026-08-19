from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from datetime import datetime

from langchain_core.messages import AIMessageChunk, HumanMessage
from sqlmodel import select, Field
from pydantic import BaseModel

from app.database import get_session,User,Chat,Message
from app.dependencies import get_current_user
from app.services.sse_stream import event_stream
from app.rag.rag import retrieve_relevant_docs
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
    kb_id: int | None = Field(description="知识库 ID。传入时 AI 会先检索知识库相关内容再回答")

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
    chat.updated_at = datetime.now()
    session.add(user_message)
    await session.flush()

    # 2. 检查是否引用了知识库
    if message.kb_id:
        # 1. 检索相关文档片段
        relevant_chunks = await retrieve_relevant_docs(message.kb_id, message.content)
        # 2. 将检索结果拼接到用户消息中
        context = "\n\n".join(relevant_chunks)
        message.content = f"以下是知识库中的相关内容，请基于这些内容回答：\n\n{context}\n\n用户问题：{message.content}"

    # 返回 StreamingResponse
    return StreamingResponse(
        event_stream(
            message.chat_id, message.content, message.images, message.files, session
        ),
        media_type="text/event-stream"
    )

