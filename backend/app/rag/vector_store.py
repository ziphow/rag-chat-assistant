from functools import lru_cache
from langchain_chroma import Chroma
from langchain_community.embeddings import DashScopeEmbeddings

from dotenv import load_dotenv

load_dotenv()

# 全局共享的嵌入模型
TextEmbeddingModel = DashScopeEmbeddings(
    model="qwen3.7-text-embedding",
)

@lru_cache(maxsize=128)  # 缓存最多 128 个知识库实例
def get_vectorstore(kb_id: int) -> Chroma:
    """获取指定知识库的向量存储实例"""
    # 构造向量数据库
    return Chroma(
        collection_name=f"kb_{kb_id}",
        embedding_function=TextEmbeddingModel,  # 指定模型
        persist_directory="data/chroma_db",     # 指定向量数据库存储路径
    )