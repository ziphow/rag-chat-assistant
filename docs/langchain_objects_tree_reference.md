# LangChain v1 常用对象「继承树 + 属性/方法超详解」

> **版本**：LangChain v1.0+（兼容 langchain-core 0.3+）
> **写作规范**：
> - 📐 顶部给出**树形继承/关联结构**，一眼看清全貌
> - 🧊 每个类：先讲「它是什么 / 什么时候用」
> - 🔵 下面是**属性表**：属性名 | 类型 | 默认值 | 是否必填 | **含义**
> - 🟢 下面是**方法表**：完整签名 | 返回值类型 | **参数逐个解释** | 作用
> - 💡 示例：**可复制运行的代码**
> - ⚠️ 注意 / 坑：写在最后

---

# 📐 第 0 章：LangChain 对象全局继承 / 关联树

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      LangChain 核心对象关系全景树                        │
└─────────────────────────────────────────────────────────────────────────┘

【根 1：Pydantic BaseModel】
└── BaseMessage  (langchain_core.messages.BaseMessage)
    ├── HumanMessage         role="user"      ← 用户说的话
    ├── AIMessage            role="assistant" ← AI 说的话（可能含 tool_calls）
    ├── ToolMessage          role="tool"      ← 工具执行结果（必须有 tool_call_id）
    └── SystemMessage        role="system"    ← 系统人设/提示词
    │
    └── 【增量/流式版本：Chunk 子类】
        ├── HumanMessageChunk    stream 流式增量，可 "+" 合并
        ├── AIMessageChunk       stream 流式增量，支持 +
        ├── ToolMessageChunk
        └── SystemMessageChunk

【根 2：Runnable[Input, Output] 接口（所有可执行对象的统一协议）】
│
├── Runnable 基类（抽象）
│   ├── BasePromptTemplate  ← 提示模板都是 Runnable
│   │   ├── StringPromptTemplate
│   │   │   └── PromptTemplate                 ← 字符串 LLM 模板
│   │   └── ChatPromptTemplate                 ← 多消息聊天模板（最常用）
│   │       └── 可包含 BaseMessagePromptTemplate 节点：
│   │           ├── MessagesPlaceholder        ← 占位符（传 history 列表）
│   │           ├── SystemMessagePromptTemplate
│   │           ├── HumanMessagePromptTemplate
│   │           └── AIMessagePromptTemplate
│   │
│   ├── BaseLanguageModel                      ← 所有模型的根（Runnable[list[msg], AIMessage]）
│   │   ├── BaseChatModel                      ← 聊天模型基类
│   │   │   ├── ChatOpenAI       (langchain_openai)
│   │   │   ├── ChatAnthropic    (langchain_anthropic)
│   │   │   ├── ChatDeepSeek ... (社区集成)
│   │   │   └── ...所有厂商的 ChatModel
│   │   └── BaseLLM                            ← 字符串补全模型（旧式）
│   │
│   ├── BaseTool                                ← 所有工具的根
│   │   ├── Tool                                ← 简单单参数工具
│   │   └── StructuredTool                      ← 多参数/Pydantic Schema 工具（@tool 默认返回它）
│   │
│   ├── BaseOutputParser[T]                     ← 输出解析器
│   │   ├── StringOutputParser      [AIMessage → str]
│   │   ├── JsonOutputParser        [AIMessage → dict / Pydantic]
│   │   ├── PydanticOutputParser    [AIMessage → Pydantic instance]
│   │   ├── CommaSeparatedListOutputParser
│   │   └── ...
│   │
│   ├── BaseRetriever                             ← 检索器根
│   │   ├── VectorStoreRetriever                  ← 向量库检索器
│   │   └── EnsembleRetriever 等
│   │
│   ├── Runnable 组合子类（用于「编排」）
│   │   ├── RunnableSequence                       ← chain = a | b | c
│   │   ├── RunnableParallel / RunnableMap         ← {a:..., b:...}
│   │   ├── RunnableLambda[I, O]                   ← 包普通函数
│   │   ├── RunnablePassthrough[T]                 ← 原样透传
│   │   ├── RunnableBinding[I, O]                  ← .bind(...) 的返回
│   │   ├── RunnableWithFallbacks                  ← .with_fallbacks(...) 的返回
│   │   ├── RunnableRetry                          ← .with_retry(...) 的返回
│   │   ├── RunnableEach[I, O]                     ← .map() 的返回（每个 list 元素跑一次）
│   │   └── RunnableAssign / RunnablePick          ← dict.assign / pick 的返回
│   │
│   └── 【Agent】
│       └── CompiledGraph (LangGraph)              ← create_agent() 的返回值（支持 invoke/stream）
│
├── RunnableConfig（TypedDict，运行时配置）
└── RunnableSerializable + Runnable（持久化相关）

【其他 Pydantic 模型】
├── Document                                        ← RAG 文档：page_content + metadata
└── Structured / Pydantic Schemas（你自己写的 BaseModel）

