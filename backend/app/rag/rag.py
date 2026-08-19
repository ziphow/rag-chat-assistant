from app.rag.vector_store import get_vectorstore

async def retrieve_relevant_docs(kb_id: int, query: str, k: int = 5) -> list[str]:
    """检索与用户问题最相关的文档片段，返回纯文本列表"""
    vectorstore = get_vectorstore(kb_id)
    results = await vectorstore.asimilarity_search(query=query, k=k)
    return [doc.page_content for doc in results]