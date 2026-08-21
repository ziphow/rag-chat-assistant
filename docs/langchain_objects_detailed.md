# LangChain v1 常用对象详解（属性 + 方法 + 参数 + 返回值）

> **版本**：LangChain v1.0+（基于 SQLAlchemy 2.0 / Pydantic v2 思路）
> **写作目标**：每个对象都讲清楚「有哪些属性 → 每个属性的类型和含义 → 有哪些方法 → 每个方法的参数、返回值、作用」，尽量类比你熟悉的 SQLAlchemy/Pydantic 概念。
> **符号约定**：
> - 🧊 对象 / 类名（大类）
> - 🔵 属性：`名称: 类型` + 含义
> - 🟢 方法：完整签名 + 参数表 + 返回值 + 作用
> - 💡 完整可运行示例
> - ⚠️ 注意 / 常见坑

---

# 目录

## Part A：消息体系（Messages）
1. [`BaseMessage` —— 消息基类](#A1)
2. [`HumanMessage` —— 用户消息](#A2)
3. [`AIMessage` —— AI 消息](#A3)
4. [`ToolMessage` —— 工具返回消息](#A4)
5. [`SystemMessage` —— 系统提示消息](#A5)
6. [`AIMessageChunk` / BaseMessageChunk](#A6)

## Part B：模型体系（Chat Models）
7. [`init_chat_model()` —— 工厂函数](#B1)
8. [`ChatOpenAI` —— OpenAI 聊天模型](#B2)
9. `ChatAnthropic` 等其他厂商模型
10. [`BaseChatModel` —— 所有聊天模型的基类（通用方法）](#B3)

## Part C：工具体系（Tools）
11. [`@tool` —— 工具装饰器](#C1)
12. [`StructuredTool` —— 结构化工具类](#C2)
13. [`Tool` —— 工具对象（@tool 的产物）](#C3)

## Part D：智能体体系（Agent）
14. [`create_agent()` —— 创建智能体（工厂函数）](#D1)
15. [`AgentState` —— 智能体状态（TypedDict）](#D2)
16. [LangGraph Agent（Runnable）—— invoke/stream 等统一入口](#D3)

## Part E：提示词体系（Prompts）
17. [`ChatPromptTemplate` —— 聊天提示模板](#E1)
18. [`PromptTemplate` —— 字符串提示模板](#E2)
19. [`MessagesPlaceholder` —— 占位符](#E3)

## Part F：可运行链体系（Runnables）
20. [`Runnable` —— 所有可运行对象的基类接口](#F1)
21. [`RunnableLambda` —— 把普通函数包装成 Runnable](#F2)
22. [`RunnableSequence` —— 用 `|` 连起来的链](#F3)
23. [`RunnableParallel` —— 并行运行多个 Runnable](#F4)
24. [`RunnablePassthrough` —— 原样透传](#F5)
25. [`RunnableConfig` —— 运行配置](#F6)

## Part G：结构化输出
26. [`ToolStrategy` —— 工具策略](#G1)
27. [`ProviderStrategy` —— 提供商策略](#G2)

## Part H：中间件体系（Middleware）
28. [`@wrap_model_call` / `@wrap_tool_call` 装饰器](#H1)
29. [`@before_model` / `@after_model` 装饰器](#H2)
30. [`@dynamic_prompt` 装饰器](#H3)
31. [`AgentMiddleware` —— 中间件基类](#H4)
32. [`ModelRequest` / `ModelResponse` —— 模型请求/响应对象](#H5)

## Part I：RAG 体系
33. [`Document` —— 文档对象](#I1)
34. [`RecursiveCharacterTextSplitter` —— 文本切分](#I2)
35. [`OpenAIEmbeddings` —— Embedding 模型](#I3)
36. `Chroma` / `FAISS` 向量库对象
37. 向量库 `.as_retriever()` 返回的 `VectorStoreRetriever`

## Part J：输出解析器
38. [`StringOutputParser`](#J1)
39. [`JsonOutputParser`](#J2)

## Part K：回调与追踪
40. [`BaseCallbackHandler` —— 回调基类](#K1)
41. [`StdOutCallbackHandler`](#K2)

---

---
---

# Part A：消息体系

LangChain 的消息是 **Pydantic v2 模型**（类似你熟悉的 SQLModel / Pydantic BaseModel），所有消息都继承自 `BaseMessage`。

<a id="A1"></a>
## 🧊 1. `BaseMessage` —— 所有消息的基类

**继承**：`pydantic.BaseModel`（所以自带 `model_dump / model_validate` 等方法）

### 🔵 属性

| 属性名 | 类型 | 默认值 | 含义 |
|---|---|---|---|
| `content` | `str \| list[dict]` | **必填** | 消息正文。<br>- 简单文本：`str`<br>- 多模态（图 + 文）：`list[dict]`，如 `[{"type":"text","text":"a"}, {"type":"image_url",...}]` |
| `role` | `Literal["system", "user", "assistant", "tool"]` | 子类自动填 | 消息角色，模型靠这个区分是谁说的 |
| `name` | `str \| None` | `None` | 可选，多工具调用时区分说话者名字 |
| `id` | `str \| None` | `None` | 可选消息 ID，追踪用 |
| `response_metadata` | `dict[str, Any]` | `{}` | **模型返回时才有**：原始响应元数据（token、模型名、finish_reason 等） |
| `tool_calls` | `list[dict]` | `[]` | 只有 `AIMessage` 可能非空：模型请求调用的工具列表 |
| `invalid_tool_calls` | `list[dict]` | `[]` | 解析失败的工具调用 |
| `usage_metadata` | `dict \| None` | `None` | Token 用量：如 `{"input_tokens": 100, "output_tokens": 50, "total_tokens": 150}` |
| `additional_kwargs` | `dict[str, Any]` | `{}` | 透传的额外关键字参数 |

### 🟢 方法（继承自 Pydantic + LangChain 扩展）

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `.pretty_repr()` | `str` | 格式化的可读字符串（调试打印用） |
| `.pretty_print()` | `None` | 直接把 `pretty_repr()` 打印到 stdout |
| `.model_dump(*, mode="python" \| "json" \| ...)` | `dict` | Pydantic 自带：转 dict（见 Pydantic v2 文档） |
| `.model_dump_json(indent=...)` | `str` | 转 JSON 字符串 |
| `.to_json()` | `dict` | 转成可序列化 dict（内部用） |
| `.__add__(other)` | `BaseMessage` | 支持 `msg1 + msg2`（拼接 content，chunk 场景用） |

### 💡 示例
```python
from langchain_core.messages import BaseMessage, HumanMessage

msg = HumanMessage(content="你好", id="m-001")
print(msg.content)            # "你好"
print(msg.role)               # "user"
print(msg.model_dump())       # {'content': '你好', 'role': 'user', ...}
msg.pretty_print()            # 格式化打印：HumanMessage(content='你好')
```

---

<a id="A2"></a>
## 🧊 2. `HumanMessage` —— 用户消息（role="user"）

**继承**：`BaseMessage` → 所有属性/方法都继承

### 🔵 额外属性
没有新增属性，区别只是：
- `role` 固定为 `"user"`
- 可以通过 `type: Literal["human"]` 字段在 Pydantic discriminator 中区分类型

### 💡 构造方式 4 种
```python
from langchain.messages import HumanMessage
from langchain_core.messages import HumanMessage as HumanMessage2  # 同源

# 方式 1：关键字参数
m1 = HumanMessage(content="你好")

# 方式 2：位置参数
m2 = HumanMessage("你好")

# 方式 3：带额外元数据
m3 = HumanMessage(content="你好", id="user-msg-1", name="user-zhang")

# 方式 4：dict → 实例（Pydantic）
m4 = HumanMessage.model_validate({"role": "user", "content": "你好"})

print(m1.role)   # "user"
```

---

<a id="A3"></a>
## 🧊 3. `AIMessage` —— 助手消息（role="assistant"）

**继承**：`BaseMessage`

### 🔵 额外属性（相对 BaseMessage 只是默认填充）

核心区别是 `role="assistant"`，下面两个属性在这个类上**最常用**：

| 属性名 | 类型 | 典型场景 | 含义 |
|---|---|---|---|
| `tool_calls` | `list[dict]` | Agent 中间回复 | 模型想要调用的工具，每个元素形如 `{"id":"call_abc", "name":"get_weather", "args":{"city":"上海"}}` |
| `invalid_tool_calls` | `list[dict]` | 模型格式解析失败 | 模型生成了工具调用但 JSON 解析失败 |
| `response_metadata` | `dict` | **任何时候都重要** | 包含 `finish_reason: "stop" \| "tool_calls" \| "length"`、`model_name`、`token_usage` 等 |
| `usage_metadata` | `dict \| None` | 2024 年之后的 SDK | `{"input_tokens":N, "output_tokens":M, ...}` |

### 🟢 方法（继承 + 专属）

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `@classmethod .from_format(content, format_type, **kw)` | `AIMessage` | （旧版本用）从指定格式的内容创建 |

### 💡 示例
```python
from langchain.messages import AIMessage

# 普通回复
msg = AIMessage(content="北京天气晴朗")
print(msg.role)                 # "assistant"
print(msg.tool_calls)           # []

# 带工具调用的 AI 回复（Agent 会产生）
msg2 = AIMessage(
    content="",
    tool_calls=[{
        "id": "call_abc123",
        "name": "get_weather",
        "args": {"city": "上海"},
    }],
    response_metadata={"finish_reason": "tool_calls", "model_name": "gpt-4o"},
)
print("工具调用数:", len(msg2.tool_calls))
print("要调用的工具名:", msg2.tool_calls[0]["name"])
print("finish_reason:", msg2.response_metadata.get("finish_reason"))
```

---

<a id="A4"></a>
## 🧊 4. `ToolMessage` —— 工具执行结果（role="tool"）

**继承**：`BaseMessage`

### 🔵 额外属性（**必填！**）

| 属性名 | 类型 | 默认值 | **必须？** | 含义 |
|---|---|---|---|---|
| `tool_call_id` | `str` | 无默认 | **必填** | 对应模型发出的 `tool_call.id`。必须一一匹配，不然模型不知道是谁的结果 |
| `role` | `"tool"` | 固定 | — | 不用传 |
| `content` | `str` | **必填** | **必填** | 工具执行结果。**尽量是字符串**，不要传 dict/list，容易被模型当垃圾解析 |

### 🟢 方法（继承自 BaseMessage）

### 💡 完整的「模型请求工具 → 执行 → 返回 ToolMessage」流程
```python
from langchain.messages import AIMessage, ToolMessage

# 1. 模型说要调用工具
ai_msg = AIMessage(
    content="",
    tool_calls=[{
        "id": "call_abc123",
        "name": "get_weather",
        "args": {"city": "上海"},
    }],
)

# 2. 实际调用工具
import json
for tc in ai_msg.tool_calls:
    if tc["name"] == "get_weather":
        result = f"{tc['args']['city']} 天气晴 25°C"
    else:
        result = f"未知工具 {tc['name']}"

    # 3. 把结果包成 ToolMessage，**tool_call_id 必须匹配**
    tm = ToolMessage(
        content=result,
        tool_call_id=tc["id"],       # ⚠️ 传 tc["id"]，不是 tc["name"]
    )
    print(tm.tool_call_id)           # "call_abc123"
    print(tm.role)                   # "tool"
```

### ⚠️ 最常见的坑
- 忘填 `tool_call_id` → Agent 收到 `ToolMessage` 不知道对应哪个调用，会乱掉
- `content` 传 `dict` 而不是 `str` → 模型处理不稳定，一律 `json.dumps(...)` 或 str()

---

<a id="A5"></a>
## 🧊 5. `SystemMessage` —— 系统提示（role="system"）

**继承**：`BaseMessage`

### 🔵 额外属性
无。区别就是 `role="system"`。

### 💡 用法
```python
from langchain.messages import SystemMessage, HumanMessage

sys_msg = SystemMessage(content="""你是资深 Python 讲师。
要求：
1. 解释概念要先给一句通俗定义
2. 然后给一段可运行代码
3. 最后列常见坑""")

user_msg = HumanMessage(content="解释什么是生成器")

# 放到 messages 列表最前面，作为系统人设
messages = [sys_msg, user_msg]
```

### ⚠️ 注意
- 一般放在 `messages[0]`，作为全局人设
- Anthropic Claude 对系统提示位置有限制，看文档

---

<a id="A6"></a>
## 🧊 6. `AIMessageChunk` / `HumanMessageChunk` —— 流式增量块

流式输出时每个 chunk 都是增量，不是完整消息。需要 `+` 拼起来才是完整消息。

### 🔵 属性
和对应完整消息一致，但 `content` 往往是一小段字符串；`tool_call_chunks` 等字段也只有部分。

### 🟢 核心方法

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `chunk + other_chunk` | 对应 Chunk 类型 | **最常用**：拼接两个增量块，最终得到完整消息 |

### 💡 示例
```python
from langchain.messages import AIMessageChunk

full = None
for chunk in model.stream([HumanMessage(content="你好")]):
    # chunk 是 AIMessageChunk，content 是增量字符串
    print(chunk.content, end="", flush=True)
    full = chunk if full is None else full + chunk

print()
print("完整回复内容:", full.content)
print("完整回复类型:", type(full))   # AIMessageChunk（+ 之后仍是 Chunk 类）
```

---
---

# Part B：模型体系

<a id="B1"></a>
## 🧊 7. `init_chat_model(model, **kwargs)` —— 模型工厂函数

**模块**：`langchain.chat_models`

这是**不是类，是普通函数**，但在 LangChain v1 里是最推荐的初始化方式。

### 🟢 函数签名
```python
def init_chat_model(
    model: str,                         # 模型标识符，如 "gpt-4o" / "openai:gpt-4o" / "anthropic:claude-sonnet-4-5"
    *,
    model_provider: str | None = None,  # 不传就从 model 前缀推断
    temperature: float | None = None,
    max_tokens: int | None = None,
    timeout: float | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
    **kwargs                            # 其他透传给具体 Model 类的参数
) -> BaseChatModel
```

**✅ 返回值**：`BaseChatModel` 子类实例（具体是哪个看 provider）

### 💡 示例
```python
from langchain.chat_models import init_chat_model

# 自动推断 provider（gpt-4o → openai）
gpt = init_chat_model("gpt-4o")

# 显式写前缀
claude = init_chat_model("anthropic:claude-sonnet-4-5", temperature=0)

# 透传自定义参数
gpt_cn = init_chat_model(
    "openai:gpt-4o-mini",
    base_url="https://open.bigmodel.cn/api/paas/v4/",  # 兼容其他 API
    api_key="xxx",
    temperature=0.1,
    max_tokens=2048,
    timeout=60,
)
```

---

<a id="B2"></a>
## 🧊 8. `ChatOpenAI` —— OpenAI 聊天模型类

**模块**：`langchain_openai.ChatOpenAI`

**继承**：`BaseChatModel` → `BaseLanguageModel` → `Runnable`（所以它本身就是 Runnable，支持 `|` 串联）

### 🔵 常用实例属性（构造时传入）

| 属性名 | 类型 | 默认值 | 作用 |
|---|---|---|---|
| `model` | `str` | `"gpt-4o"` 前版本不同 | 必填：模型名，如 `"gpt-4o-mini"` / `"gpt-5"` |
| `temperature` | `float` | `0.7` | 采样温度 0-2。0 = 确定，2 = 极度随机 |
| `max_tokens` | `int \| None` | `None`（模型默认） | 最大输出 token 数 |
| `model_kwargs` | `dict[str, Any]` | `{}` | 其他传给 API 的参数（如 top_p、frequency_penalty 等） |
| `api_key` | `SecretStr \| None` | 环境变量 `OPENAI_API_KEY` | API Key |
| `base_url` | `str \| None` | 官方 URL | 兼容平台用（代理、本地模型） |
| `organization` | `str \| None` | `None` | OpenAI 组织 ID |
| `timeout` | `float \| Timeout \| None` | `None` | 超时（秒） |
| `max_retries` | `int` | `2` | 失败重试次数 |
| `stream_usage` | `bool` | `False` | 流式时是否返回 usage metadata |

### 🟢 方法（主要都继承自 `BaseChatModel`，见下一节）
此外还有 OpenAI 专属方法：

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `.bind_tools(tools, **kw)` | `Runnable`（绑定工具后的模型） | 返回一个「新模型对象」，后续 invoke 会支持工具调用。原对象不变 |
| `.bind_functions(functions, ...)` | `Runnable` | Legacy 方式，现在推荐 `bind_tools` |
| `.bind_response_format(format, ...)` | `Runnable` | 绑定 JSON / 结构化响应格式 |

### 💡 示例
```python
from langchain_openai import ChatOpenAI
from langchain.tools import tool
from langchain.messages import HumanMessage

@tool
def get_weather(city: str) -> str:
    """获取天气"""
    return f"{city} 晴"

model = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.0,
    max_tokens=1024,
    timeout=30,
    max_retries=3,
)

# 1. 普通调用
resp = model.invoke([HumanMessage(content="你好")])
print(resp.content)                       # 文本
print(resp.usage_metadata)                # token 用量

# 2. 绑定工具（返回新对象）
model_with_tools = model.bind_tools([get_weather])
resp2 = model_with_tools.invoke([HumanMessage(content="上海天气")])
print(resp2.tool_calls)                   # [{'name': 'get_weather', ...}]

# 3. 流式
for chunk in model.stream([HumanMessage(content="说三句话")]):
    print(chunk.content, end="")
```

---

<a id="B3"></a>
## 🧊 9. `BaseChatModel` —— 所有聊天模型的通用基类

所有 `ChatOpenAI / ChatAnthropic / ChatDeepseek ...` 都继承这个类。**通用方法在这里**。

### 🟢 核心方法（所有模型都有）

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `.invoke(input, config=None)` | `AIMessage` | **同步执行一次**：`input` 是 `list[BaseMessage]` |
| `.ainvoke(input, config=None)` | `Awaitable[AIMessage]` | **异步** 执行一次（需要 `await`） |
| `.stream(input, config=None)` | `Iterator[AIMessageChunk]` | **同步流式**：逐块 yield 增量内容 |
| `.astream(input, config=None)` | `AsyncIterator[AIMessageChunk]` | **异步流式**：`async for chunk in ...` |
| `.batch(inputs, config=None)` | `list[AIMessage]` | **批量**：`inputs` 是 `list[list[BaseMessage]]`，并行发请求 |
| `.abatch(inputs, config=None)` | `Awaitable[list[AIMessage]]` | 异步批量 |
| `.bind_tools(tools, ...)` | `Runnable` | 绑定工具，返回新的 Runnable |
| `.bind(**kwargs)` | `Runnable` | 绑定调用时 kwargs（如 `bind(stop=["\n"])`） |
| `.with_config(config)` | `Runnable` | 返回「绑了默认 config」的副本 |
| `.with_retry(...)` | `Runnable` | 返回带重试策略的副本 |
| `.with_fallbacks([alt_model, ...])` | `Runnable` | 返回带降级模型的副本（主模型失败用备用） |
| `.get_num_tokens(text)` | `int` | 估算一段文本的 token 数 |
| `.get_num_tokens_from_messages(messages)` | `int` | 估算整个消息列表的 token 数 |
| `.identifying_params` | `dict` | **属性**（不是方法）：用于区分模型实例的参数字典 |

### 💡 综合示例
```python
from langchain_openai import ChatOpenAI
from langchain.messages import HumanMessage

m = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 同步
r = m.invoke([HumanMessage(content="你好")])
print(type(r), r.content)  # AIMessage

# 异步
import asyncio
async def main():
    r2 = await m.ainvoke([HumanMessage(content="你好（异步）")])
    print(r2.content)
    async for chunk in m.astream([HumanMessage(content="背一首诗")]):
        print(chunk.content, end="")
asyncio.run(main())

# 批量
rs = m.batch([
    [HumanMessage(content="1+1=")],
    [HumanMessage(content="2+2=")],
])
for r in rs:
    print("批量结果:", r.content)

# 估算 token
toks = m.get_num_tokens_from_messages([
    HumanMessage(content="hello world" * 100)
])
print("token 数:", toks)
```

---
---

# Part C：工具体系

<a id="C1"></a>
## 🧊 10. `@tool` —— 工具装饰器

**模块**：`langchain.tools.tool`

把**普通 Python 函数**转成「LLM 可调用的工具对象」。这是 LangChain 用的最多的装饰器，类似 Pydantic 会分析类型注解。

### 🟢 函数签名
```python
def tool(
    __func=None,               # 位置形式：@tool 直接装饰
    *,
    name: str | None = None,          # 自定义工具名；不写就用函数名
    description: str | None = None,   # 自定义描述；不写就用函数的 docstring
    args_schema: type[BaseModel] | None = None,   # 指定入参的 Pydantic 模型，写了就不分析函数签名
    return_direct: bool = False,      # True 时：工具返回内容直接作为 Agent 最终答案返回，不再进 LLM
    infer_schema: bool = True,        # 是否从函数签名推导 Schema（默认 True）
    response_format: Literal["content", "content_and_artifact"] = "content",
) -> Callable | StructuredTool
```

**✅ 返回值**：`StructuredTool`（当 args_schema 或函数带参数时）或 `Tool`（简单版本）。二者都继承 `BaseTool`，接口一致。

### 💡 5 种典型用法
```python
from langchain.tools import tool
from pydantic import BaseModel, Field

# ---- 用法 1：最简单（@tool 无括号）----
@tool
def search(query: str) -> str:
    """搜索互联网，返回 top 5 结果。"""
    return f"搜索到 {query} 的结果..."

print(type(search))       # <class 'StructuredTool'>
print(search.name)        # "search"
print(search.description) # "搜索互联网，返回 top 5 结果。"

# ---- 用法 2：自定义 name + description ----
@tool(name="谷歌搜索", description="必用这个工具查最新新闻")
def google_search(query: str) -> str:
    """..."""
    return "..."

# ---- 用法 3：return_direct = True（工具返回就是答案）----
@tool(return_direct=True)
def get_current_time() -> str:
    """获取当前系统时间字符串。"""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# ---- 用法 4：用 Pydantic 指定复杂入参 args_schema ----
class SearchInput(BaseModel):
    query: str = Field(..., description="搜索关键词，不超过 30 字")
    max_results: int = Field(5, ge=1, le=20, description="最大结果数")
    include_news: bool = Field(True, description="是否包含新闻")

@tool(args_schema=SearchInput)
def advanced_search(query: str, max_results: int, include_news: bool) -> str:
    """高级搜索。"""
    return f"{query}（最多 {max_results} 条，新闻={include_news}）"

# ---- 用法 5：@tool("名称") 简写形式 ----
@tool("calc_tool")
def calculate(expr: str) -> float:
    """计算数学表达式。"""
    return eval(expr, {"__builtins__": {}}, {})
```

### ⚠️ 最佳实践
1. **docstring 写得比业务代码还详细**：LLM 靠它理解用途，要写「**什么时候用** + **入参含义** + **返回什么格式**」
2. **返回值尽量 `str`**：dict/list 模型解析不一定稳定，复杂的用 `json.dumps()`
3. **入参尽量简单扁平**：不要嵌套 3 层结构

---

<a id="C3"></a>
## 🧊 11. `StructuredTool` —— 结构化工具类（@tool 的产物）

**模块**：`langchain.tools.StructuredTool`

当你使用 `@tool` 时，得到的对象就是这个类（或更简单的 `Tool` 类）。它的 API 是一致的。

### 🔵 核心属性

| 属性名 | 类型 | 含义 |
|---|---|---|
| `.name` | `str` | 工具名（LLM 用这个字段识别） |
| `.description` | `str` | 工具描述（LLM 读这个，决定调不调你） |
| `.args_schema` | `type[BaseModel]` | 入参 Pydantic Schema，定义了字段 + 校验 |
| `.func` | `Callable` | 被装饰的原函数（可直接调用，不需要 LLM） |
| `.coroutine` | `Callable \| None` | 异步版本（如果有的话） |
| `.return_direct` | `bool` | 是否工具返回就是 Agent 最终答案 |
| `.handle_tool_error` | `bool \| Callable` | 错误处理策略 |

### 🟢 核心方法

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `.invoke(input: dict \| ToolCall, config=None)` | `Any` | 用 dict 调工具：`tool.invoke({"query": "Python"})` |
| `.ainvoke(input, config=None)` | `Awaitable[Any]` | 异步调用 |
| `.run(*args, **kwargs)` | `Any` | 以原函数参数形式调用（legacy，不推荐新代码） |
| `.run(tool_input: dict)` | `Any` | 同上（legacy） |
| `.get_input_schema()` | `type[BaseModel]` | 返回入参的 Pydantic 类（== args_schema） |
| `.to_json()` | `dict` | 转成 OpenAI Function Calling 格式的 JSON Schema |

### 💡 示例
```python
from langchain.tools import tool

@tool
def add(a: int, b: int) -> int:
    """两数相加，返回整数和。"""
    return a + b

# 读属性
print("name:", add.name)                    # "add"
print("desc:", add.description[:30])        # 前 30 字
print("schema fields:", add.args_schema.model_fields.keys())  # dict_keys(['a', 'b'])

# 两种调用方式（等价）
print(add.func(3, 4))                 # 7，直接调原函数
print(add.invoke({"a": 3, "b": 4}))   # 7，走 Runnable 形式

# 看要发给 OpenAI 的 Function Schema
print(add.to_json()["function"]["parameters"])
# {'type': 'object', 'properties': {'a': {'type': 'integer'}, 'b': {'type': 'integer'}}, ...}
```

---
---

# Part D：智能体体系

<a id="D1"></a>
## 🧊 12. `create_agent(...)` —— 工厂函数

**模块**：`langchain.agents.create_agent`

v1 版本的核心函数，一行代码创建一个 **LangGraph Runnable Agent**。

### 🟢 签名 + 参数表
```python
def create_agent(
    model: "str | BaseChatModel",                  # 字符串标识符或 ChatModel 实例
    tools: list[BaseTool] | None = None,           # 工具列表（用 @tool 装饰的对象）
    *,
    system_prompt: str | None = None,              # 系统提示词
    response_format: ToolStrategy | ProviderStrategy | None = None,
    state_schema: type[AgentState] | None = None,  # 自定义状态（必须 TypedDict）
    middleware: list[Callable | AgentMiddleware] | None = None,  # 中间件
    context_schema: type | None = None,            # 运行时 context 的 TypedDict
    max_iterations: int = 25,                      # 最大循环次数
    graph: Any = None,                             # 高级：自定义 LangGraph 图
    checkpointer: Any = None,                      # 持久化（LangGraph MemorySaver 等）
) -> Runnable  # 实际是 LangGraph 的 CompiledGraph，实现 Runnable 协议
```

**✅ 返回值**：`LangGraph CompiledGraph`（一个 Runnable），支持 `.invoke / .stream / .astream / .batch`。

### 💡 示例
```python
from langchain.agents import create_agent
from langchain.tools import tool

@tool
def weather(city: str) -> str:
    """获取城市天气。"""
    return f"{city}晴24°C"

agent = create_agent(
    model="gpt-4o-mini",
    tools=[weather],
    system_prompt="你是生活助手，回答要简洁。",
    max_iterations=10,
)
print(type(agent).__name__)   # "CompiledGraph"（LangGraph）

result = agent.invoke({"messages": [{"role": "user", "content": "北京天气"}]})
print(result["messages"][-1].content)
```

---

<a id="D2"></a>
## 🧊 13. `AgentState` —— 智能体状态（TypedDict）

**模块**：`langchain.agents.AgentState`

LangGraph 的每个节点/边传递的数据就是 State。默认的 AgentState 包含 `messages`。

### 🔵 默认字段（所有 state 都有）

| 字段名 | 类型 | 作用 |
|---|---|---|
| `messages` | `list[BaseMessage] \| Annotated[list[BaseMessage], add_messages]` | **核心字段**：消息序列。LangGraph 用 `add_messages` reducer：新旧 state 合并时消息自动 append 不是替换 |

### 扩展自定义状态（TypedDict）
```python
from typing import TypedDict
from langchain.agents import AgentState

class MyState(AgentState):
    user_preferences: dict     # 用户偏好字典
    todo_list: list[str]       # 待办
    current_turn: int          # 当前轮次

# 使用：create_agent(state_schema=MyState)
# 调用时可以传这些自定义字段
agent = create_agent("gpt-4o", state_schema=MyState)

result = agent.invoke({
    "messages": [{"role": "user", "content": "你好"}],
    "user_preferences": {"language": "zh-CN"},
    "todo_list": ["写代码", "喝水"],
    "current_turn": 1,
})
```

### ⚠️ v1 重大变化
v1 之后 **state_schema 必须是 TypedDict**，不能是 Pydantic 模型 / dataclass，不然直接报错。

---

<a id="D3"></a>
## 🧊 14. CompiledGraph Agent —— 执行时的方法

`create_agent` 返回的对象虽然是 LangGraph 的 `CompiledGraph`，但对外它完全支持 Runnable 协议。核心方法：

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `.invoke(input, config=None, *, stream_mode=None)` | `dict`（State） | 同步执行，返回**最终完整状态**，key 至少包含 `"messages"` |
| `.ainvoke(input, config=None)` | `Awaitable[dict]` | 异步 invoke |
| `.stream(input, config=None, *, stream_mode="values" \| "updates" \| "messages-tuple")` | `Iterator[dict]` | 流式执行，最常用 `stream_mode="values"`，每次产出「当前时刻完整 state」 |
| `.astream(input, ...)` | `AsyncIterator[dict]` | 异步流式 |
| `.get_graph(config=None)` | `Graph` | 获取可视化的 DAG 图（调试用） |
| `.get_state(config)` | `StateSnapshot` | 获取某次运行的状态快照（需要 checkpointer） |
| `.update_state(config, values, as_node=None)` | `None` | 手动修改状态（人类介入 / 多轮持久化） |
| `.with_config(config)` | Runnable 副本 | 绑定默认配置 |

### 💡 综合示例
```python
# 1) invoke 拿最终结果
result = agent.invoke({"messages": [{"role": "user", "content": "你好"}]})
print(type(result))        # <class 'dict'>
print(result.keys())       # dict_keys(['messages', ...自定义字段])
for m in result["messages"]:
    print(f"[{m.role}] {getattr(m, 'name', '')}: {str(m.content)[:30]}")

# 2) stream values 模式：看每一步中间状态
for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "上海天气，然后推荐穿搭"}]},
    stream_mode="values",
):
    latest = chunk["messages"][-1]
    if latest.tool_calls:
        print(f"🛠️  调用工具: {[tc['name'] for tc in latest.tool_calls]}")
    if isinstance(latest, type(latest).__bases__[0] if hasattr(latest, '__bases__') else type(latest)):
        pass  # 工具消息判断用 role
    if hasattr(latest, "role") and latest.role == "tool":
        print("📨 工具返回:", str(latest.content)[:40])
    if getattr(latest, "role", None) == "assistant" and latest.content:
        print("🤖 AI 说:", latest.content[:60])
```

---
---

# Part E：提示词体系

<a id="E1"></a>
## 🧊 15. `ChatPromptTemplate` —— 聊天提示模板

**模块**：`langchain.prompts.ChatPromptTemplate`

把多轮提示词（system + human + ai 结构）做成模板，运行时填变量。

### 🔵 属性
| 属性名 | 类型 | 含义 |
|---|---|---|
| `.messages` | `list[BaseMessagePromptTemplate]` | 消息模板列表（就是 from_messages 的参数） |
| `.input_variables` | `set[str]` | 模板需要的变量名集合（如 `{"role", "question"}`） |
| `.partial_variables` | `dict[str, Any]` | 已经填充的变量（部分填充时用） |

### 🟢 构造 + 核心方法

| 方法 / 构造 | 返回 | 作用 |
|---|---|---|
| `ChatPromptTemplate.from_messages(list[tuple\|Message])` | `ChatPromptTemplate` | 最常用的工厂：`("system", "...{var}")` 形式列表 |
| `.invoke(variables: dict)` | `list[BaseMessage]` | 填变量 → 得到消息列表（因为它本身就是 Runnable） |
| `.format_messages(**kwargs)` | `list[BaseMessage]` | 直接调用 `.invoke(dict(kwargs))` |
| `.format(**kwargs)` | `str` | 转成纯字符串（一般不用，调试打印） |
| `.partial(**kwargs)` | `ChatPromptTemplate` | 预填部分变量，返回新模板 |
| `.pipe(other)` | `RunnableSequence` | 和其他 Runnable 串联（等价于 `\|`） |

### 💡 示例
```python
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

# 构造 1：from_messages（tuple 形式）
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个{role}，回答要{style}。"),
    ("human", "用户问题：{user_input}"),
])

print(prompt.input_variables)   # {'role', 'style', 'user_input'}

# 填变量
messages = prompt.invoke({
    "role": "Python 讲师",
    "style": "幽默",
    "user_input": "装饰器是什么",
})
for m in messages:
    print(f"[{m.role}] {m.content[:30]}")

# 和模型串联
chain = prompt | ChatOpenAI(model="gpt-4o-mini")
result = chain.invoke({
    "role": "物理学家",
    "style": "简洁",
    "user_input": "什么是黑洞",
})
print("回答:", result.content[:50])

# 预填部分变量
expert_prompt = prompt.partial(role="专家", style="详细")
print(expert_prompt.input_variables)  # {'user_input'}
```

---

<a id="E2"></a>
## 🧊 16. `PromptTemplate` —— 字符串提示模板

**模块**：`langchain.prompts.PromptTemplate`

给 `invoke` 字符串模型（`LLM`）用的。Chat 模型一般用上面的 `ChatPromptTemplate`。

### 🟢 核心方法
| 方法 | 返回 |
|---|---|
| `PromptTemplate.from_template("...{var}...")` | `PromptTemplate` |
| `.format(**kwargs)` | `str` | 填变量，拿到字符串 |
| `.format_prompt(**kwargs)` | `StringPromptValue` | 填变量，拿到 PromptValue（再 .to_messages() / .to_string()） |
| `.invoke(dict)` | `PromptValue` | Runnable 接口形式 |

---

<a id="E3"></a>
## 🧊 17. `MessagesPlaceholder` —— 列表占位符

**模块**：`langchain.prompts.MessagesPlaceholder`

模板里预留一个位置，运行时填入「一整段消息列表」（比如历史对话）。

### 🟢 构造
```python
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是乐于助人的助手。"),
    MessagesPlaceholder("history"),         # 运行时把 history 填进来
    ("human", "{input}"),
])

# 运行：history 传入 list[BaseMessage]
msgs = prompt.invoke({
    "history": [
        {"role": "user", "content": "我叫张三"},
        {"role": "assistant", "content": "你好张三！"},
    ],
    "input": "我叫什么名字？",
})
print(len(msgs))   # 1(system) + 2(history) + 1(human) = 4 条
```

---
---

# Part F：Runnable 可运行体系

LangChain 所有可执行对象（Model / Prompt / Parser / Tool / Chain / Agent）都实现了 Runnable 接口。这是 LangChain 的「骨架」。

<a id="F1"></a>
## 🧊 18. `Runnable` —— 统一接口（抽象）

### 🟢 所有 Runnable 都有的方法

| 方法签名 | 返回类型 | 作用 |
|---|---|---|
| `.invoke(input, config=None)` | `Output` | **核心**：同步执行 |
| `.ainvoke(input, config=None)` | `Awaitable[Output]` | 异步执行 |
| `.stream(input, config=None)` | `Iterator[Chunk]` | 同步流式（迭代增量块） |
| `.astream(input, config=None)` | `AsyncIterator[Chunk]` | 异步流式 |
| `.batch(inputs, config=None, **opts)` | `list[Output]` | 批量执行（inputs 是 list） |
| `.abatch(inputs, ...)` | `Awaitable[list[Output]]` | 异步批量 |
| `runnable1 \| runnable2` | `RunnableSequence` | **核心**：串联。runnable1 的输出 → runnable2 的输入 |
| `.pipe(other, ...)` | `RunnableSequence` | 和 `\|` 等价，多参数就是链式 `.pipe()` |
| `.with_config(config)` | `Runnable` | 返回副本：默认 config |
| `.with_retry(stop_after_attempt=3, ...)` | `Runnable` | 返回副本：失败自动重试 |
| `.with_fallbacks([alt1, alt2])` | `RunnableWithFallbacks` | 返回副本：主失败 → 备1 → 备2 |
| `.with_types(input_type=None, output_type=None)` | `Runnable` | 返回副本：给类型提示用 |
| `.bind(**kwargs)` | `RunnableBinding` | 返回副本：调用时额外注入 kwargs（模型用来 bind_tools / bind stop 等） |
| `.assign(**kwargs)` | `RunnableParallel` 组合 | 主要在 RunnableParallel（dict 形式）上用：在输出 dict 上添加新 key |
| `.map()` | `RunnableEach` | 把单输入 Runnable 变成「每个 list 元素执行一次」的批量版本 |
| `.graph` | `Graph` | 属性：获取 DAG 图（LangSmith） |
| `.name` | `str` | 属性：名字 |
| `.InputType` | `type` | 类属性：输入类型 |
| `.OutputType` | `type` | 类属性：输出类型 |

### 💡 链式示例
```python
from langchain.prompts import ChatPromptTemplate
from langchain.runnables import RunnableLambda
from langchain_openai import ChatOpenAI
from langchain.output_parsers import StringOutputParser

prompt = ChatPromptTemplate.from_messages([("human", "解释{topic}，30 字以内")])
model = ChatOpenAI(model="gpt-4o-mini", temperature=0)
parser = StringOutputParser()
chinese_only = RunnableLambda(lambda s: s.replace("。", "！").replace(" ", ""))

# 完整链
chain = prompt | model | parser | chinese_only

result = chain.invoke({"topic": "LangChain"})
print(type(result), repr(result))   # <class 'str'> 'LangChain是LLM应用开发框架！连接模型+工具+数据源构建复杂Agent！'
```

---

<a id="F2"></a>
## 🧊 19. `RunnableLambda(fn)` —— 普通函数变 Runnable

### 🟢 构造
```python
def __init__(
    self,
    func: Callable[[Input], Output],          # 同步函数
    afunc: Callable[[Input], Awaitable[Output]] | None = None,  # 对应异步函数（可选）
)
```

### 💡 示例
```python
from langchain.runnables import RunnableLambda

add_one = RunnableLambda(lambda x: x + 1)
print(add_one.invoke(5))   # 6

def half(x: int) -> int:
    """整除 2"""
    return x // 2

chain = add_one | RunnableLambda(half)
print(chain.invoke(10))    # (10 + 1) // 2 = 5
```

---

<a id="F3"></a>
## 🧊 20. `RunnableSequence` —— 串联的链

通常不是手动构造，而是用 `a | b` 语法。

### 🔵 属性
| 属性 | 类型 | 含义 |
|---|---|---|
| `.steps` | `tuple[Runnable, ...]` | 串联的每一步 |

### 🟢 方法
继承 Runnable 所有方法，没有额外方法。

---

<a id="F4"></a>
## 🧊 21. `RunnableParallel(branches)` —— 并行运行多个分支

### 🟢 构造
```python
# 方式 1：dict 形式（最常用）
parallel = RunnableParallel({
    "upper": lambda s: s.upper(),
    "length": RunnableLambda(len),
})

# 方式 2：等价简写（dict 直接写在链里也会自动转 RunnableParallel）
```

### 💡 示例
```python
from langchain.runnables import RunnableParallel, RunnablePassthrough

result = RunnableParallel({
    "raw": RunnablePassthrough(),
    "upper": lambda x: x.upper(),
    "len": lambda x: len(x),
}).invoke("hello")

print(result)
# {'raw': 'hello', 'upper': 'HELLO', 'len': 5}
```

典型用法在 RAG 里：
```python
chain = {
    "context": retriever | format_docs,
    "question": RunnablePassthrough(),
} | prompt | model
```
dict 形式在 `|` 左边时，LangChain 会自动把它包成 `RunnableParallel`。

---

<a id="F5"></a>
## 🧊 22. `RunnablePassthrough` —— 原样透传

功能简单但在组合链里非常常用：**输入是什么，输出就是什么**。

### 💡 3 个场景
```python
from langchain.runnables import RunnablePassthrough

# 1) 原样传
pt = RunnablePassthrough()
print(pt.invoke(123))    # 123

# 2) 搭配 RunnableParallel 做 key 映射
RunnableParallel({
    "q": RunnablePassthrough(),     # "q" 键值就是原始输入
    "ctx": lambda x: f"context of {x}",
}).invoke("Python")
# {'q': 'Python', 'ctx': 'context of Python'}

# 3) assign（dict 链上继续追加新 key）
step1 = RunnablePassthrough.assign(upper=lambda d: d["a"].upper())
step1.invoke({"a": "hello"})
# {'a': 'hello', 'upper': 'HELLO'}
```

---

<a id="F6"></a>
## 🧊 23. `RunnableConfig` —— 运行时配置

**模块**：`langchain.runnables.RunnableConfig`（实际上是 TypedDict）

### 🔵 字段

| 字段名 | 类型 | 作用 |
|---|---|---|
| `tags` | `list[str]` | 标签，LangSmith 过滤用 |
| `metadata` | `dict[str, Any]` | 自定义元数据，写进 LangSmith trace |
| `run_name` | `str` | 这次调用的名字（LangSmith 里显示） |
| `callbacks` | `list[BaseCallbackHandler]` | 回调处理器列表 |
| `recursion_limit` | `int` | 默认 25：Runnable 递归最大深度（Agent 场景要调高） |
| `max_concurrency` | `int | None` | 并行分支的最大并发数 |
| `configurable` | `dict[str, Any]` | 可配置参数，供 `RunnableBinding(configurable={...})` 使用 |
| `run_id` | `UUID \| None` | 手动指定 run id（一般不设） |

### 💡 用法
```python
from langchain.runnables import RunnableConfig

config = RunnableConfig(
    run_name="demo-call",
    tags=["dev", "weather-demo"],
    metadata={"user_id": 1001, "session": "abc"},
    recursion_limit=100,
)
result = agent.invoke({"messages": [{"role":"user","content":"你好"}]}, config=config)
```

---
---

# Part G：结构化输出

<a id="G1"></a>
## 🧊 24. `ToolStrategy(schema)` —— 工具结构化策略

**模块**：`langchain.agents.structured_output.ToolStrategy`

任何支持工具调用的模型都能用。原理：让模型调用一个「特殊的输出工具」，参数就是你要的结构。

### 🔵 属性 / 构造
```python
def __init__(self, schema: type[BaseModel]):
    ...
```
| 属性 | 类型 | 作用 |
|---|---|---|
| `.schema` | `type[BaseModel]` | 你要输出的 Pydantic 类 |

### 💡 用法
```python
from pydantic import BaseModel
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

class Info(BaseModel):
    name: str
    age: int
    tags: list[str]

agent = create_agent(
    "gpt-4o",
    tools=[],
    response_format=ToolStrategy(Info),
)
r = agent.invoke({"messages": [{"role": "user", "content": "从这段文字提取：Tom 是 28 岁程序员，喜欢 Python 和篮球"}]})

out = r["structured_response"]
print(type(out))   # <class '__main__.Info'>
print(out.name)    # "Tom"
print(out.age)     # 28
print(out.tags)    # ["程序员", "Python", "篮球"]
```

---

<a id="G2"></a>
## 🧊 25. `ProviderStrategy(schema)` —— 提供商原生结构化

**模块**：`langchain.agents.structured_output.ProviderStrategy`

仅支持 OpenAI / Anthropic 等少数提供商的「原生结构化输出」API。质量一般比 ToolStrategy 好，但兼容性差。

### 🔵 属性
| 属性 | 类型 | 作用 |
|---|---|---|
| `.schema` | `type[BaseModel]` | 要输出的结构 |
| `.method` | `Literal["function_calling", "json_mode", ...]` | 采用的原生方法 |

---
---

# Part H：中间件体系

<a id="H1"></a>
## 🧊 26. 中间件装饰器（4 个常用）

**模块**：`langchain.agents.middleware`

每个装饰器返回一个 AgentMiddleware 实例，放在 `create_agent(middleware=[...])` 里即可。

### 🟢 `@wrap_model_call` —— 包裹整个模型调用

```python
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

@wrap_model_call
def middleware_name(request: ModelRequest, handler) -> ModelResponse:
    """可以改 request.model / request.state，调用 handler(request) 得到响应后再修改响应。"""
    # 前处理
    request.model = ChatOpenAI(model="gpt-4o")
    # 执行
    resp = handler(request)
    # 后处理
    ...
    return resp
```

### 🟢 `@wrap_tool_call` —— 包裹工具调用（错误处理神器）

```python
from langchain.agents.middleware import wrap_tool_call
from langchain_core.messages import ToolMessage

@wrap_tool_call
def handle_errors(request, handler):
    try:
        return handler(request)
    except Exception as e:
        # request.tool_call 是 dict：{"id":"...", "name":"...", "args":{...}}
        return ToolMessage(
            content=f"工具出错：{e}",
            tool_call_id=request.tool_call["id"],
        )
```

### 🟢 `@before_model` —— 只在模型调用前运行

```python
from langchain.agents.middleware import before_model

@before_model
def trim_messages(state, runtime) -> dict | None:
    """返回值如果是 dict，会合并到 state（仅本次模型调用）；返回 None 不改。"""
    msgs = state["messages"]
    if len(msgs) > 50:
        return {"messages": msgs[-50:]}
    return None
```

### 🟢 `@after_model` —— 只在模型调用后运行

```python
from langchain.agents.middleware import after_model

@after_model
def log_response(state, runtime):
    last = state["messages"][-1]
    print(f"[AI replied] {str(last.content)[:50]}")
```

### 🟢 `@dynamic_prompt` —— 动态生成 system prompt

```python
from typing import TypedDict
from langchain.agents.middleware import dynamic_prompt, ModelRequest

class Ctx(TypedDict):
    level: str

@dynamic_prompt
def make_prompt(request: ModelRequest) -> str:
    level = request.runtime.context.get("level", "beginner")
    return f"你是教学助手，用户水平是 {level}，请按对应难度回答。"

agent = create_agent("gpt-4o", middleware=[make_prompt], context_schema=Ctx)
result = agent.invoke(
    {"messages": [{"role":"user","content":"解释相对论"}]},
    context={"level": "expert"},
)
```

---

<a id="H4"></a>
## 🧊 27. `AgentMiddleware` —— 中间件基类（类式）

复杂逻辑推荐继承类式 Middleware。

### 🟢 可重写的钩子方法
| 钩子签名 | 返回 | 调用时机 |
|---|---|---|
| `def before_model(self, state, runtime)` | `dict \| None` | 调模型前 |
| `def after_model(self, state, runtime)` | `dict \| None` | 调模型后 |
| `def before_tools(self, state, runtime)` | `dict \| None` | 调用任一工具前 |
| `def after_tools(self, state, runtime)` | `dict \| None` | 所有工具执行完成后 |
| `def on_error(self, state, runtime, error)` | `dict \| None` | 任何步骤异常时 |
| `async def a_before_model(...)` | — | 对应异步版本（按需重写） |
| `...` | — | 所有钩子都有 a_ 异步版本 |

### 🔵 可声明的类属性
| 属性 | 作用 |
|---|---|
| `state_schema` | 声明该中间件需要扩展哪些 state 字段（TypedDict） |
| `tools` | 该中间件专属的工具（自动挂到 agent） |
| `context_schema` | 该中间件要求的 context 结构（TypedDict） |

---

<a id="H5"></a>
## 🧊 28. `ModelRequest` / `ModelResponse`

在 `@wrap_model_call` 里拿到的两个对象。

### 🔵 ModelRequest 属性
| 属性 | 类型 | 含义 |
|---|---|---|
| `.state` | `AgentState` | 当前完整状态（含 messages、自定义字段） |
| `.model` | `BaseChatModel` | 当前要调用的模型（可以替换） |
| `.messages` | `list[BaseMessage]` | 将要发给模型的消息（可以修改） |
| `.stop` | `list[str] \| None` | stop 序列 |
| `.runtime` | `Runtime` | 运行时对象，`.runtime.context` 是用户传的 context |

### 🔵 ModelResponse 属性
| 属性 | 类型 | 含义 |
|---|---|---|
| `.output` | `AIMessage` | 模型输出（可修改） |
| `.state` | `AgentState` | 修改后的状态 |

---
---

# Part I：RAG 体系

<a id="I1"></a>
## 🧊 29. `Document` —— 文档对象

**模块**：`langchain.docstore.document.Document`（实际从 `langchain_core.documents`）

### 🔵 属性（很少，非常简单）
| 属性 | 类型 | 含义 |
|---|---|---|
| `.page_content` | `str` | **文档正文**（纯文本） |
| `.metadata` | `dict[str, Any]` | 附属元信息：来源、页码、作者、URL 等 |
| `.id` | `str \| None` | 文档 ID（可选） |

### 🟢 方法（都是 Pydantic 自带）
| 方法 | 返回 |
|---|---|
| `.model_dump()` | `dict`：`{"page_content": ..., "metadata": ...}` |
| `.model_dump_json()` | `str` |
| `.model_validate(dict)` | `Document` 类方法：从 dict 构造 |

### 💡 示例
```python
from langchain.docstore.document import Document

d1 = Document(page_content="Python 是动态语言")
d2 = Document(page_content="Python 支持装饰器", metadata={"source": "python-book.pdf", "page": 42})

print(d2.page_content)
print(d2.metadata["page"])   # 42
print(d2.model_dump())
```

---

<a id="I2"></a>
## 🧊 30. `RecursiveCharacterTextSplitter` —— 文本切分器

**模块**：`langchain.text_splitter`

### 🔵 构造参数
```python
def __init__(
    self,
    separators: list[str] | None = None,     # ["\n\n", "\n", " ", ""]（默认）：按顺序尝试切
    chunk_size: int = 4000,                  # 每块目标字符数
    chunk_overlap: int = 200,                # 相邻块重叠字符数
    length_function: Callable[[str], int] = len,  # 长度函数，可换 token 计数
    is_separator_regex: bool = False,
)
```

### 🟢 方法
| 方法签名 | 返回 | 作用 |
|---|---|---|
| `.split_text(text: str)` | `list[str]` | 切纯字符串，返回切好的文本块列表 |
| `.split_documents(docs: list[Document])` | `list[Document]` | 切 Document 列表：每个 Document 可能切成多个，metadata 保留（多加 `"chunk_index"`） |
| `.create_documents(texts, metadatas=None)` | `list[Document]` | 文本列表 → Document 列表（自动分块） |

### 💡 示例
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=200,
    chunk_overlap=20,
    separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
)

text = """\
第一章 介绍
LangChain 是一个框架。它可以用来构建 LLM 应用。

第二章 核心概念
Runnable 是所有操作的抽象。它支持 invoke、stream、batch。
"""

chunks = splitter.split_text(text)
for i, c in enumerate(chunks):
    print(f"--- Chunk {i} (len={len(c)}) ---")
    print(c)
    print()
```

---

<a id="I3"></a>
## 🧊 31. `OpenAIEmbeddings` —— Embedding 模型

**模块**：`langchain_openai.OpenAIEmbeddings`

### 🔵 构造参数（核心）
| 参数 | 类型 | 默认 | 作用 |
|---|---|---|---|
| `model` | `str` | `"text-embedding-ada-002"`（新代码推荐 `"text-embedding-3-small"`） | 模型名 |
| `api_key` | `str \| None` | 环境变量 | |
| `base_url` | `str \| None` | — | 兼容其他 API |
| `dimensions` | `int \| None` | None | v3 系列支持：控制输出维度（降维用） |
| `chunk_size` | `int` | `200` | 批量调用每批文本数 |

### 🟢 方法
| 方法签名 | 返回 | 作用 |
|---|---|---|
| `.embed_query(text: str)` | `list[float]` | 把**用户查询**向量化（某些模型对 query / doc 区分处理） |
| `.embed_documents(texts: list[str])` | `list[list[float]]` | 把**文档列表**向量化（每行返回一个向量） |
| `.aembed_query(text)` | `Awaitable[list[float]]` | 异步查询向量 |
| `.aembed_documents(texts)` | `Awaitable[list[list[float]]]` | 异步文档批量向量 |

### 💡 示例
```python
from langchain_openai import OpenAIEmbeddings

embed = OpenAIEmbeddings(model="text-embedding-3-small")

doc_vecs = embed.embed_documents(["hello world", "你好世界"])
print(len(doc_vecs))          # 2
print(len(doc_vecs[0]))       # 1536（small 默认）

q = embed.embed_query("问候语")
print(len(q))                 # 1536

# 相似度（简单点积）
import numpy as np
a, b = np.array(doc_vecs[0]), np.array(q)
sim = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))
print(f"相似度: {sim:.3f}")
```

---

## 🧊 32. 向量库 `Chroma`（`langchain-chroma` 包）

### 🟢 常用工厂 + 方法

| 方法 | 返回 | 作用 |
|---|---|---|
| `Chroma.from_texts(texts, embedding, ids=None, persist_directory=..., metadatas=None)` | `Chroma` | 从文本列表构建向量库 |
| `Chroma.from_documents(docs, embedding, persist_directory=...)` | `Chroma` | 从 Document 列表构建 |
| `.add_texts(texts, ids=None, metadatas=None)` | `list[str]` | 追加文本，返回新 ID 列表 |
| `.add_documents(docs, ids=None)` | `list[str]` | 追加文档 |
| `.similarity_search(query: str, k: int = 4, filter=None)` | `list[Document]` | 最常用：按文本相似度查 top-k |
| `.similarity_search_with_score(query, k=4)` | `list[tuple[Document, float]]` | 带距离分数（越小越相似） |
| `.similarity_search_by_vector(embedding, k=4)` | `list[Document]` | 按向量直接查 |
| `.delete(ids)` | `None` | 按 ID 删除 |
| `.as_retriever(search_kwargs={"k":5}, search_type="similarity")` | `VectorStoreRetriever` | 转成 Retriever（在链里用） |

### 🔵 Retriever 方法
| 方法 | 返回 | 作用 |
|---|---|---|
| `.invoke(query: str)` | `list[Document]` | 查 top-k 文档 |

---
---

# Part J：输出解析器

<a id="J1"></a>
## 🧊 33. `StringOutputParser`

最简单也是最常用的解析器：从 `AIMessage` 里把 `.content` 抽出来。

### 🟢 方法
| 方法签名 | 返回 | 作用 |
|---|---|---|
| `.invoke(input: AIMessage \| str)` | `str` | 同步 |
| `.ainvoke(...)` | `Awaitable[str]` | 异步 |
| `.transform(input_iter)` | `Iterator[str]` | 流式转换（chunk 迭代 → 字符串迭代） |

### 💡 示例
```python
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.output_parsers import StringOutputParser

chain = (
    ChatPromptTemplate.from_messages([("human", "{q}")])
    | ChatOpenAI(model="gpt-4o-mini")
    | StringOutputParser()
)
out = chain.invoke({"q": "说一句英语"})
print(type(out), out)    # <class 'str'> 例如 "Actions speak louder than words."
```

---

<a id="J2"></a>
## 🧊 34. `JsonOutputParser`

把模型的 JSON 字符串输出解析成 Python dict / Pydantic 对象。

### 🟢 构造 + 方法
```python
def __init__(
    self,
    pydantic_object: type[BaseModel] | None = None,   # 指定则返回 Pydantic 实例
)
```
| 方法 | 返回 |
|---|---|
| `.invoke(ai_msg_or_str)` | `dict \| BaseModel` |
| `.parse(text: str)` | `dict \| BaseModel` | 同步解析文本 |
| `.get_format_instructions()` | `str` | 告诉模型怎么输出的 prompt 片段 |

### 💡 示例
```python
from pydantic import BaseModel
from langchain.output_parsers import JsonOutputParser

class Person(BaseModel):
    name: str
    age: int

parser = JsonOutputParser(pydantic_object=Person)
print("格式说明:", parser.get_format_instructions())  # 可以把它塞进 prompt

raw = '''```json
{"name": "张三", "age": 25}
```'''

p = parser.parse(raw)
print(type(p), p.name, p.age)   # <class 'Person'> 张三 25
```

---
---

# Part K：回调体系

<a id="K1"></a>
## 🧊 35. `BaseCallbackHandler` —— 回调基类

继承并覆盖想要监听的钩子，把实例放进 `config={"callbacks":[...]}` 就生效。

### 🟢 常用钩子方法（全部都是 `def on_xxx(self, ...)`）

| 钩子签名 | 触发时机 |
|---|---|
| `on_llm_start(serialized, prompts, *, run_id, parent_run_id=None, **kwargs)` | LLM 开始执行（prompts 是 list[str]） |
| `on_llm_end(response, *, run_id, **kwargs)` | LLM 正常结束 |
| `on_llm_error(error, *, run_id, **kwargs)` | LLM 异常 |
| `on_chat_model_start(serialized, messages, *, run_id, **kwargs)` | Chat 模型开始执行（messages 是 list[list[BaseMessage]]） |
| `on_chat_model_end(response, *, run_id, **kwargs)` | Chat 模型正常结束 |
| `on_tool_start(serialized, input_str, *, run_id, **kwargs)` | 工具开始 |
| `on_tool_end(output, *, run_id, **kwargs)` | 工具结束，output 是工具返回值 |
| `on_tool_error(error, *, run_id, **kwargs)` | 工具异常 |
| `on_chain_start(serialized, inputs, *, run_id, **kwargs)` | Chain 开始 |
| `on_chain_end(outputs, *, run_id, **kwargs)` | Chain 结束 |
| `on_chain_error(error, *, run_id, **kwargs)` | Chain 异常 |
| `on_retriever_start(serialized, query, *, run_id, **kwargs)` | Retriever 开始 |
| `on_retriever_end(documents, *, run_id, **kwargs)` | Retriever 结束 |
| `on_text(text, *, run_id, **kwargs)` | 流式 chunk（文本） |
| `on_retry(retry_state, *, run_id, **kwargs)` | 重试触发 |

### 💡 自定义日志回调
```python
from langchain.callbacks.base import BaseCallbackHandler
from langchain.messages import HumanMessage

class MyLog(BaseCallbackHandler):
    def on_chat_model_start(self, ser, messages, *, run_id, **kw):
        ms = messages[0]
        print(f"\n🧠 开始调用模型，消息数={len(ms)}：")
        for m in ms:
            content = getattr(m, "content", str(m))
            print(f"  - [{getattr(m,'role','?')}] {str(content)[:40]}")

    def on_chat_model_end(self, response, *, run_id, **kw):
        out = response.generations[0][0].message
        print(f"✅ 模型回复结束：{str(out.content)[:80]}")

    def on_tool_start(self, ser, input_str, *, run_id, **kw):
        print(f"🔧 工具 {ser.get('name')} 开始，输入={input_str[:50]}")

    def on_tool_end(self, output, *, run_id, **kw):
        print(f"✅ 工具结束，输出={str(output)[:50]}")

# 使用
model = ChatOpenAI(model="gpt-4o-mini", callbacks=[MyLog()])
model.invoke([HumanMessage(content="介绍 LangChain")])
```

---
---

# 附录 A：所有对象 → 核心属性/方法速查表

| 对象 | 3 个最常用属性 | 3 个最常用方法 |
|---|---|---|
| HumanMessage | `content`, `role`=`"user"`, `id` | `model_dump()`, `pretty_print()` |
| AIMessage | `content`, `tool_calls`, `response_metadata`, `usage_metadata` | `model_dump()`, `pretty_print()` |
| ToolMessage | `content`, `tool_call_id`, `role`=`"tool"` | — |
| SystemMessage | `content`, `role`=`"system"` | — |
| ChatOpenAI | `model`, `temperature`, `api_key` | `.invoke()`, `.stream()`, `.bind_tools()` |
| StructuredTool (@tool) | `name`, `description`, `args_schema`, `func` | `.invoke(dict)` |
| ChatPromptTemplate | `.messages`, `.input_variables` | `.from_messages()`, `.invoke(dict)` |
| RunnableLambda | — | `.invoke()`, `.pipe()` / `\|` |
| RunnableParallel | `steps`（各分支） | `.invoke(dict)` |
| RunnablePassthrough | — | `.invoke(x) → x`, `.assign(**kw)` |
| ToolStrategy | `.schema` | —（作为 `create_agent(response_format=...)` 传） |
| ProviderStrategy | `.schema`, `.method` | — |
| Document | `page_content`, `metadata` | `model_dump()`, `model_validate(d)` |
| RecursiveCharacterTextSplitter | `chunk_size`, `chunk_overlap` | `.split_text()`, `.split_documents()` |
| OpenAIEmbeddings | `model` | `.embed_query()`, `.embed_documents()` |
| Chroma | `_collection`（内部） | `.similarity_search()`, `.as_retriever()`, `.delete()` |
| StringOutputParser | — | `.invoke(AIMessage) → str` |
| JsonOutputParser | `pydantic_object` | `.parse(str)`, `get_format_instructions()` |
| BaseCallbackHandler | — | 重写 `on_llm_start / on_tool_start ...` 钩子 |

# 附录 B：常见链式组合速查

```python
# 1) 最基础：Prompt → Model → 字符串输出
chain1 = chat_prompt | chat_model | StringOutputParser()

# 2) 并行：Prompt 做多个分支
from langchain.runnables import RunnablePassthrough
chain2 = {
    "raw": RunnablePassthrough(),
    "a": lambda d: f"A says {d['q']}",
    "b": lambda d: f"B says {d['q']}",
} | ChatPromptTemplate.from_messages([("human", "{a}\n{b}\n请综合")]) | chat_model

# 3) RAG 基础款
rag_chain = (
    {"context": retriever | (lambda ds: "\n\n".join(d.page_content for d in ds)),
     "question": RunnablePassthrough()}
    | rag_prompt
    | chat_model
    | StringOutputParser()
)

# 4) 结构化输出保证
from pydantic import BaseModel
parser = JsonOutputParser(pydantic_object=Person)
chain4 = (
    ChatPromptTemplate.from_messages([("system", parser.get_format_instructions()), ("human", "{text}")])
    | chat_model
    | parser
)
```
