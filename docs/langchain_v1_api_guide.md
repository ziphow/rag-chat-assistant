# LangChain v1 常用 API 速查 + 学习建议

> **适用版本**：LangChain v1.0+（2025 年发布的稳定版本）
> **参考文档**：https://langchain-doc.cn/v1/python/langchain/overview.html
> **文档定位**：按「使用频率」从高到低排列 API，每个函数附说明、参数、返回值、示例；末章附学习路线。

---

# 第一部分：API 速查（按常用度排序）

## 目录
1. [⭐ 01. 安装 & 导入](#s01)
2. [⭐ 02. `create_agent()` —— 创建智能体](#s02)
3. [⭐ 03. `@tool` —— 定义工具](#s03)
4. [⭐ 04. `agent.invoke()` —— 执行调用](#s04)
5. [⭐ 05. Chat 模型（ChatOpenAI 等）](#s05)
6. [⭐ 06. Messages —— 消息对象](#s06)
7. [⭐ 07. Prompt —— 系统提示词](#s07)
8. [⭐ 08. Streaming —— 流式输出](#s08)
9. [⭐ 09. 结构化输出 —— `response_format`](#s09)
10. [⭐ 10. Runnable 链 —— `|` 运算符](#s10)
11. [⭐ 11. 状态与记忆 —— `state_schema`](#s11)
12. [⭐ 12. Middleware —— 中间件](#s12)
13. [⭐ 13. 向量数据库 / RAG 核心类](#s13)
14. [⭐ 14. Document / TextSplitter](#s14)
15. [⭐ 15. 回调 / Callbacks](#s15)
16. [⭐ 16. 其他常用对象](#s16)

---

<a id="s01"></a>
## ⭐ 01. 安装 & 导入

### 安装
```bash
pip install -U langchain                        # 核心包
pip install -U langchain-openai                 # OpenAI 适配
pip install -U langchain-anthropic              # Anthropic 适配
pip install -U langchain-community              # 社区扩展（旧的第三方集成）
pip install -U langgraph                        # 高级智能体图（可选，复杂流程用）
```

### 最常用导入
```python
# ---------- 智能体 ----------
from langchain.agents import create_agent, AgentState
from langchain.tools import tool

# ---------- 模型 ----------
from langchain.chat_models import init_chat_model   # 模型标识符一键初始化
from langchain_openai import ChatOpenAI            # 手动实例化 OpenAI

# ---------- 消息 ----------
from langchain.messages import (
    HumanMessage,   # 用户消息
    AIMessage,      # AI 消息
    ToolMessage,    # 工具返回消息
    SystemMessage,  # 系统提示消息
)
from langchain_core.messages import BaseMessage

# ---------- 结构化输出 ----------
from langchain.agents.structured_output import ToolStrategy, ProviderStrategy
from pydantic import BaseModel

# ---------- 链与可运行对象 ----------
from langchain.runnables import RunnableLambda, RunnableSequence

# ---------- 提示词 ----------
from langchain.prompts import ChatPromptTemplate, PromptTemplate

# ---------- RAG ----------
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

# ---------- 异常 ----------
from langchain.errors import ToolExecutionError
```

---

<a id="s02"></a>
## ⭐ 02. `create_agent()` —— 创建智能体

**📌 最常用的 API**：一行代码创建能调用工具、会思考的 Agent。底层用 LangGraph 构建图运行时。

### 函数签名
```python
def create_agent(
    model,                           # str 或 ChatModel 实例
    tools: list = None,              # 工具列表（每个都是用 @tool 装饰的函数）
    *,
    system_prompt: str = None,       # 系统提示词
    response_format=None,            # 结构化输出策略
    state_schema: type[AgentState] = None,   # 自定义状态（TypedDict）
    middleware: list = None,         # 中间件列表
    context_schema: type = None,     # 运行时上下文 Schema（TypedDict）
    max_iterations: int = 25,        # 最大迭代次数（防死循环）
    **kwargs
) -> Agent  # 实际返回 LangGraph Runnable
```

### 最小示例
```python
from langchain.agents import create_agent

@tool
def get_weather(city: str) -> str:
    """获取指定城市的天气。"""
    return f"{city} 天气晴朗，温度 23°C"

agent = create_agent(
    model="openai:gpt-4o-mini",        # 字符串标识符：provider:model_name
    tools=[get_weather],
    system_prompt="你是一个乐于助人的助手。",
)
```

### 完整示例（手动配置模型）
```python
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

model = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.1,       # 0 = 最保守，1 = 最创意
    max_tokens=2000,
    timeout=60,
)

agent = create_agent(
    model=model,
    tools=[get_weather],
    system_prompt="你是一个乐于助人的助手。回答简洁准确。",
    max_iterations=50,
)
```

### 模型标识符速查（字符串）
| 写法 | 等价 |
|---|---|
| `"gpt-4o"` | `"openai:gpt-4o"` |
| `"gpt-5"` | `"openai:gpt-5"` |
| `"claude-sonnet-4-5"` | `"anthropic:claude-sonnet-4-5"` |
| `"anthropic:claude-opus"` | Anthropic 完整写法 |
| `"openai:gpt-4o-mini"` | OpenAI 完整写法 |

### ⚠️ 常见坑
- `max_iterations` 默认 25，复杂任务可能不够，手动调大
- `tools` 必须是用 `@tool` 装饰的函数，不能传普通函数

---

<a id="s03"></a>
## ⭐ 03. `@tool` —— 定义工具

**📌 赋予 Agent 行动能力**：让 LLM 能调用你写的函数去查数据库、发请求、读文件。

### 用法
```python
from langchain.tools import tool

@tool
def search_web(query: str) -> str:
    """使用搜索引擎查询信息。

    Args:
        query: 搜索关键词，必须是中文或英文的具体问题
    """
    return f"搜索 '{query}' 的结果：..."

@tool
def calculator(expression: str) -> str:
    """执行数学表达式的计算。

    Args:
        expression: 数学表达式字符串，如 "2 + 3 * 4"
    """
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"计算错误：{e}"

# 使用
print(search_web.name)       # "search_web"
print(search_web.description) # "使用搜索引擎查询信息。..."
print(search_web.args_schema)  # Pydantic 模型描述入参
```

### 高级：用 Pydantic 描述入参
```python
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(..., description="搜索关键词")
    max_results: int = Field(5, description="最大结果数", ge=1, le=20)

@tool(args_schema=SearchInput)
def search(query: str, max_results: int) -> str:
    """搜索信息。"""
    return f"搜索 {query}（最多 {max_results} 条）"
```

### ⚠️ 注意
1. **docstring 不能省**：LLM 靠 docstring 理解工具作用，写得好工具调用才准确
2. **类型标注要明确**：`str`、`int`、`dict` 等都要写清楚，LangChain 会自动转成 Schema 给模型
3. **返回值尽量是字符串**：LLM 处理字符串最稳定

---

<a id="s04"></a>
## ⭐ 04. `agent.invoke()` —— 执行调用

### 基本用法
```python
result = agent.invoke(
    {"messages": [{"role": "user", "content": "上海天气如何？"}]}
)

# result 是一个 dict，包含 "messages" 等字段
print(result["messages"][-1].content)   # 取最后一条 AI 回复
```

### 用 Message 对象（更严谨）
```python
from langchain.messages import HumanMessage

result = agent.invoke(
    {"messages": [HumanMessage(content="北京天气如何？")]}
)
# 或者用 kwargs 形式：agent.invoke(input={"messages":[...]})
```

### 多轮对话（传历史消息）
```python
# 第一轮
r1 = agent.invoke({"messages": [HumanMessage(content="我叫张三")]})
history = r1["messages"]

# 第二轮：带上历史
r2 = agent.invoke({"messages": [*history, HumanMessage(content="我叫什么名字？")]})
print(r2["messages"][-1].content)   # 应该回答 "张三"
```

### 传自定义 state / context
```python
from typing import TypedDict

class MyState(AgentState):
    user_preferences: dict

agent = create_agent(model="gpt-4o", tools=[], state_schema=MyState)

result = agent.invoke({
    "messages": [{"role": "user", "content": "你好"}],
    "user_preferences": {"style": "简洁"},
})
```

---

<a id="s05"></a>
## ⭐ 05. Chat 模型（ChatOpenAI 等）

### 方式一：字符串标识符（最简单）
```python
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-4o")   # 自动推断 openai
model = init_chat_model("anthropic:claude-sonnet-4-5")
```

### 方式二：手动实例化（完全控制）
```python
from langchain_openai import ChatOpenAI

model = ChatOpenAI(
    model="gpt-4o",
    temperature=0.0,        # 0-2，越低越确定
    max_tokens=4096,        # 最大输出 token 数
    timeout=30,             # 秒
    api_key="sk-...",       # 也可以从环境变量 OPENAI_API_KEY 读
    base_url="https://api.openai.com/v1",   # 兼容其他 OpenAI 接口的模型
)
```

### 直接调用模型（不建 Agent）
```python
from langchain.messages import HumanMessage

resp = model.invoke([HumanMessage(content="解释什么是 LangChain")])
print(resp.content)        # 字符串回复
print(resp.response_metadata)  # 含 token_usage 等元数据
```

### 批量调用
```python
results = model.batch([
    [HumanMessage(content="你好")],
    [HumanMessage(content="介绍一下自己")],
])
```

### 绑定工具（不使用 Agent 时）
```python
model_with_tools = model.bind_tools([get_weather, search_web])
resp = model_with_tools.invoke([HumanMessage(content="上海天气？")])
print(resp.tool_calls)     # 解析出工具调用列表
```

---

<a id="s06"></a>
## ⭐ 06. Messages —— 消息对象

### 四种消息

| 类 | role | 作用 |
|---|---|---|
| `HumanMessage` | `"user"` | 用户发来的消息 |
| `AIMessage` | `"assistant"` | AI 回复的消息 |
| `ToolMessage` | `"tool"` | 工具执行结果，必须有 `tool_call_id` |
| `SystemMessage` | `"system"` | 系统提示词（一般在最前） |

### 创建消息
```python
from langchain.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage

msg1 = SystemMessage(content="你是一个数学老师。")
msg2 = HumanMessage(content="1+1等于几？")
msg3 = AIMessage(content="1+1=2")
msg4 = ToolMessage(content="搜索结果：...", tool_call_id="call_abc123")
```

### 消息属性
```python
print(msg2.content)              # 消息内容（str 或 list[dict]）
print(msg2.role)                 # "user"
print(msg3.tool_calls)           # 如果 AI 调用了工具，这里是 list
print(msg4.tool_call_id)         # 工具调用 ID
print(msg3.usage_metadata)       # token 用量（如有）
print(msg3.response_metadata)    # 原始响应元数据
```

### 便捷构造：dict 也行
```python
# LangChain 会自动转成对应 Message 对象
messages = [
    {"role": "system", "content": "你是助手"},
    {"role": "user", "content": "你好"},
]
```

---

<a id="s07"></a>
## ⭐ 07. Prompt —— 系统提示词

### 静态 System Prompt（`create_agent` 直接传）
```python
agent = create_agent(
    model="gpt-4o",
    tools=[],
    system_prompt="""你是一个专业的 Python 开发助手。
    - 回答前先思考
    - 代码必须包含必要的注释
    - 如果不确定就说不知道""",
)
```

### `ChatPromptTemplate` —— 带变量的模板
```python
from langchain.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个{role}，请用{style}风格回答。"),
    ("human", "{user_input}"),
])

msg_list = prompt.invoke({
    "role": "Python 专家",
    "style": "幽默",
    "user_input": "解释装饰器",
})
print(msg_list)   # 返回 list[BaseMessage]
```

### 组合：Prompt + Model
```python
chain = prompt | model
result = chain.invoke({
    "role": "Python 专家",
    "style": "简洁",
    "user_input": "解释装饰器",
})
print(result.content)
```

---

<a id="s08"></a>
## ⭐ 08. Streaming —— 流式输出

### Agent 流式输出
```python
# 按状态流式（每一步完整状态）
for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "请总结 2025 年 AI 发展"}]},
    stream_mode="values",
):
    latest_msg = chunk["messages"][-1]
    if latest_msg.content:
        print(f"AI：{latest_msg.content}")
    elif latest_msg.tool_calls:
        print(f"正在调用工具：{[tc['name'] for tc in latest_msg.tool_calls]}")
```

### 模型 Token 级流式
```python
for chunk in model.stream([HumanMessage(content="写一首关于春天的短诗")]):
    print(chunk.content, end="", flush=True)
# → 逐字输出："春眠不觉晓，处处闻啼鸟..."
```

### `astream` 异步流式
```python
import asyncio

async def run():
    async for chunk in model.astream([HumanMessage(content="解释 FastAPI")]):
        print(chunk.content, end="", flush=True)

asyncio.run(run())
```

---

<a id="s09"></a>
## ⭐ 09. 结构化输出 —— `response_format`

**📌 让 Agent 输出 JSON / Pydantic 对象**，不是随意的自然语言。

### 方式一：`ToolStrategy`（通用，任何支持工具调用的模型）
```python
from pydantic import BaseModel, Field
from langchain.agents.structured_output import ToolStrategy

class ReviewReply(BaseModel):
    score: int = Field(..., ge=1, le=5, description="评分 1-5")
    summary: str = Field(..., description="总结")
    tags: list[str] = Field(..., description="标签列表")

agent = create_agent(
    model="gpt-4o",
    response_format=ToolStrategy(ReviewReply),
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "评论：这家店的服务非常好，菜品味道也不错，就是价格有点贵。"}]
})

print(result["structured_response"])
# ReviewReply(score=4, summary="服务和味道好，价格偏贵", tags=["服务好", "味道好", "价格贵"])
```

### 方式二：`ProviderStrategy`（仅支持原生结构化输出的模型，如 OpenAI）
```python
from langchain.agents.structured_output import ProviderStrategy

agent = create_agent(
    model="openai:gpt-4o",
    response_format=ProviderStrategy(ReviewReply),
)
```

### ⚠️ 注意
v1 开始不能直接传 `response_format=ReviewReply`，必须包在 `ToolStrategy` 或 `ProviderStrategy` 里。

---

<a id="s10"></a>
## ⭐ 10. Runnable 链 —— `|` 运算符

**📌 所有实现了 `Runnable` 的对象都可以用 `|` 串联**，类似管道：前一步输出作为后一步输入。

### 基本链：Prompt → Model
```python
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

prompt = ChatPromptTemplate.from_messages([("human", "解释{topic}，用100字以内")])
model = ChatOpenAI(model="gpt-4o-mini")

chain = prompt | model
result = chain.invoke({"topic": "LangChain"})
print(result.content)
```

### 加一步：把输出转字符串
```python
from langchain.runnables import RunnableLambda

def extract_text(x) -> str:
    return x.content

chain2 = prompt | model | RunnableLambda(extract_text)
text = chain2.invoke({"topic": "SQL"})
print(text)   # 直接拿到字符串
```

### 并行：同时跑两条链
```python
from langchain.runnables import RunnableParallel

parallel = RunnableParallel({
    "a": prompt | model,
    "b": prompt | model,
})
out = parallel.invoke({"topic": "机器学习"})
print(out["a"].content, out["b"].content)
```

### 链式方法速查

| 方法 | 作用 |
|---|---|
| `chain.invoke(input)` | 同步执行 |
| `chain.ainvoke(input)` | 异步执行 |
| `chain.stream(input)` | 同步流式 |
| `chain.astream(input)` | 异步流式 |
| `chain.batch([i1, i2])` | 批量执行 |
| `chain.abatch([i1, i2])` | 异步批量 |
| `chain1 \| chain2` | 串联（也可以 `chain1.pipe(chain2)`） |
| `RunnableParallel({"a":..., "b":...})` | 并行 |
| `RunnableLambda(fn)` | 普通函数变 Runnable |

---

<a id="s11"></a>
## ⭐ 11. 状态与记忆 —— `state_schema`

**📌 AgentState 是 LangGraph 用来存储每一步状态的 TypedDict**，默认至少有 `messages`。你可以扩展它来存用户偏好、上下文等。

### 定义自定义状态
```python
from langchain.agents import create_agent, AgentState
from typing import TypedDict

class MyState(AgentState):
    user_preferences: dict       # 用户偏好
    current_step: int            # 当前步骤数

agent = create_agent(
    model="gpt-4o",
    state_schema=MyState,
)

# 调用时可以传入自定义字段
result = agent.invoke({
    "messages": [{"role": "user", "content": "你好"}],
    "user_preferences": {"style": "简洁", "language": "zh-CN"},
    "current_step": 0,
})
```

### 在工具里访问状态
```python
from langchain.tools import tool

@tool
def greet() -> str:
    """向用户打招呼。"""
    # 工具函数可以直接访问 agent 状态（通过注入方式）
    # 详见 tools 文档中关于状态注入的部分
    return "你好"
```

---

<a id="s12"></a>
## ⭐ 12. Middleware —— 中间件

**📌 强大的扩展点**：在调用模型前后、调用工具前后拦截处理。

### 装饰器方式（最常用）
```python
from langchain.agents.middleware import (
    before_model,       # 调用模型前
    after_model,        # 调用模型后
    wrap_model_call,    # 包裹整个模型调用（可改请求/改模型）
    wrap_tool_call,     # 包裹工具调用（错误处理）
    dynamic_prompt,     # 动态系统提示
)
from langchain.agents.middleware import ModelRequest, ModelResponse
from langchain_core.messages import ToolMessage

# ========= 动态模型选择 =========
@wrap_model_call
def pick_model(request: ModelRequest, handler) -> ModelResponse:
    """消息多就用强模型。"""
    if len(request.state["messages"]) > 10:
        request.model = ChatOpenAI(model="gpt-4o")
    else:
        request.model = ChatOpenAI(model="gpt-4o-mini")
    return handler(request)

# ========= 工具错误处理 =========
@wrap_tool_call
def handle_tool_err(request, handler):
    try:
        return handler(request)
    except Exception as e:
        return ToolMessage(
            content=f"工具调用失败：{e}，请换一种方式重试。",
            tool_call_id=request.tool_call["id"],
        )

# ========= 动态系统提示 =========
from typing import TypedDict
class Ctx(TypedDict):
    role: str

@dynamic_prompt
def prompt_by_role(request: ModelRequest) -> str:
    role = request.runtime.context.get("role", "user")
    return f"你是助手。用户角色是{role}，请用适合{role}的语言回答。"

# ========= 注册 =========
agent = create_agent(
    model="gpt-4o",
    tools=[search_web],
    middleware=[pick_model, handle_tool_err, prompt_by_role],
    context_schema=Ctx,
)
```

### 类式 Middleware（复杂逻辑推荐）
```python
from langchain.agents.middleware import AgentMiddleware

class LogMiddleware(AgentMiddleware):
    def before_model(self, state, runtime):
        print(f"[before_model] messages={len(state['messages'])}")
        return None

    def after_model(self, state, runtime):
        print(f"[after_model] 得到 AI 回复")
        return None

agent = create_agent(model="gpt-4o", middleware=[LogMiddleware()])
```

---

<a id="s13"></a>
## ⭐ 13. 向量数据库 / RAG 核心类

### Embedding 模型
```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectors = embeddings.embed_documents(["hello world", "你好世界"])
q_vec = embeddings.embed_query("问候")
```

### 向量库（Chroma 本地零依赖，测试首选）
```bash
pip install langchain-chroma
```

```python
from langchain_chroma import Chroma

# 建库
vectorstore = Chroma.from_texts(
    texts=["Python 是编程语言", "Java 运行在 JVM", "C++ 支持手动内存管理"],
    ids=["1", "2", "3"],
    embedding=embeddings,
    persist_directory="./chroma_db",
)

# 查询
docs = vectorstore.similarity_search("什么语言不需要手动管理内存？", k=2)
for d in docs:
    print(d.page_content)
```

### 作为检索器（和 RAG 链配合）
```python
retriever = vectorstore.as_retriever(k=3)
docs = retriever.invoke("Python 介绍")
```

### 典型 RAG 链
```python
from langchain.prompts import ChatPromptTemplate
from langchain.runnables import RunnableLambda, RunnablePassthrough

rag_prompt = ChatPromptTemplate.from_messages([
    ("system", "根据上下文回答：\n{context}\n\n不知道就说不知道。"),
    ("human", "{question}"),
])

def format_docs(docs) -> str:
    return "\n\n".join(d.page_content for d in docs)

rag_chain = (
    {
        "context": retriever | RunnableLambda(format_docs),
        "question": RunnablePassthrough(),
    }
    | rag_prompt
    | model
)

answer = rag_chain.invoke("Python 是什么？")
print(answer.content)
```

---

<a id="s14"></a>
## ⭐ 14. Document / TextSplitter

### Document 文档对象
```python
from langchain.docstore.document import Document

doc = Document(
    page_content="这是文档内容",
    metadata={"source": "file.txt", "page": 1},
)
print(doc.page_content)
print(doc.metadata)
```

### TextSplitter 文档切分
```python
from langchain.text_splitter import (
    RecursiveCharacterTextSplitter,   # 最常用，递归切
    CharacterTextSplitter,
    TokenTextSplitter,                 # 按 token 切，最准确
)

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,         # 每块字符数
    chunk_overlap=50,       # 相邻块的重叠，避免语义中断
    separators=["\n\n", "\n", ".", "?", "!"],
)

long_text = "很长的文档内容..."
chunks = splitter.split_text(long_text)
# 或者切 Document： chunks = splitter.split_documents([doc1, doc2])
```

---

<a id="s15"></a>
## ⭐ 15. 回调 / Callbacks

### LangSmith 追踪（官方推荐）
```python
# 设置环境变量
# LANGCHAIN_TRACING_V2=true
# LANGCHAIN_API_KEY=lsv2_pt_xxx
# LANGCHAIN_PROJECT=my-project
```

只要设置了环境变量，所有 `invoke/stream` 都会自动上报到 LangSmith，无需改代码。

### 手动回调
```python
from langchain.callbacks import StdOutCallbackHandler

agent.invoke(
    {"messages": [{"role": "user", "content": "你好"}]},
    config={"callbacks": [StdOutCallbackHandler()]},
)
```

### 自定义回调
```python
from langchain.callbacks.base import BaseCallbackHandler

class MyHandler(BaseCallbackHandler):
    def on_llm_start(self, serialized, prompts, **kwargs):
        print(f"LLM 开始，prompts={prompts[:30]}...")
    def on_llm_end(self, response, **kwargs):
        print(f"LLM 结束，generations={len(response.generations)}")
    def on_tool_start(self, serialized, input_str, **kwargs):
        print(f"工具 {serialized.get('name')} 开始，参数={input_str}")
    def on_tool_end(self, output, **kwargs):
        print(f"工具结束，结果={str(output)[:50]}")
```

---

<a id="s16"></a>
## ⭐ 16. 其他常用对象

### `RunnablePassthrough`
```python
from langchain.runnables import RunnablePassthrough

pt = RunnablePassthrough()
pt.invoke({"a": 1})   # {"a": 1}，原样传过去（常用于 dict 组合）
```

### `RunnableConfig`
```python
from langchain.runnables import RunnableConfig

config = RunnableConfig(
    run_name="my-run",
    configurable={"llm": "gpt-4o"},
    recursion_limit=50,
)
chain.invoke("hello", config=config)
```

### `StringOutputParser` —— 自动取 content
```python
from langchain.output_parsers import StringOutputParser

chain = prompt | model | StringOutputParser()
text = chain.invoke({"topic": "Hello"})  # 直接是 str，不是 AIMessage
```

### `JsonOutputParser` —— 自动转 JSON / Python 对象
```python
from langchain.output_parsers import JsonOutputParser

parser = JsonOutputParser(pydantic_object=ReviewReply)
chain = prompt | model | parser
obj = chain.invoke({"review_text": "服务很好"})
print(type(obj))   # dict（或 ReviewReply 实例）
```

### `init_chat_model` 统一初始化
```python
from langchain.chat_models import init_chat_model

# 任何支持的模型都用同一个函数
gpt = init_chat_model("gpt-4o")
claude = init_chat_model("anthropic:claude-sonnet-4-5", temperature=0.5)
```

---

# 第二部分：学习建议

## 🗺️ 推荐学习路线（4 周循序渐进）

### 第 1 周：基础 —— 理解核心概念
- **目标**：能跑通最简单的 Agent
- **学习内容**：
  1. 看官方 Overview：`https://langchain-doc.cn/v1/python/langchain/overview.html`
  2. 装 `langchain`、`langchain-openai`，跑通「创建 Agent → invoke → 拿到回复」最小 Demo
  3. 学 3 个 API：`create_agent` / `@tool` / `agent.invoke`
  4. 理解 ReAct 循环：思考 → 调工具 → 看结果 → 再思考 → 最终答案
- **动手练习**：写一个 `get_weather` + `get_news` 两个工具的「生活助手」

### 第 2 周：模型 / 消息 / 提示词
- **目标**：能写出可控的 Prompt，替换不同模型
- **学习内容**：
  1. 深入理解 Messages 四种类型 + 多轮对话（把历史消息一起传）
  2. 掌握 `ChatOpenAI` 的 `temperature / max_tokens / timeout / base_url`
  3. `ChatPromptTemplate` 写带变量的模板
  4. 学流式输出：`agent.stream` + `model.stream`
- **动手练习**：写一个支持上下文的聊天机器人（带历史消息），前端用 stream 逐字显示

### 第 3 周：结构化输出 + 工具进阶 + RAG 入门
- **目标**：输出可解析的 JSON；做一个 RAG 问答系统
- **学习内容**：
  1. `ToolStrategy(ContactInfo)` + Pydantic BaseModel：让 Agent 按格式输出
  2. `@tool(args_schema=SomeModel)` 用 Pydantic 描述复杂入参
  3. 文档加载 → `RecursiveCharacterTextSplitter` → `Embedding` → `Chroma`
  4. 组合 RAG 链：`{context, question} → prompt → model`
- **动手练习**：做一个「自己 PDF 文档的问答机器人」

### 第 4 周：中间件 / 状态 / 调试 + 小项目
- **目标**：能处理错误、做持久化、用 LangSmith 调试
- **学习内容**：
  1. Middleware：`@wrap_tool_call` 处理工具异常、`@wrap_model_call` 动态选模型
  2. `state_schema` + `AgentState`：存用户偏好
  3. 开 LangSmith：看每条消息、每步工具的执行轨迹
  4. 结构化输出 → 下游数据库落库
- **动手练习**：写一个「知识库 + 工具调用 + 持久化」的企业问答 Agent

## 进阶路径（第 5 周之后）

1. **LangGraph**：复杂流程（多智能体、人类审批、子图）
2. **长记忆 / 长期记忆**：`langchain-long-term-memory`、向量库做长期记忆
3. **多 Agent 协作**：一个 Agent 写代码，一个 Agent 评审
4. **生产部署**：用 `FastAPI` + `uvicorn` 把 Agent 做成 API；加并发控制；用量监控
5. **评估（Evaluation）**：`langsmith` 评估数据集，量化 Agent 质量

---

## 💡 十大最佳实践

1. **写好 Tool 的 docstring**：LLM 完全靠 docstring 判断工具用途，要写「这个工具什么时候用」「入参含义」
2. **Tool 入参尽量简单**：尽量用 `str` / `int` / `list[str]`，不要嵌套复杂结构；复杂结构显式写 `args_schema`
3. **`max_iterations` 一定要设置合理**：默认 25，复杂问答 50-100，避免无限循环烧钱
4. **用 `temperature=0` 做结构化输出**：降低创造性，保证格式稳定
5. **Prompt 先写清楚「格式要求」再写任务**：减少模型幻觉
6. **错误要用 `ToolMessage` 返回给模型**：工具异常别抛给用户，包成 `ToolMessage` 让 Agent 自己纠错
7. **用 LangSmith 先看轨迹再 debug**：别瞎猜，LangSmith 能看清每一步 Prompt、回复、token、错误
8. **Embedding 和 LLM 选同一提供商**：跨平台虽然可以，但同家兼容性更好
9. **Chunk 大小按模型窗口算**：留出 Prompt + 回答的空间，不要把 context 塞死
10. **v1 时代用 `TypedDict` 不要用 Pydantic 做 state**：自定义 state_schema 必须是 TypedDict

---

## 🚫 常见坑 & 解决

| 问题 | 原因 | 解决 |
|---|---|---|
| 工具死活不调用，模型直接瞎编答案 | Tool docstring 不清楚 / 名字不直观 | 把 docstring 写具体，工具名要动词开头如 `search_web` |
| 模型传错参数给 Tool | 入参没加类型 / 描述 | `@tool(args_schema=PydanticModel)` 强制校验 |
| `response_format` 报错说不再支持 | v1 开始不能直接传类 | 包 `ToolStrategy(MyModel)` 或 `ProviderStrategy(MyModel)` |
| `agent.stream` 输出乱 | `stream_mode` 没传 | 加上 `stream_mode="values"`，取 `chunk["messages"][-1]` |
| 自定义状态字段报错说没有 | state_schema 不是 TypedDict | v1 要求 state_schema 是 TypedDict，不是 Pydantic |
| 结构化输出 `result["structured_response"]` 为 None | 没成功走 Tool 策略 | 检查模型是否支持工具调用（或者切换 ProviderStrategy） |
| 多轮对话上下文丢失 | 第二轮没传第一轮的 messages | 每次调用都传完整 history（`[*prev_result["messages"], HumanMessage(...)]`） |
| Agent 输出不按格式 | Prompt 没给示例 | System Prompt 里加 1-2 个期望格式的 Few-Shot 示例 |
| OpenAI 限流 | 没做重试 / 退避 | 给 ChatOpenAI 加 `max_retries=3`，或者用 middleware 统一加退避 |
| RAG 回答质量差 | chunk 不对 / top_k 太少 | 调 `chunk_size/overlap`，top_k 从 3 到 5 实验；加 rerank |

---

## 📚 学习资源推荐

| 类型 | 资源 |
|---|---|
| 官方文档 | https://langchain-doc.cn/v1/python/ |
| 官方 API 参考 | https://reference.langchain.com/python/ |
| LangSmith 注册 | https://smith.langchain.com/ （免费额度足够学习） |
| 示例仓库 | https://github.com/langchain-ai/langchain/tree/master/templates |
| 视频教程 | YouTube 搜「LangChain 1.0 tutorial」，找今年发布的 v1 版本 |
| 进阶书 | 《构建 LLM 驱动的应用程序》 / 《LangChain 实战》 |
| 讨论区 | LangChain 官方 Discord / GitHub Discussions |

---

## 🎯 检查清单（你是否入门了？）

- [ ] 能写一个 20 行代码的「单工具 Agent」并成功运行
- [ ] 能写多轮对话，历史消息正确传递
- [ ] 能用 `@tool(args_schema=...)` 定义带 Pydantic 入参的工具
- [ ] 能用 `ToolStrategy` 让 Agent 输出指定 JSON 结构
- [ ] 能搭建一个 3 步的 RAG：Document → Vectorstore → Prompt+Context
- [ ] 会用 `stream_mode="values"` 流式打印 Agent 中间步骤
- [ ] 会用 middleware 处理工具报错，而不是把异常抛给用户
- [ ] 会用 LangSmith 看一次 Agent 调用的完整轨迹
- [ ] 知道 `ChatPromptTemplate` 和 `ChatOpenAI` 如何用 `|` 连起来
- [ ] 能解释清楚 ReAct 循环：思考 → 行动 → 观察 → 循环