【其他非 Pydantic 类】
├── RecursiveCharacterTextSplitter / ... 文本切分
├── OpenAIEmbeddings / ... 向量嵌入模型（也是 Runnable[str, list[float]]）
├── Chroma / FAISS / ... 向量库对象（.as_retriever() → BaseRetriever）
├── BaseCallbackHandler + StdOutCallbackHandler     ← 回调钩子
├── ToolStrategy / ProviderStrategy                  ← 结构化输出策略
├── AgentMiddleware 基类 + 装饰器 (@wrap_model_call...)
├── ModelRequest / ModelResponse                     ← middleware 请求/响应对象
└── AgentState（TypedDict，不是 Pydantic）            ← messages + 自定义字段
```

---
---

# Part 1：Messages 消息树

<a id="msg"></a>
## 🧊 1.1 `BaseMessage` —— 所有消息的基类

- **它是什么**：Pydantic v2 `BaseModel` 的子类，所有 `HumanMessage / AIMessage / ToolMessage / SystemMessage` 都继承它。
- **什么时候用**：你不需要直接实例化它（它是「抽象的」），但你会**大量接收和读取它的子类**。
- **模块**：`langchain_core.messages.base.BaseMessage`（也可从 `langchain.messages` 导入具体子类）

---

### 🔵 BaseMessage 属性（所有子类都有这些字段）

| # | 属性名 | 类型 | 默认值 | 必填？ | 含义 / 说明 |
|---|---|---|---|---|---|
| 1 | **`content`** | `str \| list[dict[str, Any]]` | — | **✅ 必填** | 消息正文。<br>• **纯文本**场景：直接写 `str`，例如 `"你好"`。<br>• **多模态**场景：`list[dict]`，如图片+文字：<br>`[{"type":"text","text":"描述这张图"}, {"type":"image_url","image_url":{"url":"https://..."}}]`。<br>多模态具体格式见厂商文档（OpenAI 格式基本已成事实标准）。 |
| 2 | **`role`** | `Literal["system","user","assistant","tool"]` | 子类**自动设置**，你一般**不要改** | 子类各自填 | 说话者角色。LLM 靠这个区分**谁说的**，决定上下文处理逻辑。<br>4 个固定值：`system / user / assistant / tool`。4 个具体子类各对应一个。 |
| 3 | **`name`** | `str \| None` | `None` | ❌ | **可选的人名/工具名**。<br>• 多用户场景可以区分 `name="张三"` vs `name="李四"`；<br>• 工具场景里有特殊用途（Function Calling 旧版）；<br>• 大多数时候不填。 |
| 4 | **`id`** | `str \| None` | `None` | ❌ | **消息唯一 ID**，用于追踪、回写、校验。<br>• LangSmith 链路追踪时会用到；<br>• 在 Agent 多步骤里可以用它精确引用某条消息；<br>• 不填则大部分情况下也没问题。 |
| 5 | **`additional_kwargs`** | `dict[str, Any]` | `Field(default_factory=dict)` | ❌ | **额外透传参数给厂商 API** 的字典。<br>某些模型的**非通用参数**（厂商自己加的）不会单独做成字段，会塞在这里。<br>典型例子：`{"function_call": ...}`（旧版 OpenAI Function Calling）、Google 的一些扩展。 |
| 6 | **`response_metadata`** | `dict[str, Any]` | `Field(default_factory=dict)` | ❌ | **模型返回后才会有值**的「响应元数据」：<br>• `finish_reason: "stop" \| "tool_calls" \| "length" \| "content_filter"`（最常用）；<br>• `model_name: str` 实际用了哪个模型；<br>• `token_usage: {"prompt_tokens":N,"completion_tokens":M,"total_tokens":N+M}`（旧版塞法，新版 SDK 用 usage_metadata）；<br>• `system_fingerprint`（OpenAI 用来标识后端模型版本）；<br>• 厂商自己的其他响应头字段。 |
| 7 | **`tool_calls`** | `list[dict[str, Any]]` | `Field(default_factory=list)` | ❌ | **仅 AIMessage 有非空值**：模型请求调用的工具列表。<br>每个元素是：<br>`{`<br>&nbsp;&nbsp;`"id": "call_abc123",        # 工具调用唯一 ID`，<br>&nbsp;&nbsp;`"name": "get_weather",     # 工具名`，<br>&nbsp;&nbsp;`"args": {"city": "上海"}    # 参数（已解析的 dict）`<br>`}`。<br>如果是流式 Chunk，这里可能只有部分字段（会在 Chunk 合并时拼成完整）。 |
| 8 | **`invalid_tool_calls`** | `list[dict[str, Any]]` | `Field(default_factory=list)` | ❌ | **模型返回了工具调用但解析失败的条目**。<br>比如模型生成的参数 JSON 不合法、缺字段等。<br>字段结构类似 `tool_calls`，但多一个 `error: str` 字段告诉你为什么解析失败。<br>这种情况下，中间件（`@wrap_tool_call`）可以把错误告诉模型让它重试。 |
| 9 | **`usage_metadata`** | `dict[str, int] \| None` | `None` | ❌ | **新版 SDK 推荐**的 token 用量字段：<br>`{"input_tokens": N, "output_tokens": M, "total_tokens": N+M}`。<br>有些厂商（如 OpenAI）在 2024 年之后把它单独放在这个字段里。`response_metadata["token_usage"]` 是旧版塞法。两者**你都需要检查**。 |
| 10 | **`type`** | `str` | 子类自动填 | 不要手动填 | Pydantic discriminator 字段：`"human" / "ai" / "tool" / "system"`。<br>用来做 `model_validate(..., from_attributes=True)` 时的多态反序列化。一般不需手动关心。 |

---

### 🟢 BaseMessage 方法（所有子类都有）

| # | 方法签名 | 返回值类型 | 参数说明 | 作用 |
|---|---|---|---|---|
| 1 | `.pretty_repr(*, n_messages: int = 10)` | `str` | • `n_messages`：对于含多消息的容器（没直接用到），控制显示多少条。对于单条消息可以忽略。 | 生成一个**给人读的漂亮字符串**。调试时代替直接 `print(msg)`，输出更结构化、更易读。 |
| 2 | `.pretty_print(n_messages=10)` | `None` | 同上 | 直接把 `.pretty_repr()` 的结果 `print()` 到标准输出。**最常用的调试手段之一**。 |
| 3 | `.to_json()` | `dict[str, Any]` | 无参数 | 转成**可 JSON 序列化**的 dict（`type/content/...`），用于持久化 / 网络传输。 |
| 4 | `@classmethod` <br> `.model_validate(obj, **pydantic_kwargs)` | `Self`（即具体的子类实例） | `obj` 可以是 `dict` / `BaseMessage` 等一切 Pydantic 能识别的东西。 | **从 dict 或类似对象反序列化回消息**。LangChain 内部经常用：`HumanMessage.model_validate({"role":"user","content":"hi"})` → 得到 HumanMessage。 |
| 5 | `.model_dump(*, mode="python" \| "json" \| "python-or-json" = "python", include=None, exclude=None, by_alias=False, exclude_unset=False, exclude_defaults=False, exclude_none=False, round_trip=False, warnings=True)` | `dict[str, Any]` | （全部继承自 Pydantic v2）<br>• `mode="python"`：返回 Python 原生类型；<br>• `mode="json"`：返回 JSON 兼容的纯 dict（所有不可序列化的对象都转成字符串/数字/dict）；<br>• `include/exclude`：过滤字段；<br>• `exclude_none=True`：不包含值为 None 的字段（强烈建议用）。 | Pydantic 自带：把模型转成 dict。日常调试 / 写进数据库 / 往 API 返回时都要用。 |
| 6 | `.model_dump_json(*, indent=None, include=None, exclude=None, by_alias=False, exclude_none=False, round_trip=False, warnings=True)` | `str` | `indent`：一个整数代表缩进空格数（传了就是美化 JSON）。其他同上。 | 转成 **JSON 字符串**。 |
| 7 | `.model_copy(*, update=None, deep=False)` | `Self` | `update`：要覆盖字段的字典；`deep`：是否深拷贝。 | 复制一条消息，可同时改字段。例如 `msg2 = msg.model_copy(update={"content":"新内容"})`。 |
| 8 | `msg.__add__(other)` / `msg + other` | `Self`（合并后的消息） | `other`：**同类型**的另一条 Message（或 Chunk）。流式场景把多个 Chunk 拼成完整消息时底层会调用这个方法。 | 消息拼接。流式时你 `for chunk in model.stream(...): full = full + chunk` 就走它。content 是字符串时追加；是 list 时 extend；tool_calls 做智能合并。 |
| 9 | `msg.__eq__(other)` / `msg == other` | `bool` | `other` 任意对象。 | 比较两条消息是否「字段值全相同」（基于 Pydantic 的相等）。写测试用例时很有用。 |
| 10 | `len(msg)` / `msg.__len__()` | `int` | 无。 | 如果 `content` 是 str，返回 `len(content)`；如果是 list，返回列表长度。一些旧代码可能会用它判断是否空消息。 |

---

### 💡 BaseMessage 综合示例
```python
from langchain.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage

# ======= 构造各种消息 =======
sys_m = SystemMessage(content="你是资深 Python 讲师。要求：1) 一句话定义 2) 代码 3) 常见坑")
user_m = HumanMessage(content="解释装饰器", id="user-msg-001", name="student-zhang")
ai_m = AIMessage(
    content="让我先调用一下示例代码生成工具",
    tool_calls=[{
        "id": "call_abc",
        "name": "generate_code",
        "args": {"topic": "decorator", "lang": "python"},
    }],
    response_metadata={"finish_reason": "tool_calls", "model_name": "gpt-4o"},
    usage_metadata={"input_tokens": 120, "output_tokens": 60, "total_tokens": 180},
)
tool_m = ToolMessage(
    content="""@my_decorator\ndef foo(): pass""",
    tool_call_id="call_abc",
)

# ======= 读属性 =======
print("user_m.content      =", repr(user_m.content))              # '解释装饰器'
print("user_m.role         =", user_m.role)                        # 'user'
print("user_m.id           =", user_m.id)                          # 'user-msg-001'
print("ai_m.tool_calls     =", ai_m.tool_calls[0]["name"])         # 'generate_code'
print("ai_m.finish_reason  =", ai_m.response_metadata.get("finish_reason"))  # 'tool_calls'
print("ai_m.usage_metadata =", ai_m.usage_metadata)                # {'input_tokens': 120,...}
print("tool_m.tool_call_id =", tool_m.tool_call_id)                # 'call_abc'

# ======= 方法 =======
user_m.pretty_print()
# HumanMessage(content='解释装饰器', id='user-msg-001', name='student-zhang')

print(user_m.model_dump(exclude_none=True))
# {'content': '解释装饰器', 'additional_kwargs': {}, 'response_metadata': {},
#  'role': 'user', 'name': 'student-zhang', 'id': 'user-msg-001',
#  'tool_calls': [], 'invalid_tool_calls': []}

print(user_m.model_dump_json(indent=2, exclude={"id", "name"}))
# 输出 JSON 字符串，不带 id 和 name 字段

# model_copy：复制并改
new_user = user_m.model_copy(update={"content": "解释生成器"}, deep=True)
print(new_user.content)   # '解释生成器'

# + 拼接（主要在流式 Chunk 场景）
from langchain.messages import AIMessageChunk
c1 = AIMessageChunk(content="你")
c2 = AIMessageChunk(content="好")
c3 = AIMessageChunk(content="呀")
full = c1 + c2 + c3
print(full.content)   # "你好呀"
```

---
---

## 🧊 1.2 `HumanMessage` —— 用户消息（role="user"）

- **它是什么**：继承自 `BaseMessage`，**`role` 固定为 `"user"`**，代表「用户发给模型」的消息。
- **什么时候用**：**几乎每一次 LLM 调用都要传**。是你代码里写得最多的 Message。

### 🔵 特有 / 重写属性

相比 `BaseMessage` **没有新增字段**，区别仅在于：
- `role` 类属性固定为 `"user"`（Pydantic validator 保证，你改了也会被强制回 `"user"`）
- `type` discriminator 字段固定为 `"human"`

### 🟢 构造方法（4 种常见写法）

```python
from langchain.messages import HumanMessage

# ① 关键字参数（最推荐，最清晰）
m1 = HumanMessage(content="你好")

# ② 位置参数（兼容 BaseMessage 构造函数，第一个就是 content）
m2 = HumanMessage("你好")

# ③ 附带额外元数据
m3 = HumanMessage(
    content="请解释相对论",
    id="user-msg-001",
    name="student-li",
    additional_kwargs={"user_id": 12345},   # 非通用字段放这里
)

# ④ 从 dict 构造（Pydantic）
m4 = HumanMessage.model_validate({
    "role": "user",       # 可以省略（省略了 Pydantic discriminator 会自动填）
    "content": "你好",
})

# ======= 多模态：图+文（list 形式 content）=======
mm = HumanMessage(content=[
    {"type": "text", "text": "请描述这张图片"},
    {"type": "image_url", "image_url": {"url": "https://example.com/a.jpg"}},
])
```

### ⚠️ 注意
- **不要传 `role="xxx"`**：它固定是 "user"，传了反而可能报错（至少不生效）。
- **不要在 HumanMessage 里塞 `tool_calls`**：那是 AI 消息的专属字段，塞了也不会生效。

---

## 🧊 1.3 `AIMessage` —— AI/助手消息（role="assistant"）

- **它是什么**：继承自 `BaseMessage`，代表「模型返回给用户」的消息，也可以是「你手动写的多轮历史里 AI 说过的话」。
- **什么时候用**：`model.invoke(...)` 的返回值就是 `AIMessage`；构建多轮上下文时需要把它加进 `messages` 列表。

### 🔵 相比 BaseMessage 更重要的字段

`AIMessage` 没有新增字段，但**下面这些字段在这个类上最常被读取**（其他消息类基本是空的）：

| 属性 | 在 AIMessage 上的典型值 / 非空时机 |
|---|---|
| **`tool_calls`** | **Agent / 工具调用场景下非空**：包含模型想调用的 1 或多个工具。必须是 `list[dict]`，每个 dict 含 `id / name / args`。 |
| **`invalid_tool_calls`** | 模型生成了工具调用 JSON 但解析失败时非空，每项多一个 `error` 字段。 |
| **`response_metadata`** | **几乎一定非空**：包含 `finish_reason`、`model_name`、`token_usage` 等。 |
| **`usage_metadata`** | 如果 SDK / 模型支持，含 `input_tokens / output_tokens`。 |
| **`content`** | 如果是纯文本回复，就是完整回答字符串；<br>如果回复全是工具调用（`finish_reason="tool_calls"`），可能是空字符串 `""`。 |

### 🟢 特有方法（相对 BaseMessage）
没有真正「特有」的方法，但下面是**使用频率极高**的模式（虽然是读属性）：

```python
# 判断这条 AI 消息是不是「要求调用工具」（最常见写法）
def wants_to_call_tools(ai_msg: AIMessage) -> bool:
    return len(ai_msg.tool_calls) > 0

# 遍历它请求调用的所有工具
for tc in ai_msg.tool_calls:
    call_id: str = tc["id"]
    tool_name: str = tc["name"]
    args_dict: dict = tc["args"]
    print(f"工具 {tool_name}，参数 {args_dict}")

# 取 finish_reason（判断为什么模型停下了）
finish = ai_msg.response_metadata.get("finish_reason")
if finish == "stop":
    print("模型自然停止，输出是最终答案")
elif finish == "tool_calls":
    print("模型停下是因为要调用工具")
elif finish == "length":
    print("模型停下是因为 max_tokens 被打满，答案被截断！必须接着调用")
elif finish == "content_filter":
    print("被安全审查截断")
```

### 💡 示例
```python
from langchain.messages import AIMessage

# 1) 纯文本回复（普通问答）
m1 = AIMessage(
    content="1+1=2。这是最基本的加法。",
    response_metadata={
        "finish_reason": "stop",
        "model_name": "gpt-4o-mini",
        "token_usage": {"prompt_tokens": 20, "completion_tokens": 15, "total_tokens": 35},
    },
)

# 2) 调工具的 AI 回复（Agent 中间步骤）
m2 = AIMessage(
    content="",   # 工具调用场景下 content 往往是空串，但不强制
    tool_calls=[
        {
            "id": "call_abc123",
            "name": "get_weather",
            "args": {"city": "上海"},
        },
        {
            "id": "call_def456",
            "name": "get_weather",
            "args": {"city": "北京"},
        },
    ],
    response_metadata={"finish_reason": "tool_calls", "model_name": "gpt-4o"},
)

print(len(m2.tool_calls))                   # 2
print(m2.tool_calls[0]["args"]["city"])     # 上海
print(m2.response_metadata["finish_reason"])# "tool_calls"
```

---

## 🧊 1.4 `ToolMessage` —— 工具执行结果（role="tool"）

- **它是什么**：继承自 `BaseMessage`，**代表「某个工具的输出」**，要回传给模型。
- **什么时候用**：当 `AIMessage.tool_calls` 非空时，你需要遍历每个 tool_call，**执行对应函数**，然后用 `ToolMessage` 把输出包起来，**追加到 messages 列表里**，再把整个 messages 送回给模型。
- **⚠️ 最容易出错的类**：`tool_call_id` 必须填对（不是填工具名，填 ID！）。

### 🔵 ToolMessage 关键属性

| 属性 | 类型 | 要求 | 含义 |
|---|---|---|---|
| **`content`** | `str` | **✅ 必须是字符串**（非常重要！） | 工具执行结果。<br>⚠️ 即使你要返回 dict 也请 `json.dumps(...)`，或者强制转成 `str`。<br>如果直接传 dict，模型侧可能无法正确解析。 |
| **`tool_call_id`** | `str` | **✅ 必填！必须与原 AIMessage.tool_calls[...]["id"] 完全一致** | 告诉模型：「我这条 ToolMessage 对应的是你哪个工具调用」。<br>模型维护了一个 `{call_id → tool_name + args}` 的映射；**传错 id 模型会认为你没执行那个工具，或者把结果搞混**。 |
| `role` | `"tool"` | 固定，别改 | |
| `name` | `str \| None` | 可选 | 可以填工具名辅助调试，但**核心匹配靠的是 tool_call_id，不是 name** |

### 🟢 方法
完全继承自 BaseMessage，无新增方法。

### 💡 完整「工具调用 → 返回 ToolMessage」闭环示例
```python
from langchain.messages import AIMessage, ToolMessage
from langchain.tools import tool
import json

# 1) 定义两个工具
@tool
def get_weather(city: str) -> str:
    """获取城市天气。"""
    return f"{city}，晴，25°C，风力 3 级"

@tool
def multiply(a: int, b: int) -> str:
    """两数相乘，返回字符串结果。"""
    return str(a * b)

TOOLS = {get_weather.name: get_weather, multiply.name: multiply}

# 2) 假设有一条模型返回的「请求调用工具」的 AIMessage
ai_msg = AIMessage(
    content="",
    tool_calls=[
        {"id": "call_abc", "name": "get_weather", "args": {"city": "上海"}},
        {"id": "call_def", "name": "multiply",    "args": {"a": 6, "b": 7}},
    ],
    response_metadata={"finish_reason": "tool_calls"},
)

# 3) 遍历执行 → 生成 ToolMessage 列表
tool_messages: list[ToolMessage] = []
for tc in ai_msg.tool_calls:
    tool_name = tc["name"]
    tool_args = tc["args"]
    call_id   = tc["id"]

    if tool_name in TOOLS:
        tool_obj = TOOLS[tool_name]
        try:
            # ⭐ 用 tool.invoke(dict)：按 Schema 校验参数
            output = tool_obj.invoke(tool_args)
            # output 已经是 str，直接包
            tm = ToolMessage(content=output, tool_call_id=call_id)
        except Exception as e:
            # ❌ 出错也一定要回 ToolMessage，不然模型不知道发生了什么
            tm = ToolMessage(
                content=f"[工具执行错误] {type(e).__name__}: {e}. 请检查参数并重试。",
                tool_call_id=call_id,
            )
    else:
        tm = ToolMessage(
            content=f"[未知工具] 工具名 {tool_name!r} 不存在，请换一个。",
            tool_call_id=call_id,
        )
    tool_messages.append(tm)

# 4) 结果检查
for tm in tool_messages:
    print(f"[{tm.role}] id={tm.tool_call_id!r}, content={tm.content!r}")
# [tool] id='call_abc', content='上海，晴，25°C，风力 3 级'
# [tool] id='call_def', content='42'

# 5) 接下来：把 ai_msg + tool_messages 全部 append 到 messages，再次调模型
messages = [*prev_messages, ai_msg, *tool_messages]  # 再送入 model.invoke(messages)
```

### ⚠️ 常见错误 Top 3

| 错误写法 | 错误原因 | 正确写法 |
|---|---|---|
| `ToolMessage(content=result_dict)` `result_dict = {"temp":25}` | content 不是 str，模型解析不稳定 | `content=json.dumps(result_dict, ensure_ascii=False)` |
| `ToolMessage(content=r, tool_call_id=tool_name)` | 把工具名当成 ID。模型是按 call_id 匹配，不是按 name。 | `tool_call_id=tc["id"]` |
| 执行工具抛异常 → 直接 raise，没有回 ToolMessage | Agent 上下文缺对应的 ToolMessage，模型会重复调用同一个工具 / 卡死 / 输出错误 | catch 所有异常 → 包成 ToolMessage 返回 |

---

## 🧊 1.5 `SystemMessage` —— 系统提示（role="system"）

- **它是什么**：`role="system"` 的消息。
- **什么时候用**：放在 messages 列表**第 0 条**，给模型定人设 / 工作流 / 输出格式。

### 🔵 属性
没有新增属性，`role` 固定 `"system"`。

### 💡 最佳实践
```python
from langchain.messages import SystemMessage, HumanMessage

# ❌ 空泛的系统提示
bad = SystemMessage(content="你是一个有帮助的助手。")

# ✅ 具体、约束充分、包含格式要求的系统提示
good = SystemMessage(content="""你是一个「客服工单分类助手」。你的职责是阅读用户描述，输出分类结果。

【必须遵守的工作流】
1. 先分析用户的问题属于哪一类：账号 / 支付 / 商品 / 物流 / 售后 / 其他
2. 输出严格为 JSON，格式：{"category": "xxx", "confidence": 0~1, "reason": "一句话理由"}
3. 如果信息不足，category 填 "其他"，reason 说明缺什么信息
4. 不要输出 JSON 以外的任何文字，不要 Markdown 代码块""")

messages = [good, HumanMessage(content="登录的时候一直说账号密码不对，但我明明没输错")]
```

---

## 🧊 1.6 流式 Chunk 子类：`HumanMessageChunk / AIMessageChunk / ToolMessageChunk / SystemMessageChunk`

- **它们是什么**：对应消息类型的「流式增量版本」，字段基本一样。区别是：
  - 可以用 `+` 拼接
  - `content / tool_calls / ...` 里只有**部分信息**，拼完才是完整消息

### 🟢 核心方法：`+` 拼接
```python
from langchain.messages import AIMessageChunk

# 模拟流式
chunks = [
    AIMessageChunk(content="你"),
    AIMessageChunk(content="好，"),
    AIMessageChunk(content="世"),
    AIMessageChunk(content="界"),
]

# 逐步合并
full = None
for c in chunks:
    full = c if full is None else full + c
    print(c.content, end="", flush=True)  # 你好，世界

print()
print("合并后的类型:", type(full).__name__)   # AIMessageChunk（它和 AIMessage 接口一致，可以 model_dump 等）
print("完整内容:", full.content)               # "你好，世界"
```

### 🔑 关键点
1. Chunk 也是 Pydantic，和对应的 Message 共享同样字段，可以 `.model_dump()` 等所有方法。
2. `full.content` 的拼接结果正确，`tool_calls` 也会自动拼（流式返回工具调用时也没问题）。
3. 如果你**只关心 token 流**，打印 chunk.content 即可；**如果你要最终 AIMessage**，请做 `full = full + chunk` 合并。

---
---

# Part 2：Runnable 可运行对象树

> **Runnable 是 LangChain 最重要的协议**。模型、提示、工具、解析器、Agent、链…… 只要能「执行」，都实现了 Runnable。这意味着它们有**同一套方法**：`invoke / ainvoke / stream / astream / batch / abatch / pipe(|) / bind / with_retry / with_fallbacks / with_config / map`。

<a id="runnable"></a>
## 🧊 2.1 `Runnable[Input, Output]`（接口 / 抽象基类）

- **它是什么**：所有「可执行对象」的公共抽象（不是 Pydantic）。你不会直接实例化，但你可以依赖下面这套方法写代码。
- **泛型参数**：
  - `Input`：`invoke(input=...)` 的入参类型。例如 ChatModel 是 `list[BaseMessage]`，PromptTemplate 是 `dict`，StringOutputParser 是 `AIMessage | str`。
  - `Output`：invoke 返回值类型。例如 ChatModel 是 `AIMessage`，StringOutputParser 是 `str`。

---

### 🟢 Runnable 通用方法（**最重要的一张表**，几乎所有类都有）

| # | 方法签名 | 返回值类型 | 参数解释 | 作用 |
|---|---|---|---|---|
| 1 | `.invoke(input: Input, config: RunnableConfig \| None = None, **kwargs)` | `Output` | • `input`：要执行的输入（类型取决于 Runnable 自身）。<br>• `config`：`RunnableConfig`（dict 形式 TypedDict，见 2.7 节）。<br>• `**kwargs`：大部分情况下可以直接传 `configurable=...` / `run_name=...` 等 | **同步执行，拿到最终结果**。最常用、最先学会的方法。 |
| 2 | `.ainvoke(input: Input, config=None, **kwargs)` | `Awaitable[Output]` | 同上 | **异步**版本：`await r.ainvoke(x)`。在 FastAPI / aiohttp 异步服务里用。 |
| 3 | `.stream(input: Input, config=None, **kwargs)` | `Iterator[Chunk]` | 同上 | **同步流式**：`for chunk in r.stream(x): ...`。<br>• 对于 Model：每次 yield 增量 `AIMessageChunk`；<br>• 对于 Agent：每次 yield 一个「当前时刻状态 dict」（stream_mode="values" 时）。 |
| 4 | `.astream(input: Input, config=None, **kwargs)` | `AsyncIterator[Chunk]` | 同上 | **异步流式**：`async for chunk in r.astream(x): ...`。<br>FastAPI StreamingResponse 场景用得极多。 |
| 5 | `.batch(inputs: list[Input], config=None, *, return_exceptions: bool = False, **kwargs)` | `list[Output]` | • `inputs`：`list` 形式的输入，每个元素对应一次 invoke。<br>• `return_exceptions=True`：把失败项变成 `Exception` 对象返回（不中断整个 batch）。 | **批量并发执行**，通常比 for+invoke 快很多（有并发控制，见 max_concurrency）。 |
| 6 | `.abatch(inputs, config=None, *, return_exceptions=False, **kwargs)` | `Awaitable[list[Output]]` | 同上 | 异步批量。 |
| 7 | **`r1 \| r2`** 或等价的 `r1.pipe(r2, ...)` | `RunnableSequence` | `r2` 必须接受 `r1.Output` 作为输入。 | **串联**：先跑 r1，再把 r1 的输出喂给 r2。<br>例如 `prompt \| model \| parser`：`prompt(dict)` → list[Message] → `model` → AIMessage → `parser` → str。 |
| 8 | `.with_config(config: RunnableConfig)` | `Runnable[I, O]`（新的副本） | `config`：默认配置，之后 invoke 不传就用这个。 | 返回「已经绑了默认 config」的副本。不会改原对象。 |
| 9 | `.with_retry(*, stop_after_attempt: int = 3, wait_exponential_jitter=True, retry_exception_types=None, ...)` | `RunnableRetry`（新 Runnable） | • `stop_after_attempt`：最多重试几次。<br>• `retry_exception_types`：只有这些异常才重试（默认常见网络异常 / 限流异常）。 | 给 Runnable 加上自动重试。LLM API 调用极不稳定，**生产必加**。 |
| 10 | `.with_fallbacks(fallbacks: list[Runnable[I, O]], *, exceptions_to_handle=None)` | `RunnableWithFallbacks` | `fallbacks`：降级备选 Runnable 列表，顺序尝试。 | 主 Runnable 失败 → 依次尝试 fallbacks 里的对象，直到成功。常见场景：主模型挂了就切到备用模型 / 备用 Key。 |
| 11 | `.bind(**kwargs)` | `RunnableBinding[I, O]` | `kwargs`：每次调用时**注入到底层 Runnable 的 invoke 里的 kwargs**。<br>• 对于模型：`.bind(stop=["\n"])`, `.bind_tools([...])`, `.bind(response_format=...)` 都属于 bind 的特定便利版本。 | 「给 Runnable 追加每次调用都要传的 kwargs」。返回副本。 |
| 12 | `.map()` | `RunnableEach` | 无参数。 | 把一个接受单个输入的 Runnable 变成「接受 `list[Input]`，对每个元素顺序 / 并发执行，返回 `list[Output]`」的 Runnable。类似于 Python 的 `map()`。 |
| 13 | `Runnable.assign(**kwargs)`（仅对「输出是 dict 的 Runnable」有效） | 新 Runnable | `kwargs`：要新增/覆盖的 key → Runnable（会被调用时把当前 dict 传入）。 | 在「输出 dict 的链」上追加新 key。<br>典型：`RunnablePassthrough.assign(upper=lambda d: d["x"].upper())` |
| 14 | `.transform(input_iterator: Iterator[I], config=None, **kwargs)` | `Iterator[O]` | 流式内部管道。一般不直接用，写自定义解析器 / 中间件时会重写它。 | |
| 15 | `.atransform(input_aiterator, config=None, **kwargs)` | `AsyncIterator[O]` | 异步版本 transform。 | |
| 16 | `.get_graph(config=None)` | `Graph` | 返回可视化 DAG。LangSmith 显示链路时用。可以 `.print_ascii()` 在终端打印。 | 调试复杂链结构。 |
| 17 | `.get_input_schema(config=None)` | `type[Pydantic BaseModel]` | 返回描述输入的 Pydantic 模型（供校验 / 生成 OpenAPI 用）。 | |
| 18 | `.get_output_schema(config=None)` | `type[Pydantic BaseModel]` | 输出 Schema。 | |
| 19 | `.InputType` | `type` | 类属性：**输入类型注解**。IDE 检查 / 阅读源码用。 | |
| 20 | `.OutputType` | `type` | 类属性：**输出类型注解**。 | |
| 21 | `.name` | `str` | 实例属性：名字（显示在 LangSmith / 调试打印里）。 | |

---

### 💡 Runnable 通用方法综合示例
```python
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.output_parsers import StringOutputParser
from langchain.runnables import RunnableLambda, RunnablePassthrough

# ======= 构造一条基础链 =======
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是翻译官。把用户的话翻译成英文，输出翻译结果就好，不要加任何多余文字。"),
    ("human", "{text}"),
])

model = ChatOpenAI(model="gpt-4o-mini", temperature=0)
parser = StringOutputParser()

chain = prompt | model | parser

# 1. invoke
result = chain.invoke({"text": "你好世界"})
print(type(result), repr(result))  # <class 'str'> 'Hello world'

# 2. stream（同步流式）
for chunk in chain.stream({"text": "今天天气很好，我想出去散步。"}):
    print(chunk, end="", flush=True)
print()

# 3. batch（批量）
outs = chain.batch([
    {"text": "你好"},
    {"text": "谢谢"},
    {"text": "再见"},
])
print(outs)  # ['Hello', 'Thank you', 'Goodbye']

# 4. with_retry（自动重试）
chain_with_retry = chain.with_retry(stop_after_attempt=5)
chain_with_retry.invoke({"text": "我要重试但不真正失败的demo"})

# 5. with_fallbacks（降级）
cheap_model = ChatOpenAI(model="gpt-4o-mini")
strong_model = ChatOpenAI(model="gpt-4o")
fallback_chain = (prompt | cheap_model | parser).with_fallbacks([prompt | strong_model | parser])
# 如果 gpt-4o-mini 挂了，自动再试一次 gpt-4o

# 6. bind（给模型加 stop 序列）
chain_with_stop = prompt | model.bind(stop=["，", "。"]) | parser
print(chain_with_stop.invoke({"text": "今天天气怎么样？"}))  # 只输出到遇到第一个"，"或"。"

# 7. Runnable.assign：在 dict 链上追加字段
step = RunnablePassthrough.assign(
    english=lambda d: chain.invoke(d),           # 这里为了演示，一般应该写成 chain
    length=lambda d: len(d["text"]),
)
out = step.invoke({"text": "你好"})
print(out)  # {'text': '你好', 'english': 'Hello', 'length': 2}
```

---

## 🧊 2.2 `RunnableLambda[I, O]` —— 把普通函数包成 Runnable

- **什么时候用**：你想在链中插入一段「自己的 Python 处理」，但不想写完整 Runnable 子类。

### 🔵 构造参数
```python
def __init__(
    self,
    func: Callable[[I], O],
    afunc: Callable[[I], Awaitable[O]] | None = None,  # 异步函数
    *,
    name: str | None = None,
)
```

### 🟢 行为
它完全等价于 Runnable：`invoke(x) = func(x)`，`ainvoke(x) = await afunc(x)`（如果提供了）。其余方法 `stream/batch` 等都默认基于 `invoke` 实现。

### 💡 示例
```python
from langchain.runnables import RunnableLambda

add_one = RunnableLambda(lambda x: x + 1)
print(add_one.invoke(5))   # 6

async def async_double(x):
    return x * 2

both = RunnableLambda(lambda x: x + 10, afunc=async_double)
print(both.invoke(5))     # 15
# await both.ainvoke(5) → 10（异步走 afunc，不是 func）
```

---

## 🧊 2.3 `RunnableSequence` —— 用 `|` 连起来的链

- **它是什么**：当你写 `a | b | c` 时，LangChain 内部返回的就是这个对象。
- **你几乎不会手动构造它**。

### 🔵 公开属性
| 属性 | 类型 | 含义 |
|---|---|---|
| `.steps` | `tuple[Runnable, ...]` | 串联的每一步（`a|b|c` → `(a, b, c)`）。调试时可以用来检查「链到底包含哪些步骤」。 |

### 💡 示例
```python
chain = prompt | model | parser
print(type(chain).__name__)            # RunnableSequence
print(len(chain.steps))                # 3
print(chain.steps[0].__class__.__name__)
# ChatPromptTemplate
```

---

## 🧊 2.4 `RunnableParallel` / `RunnableMap` —— 并行运行多个分支

- **它是什么**：`{"a": r1, "b": r2, "c": r3}` 这种 dict 在 `|` 左边时，会自动被 LangChain 包成 `RunnableParallel`（别名 `RunnableMap`）。
- **执行模式**：所有分支都接收同一个输入，彼此**并发执行**（默认有 max_concurrency 限制），最后把结果按 key 合并成一个 dict 返回。

### 🔵 构造
```python
RunnableParallel({
    "key_a": runnable_or_callable_1,
    "key_b": runnable_or_callable_2,
    ...
})
```
dict 的 value 可以是：
- 任意 Runnable
- 普通 callable（自动被 RunnableLambda 包）
- 常数值（如果不是 callable，会当作常量返回）

### 💡 示例
```python
from langchain.runnables import RunnableParallel, RunnablePassthrough

parallel = RunnableParallel({
    "raw": RunnablePassthrough(),
    "upper": lambda s: s.upper(),
    "lower": lambda s: s.lower(),
    "length": len,
    "greeting": "你好，世界",          # 非 callable：就是常量值
})

out = parallel.invoke("Hello World")
# out == {
#   "raw": "Hello World",
#   "upper": "HELLO WORLD",
#   "lower": "hello world",
#   "length": 11,
#   "greeting": "你好，世界",
# }
```

---

## 🧊 2.5 `RunnablePassthrough[T]` —— 原样透传

- **它是什么**：最简单的 Runnable，`invoke(x) = x`，`stream(x) = iter([x])`。
- **看起来没用？但组合链时极其常用！**
  1. 在 `RunnableParallel` 里做「原样保留原输入」的 key；
  2. 配合 `.assign` 在 dict 上加字段。

### 🟢 `.assign(**kwargs: Runnable | Callable)` 方法
```python
def assign(self, **kwargs) -> RunnablePassthroughAssign: ...
```
每个 kwarg 的 value 接收「当前输入 dict」。返回一个「新 Runnable」：输入 dict，输出 dict 合并了 kwargs 的执行结果。

### 💡 示例
```python
from langchain.runnables import RunnablePassthrough

# 1) 原样透传
pt = RunnablePassthrough()
print(pt.invoke("abc"))   # 'abc'
print(pt.invoke(12345))   # 12345

# 2) .assign 用法（输入必须是 dict）
chain = RunnablePassthrough.assign(
    name_upper=lambda d: d["name"].upper(),
    doubled_age=lambda d: d["age"] * 2,
)
print(chain.invoke({"name": "Tom", "age": 20}))
# {'name': 'Tom', 'age': 20, 'name_upper': 'TOM', 'doubled_age': 40}
```

---

## 🧊 2.6 Runnable 其他子类速览

| 类名 | 怎么来的 | 作用 |
|---|---|---|
| `RunnableBinding` | `.bind(...)` / `.bind_tools(...)` 的返回值 | 包装原 Runnable，调用时自动把 kwargs 注入下去。 |
| `RunnableRetry` | `.with_retry(...)` 的返回值 | 带重试逻辑。 |
| `RunnableWithFallbacks` | `.with_fallbacks([...])` 的返回值 | 主失败 → 按顺序试备选。 |
| `RunnableEach` | `.map()` 的返回值 | `map()` 后 Runnable 的输入输出都变成 list。 |
| `RunnableAssign` | `.assign(...)` 形式（不是 Passthrough 的 assign） | 同 `.assign`。 |

---

## 🧊 2.7 `RunnableConfig`（TypedDict）

- **它是什么**：`dict`，不是 Pydantic。所有 `invoke/stream/batch` 的 `config` 参数都接收它。
- **字段表**（超级常用）：

| # | key | 类型 | 默认 | 作用 |
|---|---|---|---|---|
| 1 | `tags` | `list[str]` | `[]` | 运行标签。LangSmith 里可以按 tag 过滤 trace。 |
| 2 | `metadata` | `dict[str, Any]` | `{}` | 自定义元数据，会写进 LangSmith trace。典型：`{"user_id": 123, "session_id": "abc"}` |
| 3 | `run_name` | `str` | 自动生成 | 这次运行在 LangSmith 里显示的名字。一般传一个语义化的名字，如 "weather-agent-invoke"。 |
| 4 | `callbacks` | `list[BaseCallbackHandler]` | `[]` | 回调处理器。放一个 StdOutCallbackHandler 就能实时打印步骤。 |
| 5 | `recursion_limit` | `int` | 25 | Runnable 递归调用最大深度。Agent 循环比较深时一定要调大（50~500 常见）。 |
| 6 | `max_concurrency` | `int \| None` | 无（由具体 Runnable 定） | 并行分支时最大并发线程 / 协程数。批量调用时限制速率。 |
| 7 | `configurable` | `dict[str, Any]` | `{}` | 提供给 `Runnable.configurable_fields(...)` 机制做「运行时配置」。高级用法。 |
| 8 | `run_id` | `str(UUID) \| None` | 自动生成 | 手动指定 run ID。一般不设，除非你要和你自己的追踪系统 ID 对齐。 |

### 💡 示例
```python
from langchain.runnables import RunnableConfig
from langchain.callbacks import StdOutCallbackHandler

config: RunnableConfig = {
    "tags": ["dev", "demo", "weather"],
    "metadata": {"user_id": 1001, "session_id": "sess_abcdef"},
    "run_name": "weather-answer-v3",
    "callbacks": [StdOutCallbackHandler()],
    "recursion_limit": 100,
}
result = agent.invoke({"messages": [{"role":"user","content":"上海天气"}]}, config=config)
```

---
---

# Part 3：模型体系

## 🧊 3.1 `BaseChatModel` —— 聊天模型基类

所有 `ChatOpenAI / ChatAnthropic / ChatDeepseek / ChatQwen ...` 都继承它。它**本身也是 Runnable**（`Runnable[list[BaseMessage], AIMessage]`）。

### 🟢 继承自 Runnable 的方法
上面 Runnable 16+ 个方法全部都有。下面列的是「**只有模型才有**」的方法。

| # | 方法签名 | 返回值类型 | 参数 | 作用 |
|---|---|---|---|---|
| 1 | `.bind_tools(tools: list[StructuredTool \| Callable \| BaseTool], *, tool_choice=None, strict=None, **kwargs)` | `RunnableBinding` | `tools`：`@tool` 装饰出来的对象列表；<br>`tool_choice`：字符串 `"auto"/"any"/"none"` 或指定某个工具 `{"type":"function","function":{"name":"xxx"}}`。 | 返回一个「已经绑定了工具」的新 Runnable。调用它时模型就会考虑是否要调这些工具。**这是 Agent 的基石**。 |
| 2 | `.bind_functions(functions: list, *, function_call=None, **kw)` | `RunnableBinding` | 旧版 OpenAI Function Calling 形式。**不推荐新代码**，功能上等价于 `bind_tools`。 | 遗留系统兼容用。 |
| 3 | `.bind_response_format(response_format, **kw)` | `RunnableBinding` | `response_format`：`{"type":"json_object"}` 或 Pydantic 类 / `StructuredOutput` 对象（看厂商）。 | 强制模型输出指定格式。**比把要求写进 Prompt 可靠得多**。 |
| 4 | `.bind_logprobs(*, include: bool = False, top_logprobs: int \| None = None, ...)` | `RunnableBinding` | 是否返回每个 token 的对数概率。做打分 / 检索 / 置信度评估时有用。 |
| 5 | `.get_num_tokens(text: str)` | `int` | `text` 是要计数的字符串。 | **估算**一段文本约多少 token（近似算法，不保证和厂商完全一致，但很接近）。 |
| 6 | `.get_num_tokens_from_messages(messages: list[BaseMessage])` | `int` | 消息列表。 | **估算**整个消息 list 的 token 数，用来判断是否快超上下文窗口。 |
| 7 | **`@property .identifying_params`** | `dict[str, Any]` | （属性，只读） | 能「唯一标识这个模型实例」的参数字典（比如 model、temperature、base_url 等）。LangSmith 用它区分不同配置的 run。 |
| 8 | **`@property .tokenizer`** | 一般是 HuggingFace Tokenizer / tiktoken Encoding \| None | （属性，尽量别直接依赖内部实现） | 真正在使用的 tokenizer。需要时可用来做更精确的拆分。 |

### 💡 ChatModel 综合示例
```python
from langchain_openai import ChatOpenAI
from langchain.tools import tool
from langchain.messages import HumanMessage, AIMessage, ToolMessage

@tool
def get_weather(city: str) -> str:
    """获取天气。"""
    return f"{city} 晴"

# 1) 构造
model = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.0,
    max_tokens=512,
    timeout=30,
    max_retries=3,
)

# 2) 同步 / 异步 / 流式
r = model.invoke([HumanMessage(content="1+1=?")])
print(type(r), r.content)  # AIMessage "2"

for chunk in model.stream([HumanMessage(content="背一首唐诗《春晓》")]):
    print(chunk.content, end="", flush=True)
print()

# 3) 绑定工具
model_tools = model.bind_tools([get_weather])
r2 = model_tools.invoke([HumanMessage(content="上海天气怎么样？")])
print("finish_reason:", r2.response_metadata.get("finish_reason"))  # tool_calls
print("tool_calls:", r2.tool_calls)  # [{"id":"...", "name":"get_weather", "args":{"city":"上海"}}]

# 4) 估算 token
print("单句 tokens:", model.get_num_tokens("你好" * 100))
print("整对话 tokens:", model.get_num_tokens_from_messages([
    HumanMessage(content="你好"),
    AIMessage(content="你好，有什么可以帮您？"),
    HumanMessage(content="请问 LangChain 是什么？"),
]))
```

---

## 🧊 3.2 `ChatOpenAI` 构造参数详解（常用）

### 🔵 构造参数（`__init__` 关键字）

| # | 参数名 | 类型 | 默认值 | 作用 |
|---|---|---|---|---|
| 1 | **`model`** | `str` | 不同版本 SDK 默认值不同（如 `"gpt-4o"` / 空字符串强制报错） | 模型名。可选：`gpt-4o / gpt-4o-mini / gpt-5 / gpt-3.5-turbo-0125 / o1-preview ...` |
| 2 | **`temperature`** | `float` | `0.7` | 采样温度 0~2。<br>0 = 每次只选概率最高 token（基本确定）；<br>2 = 非常随机（容易胡言乱语）。<br>**分类/提取/结构化输出：0.0**；<br>**创意写作：0.7~1.2**。 |
| 3 | **`max_tokens`** | `Optional[int]` | `None`（用模型默认 / 达到自然停） | 最大输出 token 数。结构化输出限小一点能省钱。 |
| 4 | **`model_kwargs`** | `dict[str, Any]` | `{}` | 透传给 API 的其他参数，比如 `top_p / frequency_penalty / presence_penalty / seed / stop` 等。也可以用 `.bind(stop=...)` 代替。 |
| 5 | **`api_key`** | `SecretStr \| str \| None` | 读环境变量 `OPENAI_API_KEY` | API Key。**生产环境请一定用环境变量，不要写死**。 |
| 6 | **`base_url`** | `str \| None` | OpenAI 官方 URL | 兼容其他 OpenAI-Protocol 平台（国内 / 本地代理 / 开源网关如 OneAPI / LiteLLM）。 |
| 7 | **`organization`** | `str \| None` | `None` | OpenAI 组织 ID（有的账号分组织计费）。 |
| 8 | **`project`** | `str \| None` | `None` | OpenAI 项目 ID（新版 Project API Key）。 |
| 9 | **`timeout`** | `float \| Timeout \| None` | `600`（注意新版本默认可能变） | 单请求超时秒数 / 或 httpx.Timeout（可分别设置 connect/read/write/pool）。 |
| 10 | **`max_retries`** | `int` | `2` | 5xx / 429 重试次数。生产建议 3~5。 |
| 11 | **`stream_usage`** | `bool` | `False` | 流式时是否在最后一个 chunk 返回 usage_metadata。True 时可以拿到完整 token 用量，False 时流式里拿不到。 |
| 12 | **`streaming`** | `bool` | `False`（一般别手动改） | 当你显式调用 `.stream()` 时内部会开启。你手动 `ChatOpenAI(streaming=True).invoke(...)` 没有意义。 |
| 13 | **`n`** | `int` | `1` | 一次请求生成多少条候选回复。**1（默认）是最常用的**，>1 非常烧钱。 |
| 14 | **`top_p`** | `float` | `1.0` | Nucleus 采样。和 temperature 只改一个即可，一般只调 temperature。 |
| 15 | **`presence_penalty` / `frequency_penalty`** | `-2.0 ~ 2.0` | `0.0` | 控制 token 重复。<br>presence_penalty：出现过一次就抑制（鼓励说新话题）；<br>frequency_penalty：出现次数越多抑制越强。 |
| 16 | **`seed`** | `int \| None` | `None` | 设了以后同一 seed 的多次调用结果会尽量一致（不保证完全一致，OpenAI 提供 best-effort）。写测试时设 seed 很方便。 |
| 17 | **`logprobs` / `top_logprobs`** | `bool` / `int \| None` | `False` / `None` | 是否返回每个 token 的 top-k 对数概率。做置信度分析时用。 |
| 18 | **`stop`** | `list[str] \| None` | `None` | stop 序列。遇到任何一个就停止生成。也可以用 `.bind(stop=[...])` 传。 |
| 19 | **`user`** | `str \| None` | `None` | OpenAI 建议传一个用户 ID，有助于检测滥用（对调用结果无影响）。 |
| 20 | **`http_client` / `http_async_client`** | `httpx.Client \| AsyncClient \| None` | 自动创建 | 提供你自己的 httpx client（配代理、证书、超时策略等）。企业内网代理环境非常有用。 |

### 💡 ChatOpenAI 配置最全示例
```python
from langchain_openai import ChatOpenAI
import httpx

client = httpx.Client(proxies="http://proxy.corp.example.com:8080", timeout=httpx.Timeout(10, connect=5))

model = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.0,
    max_tokens=1024,
    api_key="sk-xxx",                         # 生产请用环境变量！
    base_url="https://gateway.corp.example.com/v1",  # 内部网关
    timeout=30,
    max_retries=4,
    seed=42,                                 # 可复现
    stream_usage=True,
    model_kwargs={"top_p": 0.95, "frequency_penalty": 0.1},
    http_client=client,
)
```

---

## 🧊 3.3 `init_chat_model(model, *, model_provider=None, **kw)` 工厂函数

**模块**：`langchain.chat_models.init_chat_model`

### 🟢 签名
```python
def init_chat_model(
    model: str,
    *,
    model_provider: str | None = None,
    **kwargs                # temperature / max_tokens / base_url / api_key / timeout ... 一切透传
) -> BaseChatModel
```

- 规则：
  - `model` 写成 `"openai:gpt-4o"` → 前缀是 provider；
  - 写成 `"gpt-4o"` → 自动推断 provider（`gpt-* / o1-* / dall-e-* / tts-* / whisper*` → `openai`；`claude-*` → `anthropic`）；
  - 无法推断时可以用 `model_provider=` 手动指定。

### 💡 示例
```python
from langchain.chat_models import init_chat_model

m1 = init_chat_model("gpt-4o")                                  # 自动：openai
m2 = init_chat_model("anthropic:claude-sonnet-4-5")            # 显式前缀
m3 = init_chat_model("gpt-4o-mini", temperature=0, max_tokens=512, timeout=30)
```

---
---

# Part 4：工具体系

## 🧊 4.1 `@tool` 装饰器（函数 → StructuredTool）

**模块**：`langchain.tools.tool`

### 🟢 完整签名
```python
def tool(
    __func: Callable | None = None,
    *,
    name: str | None = None,
    description: str | None = None,
    args_schema: type[BaseModel] | None = None,
    return_direct: bool = False,
    infer_schema: bool = True,
    response_format: Literal["content", "content_and_artifact"] = "content",
    handle_tool_error: bool | str | Callable[[Exception], str] = False,
) -> Callable | StructuredTool:
```

| # | 参数 | 类型 | 默认 | 作用 |
|---|---|---|---|---|
| 1 | `__func` | 被装饰函数 | — | `@tool`（没括号）直接装饰时自动传入。 |
| 2 | **`name`** | `str \| None` | `None` → 使用函数名 | 工具的「对外名称」。LLM 就是根据这个名字和 description 判断要不要调你。**建议用英文小写下划线命名**，如 `search_web`。 |
| 3 | **`description`** | `str \| None` | `None` → 使用函数 docstring | **最重要的参数**。强烈建议写 docstring 不写这个参数（docstring 更靠近代码，更同步）。要写清「**什么时候用 / 入参含义 / 返回什么**」。 |
| 4 | **`args_schema`** | `type[BaseModel] \| None` | `None` → 从函数签名 + 类型注解自动生成。 | **指定 Pydantic 模型作为入参 Schema**。复杂参数建议写 Pydantic 模型，可以加 `Field(description=...)`、`ge/le` 等约束。 |
| 5 | **`return_direct`** | `bool` | `False` | `True` 时：在旧的 AgentExecutor / ReAct 中，工具返回的字符串会直接作为 Agent 最终答案，不再回 LLM 第二轮。在 v1 create_agent 中**效果要结合具体 agent implementation 看**，一般用默认 False 即可。 |
| 6 | `infer_schema` | `bool` | `True` | 是否从函数签名自动推断 args_schema。设 False 时只保留名字/描述（极少见）。 |
| 7 | `response_format` | `Literal["content", "content_and_artifact"]` | `"content"` | `"content"`：Tool 只输出 content（最常见，就是字符串）；<br>`"content_and_artifact"`：返回 `(content, artifact)`，前者给模型看的字符串，后者是结构化对象（可以给后续 Tool/Client 用，不进 Token 计算）。 |
| 8 | **`handle_tool_error`** | `bool \| str \| Callable[[Exception], str]` | `False` | 工具执行异常时如何处理：<br>`False` → 抛出去；<br>`True` → 回传固定格式 ToolMessage；<br>`str` → 回传这段固定字符串给模型；<br>`callable(e) -> str` → 调用回调自定义错误内容给模型。生产建议写 `True` 或回调，不然一个工具异常直接让整条链炸。 |

### 💡 5 种用法
```python
from typing import Literal
from pydantic import BaseModel, Field
from langchain.tools import tool

# ✅ 用法 1：最简 @tool（无参数）—— 默认用函数名当 name，docstring 当 description
@tool
def search_web(query: str) -> str:
    """调用搜索引擎搜索互联网。

    适合查：最新新闻、实时天气、体育赛果、不在训练集里的信息。

    Args:
        query: 搜索引擎关键词（简单自然语言即可）。
    """
    return f"[搜索 '{query}'] 找到结果 1, 2, 3 ..."

# ✅ 用法 2：@tool("自定义工具名") 简写
@tool("谷歌搜索")
def search_v2(query: str) -> str:
    """搜最新新闻。"""
    return "..."

# ✅ 用法 3：命名参数形式
@tool(
    name="calculator",
    description="做数学四则运算。参数 expression 是合法 Python 数学表达式字符串（如 '2+3*4'）",
    return_direct=False,
    handle_tool_error=True,
)
def calc(expr: str) -> str:
    return str(eval(expr, {"__builtins__": {}}, {}))

# ✅ 用法 4：args_schema + Pydantic（复杂入参强烈推荐）
class SearchInput(BaseModel):
    query: str = Field(..., description="搜索关键词，不超过 100 字符", min_length=1, max_length=100)
    max_results: int = Field(5, description="最多返回几条", ge=1, le=20)
    category: Literal["news", "general", "image", "video"] = Field("general", description="搜索类别")

@tool(args_schema=SearchInput)
def advanced_search(query: str, max_results: int, category: str) -> str:
    """高级搜索。"""
    return f"[{category}] 搜索 {query}，最多 {max_results} 条"

# ✅ 用法 5：handle_tool_error 回调
@tool(handle_tool_error=lambda e: f"[工具内部错误] 请稍后重试。错误摘要：{e}")
def risky_call(url: str) -> str:
    """请求一个 URL 返回内容。"""
    import urllib.request
    return urllib.request.urlopen(url, timeout=5).read().decode()
```

---

## 🧊 4.2 `StructuredTool`（@tool 的返回类）

**模块**：`langchain.tools.StructuredTool`

所有 `@tool` 装饰出来的对象，底层就是 `StructuredTool`。

### 🔵 核心属性（你会频繁读）

| # | 属性 | 类型 | 含义 |
|---|---|---|---|
| 1 | **`.name`** | `str` | 工具名。 |
| 2 | **`.description`** | `str` | 工具描述（LLM 就靠它判断要不要用你）。 |
| 3 | **`.args_schema`** | `type[BaseModel]` | 入参 Pydantic Schema，有 `model_fields / model_json_schema()`。 |
| 4 | **`.func`** | `Callable` | 被装饰的**原始同步函数**。可以直接调用：`tool.func("a", "b")`（跳过校验和回调）。 |
| 5 | **`.coroutine`** | `Callable \| None` | 如果原函数是 async def，这里就是它。 |
| 6 | **`.return_direct`** | `bool` | 构造时传入的值。 |
| 7 | **`.handle_tool_error`** | `bool \| str \| Callable` | 构造时传入的错误处理策略。 |
| 8 | **`.response_format`** | `Literal["content", "content_and_artifact"]` | 构造时传入。 |

### 🟢 方法

| # | 方法签名 | 返回值 | 参数 / 作用 |
|---|---|---|---|
| 1 | **`.invoke(input: dict[str, Any] \| ToolCall, config=None)`** | `Any` | **最常用的调用方式**：`input` 是「参数字典」。内部会先做 args_schema 校验，再调 func，再按 handle_tool_error 做异常处理。 |
| 2 | `.ainvoke(input, config=None)` | `Awaitable[Any]` | 异步版本。如果工具提供了 `.coroutine` 就会用它。 |
| 3 | `.run(*args, **kwargs)` | `Any` | Legacy 形式（不推荐新代码）。支持两种：<br>① `tool.run("a", "b")` 按位置传参；<br>② `tool.run({"k":"v"})` 传 dict（等价于 invoke）。 |
| 4 | `.get_input_schema()` | `type[BaseModel]` | 返回 `.args_schema`。 |
| 5 | **`.to_json()`** | `dict` | 转成 **OpenAI Function Calling 格式**的 schema。`{ "type": "function", "function": {"name":"...","description":"...","parameters": {...}} }`。.bind_tools 内部就是调用它。 |
| 6 | `@classmethod` `.from_function(func, ...)` | `StructuredTool` | 从普通函数构造（@tool 内部实际就是用它）。 |

### 💡 示例
```python
from langchain.tools import tool

@tool
def add(a: int, b: int) -> int:
    """两数相加。"""
    return a + b

print("name:", add.name)                                          # "add"
print("desc:", add.description)                                   # "两数相加。"
print("fields:", add.args_schema.model_fields.keys())             # dict_keys(['a', 'b'])
print("schema JSON:", add.args_schema.model_json_schema())        # Pydantic JSON Schema

# 两种调用
print(add.func(3, 4))                     # 7（跳过校验 / 回调）
print(add.invoke({"a": 3, "b": 4}))       # 7（正规流程：校验 + 错误处理）

# 生成要发给 LLM 的工具描述 JSON
import json
print(json.dumps(add.to_json(), indent=2, ensure_ascii=False))
# {
#   "type": "function",
#   "function": {
#     "name": "add",
#     "description": "两数相加。",
#     "parameters": {
#       "type": "object",
#       "properties": {
#         "a": {"type": "integer", "title": "A"},
#         "b": {"type": "integer", "title": "B"}
#       },
#       "required": ["a", "b"],
#       ...
#     }
#   }
# }
```

---
---

# Part 5：提示词体系

## 🧊 5.1 `ChatPromptTemplate` —— 聊天模板

**模块**：`langchain.prompts.ChatPromptTemplate`

本质是「消息模板列表」。每条消息模板可以是：
- `("system", "...{var}...")` → 自动转 SystemMessage
- `("human", "...{var}...")` → HumanMessage
- `("assistant", "...{var}...")` → AIMessage
- `BaseMessage` 实例（常量消息，不替换变量）
- `MessagesPlaceholder("history")` → 运行时填一整段消息列表

### 🔵 属性
| 属性 | 类型 | 含义 |
|---|---|---|
| `.messages` | `list[BaseMessagePromptTemplate \| tuple \| BaseMessage]` | 你给 from_messages 传的原始列表。 |
| `.input_variables` | `set[str]` | 模板需要填的所有变量名集合。 |
| `.partial_variables` | `dict[str, Any]` | 已经填过的变量（.partial() 的结果）。 |
| `.validate_template` | `bool` | 是否校验模板里没写错变量名（默认 True）。 |

### 🟢 方法

| # | 方法签名 | 返回值 | 作用 |
|---|---|---|---|
| 1 | **`@classmethod` `.from_messages(messages: list)`** | `ChatPromptTemplate` | **最常用构造方法**。传一个「消息列表」。 |
| 2 | `.invoke(variables: dict[str, Any])` | `list[BaseMessage]` | **填变量 → 生成消息列表**（因为它是 Runnable）。链里写 `prompt \| model` 就是靠这个。 |
| 3 | `.format_messages(**kwargs)` | `list[BaseMessage]` | 等价于 `.invoke(dict(kwargs))`。命名更直接。 |
| 4 | `.format(**kwargs)` | `str` | 转成纯字符串（把所有消息拼成一个大字符串，system 加前缀 "System: " 等）。**调试用，不要拿来喂给聊天模型**。 |
| 5 | `.partial(**kwargs: Any)` | `ChatPromptTemplate` | 预填一部分变量，返回新模板。常用于「通用模板 + 特定场景的固定人设」。 |
| 6 | `.pipe(other, ...)` | `RunnableSequence` | 等价于 `prompt \| other`，链的第一步最常用。 |
| 7 | `.pretty_format(**kwargs)` | `str` | 格式化显示「填好变量后的完整提示词」。**调试神器**。 |
| 8 | `.save(file_path: str)` | `None` | 把模板存成 YAML。（团队共享提示词模板）。 |
| 9 | **`@classmethod` `.load(file_path: str)`** | `ChatPromptTemplate` | 从 YAML 加载保存过的模板。 |

### 💡 综合示例
```python
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是{role}。请用{level}难度讲解。"),
    MessagesPlaceholder("history"),             # 运行时填 list[BaseMessage]
    ("human", "{question}"),
])

print("需要填变量:", prompt.input_variables)
# {'role', 'level', 'history', 'question'}

# 1) 填变量 → 消息列表
msgs = prompt.invoke({
    "role": "物理教授",
    "level": "研究生",
    "history": [
        {"role": "user", "content": "我是物理小白"},
        {"role": "assistant", "content": "好的，我会从零开始讲解。"},
    ],
    "question": "什么是量子隧道效应？",
})
for m in msgs:
    print(f"[{m.role}] {str(m.content)[:50]}")
# [system] 你是物理教授。请用研究生难度讲解。
# [user] 我是物理小白
# [assistant] 好的，我会从零开始讲解。
# [user] 什么是量子隧道效应？

# 2) partial 预填变量
teacher_prompt = prompt.partial(role="中学老师", level="初中")
print(teacher_prompt.input_variables)   # {'history', 'question'}

# 3) 调试
print(prompt.pretty_format(
    role="老师", level="大学",
    history=[], question="讲一下黑洞",
))
```

---

## 🧊 5.2 `PromptTemplate`（字符串提示模板）

**模块**：`langchain.prompts.PromptTemplate`

给旧式「字符串 LLM」用（现在的 Chat 模型基本不用了，但读老代码会遇到）。

### 🟢 关键方法
| 方法 | 返回 |
|---|---|
| `@classmethod .from_template(template_str: str)` | `PromptTemplate` |
| `.format(**kw)` | `str` |
| `.format_prompt(**kw)` | `StringPromptValue` → `.to_string()` / `.to_messages()` |

```python
from langchain.prompts import PromptTemplate

pt = PromptTemplate.from_template("把以下中文翻译成英文：\n{text}")
print(pt.format(text="你好世界"))
# '把以下中文翻译成英文：\n你好世界'
```

---

## 🧊 5.3 `MessagesPlaceholder(var_name, *, optional=False, n_messages=None)`

- **它是什么**：不是 Runnable 本体，是「PromptTemplate 内部节点」。用于在模板里留「一整段消息列表」的位置。
- **参数**：
  - `var_name: str`：运行时传入 dict 里对应的 key，key 的 value 必须是 `list[BaseMessage]` / 或「能转成消息的 dict 列表」
  - `optional: bool`：`True` 时不传这个 key 不会报错，相当于空列表
  - `n_messages: int | None`：如果非 None，要求该列表长度恰好是 n（极端场景用）

### 💡 典型用法（上面已经看到）
```python
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是助手"),
    MessagesPlaceholder("chat_history", optional=True),  # 可以不传
    ("human", "{input}"),
])
```

---
---

# Part 6：Agent 体系 / RAG 体系 / Parser / Callback / Middleware （超详解）

<a id="agent"></a>
## 🧊 6.1 `create_agent(model, tools=None, *, ...)` 工厂函数

**模块**：`langchain.agents.create_agent`

### 🟢 完整参数表
```python
def create_agent(
    model: "str | BaseChatModel",
    tools: list[BaseTool] | None = None,
    *,
    system_prompt: str | None = None,
    response_format: "ToolStrategy | ProviderStrategy | None" = None,
    state_schema: type[AgentState] | None = None,
    middleware: "list[AgentMiddleware | Callable] | None" = None,
    context_schema: type | None = None,
    max_iterations: int = 25,
    max_time: float | None = None,
    graph=None,
    checkpointer=None,
    debug: bool = False,
    store=None,
    **kwargs,
):
    ...
    return CompiledGraph   # LangGraph 的图，支持 invoke/stream
```

| # | 参数 | 类型 | 默认 | 作用 |
|---|---|---|---|---|
| 1 | **`model`** | `str \| BaseChatModel` | 必填 | 字符串：走 `init_chat_model`；或直接传模型实例。 |
| 2 | **`tools`** | `list[BaseTool] \| None` | `None`（无工具） | `@tool` 装饰出来的对象列表。 |
| 3 | `system_prompt` | `str \| None` | `None` | 系统提示词字符串（会被塞进 messages[0]）。更复杂的动态系统提示用中间件 `@dynamic_prompt`。 |
| 4 | **`response_format`** | `ToolStrategy \| ProviderStrategy \| None` | `None` | 让 Agent 输出结构化对象。v1 必须包装。 |
| 5 | **`state_schema`** | `type[AgentState] (TypedDict) \| None` | 默认 `AgentState`（只含 messages） | 自定义状态字段。**v1 必须是 TypedDict（不能是 Pydantic）**。 |
| 6 | **`middleware`** | `list[AgentMiddleware \| Callable] \| None` | `None` | 中间件列表（装饰器或类实例）。 |
| 7 | `context_schema` | `TypedDict type \| None` | `None` | 运行时 `context=` 参数的 TypedDict，给 @dynamic_prompt / 中间件用。 |
| 8 | **`max_iterations`** | `int` | `25` | ReAct 循环最大步数，防止无限烧钱。复杂问答 50~100。 |
| 9 | `max_time` | `float \| None` | `None` | 最多运行多少秒（软限制，在节点边界判断）。 |
| 10 | `checkpointer` | `LangGraph MemorySaver / AsyncSqliteSaver ... \| None` | `None` | 持久化执行状态（多轮、断点续跑、人类介入）。需要 LangGraph 内置 checkpointer。 |
| 11 | `graph` | 预构建的 StateGraph | `None` | 高级：自定义节点 / 边。 |
| 12 | `store` | `BaseStore \| None` | `None` | 长期记忆 Store（LangGraph Store）。 |
| 13 | `debug` | `bool` | `False` | True 时打印每一步状态。（开发调试用，生产关掉。） |

### 🔵 返回值 `CompiledGraph`（LangGraph）的方法（本质都是 Runnable 方法 + 图专属方法）

| # | 方法签名 | 返回值 | 作用 |
|---|---|---|---|
| 1 | `.invoke(input, config=None, *, stream_mode=None)` | `dict`（State） | 同步执行，返回**最终状态**。至少有 `"messages"` key。 |
| 2 | `.ainvoke(input, config=None)` | `Awaitable[dict]` | 异步 invoke。 |
| 3 | `.stream(input, config=None, *, stream_mode="values"\|"updates"\|"messages-tuple"=None)` | `Iterator[dict]` | **流式**。`stream_mode="values"`：每次 yield 该时刻「完整 state」（最常用的 UI 展示模式）；`"updates"`：只 yield 变化的字段；`"messages-tuple"`：更细粒度的 (msg, meta) 对。 |
| 4 | `.astream(input, ...)` | `AsyncIterator[dict]` | 异步流式。FastAPI 必用。 |
| 5 | `.batch(inputs, config=None, ...)` | `list[dict]` | 批量独立 run。 |
| 6 | `.get_graph(config=None)` | `Graph` | 可 `.print_ascii()` / `.draw_mermaid_png()` 画流程图。 |
| 7 | `.get_state(config)` | `StateSnapshot` | **从 checkpointer 取出某次运行的状态**。`config` 需要带 checkpointer 能识别的 `configurable.thread_id`。 |
| 8 | `.get_state_history(config, filter=None, limit=None)` | `Iterator[StateSnapshot]` | 历史状态快照列表。 |
| 9 | `.update_state(config, values: dict, as_node: str \| None = None)` | `None` | **手动修改 checkpointer 里的状态**。人类介入修正 / 外部事件注入。 |

---

## 🧊 6.2 `AgentState`（TypedDict）

```python
class AgentState(TypedDict, total=False):
    # 唯一默认「必含」字段（带 add_messages reducer）
    messages: Annotated[list[BaseMessage], add_messages]
```

### 🔵 自定义扩展方式
```python
from typing import TypedDict
from langchain.agents import AgentState

class MyState(AgentState):          # 继承，含 messages + reducer
    user_preferences: dict          # 你的字段 1
    todo: list[str]                 # 你的字段 2
    turn_counter: int               # 你的字段 3
```

### ⚠️ v1 强约束
- **必须 TypedDict，不能是 Pydantic / dataclass**。v1 之后类型检查会严格报错。
- 复杂类型（嵌套 dict / list）都支持，只要符合 TypedDict。

---
---

# Part 7：RAG 体系超详解

## 🧊 7.1 `Document` 文档对象

**模块**：`langchain_core.documents.Document`（`langchain.docstore.document` 也能导）

### 🔵 属性（就是一个 Pydantic v2 BaseModel）
| # | 属性 | 类型 | 默认 | 含义 |
|---|---|---|---|---|
| 1 | **`page_content`** | `str` | 必填 | 文档正文纯文本。RAG 里所有向量化 / 切分都是对它做。 |
| 2 | **`metadata`** | `dict[str, Any]` | `{}` | 附属信息。典型 key：`source / page / author / url / title / created_at / chunk_index`。 |
| 3 | **`id`** | `str \| None` | `None` | 可选唯一 ID。向量库 `add_documents` 有 ids 参数，如果不传一般自己生成 UUID。 |

### 🟢 Pydantic 方法
`model_dump() / model_dump_json() / model_validate(dict) / model_copy(update=...)`。都和之前 BaseMessage 里的一样。

### 💡 示例
```python
from langchain.docstore.document import Document

doc = Document(
    page_content="LangChain 是用于构建 LLM 应用的框架，集成了模型、工具、RAG 等模块。",
    metadata={"source": "tutorial.md", "page": 1, "author": "Tom"},
    id="doc-001",
)
print(doc.page_content)
print(doc.metadata["page"])
print(doc.model_dump())
```

---

## 🧊 7.2 `RecursiveCharacterTextSplitter` —— 递归字符切分器

### 🔵 构造参数
```python
def __init__(
    self,
    chunk_size: int = 4000,
    chunk_overlap: int = 200,
    length_function: Callable[[str], int] = len,
    keep_separator: bool = False,
    is_separator_regex: bool = False,
    separators: list[str] | None = None,  # 默认 ["\n\n", "\n", " ", ""]
    strip_whitespace: bool = True,
)
```

| # | 参数 | 类型 | 默认 | 含义 |
|---|---|---|---|---|
| 1 | **`chunk_size`** | `int` | 4000 | 每块的「目标」字符数（实际可能略小）。**最佳值 ≈ 你的 Embedding 模型能接受的长度 × 0.8，同时保证每块语义不被切碎**。 |
| 2 | **`chunk_overlap`** | `int` | 200 | 相邻两块的重叠字符数，避免语义被切在边界上。一般设 chunk_size 的 10%~20%。 |
| 3 | **`length_function`** | `Callable[[str], int]` | `len` | 按字符算还是按 token 算。**推荐按 token 算**：用 `tiktoken.encoding_for_model("gpt-4o").encode` 的长度。 |
| 4 | **`separators`** | `list[str]` | `["\n\n", "\n", " ", ""]` | 分隔符优先级。递归：「尽量先按最大粒度（段落）切；一块仍超长就按次一级分隔符（行）再切；... 最后没办法按单个字符切」。<br>对代码可以加 `{`, `}`, `def ` 等。 |
| 5 | `keep_separator` | `bool` | False | True：切分后把分隔符留在当前 chunk 尾部 / 下一 chunk 头部。 |
| 6 | `strip_whitespace` | `bool` | True | 去掉 chunk 首尾空白。 |

### 🟢 方法
| 方法签名 | 返回 | 作用 |
|---|---|---|
| `.split_text(text: str)` | `list[str]` | 切字符串 → 文本块。 |
| `.split_documents(docs: list[Document])` | `list[Document]` | 切 Document 列表。每个切出来的 Document 继承原 metadata，外加：<br>• `chunk_index: int`（第几块）<br>• `start_index: int`（原文本偏移量，可选） |
| `.create_documents(texts, metadatas=None)` | `list[Document]` | 文本列表 + 可选每条的 metadata → 直接切完的 Documents。 |
| `.from_huggingface_tokenizer(tokenizer_name, **kw)` | 「返回 TextSplitter 实例」 | 按 HF tokenizer 切。 |
| `.from_tiktoken_encoder(model_name="gpt-4o", **kw)` | 实例 | 按 tiktoken token 切（推荐）。 |

### 💡 示例
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 推荐：按 token 切
splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    model_name="gpt-4o",
    chunk_size=500,        # 500 tokens / 块
    chunk_overlap=50,
)

