# RAG 检索增强生成教程

> 本教程覆盖 RAG 全流程中 LangChain 常用库的核心对象、方法、属性详解。每个对象说明其作用，每个方法列出参数、返回类型和功能，每个属性说明其用途。

---

## 目录

- [1. RAG 核心原理](#1-rag-核心原理)
- [2. RAG 完整流程](#2-rag-完整流程)
- [3. Document 对象](#3-document-对象)
- [4. 文档加载器（Document Loaders）](#4-文档加载器document-loaders)
- [5. 文本分割器（Text Splitters）](#5-文本分割器text-splitters)
- [6. Embeddings 嵌入模型](#6-embeddings-嵌入模型)
- [7. VectorStore 向量存储基类](#7-vectorstore-向量存储基类)
- [8. Chroma 向量数据库](#8-chroma-向量数据库)
- [9. Retriever 检索器](#9-retriever-检索器)
- [10. 完整实战代码](#10-完整实战代码)

---

## 1. RAG 核心原理

大语言模型（LLM）存在三个固有局限：

- **知识截止日期**：训练数据有截止时间，无法回答最新信息
- **幻觉问题**：编造不存在的事实
- **私有数据盲区**：无法访问企业内部文档

RAG（Retrieval-Augmented Generation，检索增强生成）通过在生成回答前先从外部知识库检索相关文档，将这些文档作为上下文注入提示词，从而让模型基于真实数据回答问题。

与微调（Fine-tuning）相比，RAG 的优势在于：无需重新训练模型，知识库可以随时增删更新，回答可溯源到具体文档，部署成本低。

> **RAG 的本质**：用户提问 → 从知识库检索相关片段 → 将片段拼入提示词 → LLM 基于片段生成回答。整个过程分两阶段：**检索阶段**（Retrieval）负责找到信息，**生成阶段**（Generation）负责组织语言。

---

## 2. RAG 完整流程

一个完整的 RAG 系统分为两个阶段：**数据准备阶段**（离线执行一次或按需更新）和**查询阶段**（用户每次提问时执行）。

```
┌─────────────────────────────────────────────────────────┐
│                   数据准备阶段（离线）                     │
│                                                         │
│  原始文档        文档加载器       文本分割器      嵌入模型  │
│  PDF/Word/TXT → Document Loader → Text Splitter → Embed │
│                                                         │
│                                              ↓          │
│                                    向量数据库             │
│                                    Vector Store          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    查询阶段（在线）                       │
│                                                         │
│  用户提问 → 嵌入模型 → 向量化                            │
│                        ↓                                │
│              向量数据库相似度检索 → Top-K 文档片段         │
│                        ↓                                │
│              拼接到提示词（Context Injection）           │
│                        ↓                                │
│              LLM 生成回答 → 返回答案给用户               │
└─────────────────────────────────────────────────────────┘
```

### 数据准备阶段（离线）

1. **加载**：用 Document Loader 将 PDF、Word、TXT 等文件解析为统一的 Document 对象列表
2. **分块**：用 Text Splitter 将长文档切分为小块（chunk），每块通常 300-1000 字符
3. **嵌入**：用 Embeddings 模型将每个文本块转换为高维向量（如 1536 维）
4. **存储**：将向量和原始文本一起存入向量数据库（如 Chroma、FAISS）

### 查询阶段（在线）

1. **向量化**：用同一个 Embeddings 模型将用户问题转换为向量
2. **检索**：在向量数据库中做相似度搜索，找到最相关的 Top-K 个文档块
3. **拼接**：将检索到的文档块拼接到系统提示词或用户消息中
4. **生成**：LLM 基于上下文生成回答

> **关键原则**：数据准备阶段和查询阶段必须使用**同一个 Embeddings 模型**。不同模型的向量空间不同，混用会导致检索结果完全错误。

---

## 3. Document 对象

Document 是 LangChain 中表示文本数据的标准容器，贯穿 RAG 流程的每一个环节。文档加载器输出它，文本分割器操作它，向量存储器存取它。

### 对象：Document

```python
from langchain_core.documents import Document
```

**作用**：表示一段文本内容及其关联元数据的不可变数据结构。每个 Document 包含两部分：page_content（文本正文）和 metadata（附加信息）。在 RAG 中，一个文档被分块后，每个块也是一个 Document。

#### 属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `page_content` | `str` | 文档的文本正文内容。这是 RAG 流程中被向量化、被检索、最终被注入 LLM 提示词的核心数据 |
| `metadata` | `dict` | 与文档关联的元数据字典。可存储 source（来源文件路径）、page（页码）、chunk_index（分块序号）等。必须可 JSON 序列化。在检索时可用来做过滤筛选 |
| `id` | `str \| None` | 文档的唯一标识符。可选字段，用于在向量存储中更新或删除文档时定位 |
| `type` | `Literal["Document"]` | 文档类型标识，固定值 "Document"，用于 LangChain 内部序列化和反序列化 |

#### 方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `__init__` | `page_content: str`（必填）<br>`metadata: dict = {}`（可选）<br>`id: str \| None = None`（可选） | `Document` | 创建一个文档实例 |

#### 使用示例

```python
from langchain_core.documents import Document

doc = Document(
    page_content="FastAPI 是一个现代的 Python Web 框架",
    metadata={
        "source": "fastapi_tutorial.pdf",
        "page": 1,
        "chunk_index": 0
    }
)

# 访问属性
print(doc.page_content)  # "FastAPI 是一个现代的 Python Web 框架"
print(doc.metadata)      # {"source": "fastapi_tutorial.pdf", "page": 1, ...}
```

---

## 4. 文档加载器（Document Loaders）

文档加载器负责将各种格式的文件（PDF、Word、TXT、Markdown、CSV 等）解析为 Document 对象列表。所有加载器都继承自 BaseLoader，拥有统一的接口。

### 对象：BaseLoader

```python
from langchain_core.document_loaders import BaseLoader
```

**作用**：所有文档加载器的抽象基类，定义了加载文档的统一接口。实际使用时不需要直接实例化它，而是使用具体的子类（如 PyPDFLoader、TextLoader 等）。

#### 方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `load` | 无 | `list[Document]` | 一次性加载所有文档到内存。适用于小文件。对于大文件可能导致内存溢出 |
| `lazy_load` | 无 | `Iterator[Document]` | 延迟加载，返回一个迭代器，每次只产生一个 Document。适合大文件或批量处理，避免内存溢出 |
| `aload` | 无 | `list[Document]` | 异步版本的 load，在异步框架（如 FastAPI）中使用，不会阻塞事件循环 |
| `alazy_load` | 无 | `AsyncIterator[Document]` | 异步延迟加载，返回异步迭代器 |
| `load_and_split` | `text_splitter: TextSplitter`（可选） | `list[Document]` | 加载文档后立即用指定的分割器分块，等于 load() + split_documents() 的一步到位写法 |

---

### 对象：PyPDFLoader

```python
from langchain_community.document_loaders import PyPDFLoader
```

**作用**：加载 PDF 文件，每页生成一个 Document 对象。metadata 中自动包含 page 和 source 字段。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `file_path` | `str` | 是 | PDF 文件路径 |
| `password` | `str \| None` | 否 | PDF 密码（加密 PDF 用） |
| `headers` | `dict \| None` | 否 | HTTP 请求头（加载远程 PDF 时用） |
| `extract_images` | `bool` | 否 | 是否提取 PDF 中的图片，默认 False |

#### 示例

```python
from langchain_community.document_loaders import PyPDFLoader

loader = PyPDFLoader("data/tutorial.pdf")
documents = loader.load()

for doc in documents:
    print(f"第 {doc.metadata['page']} 页: {doc.page_content[:50]}...")
```

---

### 对象：TextLoader

```python
from langchain_community.document_loaders import TextLoader
```

**作用**：加载纯文本文件（.txt、.md），整个文件生成一个 Document 对象。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `file_path` | `str` | 是 | 文本文件路径 |
| `encoding` | `str \| None` | 否 | 文件编码，默认自动检测 |
| `autodetect_encoding` | `bool` | 否 | 是否自动检测编码，默认 False |

---

### 对象：Docx2txtLoader

```python
from langchain_community.document_loaders import Docx2txtLoader
```

**作用**：加载 Word 文档（.docx），提取纯文本内容。需要安装 `docx2txt` 包。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `file_path` | `str` | 是 | .docx 文件路径 |

---

### 对象：CSVLoader

```python
from langchain_community.document_loaders import CSVLoader
```

**作用**：加载 CSV 文件，每行生成一个 Document 对象。page_content 包含该行所有字段的文本表示。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `file_path` | `str` | 是 | CSV 文件路径 |
| `source_column` | `str \| None` | 否 | 指定哪一列作为 metadata 中的 source 值 |
| `csv_args` | `dict` | 否 | 传递给 csv.DictReader 的参数（如 delimiter） |
| `encoding` | `str` | 否 | 文件编码，默认 "utf-8" |

---

### 对象：DirectoryLoader

```python
from langchain_community.document_loaders import DirectoryLoader
```

**作用**：批量加载一个目录下的所有文件，自动根据文件扩展名选择对应的加载器。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `path` | `str` | 是 | 目录路径 |
| `glob` | `str` | 否 | 文件匹配模式，默认 "**/*.txt" |
| `loader_cls` | `type[BaseLoader]` | 否 | 使用的加载器类，默认 TextLoader |
| `recursive` | `bool` | 否 | 是否递归子目录，默认 False |
| `show_progress` | `bool` | 否 | 是否显示进度条，默认 True |

#### 示例

```python
from langchain_community.document_loaders import DirectoryLoader, PyPDFLoader

# 加载目录下所有 PDF
loader = DirectoryLoader(
    "data/",
    glob="**/*.pdf",
    loader_cls=PyPDFLoader,
    recursive=True,
    show_progress=True
)
documents = loader.load()
```

---

## 5. 文本分割器（Text Splitters）

LLM 的上下文窗口有限（通常 4K-128K token），整篇文档直接喂给模型不现实。文本分割器将长文档切分为小块（chunk），每块独立向量和检索。分块质量直接影响 RAG 检索效果——块太大浪费 token，块太小丢失上下文。

### 对象：RecursiveCharacterTextSplitter

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
```

**作用**：LangChain 推荐的通用文本分割器。递归尝试一组分隔符（先按段落分，段落太大再按句子分，句子太大再按词分），尽量保持语义完整性。是 RAG 场景的首选分割器。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `chunk_size` | `int` | 是 | 每个块的最大字符数。常用值 500-1000。块越大包含的信息越多但消耗更多 token，块越小检索更精确但可能丢失上下文 |
| `chunk_overlap` | `int` | 否 | 相邻块之间的重叠字符数，默认 0。设为 chunk_size 的 10%-20% 可以避免在块边界截断关键信息 |
| `separators` | `list[str]` | 否 | 分隔符列表，按优先级尝试。默认 `["\n\n", "\n", " ", ""]`，即先按段落分，再按行分，再按空格分 |
| `keep_separator` | `bool` | 否 | 是否在分块结果中保留分隔符，默认 True |
| `length_function` | `Callable` | 否 | 计算文本长度的函数，默认 len。可替换为 tokenizer 计数函数 |
| `add_start_index` | `bool` | 否 | 是否在 metadata 中添加 start_index（块在原文中的起始位置），默认 False |

#### 方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `split_text` | `text: str`（必填） | `list[str]` | 将一段文本分割为多个字符串块。不包含 metadata，纯文本操作 |
| `split_documents` | `documents: list[Document]`（必填） | `list[Document]` | 分割 Document 列表，每个 Document 被切分后生成多个新 Document，保留原 metadata 并自动追加分块信息 |
| `create_documents` | `texts: list[str]`（必填）<br>`metadatas: list[dict] \| None`（可选） | `list[Document]` | 将多个文本字符串分割并创建为 Document 对象列表，可批量附加 metadata |
| `transform_documents` | `documents: Sequence[Document]`（必填） | `list[Document]` | split_documents 的别名，实现 Runnable 接口，可链式调用 |

#### 示例

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", "。", " ", ""]
)

# 分割纯文本
chunks = splitter.split_text(long_text)

# 分割 Document 列表（RAG 常用）
split_docs = splitter.split_documents(documents)

print(f"原文档数: {len(documents)}, 分块后: {len(split_docs)}")
```

> **chunk_overlap 的作用**：假设 chunk_size=500，chunk_overlap=50。第 1 块取字符 0-500，第 2 块取字符 450-950（前 50 字符与第 1 块重叠）。这确保即使关键信息恰好被截断在块边界，也能在相邻块中完整出现。

---

### 对象：CharacterTextSplitter

```python
from langchain_text_splitters import CharacterTextSplitter
```

**作用**：简单的按单一分隔符分割的文本分割器。不如 Recursive 版本智能，不推荐用于 RAG。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `separator` | `str` | 否 | 分割用的分隔符，默认 `"\n\n"` |
| `chunk_size` | `int` | 是 | 每个块的最大字符数 |
| `chunk_overlap` | `int` | 否 | 重叠字符数，默认 0 |

> 方法与 RecursiveCharacterTextSplitter 相同：split_text、split_documents、create_documents。

---

### 对象：MarkdownHeaderTextSplitter

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter
```

**作用**：按 Markdown 标题层级（#、##、###）分割文档。每个块的 metadata 自动包含其所属的标题路径。适合结构化 Markdown 文档的 RAG。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `headers_to_split_on` | `list[tuple[str, str]]` | 是 | 指定按哪些标题级别分割，如 `[("#", "Header1"), ("##", "Header2")]` |
| `return_each_line` | `bool` | 否 | 是否每行返回一个 Document，默认 False |

#### 示例

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter

headers = [
    ("#", "H1"),
    ("##", "H2"),
    ("###", "H3"),
]
splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers)
md_docs = splitter.split_text(markdown_text)
# md_docs[0].metadata = {"H1": "FastAPI 教程", "H2": "路由定义"}
```

---

## 6. Embeddings 嵌入模型

Embeddings 模型将文本转换为高维浮点向量（如 768 维或 1536 维），使语义相近的文本在向量空间中距离也相近。这是 RAG 能够做"语义搜索"而非"关键词匹配"的核心。

### 对象：OpenAIEmbeddings

```python
from langchain_openai import OpenAIEmbeddings
```

**作用**：使用 OpenAI 兼容 API 的嵌入模型。虽然名字带 OpenAI，但可以通过 base_url 指向任何兼容 OpenAI 接口的服务（如阿里云 DashScope、本地 Ollama 等）。这是 RAG 项目中最常用的嵌入模型。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `model` | `str` | 否 | 嵌入模型名称。OpenAI 默认 "text-embedding-ada-002"，DashScope 用 "text-embedding-v3" |
| `api_key` | `str \| None` | 否 | API 密钥。也可通过环境变量 OPENAI_API_KEY 设置 |
| `base_url` | `str \| None` | 否 | API 基础地址。指向非 OpenAI 服务时必须设置，如 DashScope 的 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `dimensions` | `int \| None` | 否 | 输出向量维度。部分模型支持降维 |
| `embedding_ctx_length` | `int` | 否 | 单次嵌入的最大 token 数，默认 8191 |
| `chunk_size` | `int` | 否 | 批量嵌入时每批的文本数，默认 1000。API 限流时可调小 |

#### 方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `embed_query` | `text: str`（必填） | `list[float]` | 将单个查询文本嵌入为向量。在 RAG 查询阶段使用——把用户问题转为向量用于检索 |
| `embed_documents` | `texts: list[str]`（必填） | `list[list[float]]` | 将多个文档文本批量嵌入为向量列表。在 RAG 数据准备阶段使用——把所有文档块转为向量存入数据库 |
| `aembed_query` | `text: str`（必填） | `list[float]` | embed_query 的异步版本，在 FastAPI 等异步框架中使用 |
| `aembed_documents` | `texts: list[str]`（必填） | `list[list[float]]` | embed_documents 的异步版本 |

#### 示例

```python
from langchain_openai import OpenAIEmbeddings
import os

embeddings = OpenAIEmbeddings(
    model="text-embedding-v3",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
)

# 嵌入单个查询（查询阶段）
query_vector = embeddings.embed_query("什么是装饰器？")
print(f"向量维度: {len(query_vector)}")  # 如 1024

# 批量嵌入文档（数据准备阶段）
doc_vectors = embeddings.embed_documents([
    "Python 装饰器是一种语法糖",
    "FastAPI 基于类型提示自动生成文档",
])
```

---

### 对象：HuggingFaceEmbeddings

```python
from langchain_huggingface import HuggingFaceEmbeddings
```

**作用**：使用 HuggingFace 开源模型做本地嵌入。不需要 API 调用，完全离线运行，适合数据隐私要求高或想省 API 费用的场景。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `model_name` | `str` | 否 | HuggingFace 模型名，默认 "sentence-transformers/all-mpnet-base-v2" |
| `model_kwargs` | `dict` | 否 | 传给模型的参数，如 `{"device": "cuda"}` 指定 GPU |
| `encode_kwargs` | `dict` | 否 | 编码参数，如 `{"normalize_embeddings": True}` |

> 方法与 OpenAIEmbeddings 一致：embed_query、embed_documents 及其异步版本。

---

## 7. VectorStore 向量存储基类

VectorStore 是 LangChain 中所有向量数据库的抽象基类，定义了存储和检索向量的统一接口。无论底层是 Chroma、FAISS 还是 Pinecone，对外暴露的 API 完全一致，可以无缝切换。

### 对象：VectorStore

```python
from langchain_core.vectorstores import VectorStore
```

**作用**：向量存储抽象基类。不需要直接实例化，通过具体实现类（如 Chroma）使用。

#### 属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `embeddings` | `Embeddings` | 当前向量存储使用的嵌入模型实例。用于在检索时将查询文本转为向量 |

#### 核心方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `add_documents` | `documents: list[Document]`（必填）<br>`ids: list[str] \| None`（可选） | `list[str]` | 将 Document 列表添加到向量存储。自动对 page_content 做嵌入并连同 metadata 一起存储。返回分配的 ID 列表 |
| `add_texts` | `texts: Iterable[str]`（必填）<br>`metadatas: list[dict] \| None`（可选）<br>`ids: list[str] \| None`（可选） | `list[str]` | 将纯文本字符串列表添加到向量存储。与 add_documents 的区别：不传入 Document 对象，直接传文本和 metadata |
| `similarity_search` | `query: str`（必填）<br>`k: int = 4`（可选）<br>`filter: dict \| None`（可选） | `list[Document]` | 最常用的检索方法。将查询文本嵌入为向量，在库中找最相似的 k 个文档。filter 按 metadata 字段过滤 |
| `similarity_search_with_score` | `query: str`（必填）<br>`k: int = 4`（可选）<br>`filter: dict \| None`（可选） | `list[tuple[Document, float]]` | 检索并返回相似度分数。分数含义取决于具体实现：Chroma 返回距离（越小越相似），FAISS 返回 L2 距离 |
| `similarity_search_by_vector` | `embedding: list[float]`（必填）<br>`k: int = 4`（可选） | `list[Document]` | 直接用向量做检索，跳过嵌入步骤。当你已经用 embed_query 得到向量时可用 |
| `max_marginal_relevance_search` | `query: str`（必填）<br>`k: int = 4`（可选）<br>`fetch_k: int = 20`（可选）<br>`lambda_mult: float = 0.5`（可选） | `list[Document]` | MMR 检索：先取 fetch_k 个候选，再从中选 k 个兼顾相似度和多样性的结果。避免返回内容高度重复的文档块 |
| `delete` | `ids: list[str] \| None`（可选） | `bool \| None` | 按 ID 删除向量记录。不传 ids 则删除全部 |
| `get_by_ids` | `ids: Sequence[str]`（必填） | `list[Document]` | 按 ID 查询文档 |
| `as_retriever` | `search_type: str`（可选）<br>`search_kwargs: dict`（可选） | `VectorStoreRetriever` | 将向量存储包装为检索器对象。search_type 可选 "similarity"（默认）、"mmr" 或 "similarity_score_threshold" |

#### 异步方法

| 方法 | 说明 |
|------|------|
| `aadd_documents` | 异步版 add_documents |
| `aadd_texts` | 异步版 add_texts |
| `asimilarity_search` | 异步版 similarity_search |
| `asimilarity_search_with_score` | 异步版 similarity_search_with_score |
| `adelete` | 异步版 delete |
| `aget_by_ids` | 异步版 get_by_ids |

---

## 8. Chroma 向量数据库

Chroma 是 RAG 项目中最常用的轻量级向量数据库。无需独立部署服务，数据持久化到本地磁盘，API 简洁直观。适合学习阶段和小型项目。

### 对象：Chroma

```python
from langchain_chroma import Chroma
```

**作用**：基于 ChromaDB 的 LangChain 向量存储实现。数据自动持久化到磁盘，支持按 collection 分组管理多个知识库。继承 VectorStore 的所有方法。

#### 构造参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `collection_name` | `str` | 否 | 集合名称，默认 "langchain"。每个知识库用一个独立的 collection 名，如 "kb_1" |
| `embedding_function` | `Embeddings` | 否 | 嵌入模型实例。添加和检索时都会使用。强烈建议显式传入 |
| `persist_directory` | `str \| None` | 否 | 数据持久化目录。如 "data/chroma_db"。不设则仅存内存，程序退出后丢失 |
| `client` | `ClientAPI \| None` | 否 | 自定义 Chroma 客户端。连接 Chroma 服务器时使用 |
| `client_settings` | `Settings \| None` | 否 | Chroma 客户端配置（如内存限制、超时等） |
| `host` | `str \| None` | 否 | Chroma 服务器主机名。连接远程 Chroma 服务时使用 |
| `port` | `int \| None` | 否 | Chroma 服务器端口，默认 8000 |
| `collection_metadata` | `dict \| None` | 否 | 集合级别的元数据配置 |
| `relevance_score_fn` | `Callable \| None` | 否 | 自定义相关性分数计算函数 |
| `create_collection_if_not_exists` | `bool` | 否 | 集合不存在时是否自动创建，默认 True |

#### Chroma 特有方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `delete_collection` | 无 | `None` | 删除当前集合及其所有数据。在删除整个知识库时使用 |
| `reset_collection` | 无 | `None` | 清空集合中的所有数据但保留集合本身 |
| `get` | `ids: list[str] \| None`（可选）<br>`where: dict \| None`（可选）<br>`limit: int \| None`（可选）<br>`offset: int \| None`（可选） | `dict` | 直接查询存储中的原始数据。where 按 metadata 过滤，limit/offset 分页。返回包含 ids、documents、metadatas 的字典 |
| `update_document` | `document_id: str`（必填）<br>`document: Document`（必填） | `None` | 更新单个文档的内容和 metadata，自动重新计算嵌入向量 |
| `update_documents` | `ids: list[str]`（必填）<br>`documents: list[Document]`（必填） | `None` | 批量更新文档 |
| `fork` | `new_name: str`（必填） | `Chroma` | 复制当前集合为新的集合 |
| `similarity_search_by_image` | `uri: str`（必填）<br>`k: int = 4`（可选） | `list[Document]` | 以图搜文。用图片的向量做相似度检索 |

#### 类方法（工厂方法）

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `from_documents` | `documents: list[Document]`（必填）<br>`embedding: Embeddings`（必填）<br>`ids: list[str] \| None`（可选）<br>`**kwargs`（可选） | `Chroma` | 一步创建 Chroma 实例并添加文档。最常用的初始化方式 |
| `from_texts` | `texts: list[str]`（必填）<br>`embedding: Embeddings`（必填）<br>`metadatas: list[dict] \| None`（可选）<br>`ids: list[str] \| None`（可选）<br>`**kwargs`（可选） | `Chroma` | 用纯文本列表创建 Chroma 实例 |

#### 示例

```python
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(
    model="text-embedding-v3",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
)

# 方式1：from_documents 一步到位（数据准备阶段常用）
vectorstore = Chroma.from_documents(
    documents=split_docs,
    embedding=embeddings,
    collection_name="kb_1",
    persist_directory="data/chroma_db",
)

# 方式2：先创建空库，再添加文档
vectorstore = Chroma(
    collection_name="kb_1",
    embedding_function=embeddings,
    persist_directory="data/chroma_db",
)
vectorstore.add_documents(split_docs)

# 检索（查询阶段）
results = vectorstore.similarity_search(
    query="什么是装饰器？",
    k=3,
    filter={"source": "python_tutorial.pdf"}  # 按 metadata 过滤
)
for doc in results:
    print(doc.page_content[:80])

# 带分数检索
results_with_score = vectorstore.similarity_search_with_score(
    query="什么是装饰器？", k=3
)
for doc, score in results_with_score:
    print(f"距离={score:.4f} | {doc.page_content[:50]}")

# 删除整个知识库
vectorstore.delete_collection()
```

> **Chroma 分数的含义**：Chroma 的 `similarity_search_with_score` 返回的是**距离值**（distance），**越小越相似**。这与某些数据库返回相似度分数（越大越相似）相反。判断阈值时注意方向。

---

### 对象：FAISS

```python
from langchain_community.vectorstores import FAISS
```

**作用**：Facebook 开源的高效相似度搜索库。纯内存运行，检索速度极快，但不自带持久化——需要手动调用 save_local / load_local 保存和加载。适合超大规模向量数据（百万级以上）。

> FAISS 的核心方法与 Chroma 一致（similarity_search、add_documents 等），但有两个特有方法：

#### 特有方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `save_local` | `folder_path: str`（必填）<br>`index_name: str = "index"`（可选） | `None` | 将向量索引和元数据保存到本地文件夹 |
| `load_local` | `folder_path: str`（必填）<br>`embeddings: Embeddings`（必填）<br>`index_name: str = "index"`（可选） | `FAISS` | 从本地文件夹加载向量索引 |

---

## 9. Retriever 检索器

Retriever 是 VectorStore 的上层封装，提供更简洁的检索接口。它的核心优势是作为 LangChain Runnable，可以链式组合到 LCEL（LangChain Expression Language）流水线中，也可以作为 Agent 的工具使用。

### 对象：VectorStoreRetriever

```python
from langchain_core.vectorstores import VectorStoreRetriever
```

**作用**：通过 `VectorStore.as_retriever()` 创建的检索器对象。不需要手动实例化。封装了向量存储的检索逻辑，对外暴露统一的 Runnable 接口。

#### 属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `vectorstore` | `VectorStore` | 底层关联的向量存储实例 |
| `search_type` | `str` | 检索策略："similarity"（相似度）、"mmr"（最大边际相关性）、"similarity_score_threshold"（带分数阈值） |
| `search_kwargs` | `dict` | 检索参数字典，如 `{"k": 4, "fetch_k": 20, "lambda_mult": 0.5}` |

#### 方法

| 方法 | 参数 | 返回类型 | 说明 |
|------|------|----------|------|
| `invoke` | `input: str`（必填） | `list[Document]` | 同步检索。传入查询文本，返回相关文档列表。这是 Runnable 接口的标准方法 |
| `ainvoke` | `input: str`（必填） | `list[Document]` | 异步检索。在 FastAPI 异步端点中使用 |
| `get_relevant_documents` | `query: str`（必填） | `list[Document]` | invoke 的旧版方法名，功能相同。已废弃，推荐用 invoke |

#### search_type 详解

| 搜索类型 | search_kwargs | 说明 |
|----------|---------------|------|
| `similarity` | `k: int = 4` | 纯相似度搜索。返回与查询最相似的 k 个文档。最常用、最快的检索方式 |
| `mmr` | `k: int = 4`<br>`fetch_k: int = 20`<br>`lambda_mult: float = 0.5` | 最大边际相关性搜索。先取 fetch_k 个候选，再从中选 k 个兼顾相似度和多样性。lambda_mult=1 纯相似度，=0 纯多样性。适合避免返回重复内容 |
| `similarity_score_threshold` | `k: int = 4`<br>`score_threshold: float` | 带分数阈值的相似度搜索。只返回相似度分数超过阈值的结果 |

#### 示例

```python
# 创建检索器
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 3,              # 返回 3 个文档
        "fetch_k": 20,       # 先取 20 个候选
        "lambda_mult": 0.5,  # 相似度和多样性各占一半
    }
)

# 同步检索
docs = retriever.invoke("如何使用 FastAPI 创建路由？")

# 异步检索（FastAPI 中使用）
docs = await retriever.ainvoke("如何使用 FastAPI 创建路由？")

for doc in docs:
    print(f"[{doc.metadata['source']}] {doc.page_content[:80]}")
```

> **VectorStore vs Retriever 怎么选**：如果只是简单检索，直接用 `vectorstore.similarity_search(query, k=3)` 就够了。如果需要接入 LangChain 链式流水线（如 RetrievalQA）、或需要使用 MMR 等高级检索策略、或需要作为 Agent 工具，就先 `as_retriever()` 再用。

---

## 10. 完整实战代码

以下是一个完整的 RAG 实现，可以直接集成到你的 FastAPI 项目中。包含数据准备和查询两个阶段，覆盖本教程介绍的所有核心对象。

### 安装依赖

```bash
# RAG 相关依赖
pip install chromadb langchain-chroma
pip install pypdf python-docx docx2txt
pip install langchain-text-splitters langchain-openai
```

### 向量存储管理（vector_store.py）

```python
import os
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

# 嵌入模型（全局单例）
embeddings = OpenAIEmbeddings(
    model="text-embedding-v3",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
)

def get_vectorstore(kb_id: int) -> Chroma:
    """获取指定知识库的向量存储实例"""
    return Chroma(
        collection_name=f"kb_{kb_id}",
        embedding_function=embeddings,
        persist_directory="data/chroma_db",
    )
```

### 文档加载与处理（document_loader.py）

```python
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_and_split(file_path: str) -> list:
    """加载文档并分块，返回 Document 列表"""
    # 1. 根据扩展名选择加载器
    ext = file_path.rsplit('.', 1)[-1].lower()
    if ext == 'pdf':
        loader = PyPDFLoader(file_path)
    elif ext == 'docx':
        loader = Docx2txtLoader(file_path)
    else:
        loader = TextLoader(file_path)

    # 2. 加载文档
    documents = loader.load()

    # 3. 分块
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", "。", "！", "？", " ", ""],
    )
    return splitter.split_documents(documents)
```

### 检索函数（rag.py）

```python
from app.ai.vector_store import get_vectorstore

def retrieve_relevant_docs(kb_id: int, query: str, k: int = 3) -> list[str]:
    """检索与用户问题最相关的文档片段，返回纯文本列表"""
    vectorstore = get_vectorstore(kb_id)
    results = vectorstore.similarity_search(query=query, k=k)
    return [doc.page_content for doc in results]
```

### 在消息发送接口中集成 RAG

```python
# messages.py 中的 send_messages 函数
if message.kb_id:
    # 1. 检索相关文档片段
    from app.ai.rag import retrieve_relevant_docs
    relevant_chunks = retrieve_relevant_docs(message.kb_id, message.content)

    # 2. 将检索结果拼接到用户消息中
    context = "\n\n".join(relevant_chunks)
    enhanced_content = f"""请基于以下知识库内容回答用户问题。
如果知识库中没有相关信息，请说明并尝试用自身知识回答。

---知识库内容---
{context}
---知识库内容结束---

用户问题：{message.content}"""
    # 用 enhanced_content 替代 message.content 传给 AI
```

### 上传文档到知识库的接口

```python
from fastapi import UploadFile
from app.ai.document_loader import load_and_split
from app.ai.vector_store import get_vectorstore

@router.post("/knowledge-bases/{kb_id}/documents")
async def upload_document(kb_id: int, file: UploadFile,
                          current_user=Depends(get_current_user)):
    # 1. 保存文件到磁盘
    save_path = f"uploads/kb_{kb_id}_{file.filename}"
    with open(save_path, "wb") as f:
        f.write(await file.read())

    # 2. 加载并分块
    chunks = load_and_split(save_path)

    # 3. 存入向量数据库
    vectorstore = get_vectorstore(kb_id)
    vectorstore.add_documents(chunks)

    return {"code": 200, "message": "上传成功"}
```

---

> **学习路径建议**：先跑通 Document + TextSplitter（不接数据库，打印分块结果感受效果）→ 接入 Embeddings（看向量长什么样）→ 接入 Chroma（完成数据准备阶段）→ 实现 similarity_search（完成检索）→ 集成到消息接口（完成完整 RAG 链路）。每一步验证通过后再做下一步。
