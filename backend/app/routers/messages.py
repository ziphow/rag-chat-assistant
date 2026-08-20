from fastapi import APIRouter, Depends, HTTPException,status
from fastapi.responses import StreamingResponse

from datetime import datetime

from sqlmodel import select, Field, func
from pydantic import BaseModel

from app.database import get_session,User,Chat,Message,KnowledgeBases,KnowledgeDocuments,DocStatus
from app.dependencies import get_current_user
from app.services.sse_stream import event_stream
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

# 发送消息接口，流式回复
@router.post("/message/send")
async def send_messages(message: UserMessages,
                        current_user: User = Depends(get_current_user),
                        session=Depends(get_session)):
    # 验证权限
    chat = (await session.exec(select(Chat).where(Chat.id == message.chat_id))).first()
    if not chat :
        raise HTTPException(status_code=status.HTTP_404_FORBIDDEN, detail="对话不存在")
    if chat.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作该对话")
    if  message.kb_id:
        kb = await session.get(KnowledgeBases, message.kb_id)
        if not kb:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")
        if kb.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该知识库！")
        # 检查是否有处理中文档，有则拒绝
        processing_count = (await session.exec(
            select(func.count(KnowledgeDocuments.id))
            .where(KnowledgeDocuments.kb_id == message.kb_id)
            .where(KnowledgeDocuments.status == DocStatus.processing)
        )).one()
        if processing_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="知识库中有文档正在处理中，请等待处理完成后再发送消息"
            )

    # 1. 保存用户消息
    user_message = Message(
        chat_id=message.chat_id, role="user", content=message.content,
        images=[img.model_dump() for img in message.images] if message.images else None,
        files=[f.model_dump() for f in message.files] if message.files else None,
    )
    chat.updated_at = datetime.now()
    session.add(user_message)
    await session.flush()

    # 3、调用 app.services.sse_stream 的 event_stream函数实现流式回复
    return StreamingResponse(
        event_stream(
            message.chat_id, message.content, session, message.images, message.files,message.kb_id
        ),
        media_type="text/event-stream"
    )