big_doc = """\
第1章 介绍
LangChain 是一个框架。它由 Harrison Chase 于 2022 年创立。
核心是把 LLM 和外部能力（搜索、数据库、工具）结合。

第2章 Runnable
Runnable 是 LangChain 一切可执行对象的统一抽象。
它定义了 invoke / ainvoke / stream / astream / batch / abatch / pipe。
这种抽象让你把「提示 → 模型 → 解析器」用 | 无缝串联。
"""

chunks = splitter.split_text(big_doc)
for i, c in enumerate(chunks):
    print(f"==== Chunk {i} ({len(c)} 字符) ====")
    print(c[:60], "...")
```

---

## 🧊 7.3 `OpenAIEmbeddings`

### 🔵 构造参数
```python
def __init__(
    self,
    model: str = "text-embedding-ada-002",
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    dimensions: int | None = None,   # 只有 v3 系列支持
    tiktoken_model_name: str | None = None,
    embedding_ctx_length: int = 8191,
    chunk_size: int = 200,           # 单次 API 调用多少条文本
    max_retries: int = 3,
    timeout: float | None = None,
    ...（http_client / organization / 其他 httpx 参数）
)
```

### 🟢 方法
| 方法签名 | 返回 | 作用 |
|---|---|---|
| `.embed_query(text: str)` | `list[float]` | **对用户查询**做 embedding。部分模型（如 bge-m3 / some OpenAI 策略）对 query 和 document 有不同 pooling 策略。**查询永远用这个方法**。 |
| `.embed_documents(texts: list[str])` | `list[list[float]]` | **对文档列表**做 embedding。内部会按 chunk_size 分批并发。 |
| `.aembed_query(text)` | `Awaitable[list[float]]` | 异步 query。 |
| `.aembed_documents(texts)` | `Awaitable[list[list[float]]]` | 异步 documents。 |

### 💡 示例：用 Cosine 相似度做查询
```python
from langchain_openai import OpenAIEmbeddings
import numpy as np

