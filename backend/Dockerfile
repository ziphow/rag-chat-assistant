# 后端镜像：FastAPI + LangChain
FROM python:3.14-slim

# 系统依赖（chromadb/onnxruntime 等需要编译器与运行时库）
# 国内服务器直连 deb.debian.org 仅 ~14kB/s，换腾讯云镜像源
RUN sed -i 's|deb.debian.org|mirrors.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libgomp1 \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先装 Python 依赖（利用构建缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 复制后端源码（.env / data / uploads 已被 .dockerignore 排除，运行时由 compose 注入与挂载）
COPY . .

EXPOSE 8000

# 监听 0.0.0.0，供 nginx 反代与容器间通信
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]