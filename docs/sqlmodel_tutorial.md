# SQLModel 基本用法教程

> **SQLModel** 是 FastAPI 作者 Tiangolo 开发的库，**结合了 Pydantic 和 SQLAlchemy**。
> - 写一个模型 = 同时拥有「数据验证」+「ORM 映射」
> - 专为 FastAPI 设计，写后端 API 时模型可以同时用于请求体验证和数据库操作
> - 底层就是 SQLAlchemy + Pydantic，所以可以无缝使用 SQLAlchemy 的所有功能

---

## 目录

1. [安装](#01)
2. [核心概念](#02)
3. [创建数据库与表](#03)
4. [新增（Create）](#04)
5. [查询（Read）](#05)
6. [更新（Update）](#06)
7. [删除（Delete）](#07)
8. [完整 CRUD 示例](#08)
9. [结合 FastAPI 使用](#09)
10. [常见问题速查](#10)

---

<a id="01"></a>
# 1. 安装

```bash
pip install sqlmodel
# 默认会装上 SQLAlchemy + Pydantic
```

可选驱动：
```bash
pip install pymysql          # MySQL
pip install psycopg2-binary  # PostgreSQL
# SQLite 内置，无需额外驱动
```

---

<a id="02"></a>
# 2. 核心概念

## 📌 SQLModel 的核心思想

传统写法需要写**两个类**：一个 Pydantic 模型用于 API 验证，一个 SQLAlchemy 模型用于数据库。SQLModel 把它们**合并成一个类**：

```python
# 传统做法：两个类
class UserCreate(BaseModel):       # Pydantic 模型
    name: str
    age: int

class User(Base):                  # SQLAlchemy 模型
    __tablename__ = "user"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    age = Column(Integer)

# SQLModel：一个类搞定
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    age: int
```

## 📌 关键点

- 继承 `SQLModel`，并设 `table=True` → 这个类会映射到数据库表
- 不设 `table=True` → 就是普通 Pydantic 模型（用于 API 请求体验证，不建表）
- 字段用 `Field(...)` 定义主键、默认值、索引、约束等
- 类型提示是核心：`name: str` 自动映射为 `VARCHAR`
- 主键字段必须显式标注 `Optional`（`int | None`），因为创建对象时还没 id

---

<a id="03"></a>
# 3. 创建数据库与表

## 3.1 定义模型

```python
from sqlmodel import SQLModel, Field
from typing import Optional

class User(SQLModel, table=True):
    # table=True 表示这是一个数据库表模型
    __tablename__ = "user"        # 可选，不写默认用类名小写

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=50)             # 加索引
    age: int = Field(default=18)                            # 默认值
    email: str = Field(unique=True, max_length=100)          # 唯一约束
    is_active: bool = Field(default=True)
```

**📌 `Field` 常用参数**：

| 参数 | 作用 |
|---|---|
| `primary_key=True` | 主键 |
| `default=value` | Python 侧默认值 |
| `default_factory=func` | 可变默认值（如 `list`） |
| `index=True` | 建索引 |
| `unique=True` | 唯一约束 |
| `nullable=False` | 非空（默认已根据类型推断） |
| `max_length=50` | 字符串长度 |
| `foreign_key="user.id"` | 外键 |
| `sa_type=...` / `sa_column=...` | 覆盖底层 SQLAlchemy 类型 |

## 3.2 创建引擎

```python
from sqlmodel import create_engine

# SQLite
engine = create_engine("sqlite:///./demo.db", echo=False)

# MySQL
# engine = create_engine(
#     "mysql+pymysql://root:pwd@localhost:3306/mydb?charset=utf8mb4",
#     echo=False,
#     pool_recycle=3600,        # 防止 MySQL 8 小时断连
#     pool_pre_ping=True,
# )

# PostgreSQL
# engine = create_engine("postgresql+psycopg2://user:pwd@localhost/mydb")
```

- `echo=True` 开发时打印所有 SQL
- SQLite 多线程需加 `connect_args={"check_same_thread": False}`

## 3.3 建表

```python
# 根据 SQLModel 子类创建所有表（已存在的表不会被改动）
SQLModel.metadata.create_all(engine)
```

**📌 注意**：`create_all` 只会**创建不存在的表**，已存在的表结构不会更新。生产环境用 **Alembic** 做迁移。

## 3.4 完整代码：建库 + 建表

```python
from sqlmodel import SQLModel, Field, create_engine
from typing import Optional

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=50)
    age: int = Field(default=18)
    email: str = Field(unique=True, max_length=100)
    is_active: bool = Field(default=True)

class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=200)
    content: str
    user_id: int = Field(foreign_key="user.id")    # 外键

# 创建引擎 + 建表
engine = create_engine("sqlite:///./demo.db", echo=False)
SQLModel.metadata.create_all(engine)
```

运行后会生成 `demo.db` 文件，包含 `user` 和 `post` 两张表。

---

<a id="04"></a>
# 4. 新增（Create）

## 4.1 `session.add()` —— 单条新增

```python
from sqlmodel import Session

# 创建对象
user = User(name="张三", age=20, email="zhang@test.com")

with Session(engine) as session:
    session.add(user)
    session.commit()
    session.refresh(user)       # 刷新，拿到数据库自动生成的 id
    print(user.id)              # ✅ 已有值
```

**📌 `session.refresh(obj)`**：从数据库重新加载对象的最新状态（拿到自增 id、默认值等）。

## 4.2 批量新增

```python
with Session(engine) as session:
    session.add_all([
        User(name="李四", age=25, email="li@test.com"),
        User(name="王五", age=30, email="wang@test.com"),
        User(name="赵六", age=28, email="zhao@test.com"),
    ])
    session.commit()
```

## 4.3 用上下文自动提交（推荐）

```python
from sqlmodel import Session

with Session(engine) as session:
    # 显式事务：退出自动 commit，异常自动 rollback
    with session.begin():
        user = User(name="钱七", age=22, email="qian@test.com")
        session.add(user)
        session.flush()         # 立即写入，可拿到 user.id
        print(user.id)
```

## 4.4 模型实例方法（SQLModel 特色）

SQLModel 模型自带一些便捷方法：

```python
# 创建并直接入库
user = User(name="孙八", age=24, email="sun@test.com")
user.id   # None（还没入库）

with Session(engine) as session:
    # 不用每次手动写 add + commit
    User(name="周九", age=26, email="zhou@test.com")

# ⚠️ 上面这种「无 session」写法需要配合 SQLModel 的全局 session，
# 默认情况下还是要手动管理 session，推荐用标准写法。
```

---

<a id="05"></a>
# 5. 查询（Read）

## 5.1 按主键查：`session.get()`

```python
with Session(engine) as session:
    user = session.get(User, 1)
    if user:
        print(user.name, user.age)
    else:
        print("不存在")
```

**返回值**：模型对象 or `None`

## 5.2 条件查询：`select()`

SQLModel 的 `select` 用法和 SQLAlchemy 2.0 一样：

```python
from sqlmodel import select

with Session(engine) as session:
    # 查所有
    users = session.exec(select(User)).all()

    # 条件查询
    users = session.exec(
        select(User).where(User.age > 20)
    ).all()

    # 排序 + 分页
    users = session.exec(
        select(User)
        .where(User.is_active == True)
        .order_by(User.age.desc())
        .offset(0)
        .limit(10)
    ).all()
```

**📌 SQLModel 特点**：用 `session.exec()`（不是 `session.execute()`），它会自动调用 `.scalars()`，直接返回模型对象列表，比纯 SQLAlchemy 简洁。

## 5.3 取值方式速查

| 调用 | 返回 | 用途 |
|---|---|---|
| `session.exec(stmt).all()` | `list[Model]` | 多条 |
| `session.exec(stmt).first()` | `Model or None` | 第一条 |
| `session.exec(stmt).one()` | `Model`（0 或 >1 报错） | 恰好一条 |
| `session.exec(stmt).one_or_none()` | `Model or None` | 0 或 1 条 |
| `session.get(Model, pk)` | `Model or None` | 按主键 |

```python
with Session(engine) as session:
    # 多条
    users = session.exec(select(User)).all()

    # 第一条
    user = session.exec(select(User).where(User.name == "张三")).first()

    # 恰好一条（不存在或多条都报错）
    user = session.exec(select(User).where(User.id == 1)).one()
```

## 5.4 常用过滤条件

```python
from sqlmodel import select, or_, col
from sqlalchemy import func

# 等值 / 比较
select(User).where(User.age > 20)
select(User).where(User.age >= 18, User.age <= 30)   # AND

# 模糊匹配
select(User).where(col(User.name).like("%张%"))     # ⚠️ 用 col() 包裹
select(User).where(col(User.name).contains("张"))
select(User).where(col(User.name).startswith("张"))

# 集合
select(User).where(col(User.id).in_([1, 2, 3]))

# 判空
select(User).where(User.email.is_(None))

# 区间
select(User).where(User.age.between(18, 30))

# 逻辑组合
select(User).where(
    or_(
        User.age < 18,
        User.age > 60,
    )
)
```

**📌 `col()` 说明**：SQLModel 推荐用 `col(Model.field)` 包裹字段来使用 `like / in_ / contains` 等方法，类型提示更友好。

## 5.5 聚合查询

```python
from sqlalchemy import func
from sqlmodel import select

with Session(engine) as session:
    # 计数
    total = session.exec(select(func.count(User.id))).one()

    # 求和 / 平均
    result = session.exec(
        select(
            func.sum(User.age),
            func.avg(User.age),
            func.min(User.age),
            func.max(User.age),
        )
    ).one()
    print(result)

    # 分组 + having
    rows = session.exec(
        select(User.age, func.count(User.id).label("cnt"))
        .group_by(User.age)
        .having(func.count(User.id) > 1)
    ).all()
    for r in rows:
        print(r)
```

## 5.6 关联查询

```python
from sqlmodel import select

with Session(engine) as session:
    # 查所有用户的文章
    rows = session.exec(
        select(User, Post).join(Post, Post.user_id == User.id)
    ).all()
    for user, post in rows:
        print(user.name, "->", post.title)
```

---

<a id="06"></a>
# 6. 更新（Update）

## 6.1 ORM 对象方式（推荐用于单条）

```python
with Session(engine) as session:
    user = session.get(User, 1)
    if user:
        user.name = "新名字"
        user.age = 21
        session.add(user)        # 已托管对象可省略
        session.commit()
        session.refresh(user)    # 可选：刷新最新状态
```

## 6.2 批量更新（SQL 语句）

```python
from sqlmodel import Session, update

with Session(engine) as session:
    stmt = (
        update(User)
        .where(User.age > 60)
        .values(name="老年用户")
    )
    result = session.exec(stmt)
    session.commit()
    print(f"更新了 {result.rowcount} 行")
```

## 6.3 原子更新（避免并发覆盖）

```python
# ❌ 高并发会丢更新：先查再写
# user.age += 1

# ✅ SQL 表达式：age = age + 1
from sqlmodel import update

with Session(engine) as session:
    session.exec(
        update(User).where(User.id == 1).values(age=User.age + 1)
    )
    session.commit()
```

---

<a id="07"></a>
# 7. 删除（Delete）

## 7.1 ORM 对象方式

```python
with Session(engine) as session:
    user = session.get(User, 999)
    if user:
        session.delete(user)
        session.commit()
```

## 7.2 批量删除（SQL 语句）

```python
from sqlmodel import delete

with Session(engine) as session:
    result = session.exec(
        delete(User).where(User.is_active == False)
    )
    session.commit()
    print(f"删除了 {result.rowcount} 行")
```

## 7.3 按条件批量删除

```python
from sqlmodel import delete, select

with Session(engine) as session:
    session.exec(
        delete(User).where(User.email.is_(None))
    )
    session.commit()
```

---

<a id="08"></a>
# 8. 完整 CRUD 示例

```python
from typing import Optional
from sqlmodel import SQLModel, Field, Session, create_engine, select

# ========== 1. 定义模型 ==========
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=50)
    age: int = Field(default=18)
    email: str = Field(unique=True, max_length=100)
    is_active: bool = Field(default=True)

# ========== 2. 建库 + 建表 ==========
engine = create_engine("sqlite:///./crud_demo.db", echo=False)
SQLModel.metadata.create_all(engine)

# ========== 3. 新增 ==========
with Session(engine) as session:
    session.add_all([
        User(name="张三", age=20, email="zhang@test.com"),
        User(name="李四", age=25, email="li@test.com"),
        User(name="王五", age=30, email="wang@test.com"),
    ])
    session.commit()

# ========== 4. 查询 ==========
with Session(engine) as session:
    # 按主键
    u = session.get(User, 1)
    print("主键查询:", u.name if u else "无")

    # 条件查询
    users = session.exec(
        select(User).where(User.age > 20).order_by(User.age.desc())
    ).all()
    print("age>20:", [(u.name, u.age) for u in users])

    # 计数
    total = session.exec(select(User)).all()
    print("总数:", len(total))

# ========== 5. 更新 ==========
with Session(engine) as session:
    user = session.get(User, 1)
    user.age = 21
    session.add(user)
    session.commit()

# ========== 6. 删除 ==========
with Session(engine) as session:
    user = session.get(User, 3)
    if user:
        session.delete(user)
        session.commit()

# ========== 7. 验证 ==========
with Session(engine) as session:
    for u in session.exec(select(User).order_by(User.id)).all():
        print(u.id, u.name, u.age, u.email, u.is_active)
```

---

<a id="09"></a>
# 9. 结合 FastAPI 使用（SQLModel 的最大优势）

SQLModel 的核心价值在 FastAPI 中体现得淋漓尽致：**一个模型既用于 API 验证，又用于数据库操作**。

## 9.1 分离「读模型」和「写模型」

虽然一个类可以同时干两件事，但实际项目通常拆分：
- **表模型**（含 `table=True`，完整字段）
- **创建模型**（不含 `table=True`，仅请求体字段，可能多密码字段）
- **响应模型**（不含 `table=True`，仅对外字段，排除敏感字段）

```python
from typing import Optional
from sqlmodel import SQLModel, Field
from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session, create_engine, select

# ========== 模型定义 ==========
class UserBase(SQLModel):
    name: str = Field(max_length=50)
    age: int = Field(default=18)
    email: str = Field(max_length=100)

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, max_length=100)   # 表里要 unique
    is_active: bool = Field(default=True)
    hashed_password: str = Field(exclude=True)         # 敏感字段，对外不暴露

class UserCreate(UserBase):
    password: str                                      # 创建时需要密码

class UserRead(UserBase):
    id: int
    is_active: bool

# ========== 引擎 + 依赖 ==========
engine = create_engine("sqlite:///./api_demo.db")
SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

# ========== FastAPI 应用 ==========
app = FastAPI()

@app.post("/users", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    # 唯一性校验
    exists = session.exec(select(User).where(User.email == payload.email)).first()
    if exists:
        raise HTTPException(400, "邮箱已被注册")

    # 实际项目这里要 hash 密码
    user = User(
        name=payload.name,
        age=payload.age,
        email=payload.email,
        hashed_password=payload.password,    # 简化，实际要 bcrypt
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@app.get("/users", response_model=list[UserRead])
def list_users(skip: int = 0, limit: int = 10, session: Session = Depends(get_session)):
    users = session.exec(select(User).offset(skip).limit(limit)).all()
    return users

@app.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    return user

@app.put("/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserBase, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    for k, v in payload.model_dump().items():
        setattr(user, k, v)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    session.delete(user)
    session.commit()
```

运行：
```bash
uvicorn main:app --reload
```

访问 http://127.0.0.1:8000/docs 即可看到自动生成的 API 文档，可以直接测试。

## 9.2 SQLModel + FastAPI 的好处

| 对比项 | 纯 SQLAlchemy + Pydantic | SQLModel |
|---|---|---|
| 模型数量 | 至少 2 个（ORM 模型 + Pydantic 模型） | 1 套（共享基类） |
| 字段定义 | 写两遍（容易不同步） | 一处定义 |
| 类型提示 | 各自维护 | 统一 |
| `from_orm` 转换 | 需要手动配置 | 默认支持 |

---

<a id="10"></a>
# 10. 常见问题速查

| 问题 | 原因 | 解决 |
|---|---|---|
| `user.id` 是 None | 没 `commit` + `refresh` | 加 `session.refresh(user)` |
| `like` / `in_` 报错 | SQLModel 字段需要 `col()` 包裹 | `col(User.name).like("%x%")` |
| 主键字段类型报错 | 主键没标 Optional | `id: Optional[int] = Field(primary_key=True)` |
| 表已存在但改了字段没生效 | `create_all` 不会改已有表 | 删表重建 或 用 Alembic |
| `session.exec()` vs `session.execute()` | SQLModel 推荐用 `exec` | `exec` 自动 `scalars()`，更简洁 |
| commit 后属性过期 | SQLAlchemy 默认行为 | `create_engine` 后手动设 `expire_on_commit=False` |
| MySQL 连接断开 | 闲置超时被回收 | `create_engine(..., pool_recycle=3600, pool_pre_ping=True)` |
| 模型字段重复定义报错 | 同名表被注册两次 | 检查 import 链路 |
| `table=True` 的类不能做请求体 | 它是 ORM 模型不是验证模型 | 拆分：`UserBase` 不带 `table=True` 作为基类 |
| 关系查询发 N+1 条 SQL | 没预加载 | 用 SQLAlchemy 的 `selectinload` |

---

# 进阶路线建议

学完基础后，按顺序学习：

1. **关系定义**：`Relationship()` 定义一对多、多对多
2. **Alembic 迁移**：生产环境管理表结构变更
3. **异步支持**：`AsyncSession` + `asyncpg` / `aiomysql`
4. **Pydantic v2 特性**：`@field_validator`、`@model_validator`、`computed_field`
5. **FastAPI + SQLModel 进阶**：JWT 认证、权限、分页封装
6. **性能优化**：`selectinload` 防 N+1、流式查询

---

# 官方资源

- 官方文档：https://sqlmodel.tiangolo.com/
- 官方教程：https://sqlmodel.tiangolo.com/tutorial/
- FastAPI + SQLModel 集成：https://sqlmodel.tiangolo.com/tutorial/fastapi/
- GitHub：https://github.com/tiangolo/sqlmodel
