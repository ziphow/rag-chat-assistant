from langchain_chroma import Chroma
from langchain_community.embeddings import DashScopeEmbeddings

from dotenv import load_dotenv

load_dotenv()

TextEmbeddingModel = DashScopeEmbeddings(
    model="qwen3.7-text-embedding",
)
def get_vectorstore(kb_id: int) -> Chroma:
    """获取指定知识库的向量存储实例"""
    # 构造向量数据库
    return Chroma(
        collection_name=f"kb_{kb_id}",
        embedding_function=TextEmbeddingModel,  # 指定模型
        persist_directory="data/chroma_db",     # 指定向量数据库存储路径
    )