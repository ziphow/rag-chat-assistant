import json
from rich import print as rprint
from langchain_core.messages import AIMessageChunk, HumanMessage

from sqlalchemy import select

from app.database import Message ,KnowledgeDocuments
from app.Schemas.model import UserMessage
from app.ai.agent import get_agent,AgentContext
# ★ [后端修改] 新增 file_url_to_text 导入，用于将非图片文件转为文本供 AI 分析
from app.services.file_utils import image_url_to_base64, file_url_to_text
from app.rag.rag import retrieve_relevant_docs

async def event_stream(message : UserMessage,session,):
    """SSE 流式生成器，负责调用 AI 并逐块返回"""

    yield f"data: {json.dumps({'type': 'start'})}\n\n"

    full_content = ""
    thinking_content = ""
    # 构造消息
    content_blocks = []
    temp_instruction = None
    rag_content = ""
    if message.images:
        for img in message.images:
            content_blocks.append({
                "type": "image_url",
                "image_url": {"url": image_url_to_base64(img.url)}
            })
    # ★ [后端修改] 处理用户上传的非图片文件：调用 file_url_to_text 将文件内容转为文本，
    #   作为 text 类型 content_block 添加到消息上下文中，供 AI 分析
    if message.files:
        for f in message.files:
            file_text = await file_url_to_text(f.url, f.name)
            content_blocks.append({
                "type": "text",
                "text": f"[文件 {f.name} 的内容]\n{file_text}\n[文件内容结束]"
            })
    if message.kb_id:
        if (await session.exec(
                select(KnowledgeDocuments).where(KnowledgeDocuments.kb_id == message.kb_id)
            )).first():
            try:
                # 1. 检索相关文档片段
                relevant_chunks = await retrieve_relevant_docs(message.kb_id, message.content)
                # 2. 生成资料结果
                rag_content = "\n\n".join(relevant_chunks) + "\n\n 资料结束，请回答用户问题(可能为文字，图片，文件中的一个或多个)： \n\n"
                # 3、动态追加系统提示词
                temp_instruction = """
                用户引用了知识库，代码会将RAG资料（可能因为某种原因为空）拼接到用户发送的消息中（用户不会看到）,请基于这些内容回答问题。
                """
            except Exception as e:
                rprint(f"[red]RAG检索失败: {e}[/red]")
                rag_content = "知识库检索失败，请直接回答用户问题。"
                temp_instruction = "知识库检索失败，请直接回答用户问题。"
        else :
            rag_content = "用户引用了知识库，但知识库还没有任何文档，请在回复时说明这个问题。另外，请上网检索资料来回答用户问题。"
    # 拼接消息
    content = rag_content + message.content
    content_blocks.append({"type": "text", "text": content})

    human_message = HumanMessage(content=content_blocks)
    # 用 stream_mode="messages" 拿到 token 级别流式
    agent = await get_agent()
    async for msg, metadata in agent.astream(
        {
            "messages": [human_message]
        },
        stream_mode="messages",
        config={"configurable": {"thread_id": message.chat_id}},
        context=AgentContext(temp_instruction=temp_instruction)
    ):
        # ★ 只处理 AI 消息块，跳过工具消息(ToolMessage)等
        if not isinstance(msg, AIMessageChunk):
            continue
        # ★ 透传思考过程（Qwen 等模型的 reasoning_content 增量）
        thinking = getattr(msg, "additional_kwargs", {}).get("reasoning_content")
        if thinking:
            thinking_content += thinking
            yield f"data: {json.dumps({'type': 'thinking', 'content': thinking})}\n\n"
        # ★ 跳过工具调用请求（content 为空的是工具调用指令，不是回复内容）
        content = getattr(msg, 'content', None)
        if not content:
            continue

        full_content += content
        yield f"data: {json.dumps({'type': 'chunk', 'content': content})}\n\n"

    # 保存 AI 消息（连同思考过程，便于持久化展示）
    ai_message = Message(
        chat_id=message.chat_id,
        role="ai",
        content=full_content,
        thinking=thinking_content or None,
    )
    session.add(ai_message)

    await session.flush()
    await session.commit()

    # 发送 done 事件
    yield f"data: {json.dumps({'type': 'done', 'messageId': ai_message.id})}\n\n"