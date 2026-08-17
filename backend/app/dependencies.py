
"""
FastAPI 依赖注入 — 获取当前登录用户
把此文件放到你的 FastAPI 项目中（和 main.py 同级）

用法：在需要登录才能访问的接口上加 Depends(get_current_user)
    @router.get("/chats")
    async def list_chats(current_user: User = Depends(get_current_user)):
        ...
"""

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from app.services.auth_service import decode_access_token
from app.database import User,get_session

blacklisted_tokens = set()

# tokenUrl 告诉 Swagger 文档去哪个接口获取 token（填你的登录接口地址）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session=Depends(get_session),
):
    """
    从请求头中提取 token，验证后返回当前用户对象
    如果 token 无效或过期，抛出 401 异常
    """
    # 1. 解析 token
    if token in blacklisted_tokens:
        raise HTTPException(status_code=401, detail="token已失效")

    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="token无效或已过期")

    # 2. 根据 user_id 查数据库
    stmt = select(User).where(User.id == user_id)
    res = await session.exec(stmt)
    user = res.first()

    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")

    return user

