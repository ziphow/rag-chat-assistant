from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.dependencies import get_current_user

import os
import uuid
import mimetypes

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 单文件大小上限（与前端一致）
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# 允许上传的文件扩展名白名单（图片按 MIME 走，其余按扩展名）
ALLOWED_EXTENSIONS = {
    # 图片
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp",
    # 文本 / 文档
    ".txt", ".md", ".csv", ".pdf", ".docx", ".xlsx", ".pptx",
    # 压缩包
    ".zip",
}


def _allowed_ext(filename: str) -> bool:
    ext = os.path.splitext(filename or "")[1].lower()
    return ext in ALLOWED_EXTENSIONS


@router.post("/files/upload")
async def upload_file(file: UploadFile, current_user=Depends(get_current_user)):
    # 空校验
    if not file:
        raise HTTPException(status_code=400, detail="没有上传文件")

    # 类型校验：图片按 MIME 放行，其余必须命中扩展名白名单
    is_image = (file.content_type or "").startswith("image/")
    if not is_image and not _allowed_ext(file.filename):
        raise HTTPException(status_code=400, detail="不支持的文件类型")

    # 读取完整内容并做大小限制（磁盘较小，拒绝超大文件）
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件超过 10MB 限制")

    # 生成唯一的、安全的文件名（杜绝路径穿越，扩展名来自白名单或被 MIME 推导）
    if not is_image:
        ext = os.path.splitext(file.filename)[1].lower()
    else:
        ext = os.path.splitext(file.filename or "")[1].lower() \
            or mimetypes.guess_extension(file.content_type or "") or ".png"
    saved_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, saved_name)

    with open(save_path, "wb") as f:
        f.write(content)

    return {
        "code": 200,
        "message": "上传成功",
        "data": {
            "fileId": saved_name,
            "fileName": file.filename,
            "fileSize": len(content),
            "fileType": file.content_type,
            # 本地开发默认绝对地址；部署时设 BACKEND_BASE_URL='' 走同源相对路径
            "fileUrl": f"{os.getenv('BACKEND_BASE_URL', '')}/{UPLOAD_DIR}/{saved_name}",
        }
    }