embed = OpenAIEmbeddings(model="text-embedding-3-small", dimensions=1024)   # 降维

docs = [
    "Python 是动态类型语言",
    "Java 是静态类型语言，运行在 JVM 上",
    "LangChain 用来构建 LLM 应用",
]
doc_vecs = np.array(embed.embed_documents(docs))   # (3, 1024)

q_vec = np.array(embed.embed_query("静态类型的编程语言有哪些？"))   # (1024,)

# 余弦相似度
def cos(a, b):
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

scores = [cos(v, q_vec) for v in doc_vecs]
ranked = sorted(zip(scores, docs), reverse=True)
for score, text in ranked:
    print(f"{score:.3f}  {text}")
```

---

## 🧊 7.4 向量库 `Chroma`（`langchain_chroma.Chroma`）方法速查

### 🟢 构造
```python
# 1. 新建 / 加载（磁盘持久化）
Chroma(
    collection_name: str = "langchain",
    embedding_function: Embeddings 可选（.from_documents 时传）
    persist_directory: str | None = None,    # None = 内存
    client_settings: Settings | None = None,
    collection_metadata: dict | None = None,
)
```

### 🟢 工厂方法
| 方法签名 | 返回 | 作用 |
|---|---|---|
| `Chroma.from_texts(texts, embedding, metadatas=None, ids=None, persist_directory=None, collection_metadata=None, ...)` | `Chroma` | 从文本列表直接建库。最常用。 |
| `Chroma.from_documents(documents, embedding, ids=None, persist_directory=None, ...)` | `Chroma` | 从 Document 列表建库。metadata 自动保留。 |

### 🟢 实例方法
| 方法签名 | 返回 | 作用 |
|---|---|---|
| `.add_texts(texts, metadatas=None, ids=None)` | `list[str]`（新分配的 ids） | 追加文本。 |
| `.add_documents(documents, ids=None)` | `list[str]` | 追加文档。 |
| `.add_embeddings(texts, embeddings, metadatas=None, ids=None)` | `list[str]` | 你自己已经算好 embedding 的话用这个（省一次 embedding 调用）。 |
| `.similarity_search(query: str, k: int = 4, filter=None)` | `list[Document]` | **按文本查 top-k**。 |
| `.similarity_search_with_score(query, k=4, filter=None)` | `list[tuple[Document, float]]` | 带距离分数。**Chroma 的分数是 L2 距离，越小越相似**。 |
| `.similarity_search_by_vector(embedding, k=4, filter=None)` | `list[Document]` | 直接用向量查。 |
| `.similarity_search_with_relevance_scores(query, k=4, ...)` | `list[tuple[Document, float]]` | 相似度 0~1，越大越像。 |
| `.max_marginal_relevance_search(query, k=4, fetch_k=20, lambda_mult=0.5)` | `list[Document]` | MMR 多样性搜索（既相关又不重复）。问答系统推荐用。 |
| `.delete(ids: list[str])` | `None` | 按 ID 删除。 |
| `.get(ids=None, where=None, limit=None, offset=None, include=None)` | `dict` | 原始 Chroma 查询 API。include 是 `["metadatas","documents","embeddings"]` 的子集。 |
| `.update_document(doc_id, document)` | `None` | 更新单条文档。 |
| **`.as_retriever(search_kwargs=None, search_type: str = "similarity", tags=None, ...)`** | `VectorStoreRetriever` | **转成 Retriever（Runnable[str, list[Document]]）**，这样就可以写 `{"context": retriever \| format_fn, ...}` 组合到链里。 |

### 🔵 `VectorStoreRetriever`（`.as_retriever()` 返回）的方法

它是 `BaseRetriever` 子类，核心方法就是 Runnable 的：
- `.invoke(query: str) → list[Document]`
- `.ainvoke(query) → Awaitable[list[Document]]`
- `.batch(queries) → list[list[Document]]`
- `.get_relevant_documents(query: str) → list[Document]`（等价于 invoke）

**参数**：
- `search_type: "similarity" | "mmr" | "similarity_score_threshold"`
- `search_kwargs: dict`：例如 `{"k": 5}`、`{"k":5, "fetch_k":30, "lambda_mult":0.5}`（mmr）、`{"score_threshold":0.5}`（score_threshold）

---
---

# Part 8：输出解析器

## 🧊 8.1 `StringOutputParser` —— AIMessage → 纯 str

**最简单最常用的解析器。**

### 🟢 方法
| 签名 | 返回 | 作用 |
|---|---|---|
| `.invoke(input: AIMessage \| BaseMessageChunk \| str)` | `str` | 如果输入是 Message：取 `.content`；如果是 str：原样返回。 |
| `.ainvoke(input)` | `Awaitable[str]` | 异步。 |
| `.parse(text: str)` | `str` | 就是 `text`。 |
| `.transform(input_iter, config=None)` | `Iterator[str]` | 流式处理：MessageChunk 流 → 字符串流。对 `.stream()` 很重要。 |
| `.get_format_instructions()` | `str` | 返回 `""`（无要求）。 |

---

## 🧊 8.2 `JsonOutputParser(pydantic_object=None, ...)`

### 🔵 构造参数
```python
def __init__(
    self,
    pydantic_object: type[BaseModel] | None = None,
    *,
    return_exceptions: bool = False,
)
```

### 🟢 方法
| 签名 | 返回 | 作用 |
|---|---|---|
| `.invoke(input: AIMessage \| str)` | `dict \| BaseModel` | 如果指定了 pydantic_object：**返回 Pydantic 实例**；否则返回 `dict`。能自动剥掉 ```json ... ``` Markdown 代码块。 |
| `.parse(text: str)` | `dict \| BaseModel` | 纯文本 → 对象。.invoke 内部会先取 content 再调这个。 |
| `.get_format_instructions()` | `str` | **可拼进 Prompt 的格式说明**。让模型知道该输出什么样的 JSON。 |

### 💡 示例
```python
from pydantic import BaseModel
from langchain.output_parsers import JsonOutputParser
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

