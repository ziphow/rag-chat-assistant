from pydantic import BaseModel
from sqlmodel import Field

class Image(BaseModel):
    url: str =Field(...,description="图片url")
    name: str =Field(...,description="图片名称")
class File(BaseModel):
    fileId: str = Field(...,description="文件")
    name: str = Field(...,description="文件名称")
    size: int = Field(...,description="文件大小")
    url: str = Field(default=None,description="文件访问URL，用于后端读取文件内容")
class UserMessage(BaseModel):
    chat_id: int=Field(...,description="对话 ID")
    content: str | None =Field(default=None,description="文本消息内容（与图片/文件至少有一个）")
    images:list[Image] | None=Field(default=None,description="图片数组，每项包含 url、name")
    files: list[File] | None = Field(default=None,description="文件数组，每项包含 fileId、name、size")
    kb_id: int | None = Field(default=None,description="知识库 ID。传入时 AI 会先检索知识库相关内容再回答")