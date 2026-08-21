from fastapi import APIRouter, Depends, HTTPException,UploadFile

from app.dependencies import get_current_user

import os
import uuid
router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/files/upload")
async def upload_file(file: UploadFile,current_user=Depends(get_current_user)):
    # 空校验
    if not file:
        raise HTTPException(status_code=400,detail="File not found.没有上传文件")
    # 生成唯一文件名
    ext = os.path.splitext(file.filename)[1]
    saved_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, saved_name)
    # 保存到磁盘
    with open(save_path, "wb") as f:
        f.write(await file.read())

    return {
        "code": 200,
        "message": "上传成功",
        "data": {
            "fileId": saved_name,
            "fileName": file.filename,
            "fileSize": file.size,
            "fileType": file.content_type,
            # 本地开发默认绝对地址；部署时设 BACKEND_BASE_URL='' 走同源相对路径
            "fileUrl": f"{os.getenv('BACKEND_BASE_URL', 'http://127.0.0.1:8000')}/{UPLOAD_DIR}/{saved_name}",
        }
    }
