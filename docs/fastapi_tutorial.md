# FastAPI 入门教程（清晰易懂版）

> **适用版本**：FastAPI 0.100+ / Python 3.8+
> **目标读者**：刚接触 FastAPI 的后端新手
> **学习路径**：从 Hello World 开始 → 路由 → 参数 → Pydantic → 数据库 → 部署，循序渐进，每节都有可跑通的代码。
> **符号约定**：
> - 📌 概念要点
> - 🎯 API / 函数名
> - ⚙️ 参数说明
> - ✅ 返回值
> - 💡 可运行示例
> - ⚠️ 常见坑
> - 🔗 关联章节

---

# 目录

1. [FastAPI 是什么 & 安装](#01)
2. [第一个程序：Hello World](#02)
3. [路由与路径操作](#03)
4. [路径参数](#04)
5. [查询参数](#05)
6. [请求体（Pydantic 模型）](#06)
7. [响应模型与状态码](#07)
8. [表单与文件上传](#08)
9. [依赖注入（入门）](#09)
10. [异步与同步](#10)
11. [中间件与 CORS](#11)
12. [异常处理](#12)
13. [连接数据库（SQLAlchemy）](#13)
14. [认证入门（JWT）](#14)
15. [项目结构建议](#15)
16. [自动文档与测试](#16)
17. [运行与部署](#17)
18. [常见错误速查](#18)

---

<a id="01"></a>
# 01. FastAPI 是什么 & 安装

## 📌 一句话理解
**FastAPI 是基于 Python 类型提示的现代 Web 框架**：
- 基于 **Starlette**（ASGI 异步框架）+ **Pydantic**（数据验证）
- 写法像 Flask，但**自动校验参数**、**自动生成 OpenAPI 文档**、**性能接近 Node.js / Go**
- 类型提示是核心：你写 `def hello(name: str)`，它就能自动从 query 里取 `name`、校验是字符串、文档里也标注好

## 安装

```bash
# 安装 FastAPI + Uvicorn（ASGI 服务器，用来跑应用）
pip install fastapi "uvicorn[standard]"

# 可选：开发时热重载用的 standard 版包含 websocket、热重载等
# Python 3.8+ 即可
```

## 验证版本

```python
import fastapi
print(fastapi.__version__)
```

---

<a id="02"></a>
# 02. 第一个程序：Hello World

## 创建 `main.py`

```python
from fastapi import FastAPI

# 1. 创建应用实例
app = FastAPI(
    title="我的第一个 API",
    description="学习 FastAPI 的demo",
    version="0.1.0",
)

# 2. 定义一个路由：访问 GET / 时执行这个函数
@app.get("/")
def root():
    return {"message": "Hello, FastAPI!"}

# 3. 再加一个
@app.get("/ping")
def ping():
    return {"status": "ok"}
```

## 启动服务

打开终端，在 `main.py` 所在目录执行：

```bash
uvicorn main:app --reload
```

解释：
- `main`：文件名 `main.py`（不带 `.py`）
- `app`：你在文件里创建的 `FastAPI()` 实例变量名
- `--reload`：代码改动自动重启（开发用，生产别加）

看到 `Uvicorn running on http://127.0.0.1:8000` 就成功了。

## 访问 & 自动文档

打开浏览器：
- http://127.0.0.1:8000/ → `{"message": "Hello, FastAPI!"}`
- http://127.0.0.1:8000/ping → `{"status": "ok"}`
- 🌟 http://127.0.0.1:8000/docs → **Swagger UI 自动文档**（直接在页面上测试 API）
- 🌟 http://127.0.0.1:8000/redoc → ReDoc 风格文档

**📌 重点**：你**不用写一行文档代码**，FastAPI 根据你的类型提示自动生成 OpenAPI 文档。

---

<a id="03"></a>
# 03. 路由与路径操作

## HTTP 方法装饰器

FastAPI 为每个 HTTP 方法提供了对应装饰器：

| 装饰器 | HTTP 方法 | 用途 |
|---|---|---|
| `@app.get(path)` | GET | 查询资源（不修改数据） |
| `@app.post(path)` | POST | 创建资源 / 提交表单 |
| `@app.put(path)` | PUT | 整体替换资源 |
| `@app.patch(path)` | PATCH | 局部更新资源 |
| `@app.delete(path)` | DELETE | 删除资源 |
| `@app.options(path)` | OPTIONS | 预检请求（CORS 用） |
| `@app.head(path)` | HEAD | 只取响应头 |

## 路径写法

```python
@app.get("/users")           # ✅ 推荐：复数
@app.get("/users/{user_id}") # 路径参数（下一节讲）
@app.get("/users/")          # 结尾带 /，访问 /users 会自动重定向到 /users/
```

**⚠️ 路由顺序**：FastAPI 按定义顺序匹配。下面这个例子是经典坑：

```python
@app.get("/users/me")       # ✅ 必须在前
def get_me():
    return {"user": "me"}

@app.get("/users/{user_id}") # ❌ 如果放在前面，/users/me 会匹配到这里
def get_user(user_id: str):
    return {"user_id": user_id}
```

## 用 APIRouter 拆分路由（推荐）

当路由多了，全堆 `main.py` 太乱。用 `APIRouter` 分模块：

```python
# routers/users.py
from fastapi import APIRouter

router = APIRouter(
    prefix="/users",           # 这个 router 下所有路径都自动加 /users 前缀
    tags=["用户"],             # 文档里的分组名
)

@router.get("/")
def list_users():
    return [{"id": 1}, {"id": 2}]

@router.get("/{user_id}")
def get_user(user_id: int):
    return {"id": user_id}
```

```python
# main.py
from fastapi import FastAPI
from routers import users

app = FastAPI()
app.include_router(users.router)   # 注册到主 app

# 也可以加前缀/标签覆盖：
# app.include_router(users.router, prefix="/api/v1", tags=["v1"])
```

访问：`/users/` 和 `/users/123`

---

<a id="04"></a>
# 04. 路径参数

## 基本用法

```python
@app.get("/users/{user_id}")
def get_user(user_id: int):       # 类型提示告诉 FastAPI：这是 int
    return {"user_id": user_id, "type": "int"}
```

- 访问 `/users/123` → `{"user_id": 123, "type": "int"}`
- 访问 `/users/abc` → FastAPI **自动返回 422 错误**，告诉你 `user_id` 不是整数

## 📌 类型转换与校验

FastAPI 用 Pydantic 校验，类型支持：`int / float / str / bool / UUID / datetime / date / Enum` 等。

```python
from datetime import date
from enum import Enum

class Color(str, Enum):
    red = "red"
    green = "green"
    blue = "blue"

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}

@app.get("/users/{user_id}/orders/{order_date}")
def user_orders(user_id: int, order_date: date):
    return {"user_id": user_id, "date": order_date}

@app.get("/colors/{color}")
def pick_color(color: Color):
    return {"color": color, "value": color.value}
```

## 路径参数顺序坑（再强调一次）

```python
# ❌ 错误顺序：访问 /files/me 会匹配到 {file_name}
@app.get("/files/{file_name}")
def get_file(file_name: str):
    return {"file": file_name}

@app.get("/files/me")
def get_me_file():
    return {"file": "me.txt"}


# ✅ 正确顺序：固定路径放前面
@app.get("/files/me")
def get_me_file():
    return {"file": "me.txt"}

@app.get("/files/{file_name}")
def get_file(file_name: str):
    return {"file": file_name}
```

## 路径参数的「路径」类型（接受斜杠）

```python
from fastapi import Path

@app.get("/files/{file_path:path}")
def read_file(file_path: str = Path(...)):
    return {"path": file_path}

# 访问 /files/a/b/c.txt → file_path = "a/b/c.txt"
```

---

<a id="05"></a>
# 05. 查询参数

## 基本用法

URL 里 `?` 后面的就是查询参数：

```python
from typing import Optional

@app.get("/items")
def list_items(
    skip: int = 0,                       # 有默认值 → 可选
    limit: int = 10,                     # 有默认值 → 可选
    q: Optional[str] = None,             # 默认 None → 可选
):
    return {"skip": skip, "limit": limit, "q": q}
```

- `/items` → `skip=0, limit=10, q=None`
- `/items?skip=20&limit=5` → `skip=20, limit=5, q=None`
- `/items?skip=20&limit=5&q=hello` → `q="hello"`
- `/items?skip=abc` → **422 错误**：skip 不是 int

## 必填查询参数

没有默认值的参数是必填的：

```python
@app.get("/search")
def search(keyword: str):       # 必填
    return {"keyword": keyword}

# /search → 422 错误：缺少 keyword
# /search?keyword=hello → 正常
```

## bool 类型的智能转换

```python
@app.get("/flag")
def flag(active: bool = False):
    return {"active": active}

# /flag?active=true   → True
# /flag?active=False  → False
# /flag?active=1      → True
# /flag?active=yes    → True
# /flag?active=no     → False
```

## 多值参数（列表）

```python
from typing import List

@app.get("/items")
def list_items(q: List[str] = []):
    return {"q": q}

# /items?q=a&q=b&q=c → {"q": ["a", "b", "c"]}
```

## 参数校验（Query）

```python
from fastapi import Query

@app.get("/items")
def list_items(
    q: str | None = Query(
        None,
        min_length=3,            # 最少 3 个字符
        max_length=50,            # 最多 50
        pattern="^[a-zA-Z]+$",   # 正则：只允许字母
        title="搜索关键字",       # 文档显示标题
        description="搜索商品的关键字，3-50 字符",
    ),
    page: int = Query(1, ge=1),          # >= 1
    size: int = Query(10, ge=1, le=100), # 1 <= size <= 100
):
    return {"q": q, "page": page, "size": size}
```

**📌 校验约束速查**：
- 数字：`ge`（>=）、`le`（<=）、`gt`（>）、`lt`（<）
- 字符串：`min_length / max_length / pattern`（正则）

---

<a id="06"></a>
# 06. 请求体（Pydantic 模型）

## 📌 什么是请求体
- GET 请求通常没 body，参数走 URL
- POST/PUT/PATCH 用 body 传 JSON 等复杂数据
- FastAPI 用 **Pydantic 模型** 描述请求体，**自动校验 + 转换 + 文档**

## 定义 Pydantic 模型

```python
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="用户名")
    age: int = Field(..., ge=0, le=150, description="年龄")
    email: EmailStr                            # 自动校验邮箱格式
    password: str = Field(..., min_length=6)
    nickname: Optional[str] = None             # 可选字段
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "张三",
                "age": 25,
                "email": "zhang@test.com",
                "password": "secret123",
            }
        }
    }
```

**`Field(...)` 说明**：
- `...` 表示必填（Ellipsis 对象）
- 其他值表示默认值
- `default_factory` 用来传可变默认值（如 `list`、`datetime.now`）

## 在路由里使用

```python
@app.post("/users")
def create_user(user: UserCreate):     # 类型提示是 Pydantic 模型 → FastAPI 知道这是请求体
    return {
        "name": user.name,
        "email": user.email,
        "saved": True,
    }
```

测试（用 curl 或 docs 页面）：

```bash
curl -X POST http://127.0.0.1:8000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","age":25,"email":"zhang@test.com","password":"abc123"}'
```

- ✅ 字段齐全且合法 → 200 OK
- ❌ 缺字段 / 类型错 / 邮箱格式不对 → 422，错误信息非常详细

## 嵌套模型

```python
class Address(BaseModel):
    city: str
    street: str

class UserCreate(BaseModel):
    name: str
    address: Address                # 嵌套对象
    tags: list[str] = []            # 字符串列表

# 请求体示例：
# {
#   "name": "Tom",
#   "address": {"city": "北京", "street": "长安街"},
#   "tags": ["vip", "active"]
# }
```

## 同时有路径参数 / 查询参数 / 请求体

```python
@app.put("/users/{user_id}")
def update_user(
    user_id: int,                   # 路径参数
    user: UserUpdate,               # 请求体（Pydantic 模型）
    q: str | None = None,           # 查询参数
):
    result = {"user_id": user_id, "user": user.model_dump()}
    if q:
        result["q"] = q
    return result
```

**📌 FastAPI 识别规则**：
- 类型是 Pydantic 模型 → 请求体
- 类型是 `int / str / float` 等基本类型 → 路径参数（如果在路径里）或查询参数（不在路径里）
- 用 `Path()`、`Query()`、`Body()` 可以显式指定

## 常用 Pydantic v2 方法

| 方法 | 作用 |
|---|---|
| `model.dict()` / `model.model_dump()` | 转 dict（v2 推荐 `model_dump`） |
| `model.json()` / `model.model_dump_json()` | 转 JSON 字符串 |
| `Model.parse_obj(d)` / `Model.model_validate(d)` | 从 dict 创建实例 |
| `Model.parse_raw(s)` / `Model.model_validate_json(s)` | 从 JSON 字符串创建 |
| `Model.schema()` / `Model.model_json_schema()` | 生成 JSON Schema |
| `model.copy(update={...})` | 浅拷贝并覆盖字段 |

---

<a id="07"></a>
# 07. 响应模型与状态码

## 用 `response_model` 控制响应字段

**为什么需要**：内部数据库模型可能有 `password` 等敏感字段，对外暴露时要过滤。

```python
from fastapi import FastAPI
from pydantic import BaseModel

class UserPublic(BaseModel):
    id: int
    name: str
    email: str
    # ✅ 没有 password 字段

class UserInDB(UserPublic):
    hashed_password: str             # 内部模型多一个

@app.get("/users/{user_id}", response_model=UserPublic)
def get_user(user_id: int) -> UserInDB:    # 返回 UserInDB 也会自动按 UserPublic 过滤
    return UserInDB(
        id=user_id, name="张三",
        email="zhang@test.com",
        hashed_password="secret-hash",     # 自动被过滤掉
    )
```

访问结果：`{"id": 1, "name": "张三", "email": "zhang@test.com"}`（没 password）

## 设置状态码

```python
from fastapi import status

@app.post("/users", status_code=status.HTTP_201_CREATED)   # 201 Created
def create_user(user: UserCreate):
    return user

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)  # 204 无内容
def delete_user(user_id: int):
    return None
```

**📌 常用状态码**：
- 200 OK：成功
- 201 Created：创建成功
- 204 No Content：成功但无返回体（DELETE 常用）
- 400 Bad Request：请求格式错
- 401 Unauthorized：未登录
- 403 Forbidden：禁止访问
- 404 Not Found：资源不存在
- 422 Unprocessable Entity：校验失败（FastAPI 默认）
- 500 Internal Server Error：服务器错误

## 直接返回 dict / list / 任意类型

```python
@app.get("/raw")
def raw():
    return {"hello": "world"}    # 自动转 JSON

@app.get("/list")
def list_raw():
    return [1, 2, 3]
```

## 返回 JSONResponse（自定义 headers / status）

```python
from fastapi.responses import JSONResponse

@app.get("/custom")
def custom():
    return JSONResponse(
        status_code=200,
        content={"message": "ok"},
        headers={"X-Custom-Header": "value"},
    )
```

## 其他响应类型

```python
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, FileResponse, StreamingResponse

@app.get("/html", response_class=HTMLResponse)
def html():
    return "<h1>Hello</h1>"

@app.get("/file")
def file():
    return FileResponse("/path/to/file.pdf", filename="report.pdf")

@app.get("/redirect")
def redirect():
    return RedirectResponse(url="/new-path")
```

---

<a id="08"></a>
# 08. 表单与文件上传

## 表单（Form）

⚠️ 表单需要安装 `python-multipart`：`pip install python-multipart`

```python
from fastapi import Form

@app.post("/login")
def login(
    username: str = Form(...),         # 来自表单字段，不是 JSON
    password: str = Form(...),
    remember: bool = Form(False),
):
    return {"username": username, "remember": remember}
```

测试：
```bash
curl -X POST http://127.0.0.1:8000/login \
  -d "username=tom&password=secret&remember=true"
```

## 文件上传（UploadFile）

```python
from fastapi import UploadFile, File

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # file.filename：原始文件名
    # file.content_type：MIME 类型
    # await file.read()：读全部内容（异步）
    # file.size：大小（字节）

    contents = await file.read()
    with open(f"./{file.filename}", "wb") as f:
        f.write(contents)

    return {
        "filename": file.filename,
        "size": len(contents),
        "type": file.content_type,
    }
```

## 多文件上传

```python
from typing import List

@app.post("/uploads")
async def upload_files(files: List[UploadFile] = File(...)):
    return {"count": len(files), "names": [f.filename for f in files]}
```

## 表单 + 文件一起

```python
@app.post("/submit")
async def submit(
    name: str = Form(...),
    avatar: UploadFile = File(...),
):
    return {"name": name, "avatar": avatar.filename}
```

---

<a id="09"></a>
# 09. 依赖注入（入门）

## 📌 概念
**依赖注入（Dependency Injection, DI）** = 「让 FastAPI 在调用你的函数前，先帮你执行一些公共代码，并把结果传进来」。

典型场景：
- 取当前登录用户
- 校验权限
- 获取数据库 session
- 公共分页参数

## 第一个例子：公共参数

```python
from fastapi import Depends

# 公共参数类
class Pagination:
    def __init__(self, page: int = 1, size: int = 10):
        self.page = page
        self.size = size

@app.get("/items")
def list_items(p: Pagination = Depends()):
    return {"page": p.page, "size": p.size}

@app.get("/orders")
def list_orders(p: Pagination = Depends()):
    return {"page": p.page, "size": p.size}
```

访问 `/items?page=2&size=20` → `p.page=2, p.size=20`，两个路由共用。

## 函数式依赖

```python
def get_db():
    db = SessionLocal()
    try:
        yield db              # ⭐ yield 形式：函数后的代码会作为清理执行
    finally:
        db.close()

@app.get("/users")
def list_users(db = Depends(get_db)):
    users = db.execute(select(User)).scalars().all()
    return users
```

**📌 `yield` 形式的依赖**：相当于「前置 + 后置」，类似 `with` 语句。请求结束时自动执行 `finally` 关闭 db。

## 类作为依赖

```python
class CommonQueryParams:
    def __init__(self, q: str | None = None, skip: int = 0, limit: int = 10):
        self.q = q
        self.skip = skip
        self.limit = limit

@app.get("/items")
def list_items(commons: CommonQueryParams = Depends(CommonQueryParams)):
    # 或者简写：commons: CommonQueryParams = Depends()
    return {"q": commons.q, "skip": commons.skip, "limit": commons.limit}
```

## 依赖嵌套

依赖可以再依赖其他依赖：

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(db = Depends(get_db), token: str = Header(...)):
    user = verify_token(db, token)
    if not user:
        raise HTTPException(401, "未登录")
    return user

@app.get("/me")
def me(user = Depends(get_current_user)):
    return user
```

## 全局依赖（应用级）

```python
app = FastAPI(dependencies=[Depends(verify_token)])   # 每个请求都先走这个
```

## 路由级依赖

```python
router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/secret")        # 自动需要登录
def secret():
    return {"data": "secret"}
```

---

<a id="10"></a>
# 10. 异步与同步

## 📌 概念
- **同步（def）**：阻塞调用，FastAPI 会在**线程池**里跑（不会卡事件循环）
- **异步（async def）**：协程，跑在事件循环里，适合 IO 密集（HTTP 调用、DB、Redis）

## 选择规则

| 场景 | 用什么 |
|---|---|
| 同步数据库（如 SQLAlchemy 默认同步）| `def` |
| 同步库 / 调用同步阻塞函数 | `def` |
| 异步数据库（asyncpg / async SQLAlchemy）| `async def` |
| 调用其他 HTTP API（用 httpx.AsyncClient）| `async def` |
| CPU 密集计算 | `def`（FastAPI 自动用线程池）或丢到后台任务 |

## ⚠️ 最大坑：async 函数里调用阻塞代码

```python
import time

@app.get("/bad")
async def bad():
    time.sleep(5)               # ❌ 阻塞整个事件循环！其他请求都被卡住
    return {"ok": True}

@app.get("/good-sync")
def good_sync():
    time.sleep(5)               # ✅ 同步函数会跑在线程池，不卡事件循环
    return {"ok": True}

@app.get("/good-async")
async def good_async():
    await asyncio.sleep(5)     # ✅ 异步 sleep，事件循环可以处理其他请求
    return {"ok": True}
```

## 异步调用其他 API（httpx）

```python
import httpx

@app.get("/proxy/{user_id}")
async def proxy(user_id: int):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://api.example.com/users/{user_id}")
    return resp.json()
```

## 异步 SQLAlchemy（简介）

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

engine = create_async_engine("postgresql+asyncpg://user:pwd@localhost/db")

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    async with AsyncSession(engine) as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalars().one_or_none()
```

---

<a id="11"></a>
# 11. 中间件与 CORS

## CORS（前后端分离必备）

前端 `localhost:3000` 调后端 `localhost:8000` 会被浏览器拦截。加 CORS 解决：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],   # 允许的前端域名
    allow_credentials=True,                      # 允许带 Cookie
    allow_methods=["*"],                         # 允许所有方法
    allow_headers=["*"],                         # 允许所有请求头
)
# 开发期可：allow_origins=["*"]
```

## 自定义中间件

```python
from fastapi import Request
import time

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)         # 继续往下走
    duration = time.time() - start
    response.headers["X-Process-Time"] = f"{duration:.3f}s"
    return response
```

## 常用第三方中间件

```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)  # 自动 gzip 压缩

from fastapi.middleware.trustedhost import TrustedHostMiddleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["example.com"])
```

---

<a id="12"></a>
# 12. 异常处理

## HTTPException

最常用的异常类，直接抛出就返回错误响应：

```python
from fastapi import HTTPException

@app.get("/users/{user_id}")
def get_user(user_id: int):
    if user_id not in [1, 2, 3]:
        raise HTTPException(
            status_code=404,
            detail="用户不存在",
            headers={"X-Error": "UserNotFound"},   # 可选
        )
    return {"id": user_id}
```

响应：
```json
{"detail": "用户不存在"}
```

## 自定义异常

```python
class UnicornException(Exception):
    def __init__(self, name: str):
        self.name = name

@app.exception_handler(UnicornException)
async def unicorn_exception_handler(request, exc: UnicornException):
    return JSONResponse(
        status_code=418,
        content={"message": f"Oops, {exc.name} did it again"},
    )

@app.get("/unicorns/{name}")
def read_unicorn(name: str):
    if name == "yolo":
        raise UnicornException(name)
    return {"name": name}
```

## 全局 422 校验错误改格式（可选）

FastAPI 默认的 422 响应格式可以覆盖：

```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"code": -1, "message": "参数校验失败", "errors": exc.errors()},
    )
```

---

<a id="13"></a>
# 13. 连接数据库（SQLAlchemy）

把前面学的 SQLAlchemy 速查表接入 FastAPI：

## 安装

```bash
pip install sqlalchemy pymysql   # 或 psycopg2-binary / aiosqlite
```

## 项目结构

```
myapi/
├── main.py            # 入口
├── database.py        # 引擎 + Session
├── models.py          # ORM 模型
├── schemas.py         # Pydantic 模型
└── routers/users.py   # 用户路由
```

## database.py

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"
# MySQL: "mysql+pymysql://root:pwd@localhost:3306/myapi?charset=utf8mb4"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()
```

## models.py（ORM 模型）

```python
from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "user"
    id       = Column(Integer, primary_key=True, autoincrement=True)
    name     = Column(String(50), nullable=False)
    email    = Column(String(100), unique=True, nullable=False)
    age      = Column(Integer, default=18)
```

## schemas.py（Pydantic 模型，用于请求 / 响应）

```python
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    name: str
    email: EmailStr
    age: int = 18

class UserCreate(UserBase):
    password: str          # 创建时需要密码，但对外不返回

class UserOut(UserBase):
    id: int                # 创建后才有 ID

    class Config:
        from_attributes = True     # 让 Pydantic 能从 ORM 对象读字段（v2 写法）
```

## 依赖：获取 DB session

```python
# deps.py
from database import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## 路由：CRUD 完整示例

```python
# routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from models import User
from schemas import UserCreate, UserOut
from deps import get_db

router = APIRouter(prefix="/users", tags=["用户"])

@router.post("/", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    # 唯一性校验
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(400, "邮箱已被注册")

    user = User(**payload.model_dump())   # ⚠️ 这里包含 password，实际项目要 hash
    db.add(user)
    db.commit()
    db.refresh(user)                     # 刷新拿到 id 等数据库默认值
    return user

@router.get("/", response_model=list[UserOut])
def list_users(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    stmt = select(User).offset(skip).limit(limit)
    return db.scalars(stmt).all()

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    return user

@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserCreate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    for k, v in payload.model_dump().items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    db.delete(user)
    db.commit()
```

## main.py

```python
from fastapi import FastAPI
from database import Base, engine
from routers import users

# 建表（生产用 Alembic 管理，开发可以这样）
Base.metadata.create_all(engine)

app = FastAPI(title="My API")
app.include_router(users.router)
```

---

<a id="14"></a>
# 14. 认证入门（JWT）

## 安装

```bash
pip install python-jose[cryptography] passlib[bcrypt]
```

## 生成 / 校验 token

```python
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

SECRET_KEY = "your-secret-keep-it-safe"   # 生产环境从环境变量读
ALGORITHM = "HS256"

def create_access_token(data: dict, expires_minutes: int = 60):
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token 无效或已过期")
```

## 登录 + 依赖

```python
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    # 这里要校验用户名密码，简化版直接发 token
    if form.username != "admin" or form.password != "123456":
        raise HTTPException(401, "用户名或密码错误")
    token = create_access_token({"sub": form.username})
    return {"access_token": token, "token_type": "bearer"}

def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(401, "无效 token")
    return {"username": username}

@app.get("/me")
def me(current = Depends(get_current_user)):
    return current
```

访问流程：
1. POST `/login` 用 `application/x-www-form-urlencoded` 提交 `username=admin&password=123456`
2. 拿到 `access_token`
3. 后续请求加 Header：`Authorization: Bearer <token>`

**📌 提示**：访问 `/docs` 时右上角会出现 `Authorize` 按钮，输入用户名密码后，所有需要登录的接口都会自动带上 token，超方便。

---

<a id="15"></a>
# 15. 项目结构建议

## 单文件起步（学习用）

```
main.py
```

## 中型项目

```
myapi/
├── main.py
├── database.py        # engine, SessionLocal, Base
├── deps.py            # 依赖（get_db, get_current_user）
├── models.py          # SQLAlchemy ORM 模型
├── schemas.py         # Pydantic 模型（或拆 schemas/）
├── routers/
│   ├── __init__.py
│   ├── users.py
│   ├── items.py
│   └── auth.py
├── services/          # 业务逻辑（可选）
├── core/
│   ├── config.py      # Settings（用 pydantic-settings）
│   └── security.py    # token / 密码 hash
└── tests/
```

## 配置管理（推荐 pydantic-settings）

```bash
pip install pydantic-settings
```

```python
# core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "My API"
    database_url: str = "sqlite:///./app.db"
    secret_key: str = "dev-secret"

    class Config:
        env_file = ".env"        # 从 .env 文件读取

settings = Settings()

# main.py
from core.config import settings
app = FastAPI(title=settings.app_name)
```

`.env` 文件：
```
APP_NAME=生产 API
DATABASE_URL=mysql+pymysql://root:pwd@localhost/myapi
SECRET_KEY=prod-secret-xxx
```

---

<a id="16"></a>
# 16. 自动文档与测试

## 自动文档（无需写代码）

| URL | 风格 |
|---|---|
| `/docs` | Swagger UI（最常用，可直接在页面测） |
| `/redoc` | ReDoc（更美观） |
| `/openapi.json` | 原始 OpenAPI 规范 |

## 增强 doc（可选）

```python
@app.get("/users/{user_id}",
         response_model=UserOut,
         summary="查询单个用户",                     # 列表简短描述
         description="根据用户 ID 返回用户公开信息",  # 详细描述
         response_description="用户对象",
         responses={
             404: {"description": "用户不存在"},
         },
)
def get_user(...):
    ...
```

## 单元测试（pytest）

```bash
pip install pytest httpx
```

```python
# test_main.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, FastAPI!"}

def test_create_user():
    response = client.post("/users", json={
        "name": "Tom", "email": "tom@test.com", "age": 20, "password": "abc123"
    })
    assert response.status_code == 201
    assert response.json()["name"] == "Tom"
    assert "password" not in response.json()    # 验证响应里没密码

def test_validation_error():
    response = client.post("/users", json={"name": "Tom"})   # 缺字段
    assert response.status_code == 422
```

运行：
```bash
pytest -v
```

**📌 `TestClient` 不会真的开端口，直接同步调用 app，速度极快**。

---

<a id="17"></a>
# 17. 运行与部署

## 开发期

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 生产部署：Gunicorn + Uvicorn

```bash
pip install gunicorn

# Linux/Mac
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

- `-w 4`：4 个 worker 进程（建议 CPU 数 × 2 + 1）
- `-k uvicorn.workers.UvicornWorker`：用 uvicorn 的 worker 类

## Docker 部署

`Dockerfile`：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

`requirements.txt`：
```
fastapi
uvicorn[standard]
gunicorn
sqlalchemy
pymysql
```

构建 & 运行：
```bash
docker build -t myapi .
docker run -p 8000:8000 myapi
```

## Nginx 反向代理（典型架构）

```
浏览器 → Nginx（443 HTTPS）→ Gunicorn（8000）
```

Nginx 配置示例：
```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

<a id="18"></a>
# 18. 常见错误速查

| 现象 | 原因 | 解决 |
|---|---|---|
| 422 Unprocessable Entity | 请求体字段缺失 / 类型不对 | 看响应 `detail` 里的字段名；用 `/docs` 测试更直观 |
| 404 Not Found | URL 拼错 / 路由顺序问题（`/users/{id}` 在 `/users/me` 前面）| 固定路径放前面 |
| 跨域错误（浏览器）| 没配 CORS | 加 `CORSMiddleware`，`allow_origins=["前端域名"]` |
| `RuntimeError: asyncio.run() cannot be called from a running event loop` | 在 async 函数里同步调 `asyncio.run` | 改成 `await` 或挪到同步函数 |
| `time.sleep()` 在 async 路由里卡死 | 阻塞事件循环 | 改成 `await asyncio.sleep()` 或把路由改成 `def` |
| 表单 POST 报 422 | 没装 `python-multipart` | `pip install python-multipart` |
| 上传文件 `file: bytes = File(...)` 内存爆 | 大文件全读进内存 | 改用 `UploadFile`，分片 `await file.read(size)` |
| 数据库连接耗尽 | 没关 session / 没用 `Depends(get_db)` | 用 yield 依赖，确保 `finally` 关闭 |
| 自动文档不显示某字段 | 用了 `response_model` 但模型里没该字段 | 检查 Pydantic 模型 |
| 自定义异常返回 200 而不是错误码 | 没 `@app.exception_handler` 注册 | 加上 handler 或直接用 `HTTPException` |
| `model.dict()` 报 AttributeError | 用了 Pydantic v2 但调 v1 API | 改 `model_dump()` / `model_validate()` |

---

# 进阶路线建议

学完本教程后，按顺序学习：

1. **Pydantic v2 进阶**：自定义校验器 `@field_validator`、`@model_validator`、`computed_field`
2. **SQLAlchemy 关系与 N+1**：复习前一版的 SQLAlchemy 速查表
3. **数据库迁移 Alembic**：生产必备，不要再用 `create_all`
4. **后台任务**：`BackgroundTasks`（简单）/ Celery（复杂）
5. **WebSocket**：实时推送（聊天、通知）
6. **认证进阶**：OAuth2 完整流程、权限系统 RBAC
7. **OpenAPI 自定义**：自己改 schema、生成 SDK
8. **性能监控**：Prometheus + Grafana
9. **缓存**：Redis + FastAPI Cache
10. **测试**：fixtures、mock 数据库

---

# 官方资源

- 官方文档（中文社区译本）：https://fastapi.tiangolo.com/zh/
- 官方教程：https://fastapi.tiangolo.com/tutorial/
- Pydantic v2 文档：https://docs.pydantic.dev/latest/
- Starlette 文档：https://www.starlette.io/
- Awesome FastAPI：https://github.com/ml-tooling/best-of-ml-python
