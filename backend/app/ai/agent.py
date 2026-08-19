from langchain.tools import tool
from langchain_tavily import TavilySearch
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain.chat_models import init_chat_model

import aiosqlite
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

import datetime

import os
from dotenv import load_dotenv

load_dotenv()

# ----------------------------定义智能体的系统提示词---------------------------
AGENT_SYSTEM_PROMPT="""
你是一个智能AI助手，模型使用qwen3.7-plus。
你的职责是与用户进行自然、友好的对话，并提供准确、有帮助的回答。

## 行为准则
- 必须用中文回答，除非用户明确要求其他的回答语言
- 回答简洁明了，避免冗长废话
- 使用 Markdown 格式组织内容（标题、列表、代码块、表格等），使输出结构清晰
- 不确定的信息要明确说明，不要编造事实
- 可以使用提供的工具（网页搜索、时间查询）来获取实时信息
- 回答的内容最好要有信息来源/参考资料，可以以链接或其他方式给出
- 回答结束后必须给出若干提问建议

## 工具使用
- 当用户询问实时信息、新闻、天气等需要联网的内容时，调用网页搜索工具
- 当用户询问当前时间时，调用时间查询工具
- 不需要工具时直接回答，不要过度调用工具

## 图片理解
- 用户可能发送图片，你需要理解图片内容并给出有价值的分析或描述
- 如果图片不清晰或无法理解，如实告知用户

## 对话记忆
- 你会接收到对话的摘要历史，请基于历史上下文保持对话连贯性
- 记住用户在对话中提到的偏好、背景和需求
"""
# ----------------------------定义智能体的系统摘要提示词---------------------------
SUMMARY_SYSTEM_PROMPT="""
你是一个对话摘要专家。模型使用qwen3.7-max。
你的任务是将多轮对话历史压缩为简洁的摘要，供AI助手在后续对话中保持上下文记忆。

## 摘要要求
- 用中文输出
- 控制在300字以内
- 保留关键信息：用户的问题、AI的回答要点、用户透露的偏好或背景
- 保留未解决的问题或用户明确要求记住的事项
- 丢弃寒暄、重复内容和无意义的闲聊
- 如果对话中涉及图片或文件，简要提及文件主题即可

## 输出格式
直接输出摘要文本，不要添加"摘要："等前缀，不要输出任何额外说明。

"""
# ----------------------------定义智能体的中间件（动态提示词）---------------------------
from langchain.agents.middleware import dynamic_prompt, ModelRequest
from dataclasses import dataclass

@dataclass
class AgentContext:
    temp_instruction: str | None = None

@dynamic_prompt
def dynamic_system_prompt(request: ModelRequest) -> str:
    """在已有系统提示词基础上，动态追加临时指令"""
    base = AGENT_SYSTEM_PROMPT  # 原来的系统提示词

    # 从 runtime context 获取临时指令
    if request.runtime and request.runtime.context:
        temp = request.runtime.context.temp_instruction
        if temp:
            return f"{base}\n\n[临时指令：]\n{temp}"
    return base

# -----------------------------定义智能体的工具-----------------------------
@tool
def get_time()->str:
    """
    参数：无
    这是一个用于进行查询当前时间的工具
    """
    return datetime.datetime.now().strftime("当前的时间是：%Y-%m-%d %H:%M:%S")

# 网页搜索工具
web_search = TavilySearch(
    max_retries=5,
    topic="general"
)
# -----------------------------定义智能体的模型(大脑)-----------------------------
llm = init_chat_model(
    model="qwen3.7-plus",
    model_provider="openai",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
    extra_body={"enable_thinking":True},
)
# --------------------------定义智能体的记忆管理策略---------------------------
# 定义用来做摘要的模型
middleware_llm = init_chat_model(
    model="qwen3.7-max",
    model_provider="openai",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
    extra_body={"enable_thinking":False},
)
middleware=SummarizationMiddleware(
    middleware_llm,
    prompt=SUMMARY_SYSTEM_PROMPT,
    trigger=("messages", 50),#消息达到 10 条就进行摘要
    keep=("messages", 20),    #保留5条消息
)

# -------------------------------创建智能体---------------------------------
_agent = None

async def get_agent():
    global _agent
    if _agent is not None:
        return _agent
    # ---定义智能体的记忆管理（数据库）
    # 基于sqlite轻量级数据库实现的记忆管理策略
    connection = aiosqlite.connect("data/checkpoint/checkpoint.db")
    checkpointer=AsyncSqliteSaver(connection)
    await checkpointer.setup()

    _agent  = create_agent(
        llm,
        tools=[get_time,web_search],
        checkpointer=checkpointer,
        middleware=[middleware,dynamic_system_prompt],
        context_schema=AgentContext,
        #response_format=AnswerInfo, # 结构化输出
    )
    return _agent
