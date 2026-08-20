import os
import asyncio
from pathlib import Path
import time

from fastapi import APIRouter, Depends, HTTPException, status,UploadFile, BackgroundTasks

from sqlmodel import select, delete,Field,func
from pydantic import BaseModel
from typing import Optional

from app.database import get_session, KnowledgeBases, KnowledgeDocuments, User, DocStatus, engine
from app.rag.document_loader import load_and_split
from app.rag.vector_store import get_vectorstore,delete_vectorstore_collection
from app.dependencies import get_current_user

from rich import print as rprint
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
    await session.flush()

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

    stmt = (
        select(KnowledgeBases, func.count(KnowledgeDocuments.id).label("doc_count"))
        .outerjoin(KnowledgeDocuments, KnowledgeDocuments.kb_id == KnowledgeBases.id)
        .where(KnowledgeBases.user_id == current_user.id)
        .group_by(KnowledgeBases.id)
        .order_by(KnowledgeBases.updated_at.desc())
    )
    rows = (await session.exec(stmt)).all()
    return {
        "code": 200,
        "message": "成功",
        "data": [
            {
                "id": doc.id,
                "name": doc.name,
                "description": doc.description,
                "documentCount": documentCount,
                "createdAt": doc.created_at,
                "updatedAt": doc.updated_at
            }
            for doc , documentCount in rows
        ]
    }

# 上传文档到知识库并解析嵌入向量数据库
@router.post("/knowledge-bases/{kb_id}/documents")
async def upload_document(kb_id: int,
                          file: UploadFile,
                          background_tasks: BackgroundTasks,
                          current_user=Depends(get_current_user),
                          session=Depends(get_session)):
    # 0. 验证知识库是否归属该用户
    kb = await session.get(KnowledgeBases,kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")
    if kb.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="无权访问该知识库！")
    # 1. 保存文件到磁盘
    safe_name = f"kb_{kb_id}_{int(time.time())}_{file.filename}"
    save_path = f"uploads/{safe_name}"
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # 2. 创建数据库记录，状态为 processing，立即提交
    doc = KnowledgeDocuments(
        kb_id = kb_id,
        filename = file.filename,
        file_path = save_path,
        file_size = file.size,
        chunk_count = 0,
        status = DocStatus.processing,
    )
    session.add(doc)
    await session.flush()
    await session.commit()

    # 3. 后台处理文档（不阻塞响应）
    background_tasks.add_task(
        process_document, doc.id, save_path, file.filename, kb_id
    )

    # 4. 立即返回 processing 状态
    return {
        "code": 200,
        "message": "文档上传成功，正在处理中",
        "data": {
            "id": doc.id,
            "filename":doc.filename,
            "fileSize": doc.file_size,
            "status": "processing",
            "created_at": doc.created_at,
        }
    }


async def process_document(doc_id: int, file_path: str, filename: str, kb_id: int):
    """后台处理文档：加载、分块、向量化"""
    from sqlmodel.ext.asyncio.session import AsyncSession
    async with AsyncSession(engine, expire_on_commit=False) as session:
        try:
            chunks = await load_and_split(file_path)
            for chunk in chunks:
                chunk.metadata["source"] = file_path
            vectorstore = get_vectorstore(kb_id)
            for i in range(0, len(chunks), 20):
                await vectorstore.aadd_documents(chunks[i:i + 20])

            doc = await session.get(KnowledgeDocuments, doc_id)
            doc.status = DocStatus.success
            doc.chunk_count = len(chunks)
            await session.commit()
            rprint(f"[green]文档处理成功: {filename}[/green]")
        except Exception as e:
            doc = await session.get(KnowledgeDocuments, doc_id)
            if doc:
                doc.status = DocStatus.failed
                await session.commit()
            rprint(f"[red]文档处理失败: {filename} - {e}[/red]")


# 获取文档列表
@router.get("/knowledge-bases/{kb_id}/documents")
async def get_knowledge_documents(kb_id: int,
                                  current_user: User = Depends(get_current_user),
                                  session=Depends(get_session)):
    # 0. 验证知识库是否归属该用户
    kb = await session.get(KnowledgeBases, kb_id)
    if kb.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该知识库！")

    stmt = select(KnowledgeDocuments).where(KnowledgeDocuments.kb_id == kb_id)
    rows = (await session.exec(stmt)).all()
    rprint(rows)

    return {
        "code": 200,
        "message": "成功",
        "data": rows
    }

# 删除文档及其所有向量数据。
@router.delete("/knowledge-bases/{kb_id}/documents/{doc_id}")
async def delete_document(kb_id: int,
                          doc_id:int,
                          current_user: User = Depends(get_current_user),
                          session=Depends(get_session)):
    # 0. 验证知识库是否归属该用户
    kb = await session.get(KnowledgeBases, kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")
    if kb.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该知识库！")
    #  查询文档记录，校验归属
    doc = await session.get(KnowledgeDocuments, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文档不存在")
    if doc.kb_id != kb_id:                          # ← Bug #5 修复
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该文档不属于此知识库")

    try:
        # 1. 获取向量数据库存储实例
        vectorstore = get_vectorstore(kb_id=kb_id)
        # 2. 删除文档对应的向量数据库
        await vectorstore.adelete(
            where={"source": doc.file_path}
        )
    except Exception as e:
        rprint(f"[red]删除向量数据失败: {e}[/red]")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除向量数据失败")

    # 3. 删除本地文件
    if doc.file_path:
        file_path = Path(doc.file_path)
        if file_path.exists():
            await asyncio.to_thread(os.remove, file_path)

    # 4. 删除文档对应的数据库信息
    await session.delete(doc)
    await session.commit()

    return {
        "code": 200,
        "message": "删除成功",
        "data": None
    }

# 删除知识库及其所有的文档和向量数据。
@router.delete("/knowledge-bases/{kb_id}")
async def delete_knowledge_bases(kb_id: int,
                                 current_user: User = Depends(get_current_user),
                                 session=Depends(get_session)):
    # 0. 验证知识库是否归属该用户
    kb = await session.get(KnowledgeBases, kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")
    if kb.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该知识库！")

    # 1. 查询所有文档
    docs = (await session.exec(
        select(KnowledgeDocuments).where(KnowledgeDocuments.kb_id == kb_id)
    )).all()
    # 2. 删除整个 Chroma collection（一次性删除所有向量）
    delete_vectorstore_collection(kb_id)

    # 3. 删除本地文件
    for doc in docs:
        if doc.file_path:
            file_path = Path(doc.file_path)
            if file_path.exists():
                await asyncio.to_thread(os.remove, file_path)

    # 4. 删除所有文档记录
    await session.exec(delete(KnowledgeDocuments).where(KnowledgeDocuments.kb_id == kb_id))
    # 5. 删除知识库记录
    await session.delete(kb)
    await session.commit()

    return {
        "code": 200,
        "message": "删除成功",
        "data": None
    }