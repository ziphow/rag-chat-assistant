from langchain.chat_models import init_chat_model

from app.Schemas.model import UserMessage

import os
from dotenv import load_dotenv

from app.ai.qwen_manager import ModelQuotaManager, is_quota_error

load_dotenv()

llm = init_chat_model(
    model="qwen3.7-plus",
    model_provider="openai",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
    extra_body={"enable_thinking": False},
)

tip = "以下内容是用户的提问，为提问生成一条精炼的描述（20个字以内）不需要输出其他任何内容！\n"


def _build_title_llm(model: str):
    return init_chat_model(
        model=model,
        model_provider="openai",
        api_key=os.getenv("DASHSCOPE_API_KEY"),
        base_url=os.getenv("DASHSCOPE_BASE_URL"),
        extra_body={"enable_thinking": False},
    )


title_manager = ModelQuotaManager(
    "TITLE_MODEL_PRIORITY",
    ["qwen3.7-plus"],
    _build_title_llm,
)


def get_new_title(user_message:UserMessage)->str:

    if user_message.content:
        new_str = tip + user_message.content
        while title_manager.remaining_count() > 0:
            try:
                return title_manager.current_llm().invoke(new_str).content
            except Exception as e:
                if is_quota_error(e):
                    title_manager.mark_current_unavailable()
                    continue
                raise
        raise RuntimeError("标题模型额度已全部用尽")
    elif user_message.images and user_message.files:
        return f"分析文件和图片"
    elif user_message.images:
        return f"分析图片内容"
    elif user_message.files:
        return f"分析文件内容"

