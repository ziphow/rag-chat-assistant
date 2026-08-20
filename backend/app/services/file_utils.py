import base64
import mimetypes

# ==================== 图片处理 ====================

def image_url_to_base64(url):
    """将本地图片 URL 转为 base64 data URL，供 AI 云端服务读取"""
    if not url:
        return None
    # 从 URL 提取文件路径：http://127.0.0.1:8000/uploads/xxx.png → uploads/xxx.png
    if "127.0.0.1:8000/" in url:
        file_path = url.split("127.0.0.1:8000/", 1)[1]
    elif "localhost:8000/" in url:
        file_path = url.split("localhost:8000/", 1)[1]
    else:
        return url  # 已经是外部 URL，直接返回

    with open(file_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode()

    mime_type = mimetypes.guess_type(file_path)[0] or "image/png"
    return f"data:{mime_type};base64,{encoded}"

# ==================== 文件处理（合并自 document_loader 逻辑） ====================

def _extract_local_path(url):
    """从本地 URL 提取磁盘路径，非本地 URL 返回 None"""
    if not url:
        return None
    if "127.0.0.1:8000/" in url:
        return url.split("127.0.0.1:8000/", 1)[1]
    elif "localhost:8000/" in url:
        return url.split("localhost:8000/", 1)[1]
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