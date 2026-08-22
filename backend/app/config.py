import os
from dotenv import load_dotenv

load_dotenv()

ALGORITHM = "HS256"

"""集中管理所有配置"""
#deepseek API
DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "localhost")

#阿里云千问 API
DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY")
DASHSCOPE_BASE_URL: str = os.getenv("DASHSCOPE_BASE_URL")

#Tavily API(网页搜索)
TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY")

#MySQL数据库
DATABASE_URL: str = os.getenv("DATABASE_URL")

# JWT 密钥：
SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production")
# Token 有效期（分钟），默认 1440 = 24 小时
ACCESS_TOKEN_EXPIRE_MINUTES:int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# 模型优先级列表（逗号分隔）：额度用尽自动切换到下一个
LLM_MODEL_PRIORITY: str = os.getenv("LLM_MODEL_PRIORITY", "qwen3.7-plus")
TITLE_MODEL_PRIORITY: str = os.getenv("TITLE_MODEL_PRIORITY", "qwen3.7-plus")
EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "qwen3.7-text-embedding")


