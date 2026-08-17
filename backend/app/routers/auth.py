from fastapi import APIRouter, Depends,Form, HTTPException

from sqlmodel import select,Field,or_

from app.database import get_session,User
from app.dependencies import get_current_user, blacklisted_tokens, oauth2_scheme
from app.services.security import get_password_hash,verify_password
from app.services.auth_service import create_access_token
router = APIRouter()

#登录
@router.post("/auth/login")
async def login(username: str = Form(...),
                password: str = Form(...),
                session=Depends(get_session)):

    stmt = select(User).where(or_(
        User.username == username,
        User.email == username
    ))
    res =await session.exec(stmt)
    result=res.first()

    if result is None:
        raise HTTPException(status_code=401, detail="账号不存在！")
    elif not verify_password(password,result.password_hash):
        raise HTTPException(status_code=401, detail="密码错误！")
    #生成JWT
    token = create_access_token(user_id=result.id)
    return {
        "code": 200,
        "message": "登录成功",
        "access_token": token,
        "data": {
            "token": token,
            "user": {
                "id": result.id,
                "username": result.username,
                "email": result.email,
                "avatar": None
            }
        }
    }

#注册
@router.post("/auth/register")
async def register(
        username: str = Form(..., min_length=2, max_length=20,description="用户名"),
        password: str = Form(..., min_length=6, max_length=20,description="用户密码"),
        email: str = Form(..., min_length=6, max_length=100,description="邮箱"),
        session=Depends(get_session)):

    stmt = select(User).where(or_(
        User.username == username,
        User.email == email
    ))
    res = await session.exec(stmt)
    result = res.first()
    session.flush()
    if result is not None:
        raise HTTPException(status_code=409, detail="用户名或邮箱已被注册！")

    new_user=User(
        username=username,
        email=email,
        password_hash=get_password_hash(password)
    )
    session.add(new_user)
    await session.flush()
    # 生成JWT
    token = create_access_token(user_id=new_user.id)
    return {
        "code": 200,
        "message": "注册成功",
        "access_token": token,
        "data": {
            "token": token,
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "avatar": None
            }
        }
    }


#获取当前用户
@router.get("/auth/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "code": 200,
        "message": "成功",
        "data": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "avatar": current_user.avatar
        }
    }

@router.post("/auth/logout")
async def logout(token: str = Depends(oauth2_scheme)):
    blacklisted_tokens.add(token)   # 把 token 加入黑名单
    return {"code": 200, "message": "已退出登录"}