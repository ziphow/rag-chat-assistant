from fastapi import APIRouter, Depends, HTTPException, status

from sqlmodel import select, Field
from pydantic import BaseModel
from typing import Optional

from pprint import pprint

from app.database import get_session, KnowledgeBases, KnowledgeDocuments, User
from app.dependencies import get_current_user

router = APIRouter()


class KnowledgeBase(BaseModel):
    name:str=Field(...,max_length=100,description="知识库名称")
    description:Optional[str]=Field(default="暂无描述",max_length=1000,description="知识库描述")
# 创建知识库（表）
@router.post("/knowledge-bases")
async def create_knowledge_bases(knowledge_base: KnowledgeBase,
                                current_user: User = Depends(get_current_user),
                                session=Depends(get_session)):

    new_knowledge_base = KnowledgeBases(
        user_id = current_user.id,
        name=knowledge_base.name,
        description=knowledge_base.description,
    )
    session.add(new_knowledge_base)
    session.flush()

    return {
        "code": 200,
        "message": "创建成功",
        "data": {
            "id": new_knowledge_base.id,
            "name": new_knowledge_base.name,
            "description": new_knowledge_base.description,
            "documentCount": 0,
            "createdAt": new_knowledge_base.created_at,
            "updatedAt": new_knowledge_base.updated_at
        }
    }

# 获取知识库（表）
@router.get("/knowledge-bases")
async def get_knowledge_bases(current_user: User = Depends(get_current_user),
                              session=Depends(get_session)):
    from sqlmodel import select, func, col

    stmt = (
        select(KnowledgeBases, func.count(KnowledgeDocuments.id).label("doc_count"))
        .outerjoin(KnowledgeDocuments, KnowledgeDocuments.kb_id == KnowledgeBases.id)
        .where(KnowledgeBases.user_id == current_user.id)
        .group_by(KnowledgeBases.id)
        .order_by(KnowledgeBases.updated_at.desc())
    )
    rows = (await session.exec(stmt)).all()

    result = []
    for kb, doc_count in rows:
        result.append({
            "id": kb.id,
            "name": kb.name,
            "description": kb.description,
            "doc_count": doc_count,
            "created_at": kb.created_at,
        })
    return result

# 上传文档到知识库并解析嵌入向量数据库
from fastapi import UploadFile
from app.rag.document_loader import load_and_split
from app.rag.vector_store import get_vectorstore
from pprint import pprint
@router.post("/knowledge-bases/{kb_id}/documents")
async def upload_document(kb_id: int, file: UploadFile,
                          current_user=Depends(get_current_user),
                          session=Depends(get_session)):
    # 1. 保存文件到磁盘
    save_path = f"uploads/kb_{kb_id}_{file.filename}"
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # 2. 加载并分块
    chunks = await load_and_split(save_path)
    #pprint(chunks)
    # 3. 存入向量数据库
    vectorstore = get_vectorstore(kb_id)
    for i in range(0, len(chunks), 20):  # 分批存入
        await vectorstore.aadd_documents(chunks[i:i + 20])

    # 4. 存入知识库文档数据库
    doc = KnowledgeDocuments(
        kb_id = kb_id,
        filename = file.filename,
        file_path = save_path,
        file_size = file.size,
        chunk_count = len(chunks),
    )
    session.add(doc)
    await session.flush()
    return {
        "code": 200,
        "message": "上传成功，正在处理",
        "data": {
            "id": doc.id,
            "filename":doc.filename,
            "fileSize": doc.file_size,
            "status": doc.status,
            "created_at": doc.created_at,
        }
    }


# 获取文档列表
@router.get("/knowledge-bases/{kb_id}/documents")
async def get_knowledge_documents(kb_id: int,
                                  current_user: User = Depends(get_current_user),
                                  session=Depends(get_session)):
    stmt = select(KnowledgeDocuments).where(KnowledgeDocuments.kb_id == kb_id)
    rows = (await session.exec(stmt)).all()

    return {
        "code": 200,
        "message": "成功",
        "data": rows
    }