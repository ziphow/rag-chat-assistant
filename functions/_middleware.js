/**
 * Cloudflare Pages Functions 中间件（同源反向代理）
 *
 * 位置说明：Cloudflare Pages 的 Functions 目录必须位于「项目根目录」的
 * functions/ 下，而不是构建输出目录内。故本文件放在仓库根 /functions/，
 * 静态资产仍由 Cloudflare Pages 的「构建输出目录 = frontend」托管。
 *
 * 作用：
 *   - 前端部署到 Cloudflare Pages 后没有 nginx 反代，这里在 CF 的 Worker 里
 *     把 API 前缀请求在「服务器端」转发到腾讯云后端，从而保持前端 baseURL 为
 *     相对路径（同源），后端无需配 HTTPS、前端无 CORS / mixed-content 问题。
 *   - 非 API 前缀（静态资源 index.html / js / css / assets 等）放行给
 *     Pages 内置静态托管（context.next()），保持缓存与 CDN 加速。
 *
 * 后端地址通过 Cloudflare Pages 的「环境变量」配置（键名 BACKEND_URL），
 * 例：BACKEND_URL=http://106.55.63.47:80
 */

// 与 backend/frontend nginx.conf 中的反代正则保持一致
const API_PATTERN = /^\/(auth|chats|message|files|knowledge-bases|uploads)(\/|$)/;

export const onRequest = async (context) => {
  const url = new URL(context.request.url);

  if (!API_PATTERN.test(url.pathname)) {
    return context.next(); // 静态资源交给 Pages 处理
  }

  const backendUrl = (context.env && context.env.BACKEND_URL) || 'http://127.0.0.1:8000';
  if (backendUrl === 'http://127.0.0.1:8000') {
    return new Response('BACKEND_URL 未配置，请在 Cloudflare Pages 环境变量中设置后端地址', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // 复制原始请求（保留 method / headers / body 流，兼容上传与 SSE），仅改后端地址
  const upstream = new Request(backendUrl + url.pathname + url.search, context.request);
  upstream.headers.delete('host');
  upstream.headers.set('x-forwarded-host', url.host);
  upstream.headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

  const resp = await fetch(upstream);

  // 透传响应体流与全部响应头（含 SSE 流式 / 图片 / 附件）
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
};