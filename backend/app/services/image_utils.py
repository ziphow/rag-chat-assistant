import base64
import mimetypes

def image_url_to_base64(url):
    """将本地图片 URL 转为 base64 data URL，供 AI 云端服务读取"""
    if not url:
        return None
    # 从 URL 提取文件路径：http://127.0.0.1:8000/uploads/xxx.png → uploads/xxx.png
    if "127.0.0.1:8000/" in url:
        file_path = url.split("127.0.0.1:8000/", 1)[1]
    elif "localhost:8000/" in url:
        file_path = url.split("localhost:8000/", 1)[1]
    else:
        return url  # 已经是外部 URL，直接返回

    with open(file_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode()

    mime_type = mimetypes.guess_type(file_path)[0] or "image/png"
    return f"data:{mime_type};base64,{encoded}"