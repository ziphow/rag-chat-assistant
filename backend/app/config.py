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