class Contact(BaseModel):
    name: str
    phone: str
    email: str

parser = JsonOutputParser(pydantic_object=Contact)

prompt = ChatPromptTemplate.from_messages([
    ("system", "按要求输出 JSON。\n{fmt}"),
    ("human", "从下面这段文字提取联系人信息：\n{text}"),
])

chain = prompt | ChatOpenAI(model="gpt-4o-mini", temperature=0) | parser

out = chain.invoke({
    "fmt": parser.get_format_instructions(),
    "text": "我的名字是张三，手机 13800138000，邮箱 zhangsan@example.com。",
})
print(type(out), out.name, out.phone, out.email)
# <class 'Contact'> 张三 13800138000 zhangsan@example.com
```

---
---

# Part 9：回调体系 + 中间件（简版）

## 🧊 9.1 `BaseCallbackHandler` 钩子签名

继承它并覆盖你关心的钩子即可。所有钩子都可以重写同步 + 异步两种：

```python
from langchain.callbacks.base import BaseCallbackHandler

# 全部钩子签名
def on_llm_start(self, serialized, prompts, *, run_id, parent_run_id=None, tags=None, metadata=None, **kwargs): ...
def on_llm_end(self, response: LLMResult, *, run_id, **kwargs): ...
def on_llm_error(self, error, *, run_id, **kwargs): ...
def on_llm_new_token(self, token: str, *, chunk, run_id, **kwargs): ...   # 流式产生新 token

