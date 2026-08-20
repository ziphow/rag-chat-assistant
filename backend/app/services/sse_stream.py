import json

from langchain_core.messages import AIMessageChunk, HumanMessage

from sqlalchemy import select

from app.database import Message ,KnowledgeDocuments
from app.ai.agent import get_agent,AgentContext
from app.services.image_utils import image_url_to_base64
from app.rag.rag import retrieve_relevant_docs

async def event_stream(
        chat_id: int,
        user_content: str,
        session,
        images: list | None = None,
        files: list | None = None,
        kb_id:int | None = None,
):
    """SSE 流式生成器，负责调用 AI 并逐块返回"""

    yield f"data: {json.dumps({'type': 'start'})}\n\n"

    full_content = ""
    # 构造消息
    content_blocks = []
    temp_instruction = None
    rag_content = ""
    if images:
        for img in images:
            content_blocks.append({
                "type": "image_url",
                "image_url": {"url": image_url_to_base64(img.url)}
            })
    if files:
        pass
    if kb_id:
        if (await session.exec(
                select(KnowledgeDocuments).where(KnowledgeDocuments.kb_id == kb_id)
            )).one_or_none():
            # 1. 检索相关文档片段
            relevant_chunks = await retrieve_relevant_docs(kb_id, user_content)
            # 2. 生成资料结果
            rag_content = "\n\n".join(relevant_chunks) + "\n\n 资料结束，请回答用户问题(可能为文字，图片，文件中的一个或多个)： \n\n"
            # 3、动态追加系统提示词
            temp_instruction = """
            用户引用了知识库，代码会将RAG资料（可能因为某种原因为空）拼接到用户发送的消息中（用户不会看到）,请基于这些内容回答问题。
            """
        else :
            rag_content = "用户引用了知识库，但知识库还没有任何文档，请在回复时说明这个问题。另外，请上网检索资料来回答用户问题。"
    # 拼接消息
    content = rag_content + user_content
    content_blocks.append({"type": "text", "text": content})

    human_message = HumanMessage(content=content_blocks)
    # 用 stream_mode="messages" 拿到 token 级别流式
    agent = await get_agent()
    async for msg, metadata in agent.astream(
        {
            "messages": [human_message]
        },
        stream_mode="messages",
        config={"configurable": {"thread_id": chat_id}},
        context=AgentContext(temp_instruction=temp_instruction)
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