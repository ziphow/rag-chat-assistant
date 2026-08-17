"""
JWT 工具函数 — 生成 token 和验证 token
"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES


def create_access_token(user_id: int) -> str:
    """
    生成 JWT Token
    :param user_id: 用户 ID，会编码到 token 中
    :return: JWT 字符串
    """
    # 过期时间
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # payload 中放用户 ID 和过期时间
    payload = {
        "sub": str(user_id),  # subject：用户标识
        "exp": expire,        # expiration：过期时间
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """
    验证并解析 JWT Token
    :param token: JWT 字符串
    :return: 用户 ID，验证失败返回 None
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except JWTError:
        return None