def on_chat_model_start(self, serialized, messages: list[list[BaseMessage]], *, run_id, parent_run_id=None, tags=None, metadata=None, **kwargs): ...
def on_chat_model_end(self, response, *, run_id, **kwargs): ...

def on_tool_start(self, serialized, input_str: str, *, run_id, parent_run_id=None, tags=None, metadata=None, **kwargs): ...
def on_tool_end(self, output: Any, *, run_id, **kwargs): ...
def on_tool_error(self, error, *, run_id, **kwargs): ...

def on_chain_start(self, serialized, inputs, *, run_id, parent_run_id=None, tags=None, metadata=None, **kwargs): ...
def on_chain_end(self, outputs, *, run_id, **kwargs): ...
def on_chain_error(self, error, *, run_id, **kwargs): ...

def on_retriever_start(self, serialized, query: str, *, run_id, parent_run_id=None, **kwargs): ...
def on_retriever_end(self, documents: list[Document], *, run_id, **kwargs): ...
def on_retriever_error(self, error, *, run_id, **kwargs): ...

def on_text(self, text: str, *, run_id, parent_run_id=None, **kwargs): ...   # 流式文本 chunk
def on_retry(self, retry_state: RetryCallState, *, run_id, **kwargs): ...
def on_custom_event(self, name: str, data: Any, *, run_id, **kwargs): ...
```

---

## 🧊 9.2 Middleware 装饰器签名（简化版）

完整版本参考 Part H，把常用的再精修一下：

```python
# 1) @wrap_model_call
@wrap_model_call
def mw(request: ModelRequest, handler: Callable[[ModelRequest], ModelResponse]) -> ModelResponse:
    # request.state         当前 AgentState（可改）
    # request.model         当前模型（可替换成另一个模型）
    # request.messages      要发给模型的消息列表（可改）
    # request.runtime.context  用户传的 context（@dynamic_prompt / context_schema 用）
    return handler(request)
