import base64
import mimetypes

# ==================== 图片处理 ====================

def image_url_to_base64(url):
    """将本地图片 URL 转为 base64 data URL，供 AI 云端服务读取"""
    if not url:
        return None
    # 从 URL 提取本地文件路径；仅识别指向本站 uploads 静态目录的地址（绝对或相对均可）
    if "/uploads/" in url:
        file_path = "uploads/" + url.split("/uploads/", 1)[1].lstrip("/")
    else:
        return url  # 已经是外部 URL，直接返回

    with open(file_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode()

    mime_type = mimetypes.guess_type(file_path)[0] or "image/png"
    return f"data:{mime_type};base64,{encoded}"

# ==================== 文件处理（合并自 document_loader 逻辑） ====================

def _extract_local_path(url):
    """从 URL 提取本地磁盘路径，非本站 uploads 地址返回 None"""
    if not url:
        return None
    if "/uploads/" in url:
        return "uploads/" + url.split("/uploads/", 1)[1].lstrip("/")
    return None


async def file_url_to_text(url, name):
    """
    将本地文件转为文本内容，供 AI 分析（非图片文件）。
    支持 pdf / docx / txt / md / csv，其他格式尝试 utf-8 读取。
    """
    file_path = _extract_local_path(url)
    if not file_path:
        return f"[文件 {name} 无法读取：非本地文件]"

    import os
    ext = os.path.splitext(file_path)[1].lower().lstrip('.')

    if ext == 'pdf':
        from langchain_community.document_loaders import PyPDFLoader
        loader = PyPDFLoader(file_path)
        docs = await loader.aload()
        return '\n'.join(doc.page_content for doc in docs)

    elif ext == 'docx':
        from docx import Document as DocxDocument
        doc = DocxDocument(file_path)
        return '\n'.join(para.text for para in doc.paragraphs)

    elif ext == 'csv':
        from langchain_community.document_loaders import CSVLoader
        loader = CSVLoader(file_path)
        docs = await loader.aload()
        return '\n'.join(doc.page_content for doc in docs)

    else:
        # txt / md / 其他文本格式，统一用 utf-8 读取
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()


# ==================== 文件删除 ====================

def delete_files_from_messages(messages):
    """
    从一批消息中收集所有图片和文件的本地路径，删除磁盘上的对应文件。
    非本地 URL 或文件不存在的情况静默忽略，不抛异常。

    :param messages: Message 对象列表（含 images / files 两个 JSON 字段）
    """
    import os
    paths = set()
    for msg in messages:
        for img in (msg.images or []):
            p = _extract_local_path(img.get("url"))
            if p:
                paths.add(p)
        for f in (msg.files or []):
            p = _extract_local_path(f.get("url"))
            if p:
                paths.add(p)

    for path in paths:
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            # 删除失败不影响主流程
            pass


# ==================== 孤儿文件清理 ====================

def _basename_if_local(url):
    """返回本地 uploads 文件的文件名；外部 URL 返回 None"""
    if not url or "/uploads/" not in url:
        return None
    return os.path.basename(url.split("/uploads/", 1)[1].lstrip("/"))


async def cleanup_orphan_uploads(engine, max_age_hours=24):
    """
    清理 uploads 目录中的孤儿文件：未被任何消息引用、且修改时间超过指定时长的文件。
    用于磁盘较小的部署环境，防止上传失败/未发送的中途文件长期残留占满磁盘。
    """
    import os
    import time
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlmodel import select
    from app.database import Message

    UPLOAD_DIR = "uploads"
    referenced = set()
    async with AsyncSession(engine) as session:
        rows = (await session.exec(select(Message))).all()
        for m in rows:
            for img in (m.images or []):
                name = _basename_if_local((img or {}).get("url"))
                if name:
                    referenced.add(name)
            for f in (m.files or []):
                name = _basename_if_local((f or {}).get("url"))
                if name:
                    referenced.add(name)

    if not os.path.isdir(UPLOAD_DIR):
        return

    cutoff = time.time() - max_age_hours * 3600
    for fname in os.listdir(UPLOAD_DIR):
        if fname in referenced:
            continue
        path = os.path.join(UPLOAD_DIR, fname)
        try:
            if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
                os.remove(path)
        except OSError:
            pass