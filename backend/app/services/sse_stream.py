import json

from langchain_core.messages import AIMessageChunk, HumanMessage

from app.database import Message
from app.ai.agent import get_agent
from app.services.image_utils import image_url_to_base64


async def event_stream(chat_id: int, content: str, images: list, files: list, session):
    """SSE 流式生成器，负责调用 AI 并逐块返回"""

    yield f"data: {json.dumps({'type': 'start'})}\n\n"

    full_content = ""
    # 构造消息
    content_blocks = []
    if content:
        content_blocks.append({"type": "text", "text": content})
    if images:
        for img in images:
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
        config={"configurable": {"thread_id": chat_id}},
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
    ai_message = Message(chat_id=chat_id, role="ai", content=full_content)
    session.add(ai_message)

    await session.flush()
    await session.commit()

    # 发送 done 事件
    yield f"data: {json.dumps({'type': 'done', 'messageId': ai_message.id})}\n\n"