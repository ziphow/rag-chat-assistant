# SQLModel 常用 API 速查

> **适用版本**：SQLModel 0.0.14+（基于 SQLAlchemy 2.0 + Pydantic v2）
> **文档定位**：API 速查手册，按类别列举常用函数、对象、变量，配简短示例。
> **符号约定**：🎯 函数/对象名 | ⚙️ 参数 | ✅ 返回值 | 💡 示例 | ⚠️ 注意

---

## 目录

1. [核心组件导入](#01)
2. [SQLModel 基类](#02)
3. [Field 字段定义](#03)
4. [引擎 Engine](#04)
5. [会话 Session](#05)
6. [查询 select](#06)
7. [取值方法](#07)
8. [col 字段包裹](#08)
9. [增删改：insert / update / delete](#09)
10. [关系 Relationship](#10)
11. [模型方法](#11)
12. [类型映射](#12)
13. [Pydantic 集成方法](#13)
14. [异常类](#14)
15. [常用速查总表](#15)

---

<a id="01"></a>
# 1. 核心组件导入

最常用的导入语句：

```python
from sqlmodel import (
    # 基类与字段
    SQLModel, Field, Relationship,

    # 引擎与会话
    create_engine, Session,

    # 查询构造
    select, col, or_, and_, not_,

    # DML 语句
    insert, update, delete,

    # 工具
    func, text, distinct,

    # 异常
    IntegrityError, NoResultFound, MultipleResultsFound,
)
```

---

<a id="02"></a>
# 2. SQLModel 基类

## 🎯 `SQLModel` —— 所有模型的基类

**说明**：所有 SQLModel 模型都继承它。带 `table=True` 的是数据库表模型，不带的是普通 Pydantic 模型。

**✅ 返回**：模型类（继承后获得 Pydantic + SQLAlchemy 双重能力）

```python
from sqlmodel import SQLModel, Field
from typing import Optional

# 表模型（映射到数据库表）
class User(SQLModel, table=True):
    __tablename__ = "user"          # 可选，不写默认用类名小写
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str

# 普通模型（不建表，用于 API 验证）
class UserCreate(SQLModel):
    name: str
    password: str
```

**⚠️ 注意**：`table=True` 的类不能直接做 FastAPI 请求体，需拆分出 `UserBase` + `UserCreate` + `UserRead`。

## 🎯 `table=True` 参数

**说明**：告诉 SQLModel 这是一个数据库表模型。

```python
class User(SQLModel, table=True):    # ✅ 会建表
    ...

class UserCreate(SQLModel):          # ❌ 不会建表，纯 Pydantic 模型
    ...
```

## 🎯 `__tablename__` 类变量

**说明**：指定数据库表名。不写时默认用类名小写。

```python
class User(SQLModel, table=True):
    __tablename__ = "t_user"     # 自定义表名
    ...
```

## 🎯 `__table_args__` 类变量

**说明**：表级配置（索引、约束、注释等）。

```python
from sqlalchemy import UniqueConstraint, Index

class User(SQLModel, table=True):
    __tablename__ = "user"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    age: int

    __table_args__ = (
        UniqueConstraint("name", "age", name="uniq_name_age"),
        Index("idx_name_age", "name", "age"),
        {"comment": "用户表"},
    )
```

---

<a id="03"></a>
# 3. Field 字段定义

## 🎯 `Field(...)` —— 字段定义与约束

**说明**：在模型字段上使用，定义主键、默认值、索引、约束等。同时具备 Pydantic 的 `Field` 功能（如 `description`、`example`）。

**⚙️ 常用参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `default` | 任意 | Python 侧默认值 |
| `default_factory` | callable | 可变默认值（如 `list`、`datetime.now`） |
| `primary_key` | bool | 是否主键 |
| `index` | bool | 是否建索引 |
| `unique` | bool | 是否唯一 |
| `nullable` | bool | 是否允许 NULL（默认根据类型推断） |
| `max_length` | int | 字符串长度（String 类型） |
| `foreign_key` | str | 外键，格式 `"表名.列名"`，如 `"user.id"` |
| `sa_type` | TypeEngine | 覆盖 SQLAlchemy 类型 |
| `sa_column` | Column | 完全自定义底层 Column |
| `description` | str | 字段描述（用于文档） |
| `exclude` | bool | 是否在响应中排除该字段 |
| `ge / le / gt / lt` | 数值 | 数值范围约束（继承自 Pydantic） |
| `min_length / max_length / pattern` | 字符串 | 字符串约束（继承自 Pydantic） |
| `...`（Ellipsis） | — | 表示必填（无默认值） |

**✅ 返回**：`FieldInfo` 对象

```python
from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, index=True, description="用户名")
    age: int = Field(default=18, ge=0, le=150)
    email: str = Field(max_length=100, unique=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.now)
    balance: float = Field(default=0.0, sa_type=None)  # 见 sa_column 示例
```

## 🎯 `Field` 自定义底层 Column

需要更精细控制时用 `sa_column`：

```python
from sqlalchemy import Column, String, DateTime, func

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), index=True, comment="姓名"))
    created_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, server_default=func.now()),
    )
```

**⚠️ 注意**：一旦用 `sa_column`，该字段的 `max_length / index / unique` 等参数都会失效，必须在 `Column` 里重新写。

---

<a id="04"></a>
# 4. 引擎 Engine

## 🎯 `create_engine(url, **kwargs)` —— 创建引擎

**说明**：创建数据库引擎。同 SQLAlchemy。

**⚙️ 常用参数**：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `url` | str | 必填 | 连接串 |
| `echo` | bool | `False` | 打印 SQL |
| `pool_size` | int | 5 | 连接池大小 |
| `max_overflow` | int | 10 | 额外连接数 |
| `pool_recycle` | int | -1 | 连接存活秒数（MySQL 推荐 3600） |
| `pool_pre_ping` | bool | `False` | 取连接前 ping（生产推荐开） |
| `connect_args` | dict | `{}` | 透传给底层 DBAPI 的参数 |

**✅ 返回**：`Engine` 对象

```python
from sqlmodel import create_engine

# SQLite
engine = create_engine("sqlite:///./app.db", echo=False)

# SQLite 多线程
engine = create_engine(
    "sqlite:///./app.db",
    connect_args={"check_same_thread": False},
)

# MySQL
engine = create_engine(
    "mysql+pymysql://root:pwd@localhost:3306/db?charset=utf8mb4",
    pool_recycle=3600,
    pool_pre_ping=True,
)

# PostgreSQL
engine = create_engine("postgresql+psycopg2://user:pwd@localhost/db")
```

## 🎯 `SQLModel.metadata.create_all(engine)` —— 建表

**说明**：根据所有 `table=True` 的模型建表。**不会修改已存在的表**。

```python
SQLModel.metadata.create_all(engine)
```

## 🎯 `SQLModel.metadata.drop_all(engine)` —— 删表

```python
SQLModel.metadata.drop_all(engine)
```

## 🎯 `engine.dispose()` —— 关闭连接池

```python
engine.dispose()
```

## 🎯 `engine.begin()` —— 事务上下文

```python
with engine.begin() as conn:
    conn.execute(text("DELETE FROM user WHERE id=1"))
# 退出自动 commit，异常自动 rollback
```

---

<a id="05"></a>
# 5. 会话 Session

## 🎯 `Session(engine, **kwargs)` —— 创建会话

**说明**：ORM 操作的入口，跟踪对象改动。

**⚙️ 常用参数**：

| 参数 | 说明 |
|---|---|
| `bind` | 引擎（默认用传入的 engine） |
| `autoflush` | `True`（默认）查询前自动 flush |
| `expire_on_commit` | `True`（默认）commit 后属性过期，建议设 `False` |

```python
from sqlmodel import Session

# 推荐用 with 自动关闭
with Session(engine) as session:
    ...

# 或显式关闭
session = Session(engine)
try:
    ...
finally:
    session.close()
```

## 🎯 Session 常用方法

| 方法 | 作用 | 返回值 |
|---|---|---|
| `session.add(obj)` | 加入 Session（pending 状态） | None |
| `session.add_all([obj1, obj2])` | 批量加入 | None |
| `session.delete(obj)` | 标记删除 | None |
| `session.commit()` | 提交事务 | None |
| `session.rollback()` | 回滚 | None |
| `session.flush()` | 刷入 DB，不提交（拿主键用） | None |
| `session.refresh(obj)` | 从 DB 重载对象状态 | None |
| `session.get(Model, pk)` | 按主键查 | 对象 or None |
| `session.exec(stmt)` | 执行 SQLModel 语句（自动 scalars） | `Result` |
| `session.execute(stmt)` | 执行 SQLAlchemy 语句（不 scalars） | `Result` |
| `session.scalar(stmt)` | 取首行首列 | 标量 or None |
| `session.merge(obj)` | 合并游离对象到 Session | 托管对象 |
| `session.expire(obj)` | 标记属性过期 | None |
| `session.expire_all()` | 全部过期 | None |
| `session.close()` | 关闭 Session | None |
| `session.in_transaction()` | 是否在事务中 | bool |
| `session.begin()` | 显式开启事务 | 上下文 |
| `session.begin_nested()` | SAVEPOINT 子事务 | 上下文 |

## 🎯 `session.exec()` vs `session.execute()`

**说明**：这是 SQLModel 的特色，二者都存在但行为不同。

```python
from sqlmodel import select

# ✅ exec：自动调 scalars，返回模型对象
users = session.exec(select(User)).all()        # list[User]

# ⚠️ execute：不 scalars，返回 Row
rows = session.execute(select(User)).all()      # list[Row]
rows = session.execute(select(User.id, User.name)).all()  # 多列必须用 execute
```

**📌 经验法则**：
- 查整行（实体对象）→ 用 `session.exec()`
- 查多列 / 聚合 → 用 `session.execute()`

## 🎯 事务上下文（推荐写法）

```python
from sqlmodel import Session

# ✅ 推荐：自动提交/回滚
with Session(engine) as session, session.begin():
    session.add(user)
# 自动 commit

# ✅ 也可手动控制
with Session(engine) as session:
    try:
        session.add(user)
        session.commit()
    except:
        session.rollback()
        raise
```

---

<a id="06"></a>
# 6. 查询 select

## 🎯 `select(*entities)` —— 构造 SELECT

**说明**：构造查询语句，与 SQLAlchemy 2.0 一致。

**✅ 返回**：`SelectOfScalar` 对象（可链式调用）

```python
from sqlmodel import select

# 查整行
stmt = select(User)

# 查指定列
stmt = select(User.id, User.name)

# 查多个表
stmt = select(User, Post).join(Post)
```

## 🎯 Select 链式方法

所有方法都返回新的 `Select` 对象（不可变）：

| 方法 | 作用 | 示例 |
|---|---|---|
| `.where(*conds)` | 条件（多个默认 AND） | `.where(User.age > 18)` |
| `.filter_by(**kw)` | 等值过滤 | `.filter_by(name="tom")` |
| `.order_by(*cols)` | 排序 | `.order_by(User.age.desc())` |
| `.limit(n)` | 限制行数 | `.limit(10)` |
| `.offset(n)` | 跳过行数 | `.offset(20)` |
| `.group_by(*cols)` | 分组 | `.group_by(User.dept)` |
| `.having(*conds)` | 分组过滤 | `.having(func.count() > 5)` |
| `.join(target, on=None)` | 内连接 | `.join(Post, Post.user_id == User.id)` |
| `.outerjoin(target, on=None)` | 左外连接 | `.outerjoin(Post)` |
| `.distinct()` | 去重 | `.distinct()` |
| `.options(*opts)` | 加载策略 | `.options(selectinload(User.posts))` |
| `.subquery()` | 变成子查询 | `sq = select(...).subquery()` |
| `.execution_options(**kw)` | 执行选项 | `.execution_options(stream_results=True)` |

```python
from sqlmodel import select

stmt = (
    select(User)
    .where(User.age > 18, User.is_active == True)
    .order_by(User.age.desc())
    .limit(10)
    .offset(0)
)
users = session.exec(stmt).all()
```

## 🎯 `or_ / and_ / not_` —— 逻辑组合

**说明**：构造复杂条件。

```python
from sqlmodel import select, or_, and_, not_

stmt = select(User).where(
    or_(
        User.age < 18,
        and_(User.age > 60, User.is_active == True),
    )
)

stmt = select(User).where(not_(User.is_active))
```

## 🎯 `func` —— SQL 函数调用

```python
from sqlalchemy import func
from sqlmodel import select

# 聚合
select(func.count(User.id))
select(func.sum(User.age), func.avg(User.age), func.min(User.age), func.max(User.age))
select(func.count()).select_from(User)

# 字符串
select(func.upper(User.name), func.lower(User.name), func.length(User.name))
select(func.concat(User.name, "@", User.email))

# 日期
select(func.now(), func.current_date())
select(func.extract("year", User.created_at))

# 分组
stmt = (
    select(User.age, func.count(User.id).label("cnt"))
    .group_by(User.age)
    .having(func.count(User.id) > 1)
)
```

## 🎯 `text(sql)` —— 原生 SQL

```python
from sqlalchemy import text

result = session.execute(
    text("SELECT id, name FROM user WHERE age > :min_age"),
    {"min_age": 20},
)
for row in result:
    print(row.id, row.name)
```

## 🎯 `distinct()` —— 去重

```python
from sqlmodel import select, distinct

# 方式一：在 select 上调
stmt = select(User.name).distinct()

# 方式二：用 distinct 函数（SQLAlchemy 风格）
stmt = select(distinct(User.name))
```

---

<a id="07"></a>
# 7. 取值方法

## 🎯 Result 对象方法（`session.exec()` 返回）

| 方法 | 返回 | 用途 |
|---|---|---|
| `.all()` | `list[Model]` | 取所有 |
| `.first()` | `Model or None` | 第一条 |
| `.one()` | `Model`（0 或 >1 报错） | 恰好一条 |
| `.one_or_none()` | `Model or None` | 0 或 1 条 |
| `.fetchall()` | `list[Model]` | 同 all |
| `.fetchone()` | `Model or None` | 同 first |
| `.fetchmany(n)` | `list[Model]` | 取 n 条 |
| `.count()` | `int` | 计数（部分版本） |
| 直接迭代 | 逐行 Model | 流式遍历 |

```python
from sqlmodel import select

with Session(engine) as session:
    # 多条
    users = session.exec(select(User)).all()

    # 第一条
    user = session.exec(select(User).where(User.name == "tom")).first()

    # 恰好一条
    user = session.exec(select(User).where(User.id == 1)).one()

    # 0 或 1 条
    user = session.exec(select(User).where(User.id == 1)).one_or_none()

    # 流式遍历
    for u in session.exec(select(User)):
        print(u.name)
```

## 🎯 `session.get(Model, pk)` —— 按主键查

```python
user = session.get(User, 1)        # 等价于 select(User).where(User.id == 1)
```

## 🎯 `session.scalar(stmt)` —— 取单值

```python
from sqlalchemy import func

total = session.scalar(select(func.count(User.id)))
```

---

<a id="08"></a>
# 8. col 字段包裹

## 🎯 `col(field)` —— 包装字段以使用方法

**说明**：SQLModel 推荐用 `col()` 包裹字段来调用 `like / in_ / contains / startswith` 等方法，能获得更好的类型提示。

```python
from sqlmodel import select, col

# 模糊匹配
stmt = select(User).where(col(User.name).like("%张%"))
stmt = select(User).where(col(User.name).contains("张"))
stmt = select(User).where(col(User.name).startswith("张"))
stmt = select(User).where(col(User.name).endswith("三"))

# 集合
stmt = select(User).where(col(User.id).in_([1, 2, 3]))
stmt = select(User).where(col(User.id).not_in([1, 2]))

# 区间
stmt = select(User).where(col(User.age).between(18, 30))

# 多字段一起处理（col 支持 *args）
stmt = select(User).where(col(User.name, User.email).in_([("张三", "zs@t.com")]))
```

**⚠️ 对比**：直接写 `User.name.like(...)` 在某些版本会报错或无类型提示，推荐 `col()` 包裹。

---

<a id="09"></a>
# 9. 增删改：insert / update / delete

## 🎯 `insert(Model)` —— 构造 INSERT

```python
from sqlmodel import insert

# 单条
stmt = insert(User).values(name="Tom", age=20, email="tom@t.com")
session.exec(stmt)
session.commit()

# 批量多值
stmt = insert(User).values([
    {"name": "A", "age": 20, "email": "a@t.com"},
    {"name": "B", "age": 21, "email": "b@t.com"},
])
result = session.exec(stmt)
print(f"插入了 {result.rowcount} 行")

# 插入并返回主键
stmt = insert(User).values(name="C", age=22, email="c@t.com").returning(User.id)
new_id = session.exec(stmt).one()
```

## 🎯 `update(Model)` —— 构造 UPDATE

```python
from sqlmodel import update

# 条件更新
stmt = update(User).where(User.age > 60).values(name="老年用户")
result = session.exec(stmt)
session.commit()
print(f"更新了 {result.rowcount} 行")

# 原子更新（SQL 表达式）
stmt = update(User).where(User.id == 1).values(age=User.age + 1)
session.exec(stmt)
session.commit()
```

## 🎯 `delete(Model)` —— 构造 DELETE

```python
from sqlmodel import delete

# 条件删除
stmt = delete(User).where(User.is_active == False)
result = session.exec(stmt)
session.commit()
print(f"删除了 {result.rowcount} 行")

# 子查询删除
from sqlmodel import select
stmt = delete(User).where(User.id.in_(select(User.id).where(User.age < 18)))
```

## 🎯 UPSERT（按方言）

```python
# MySQL
from sqlalchemy.dialects.mysql import insert
stmt = insert(User).values(id=1, name="张三", age=21)
stmt = stmt.on_duplicate_key_update(name=stmt.inserted.name, age=stmt.inserted.age)
session.exec(stmt)

# PostgreSQL / SQLite
from sqlalchemy.dialects.postgresql import insert as pg_insert
stmt = pg_insert(User).values(id=1, name="张三", age=21)
stmt = stmt.on_conflict_do_update(index_elements=["id"], set_={"name": stmt.excluded.name})
session.exec(stmt)
```

---

<a id="10"></a>
# 10. 关系 Relationship

## 🎯 `Relationship()` —— 定义关系

**说明**：定义 ORM 关系（一对多、多对一、多对多）。底层是 SQLAlchemy 的 `relationship`。

**⚙️ 常用参数**：

| 参数 | 说明 |
|---|---|
| `back_populates` | 双向关系对应字段名 |
| `back_populates` | 双向关系对应字段名 |
| `sa_relationship_kwargs` | 透传给底层 `relationship` 的 kwargs |
| `link_model` | 多对多中间表模型 |

```python
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Link

# ========== 一对多 ==========
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    posts: List["Post"] = Relationship(back_populates="user")

class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="posts")
```

## 🎯 多对多（link_model）

```python
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    roles: List["Role"] = Relationship(back_populates="users", link_model=UserRole)

class Role(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    users: List["User"] = Relationship(back_populates="roles", link_model=UserRole)

# 中间表
class UserRole(SQLModel, table=True):
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    role_id: Optional[int] = Field(default=None, foreign_key="role.id", primary_key=True)
```

## 🎯 加载策略

通过 `sa_relationship_kwargs` 传递：

```python
class User(SQLModel, table=True):
    posts: List["Post"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"lazy": "selectin"},    # 一对多推荐
    )
```

常用 `lazy` 值：
- `select`（默认）：懒加载
- `selectin`：IN 二次查询（推荐一对多）
- `joined`：JOIN 一次查出
- `raise`：访问即抛异常（防 N+1）
- `noload`：返回空

## 🎯 防 N+1（查询时指定加载）

```python
from sqlalchemy.orm import selectinload, joinedload
from sqlmodel import select

stmt = select(User).options(selectinload(User.posts))
users = session.exec(stmt).all()
for u in users:
    print(u.name, len(u.posts))   # 不会再发 SQL
```

---

<a id="11"></a>
# 11. 模型方法

## 🎯 `model_validate(dict)` —— 从 dict 创建实例

```python
user = User.model_validate({"name": "Tom", "age": 20, "email": "tom@t.com"})
```

## 🎯 `model_validate_json(str)` —— 从 JSON 字符串创建

```python
import json
user = User.model_validate_json('{"name": "Tom", "age": 20, "email": "tom@t.com"}')
```

## 🎯 `model_dump()` —— 转字典

```python
user.model_dump()                  # {'id': 1, 'name': 'Tom', 'age': 20, ...}
user.model_dump(exclude={"email"}) # 排除字段
user.model_dump(include={"name"})  # 只保留指定字段
```

## 🎯 `model_dump_json()` —— 转 JSON 字符串

```python
user.model_dump_json()              # '{"id":1,"name":"Tom",...}'
user.model_dump_json(indent=2)      # 美化
```

## 🎯 `model_json_schema()` —— 生成 JSON Schema

```python
User.model_json_schema()            # 用于 FastAPI 文档
```

## 🎯 `model_copy(update={...})` —— 拷贝并覆盖

```python
new_user = user.model_copy(update={"name": "新名字"})
```

## 🎯 字段验证器（Pydantic v2）

```python
from pydantic import field_validator

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str

    @field_validator("email")
    @classmethod
    def email_must_contain_at(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("邮箱格式不正确")
        return v
```

## 🎯 计算字段（不存数据库）

```python
from pydantic import computed_field

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str
    last_name: str

    @computed_field
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
```

---

<a id="12"></a>
# 12. 类型映射

## 📌 类型自动映射表

| Python 类型 | SQL 类型 | 说明 |
|---|---|---|
| `int` | `INTEGER` | 整数 |
| `float` | `FLOAT` | 浮点 |
| `bool` | `BOOLEAN` | 布尔 |
| `str` | `VARCHAR` | 字符串 |
| `bytes` | `BLOB` / `LONGBLOB` | 二进制 |
| `datetime.date` | `DATE` | 日期 |
| `datetime.datetime` | `DATETIME` | 日期时间 |
| `datetime.time` | `TIME` | 时间 |
| `datetime.timedelta` | `INTERVAL` | 时间间隔 |
| `decimal.Decimal` | `NUMERIC` | 精确小数（金额） |
| `uuid.UUID` | `CHAR(32)` / `UUID` | UUID |
| `dict` / `list` | `JSON` | JSON 列 |
| `Optional[T]` | `T NULL` | 允许为空 |
| `Enum` 子类 | `ENUM` | 枚举 |

## 🎯 自定义 SQLAlchemy 类型

```python
from sqlalchemy import Column, String, Text, BigInteger
from sqlmodel import Field, SQLModel
from typing import Optional

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(100), comment="姓名"))
    bio: Optional[str] = Field(default=None, sa_column=Column(Text))
    snowflake_id: int = Field(sa_column=Column(BigInteger))
```

## 🎯 方言专属类型

```python
# PostgreSQL
from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID
from sqlmodel import Field, Column
import uuid

class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, sa_column=Column(UUID(as_uuid=True), primary_key=True))
    tags: list = Field(sa_column=Column(ARRAY(String)))
    meta: dict = Field(sa_column=Column(JSONB))

# MySQL
from sqlalchemy.dialects.mysql import LONGTEXT, TINYINT
```

---

<a id="13"></a>
# 13. Pydantic 集成方法

SQLModel 继承自 Pydantic，所以可用所有 Pydantic v2 方法：

## 🎯 配置类

```python
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"id": 1, "name": "张三"}
            ]
        }
    }
```

## 🎯 `from_attributes=True`（从 ORM 对象创建）

```python
# SQLModel 默认开启了 from_orm 兼容
class UserRead(SQLModel):
    id: int
    name: str

    model_config = {"from_attributes": True}    # 默认已开启

# 从 ORM 对象 / 表模型创建 Read 模型
user = session.get(User, 1)
user_read = UserRead.model_validate(user)
```

## 🎯 嵌套模型

```python
class Address(SQLModel):
    city: str
    street: str

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    # 嵌套模型存为 JSON
    address: Address = Field(sa_column=Column(JSON))
```

---

<a id="14"></a>
# 14. 异常类

## 🎯 常用异常

```python
from sqlalchemy.exc import (
    IntegrityError,              # 唯一约束 / 外键冲突
    NoResultFound,              # .one() 找不到
    MultipleResultsFound,       # .one() 找到多条
    OperationalError,           # 数据库连接问题
    ProgrammingError,           # SQL 语法错误
    DataError,                  # 数据类型不匹配
    InternalError,              # 数据库内部错误
    StatementError,             # 语句错误（SQLAlchemy 层）
)
```

## 🎯 使用示例

```python
from sqlalchemy.exc import IntegrityError, NoResultFound

try:
    user = session.exec(select(User).where(User.id == 1)).one()
except NoResultFound:
    raise HTTPException(404, "用户不存在")

try:
    session.add(User(name="Tom", email="existing@t.com"))   # 假设邮箱已存在
    session.commit()
except IntegrityError:
    session.rollback()
    raise HTTPException(400, "邮箱已被注册")
```

## 🎯 FastAPI 异常处理

```python
from fastapi import FastAPI, HTTPException
from sqlalchemy.exc import IntegrityError

app = FastAPI()

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": "数据冲突（唯一键 / 外键）"},
    )
```

---

<a id="15"></a>
# 15. 常用速查总表

## 导入速查

```python
# 模型定义
from sqlmodel import SQLModel, Field, Relationship

# 引擎与会话
from sqlmodel import create_engine, Session

# 查询
from sqlmodel import select, col, or_, and_, not_, distinct
from sqlalchemy import func, text

# DML
from sqlmodel import insert, update, delete

# 异常
from sqlalchemy.exc import IntegrityError, NoResultFound, MultipleResultsFound
```

## 方法对照表

| 操作 | 函数 / 方法 | 返回 |
|---|---|---|
| 创建表 | `SQLModel.metadata.create_all(engine)` | None |
| 删除表 | `SQLModel.metadata.drop_all(engine)` | None |
| 创建会话 | `Session(engine)` | Session |
| 单条新增 | `session.add(obj)` + `commit()` | None |
| 批量新增 | `session.add_all([obj1, obj2])` | None |
| 批量插入 | `session.exec(insert(M).values(list))` | `Result` |
| 按主键查 | `session.get(M, pk)` | 对象 or None |
| 条件查询 | `session.exec(select(M).where(...)).all()` | `list[M]` |
| 取第一条 | `session.exec(select(M).where(...)).first()` | M or None |
| 取恰好一条 | `session.exec(select(M).where(...)).one()` | M（0 或 >1 报错） |
| 单值查询 | `session.scalar(stmt)` | 标量 or None |
| 计数 | `session.scalar(select(func.count(M.id)))` | int |
| 更新对象 | 给属性赋值 + `commit()` | None |
| 批量更新 | `session.exec(update(M).where(...).values(...))` | `Result` |
| 删除对象 | `session.delete(obj)` + `commit()` | None |
| 批量删除 | `session.exec(delete(M).where(...))` | `Result` |
| 刷新对象 | `session.refresh(obj)` | None |
| 提交 | `session.commit()` | None |
| 回滚 | `session.rollback()` | None |
| 关闭 | `session.close()` | None |
| 转 dict | `model.model_dump()` | dict |
| 转 JSON | `model.model_dump_json()` | str |
| 从 dict 创建 | `M.model_validate(d)` | M |
| 从 JSON 创建 | `M.model_validate_json(s)` | M |
| 字段模糊匹配 | `col(M.field).like("%x%")` | 表达式 |
| 字段包含 | `col(M.field).contains("x")` | 表达式 |
| 字段在集合 | `col(M.id).in_([1, 2, 3])` | 表达式 |

## 字段 Field 参数速查

| 参数 | 作用 |
|---|---|
| `primary_key=True` | 主键 |
| `default=value` | 默认值 |
| `default_factory=func` | 可变默认值 |
| `index=True` | 索引 |
| `unique=True` | 唯一 |
| `nullable=False` | 非空 |
| `max_length=50` | 字符串长度 |
| `foreign_key="user.id"` | 外键 |
| `sa_column=Column(...)` | 完全自定义 |
| `sa_type=TypeEngine` | 覆盖类型 |
| `exclude=True` | 响应排除 |
| `description="..."` | 描述 |
| `ge / le / gt / lt` | 数值范围 |
| `min_length / max_length / pattern` | 字符串约束 |

## 常见坑速查

| 坑 | 原因 | 解决 |
|---|---|---|
| `user.id` 是 None | 没 `commit + refresh` | 加 `session.refresh(user)` |
| `like` 报错 | 字段未用 `col()` 包裹 | `col(User.name).like(...)` |
| 主键类型报错 | 主键没标 Optional | `id: Optional[int]` |
| 改字段没生效 | `create_all` 不改已有表 | 删表重建 或 用 Alembic |
| `exec` vs `execute` 混乱 | SQLModel 推荐用 `exec` | `exec` 自动 scalars，返回模型对象 |
| commit 后属性过期 | 默认 `expire_on_commit=True` | `Session(engine, expire_on_commit=False)` |
| MySQL 连接断开 | 闲置超时 | `pool_recycle=3600, pool_pre_ping=True` |
| N+1 查询 | 循环访问关系 | `selectinload(rel)` 预加载 |
| `table=True` 类做请求体报错 | 它是表模型 | 拆 `UserBase / UserCreate / UserRead` |
| 同名表重复定义 | 模型多次 import | 检查 import 链 |
| `User.email == None` 不生效 | Python 恒 False | `User.email.is_(None)` |

---

# 官方资源

- 官方文档：https://sqlmodel.tiangolo.com/
- API 参考：https://sqlmodel.tiangolo.com/reference/
- FastAPI + SQLModel：https://sqlmodel.tiangolo.com/tutorial/fastapi/
- GitHub：https://github.com/tiangolo/sqlmodel
