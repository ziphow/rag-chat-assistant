# 前端镜像：纯静态文件交给 nginx 托管
FROM nginx:1.27-alpine

# nginx 配置（含后端 API 反代）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 前端静态资源
WORKDIR /usr/share/nginx/html
COPY index.html styles.css app.js ./
COPY assets ./assets
COPY js ./js