# return 可以修改 resp.output、resp.state

# 2) @wrap_tool_call
@wrap_tool_call
def mw(request, handler) -> ToolMessage:
    # request.tool_call: {"id":..., "name":..., "args":...}
    try:
        return handler(request)
    except Exception as e:
        return ToolMessage(content=f"工具错误 {e}", tool_call_id=request.tool_call["id"])

# 3) @before_model
@before_model
def mw(state, runtime) -> dict | None:
    # 返回 dict：合并到 state（仅本次调模型）
    # 返回 None：不改
    ...

# 4) @dynamic_prompt
@dynamic_prompt
def mw(request: ModelRequest) -> str:
    return "你是助手。当前时间 " + datetime.now().isoformat()
```

---
---

# 附录 A：常用继承关系快查

```
【消息】
Pydantic.BaseModel
 └── BaseMessage
      ├─ HumanMessage              ← HumanMessageChunk 流式增量
      ├─ AIMessage                 ← AIMessageChunk（tool_calls / response_metadata / usage_metadata 主要在这）
      ├─ ToolMessage               ← ToolMessageChunk（必须有 tool_call_id）
      └─ SystemMessage             ← SystemMessageChunk

【Runnable】（模型/提示/工具/链/Agent 全是它）
Runnable[I,O]
 ├── BasePromptTemplate
 │    ├─ PromptTemplate（字符串）
 │    └─ ChatPromptTemplate（多消息）★最常用
 │         └─ 内部节点：MessagesPlaceholder / MessagesPromptTemplate（XxxMessagePromptTemplate）
 │
 ├── BaseLanguageModel
 │    ├─ BaseChatModel
 │    │    ├─ ChatOpenAI / ChatAnthropic / ...
 │    │    └─ ...
 │    └─ BaseLLM（字符串补全模型，旧式）
 │
 ├── BaseTool
 │    ├─ Tool（简单单参数）
 │    └─ StructuredTool（@tool 默认产物，带 Pydantic args_schema）★最常用
 │
 ├── BaseOutputParser[T]
 │    ├─ StringOutputParser              AIMessage → str  ★最多
 │    ├─ JsonOutputParser                AIMessage → dict / Pydantic
 │    └─ PydanticOutputParser / CommaSeparated...
 │
 ├── BaseRetriever
 │    ├─ VectorStoreRetriever
 │    └─ EnsembleRetriever / ...
 │
 └── 「编排」子类
      ├─ RunnableSequence                用 a|b|c 构造
      ├─ RunnableParallel / RunnableMap  {"a":..., "b":...}
      ├─ RunnableLambda[I,O]             包普通函数
      ├─ RunnablePassthrough[T]          原样透传 + assign
      ├─ RunnableBinding                 .bind(...) 产物（含 bind_tools / bind_response_format）
      ├─ RunnableRetry / RunnableWithFallbacks / RunnableEach / RunnableAssign
      └── ...

【Agent】
 └─ CompiledGraph (LangGraph)       create_agent() 返回，State: AgentState(TypedDict)
                                      方法：invoke / stream / get_state / update_state / get_graph

【RAG 周边】
Pydantic.BaseModel
 └── Document            page_content: str, metadata: dict, id: str|None
RecursiveCharacterTextSplitter   split_text / split_documents / create_documents / from_tiktoken_encoder
OpenAIEmbeddings         embed_query / embed_documents
Chroma                   from_texts / from_documents → methods: similarity_search* / as_retriever
VectorStoreRetriever     .invoke(query) → list[Document]
```
