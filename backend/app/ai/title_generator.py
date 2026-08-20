from langchain.chat_models import init_chat_model

from app.routers.messages import UserMessages

import os
from dotenv import load_dotenv

load_dotenv()

llm = init_chat_model(
    model="qwen3.7-plus",
    model_provider="openai",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
    extra_body={"enable_thinking": False},
)

tip = "以下内容是用户的提问，为提问生成一条描述/总结本次提问的标题\n"

def get_new_title(user_message:UserMessages)->str:

    if user_message.content:
        new_str = tip + user_message.content
        response=llm.invoke(new_str)
        return response.content
    elif user_message.images and user_message.files:
        return "分析文件和图片"
    elif user_message.images:
        return "分析图片内容"
    elif user_message.files:
        return "分析文件内容"

