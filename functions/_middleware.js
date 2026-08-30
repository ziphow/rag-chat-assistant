/**
 * Cloudflare Pages Functions 中间件（同源反向代理）
 *
 * 作用：把页面 /api 前缀请求在 Cloudflare Worker「服务器端」转发到后端，
 * 保持前端 baseURL 为相对路径（同源），避免前端 CORS / mixed-content 问题。
 * 非 API 前缀（index.html / js / css / assets 等）放行给 Pages 静态托管。
 *
 * BACKEND_URL 通过 Cloudflare Pages 环境变量配置。
 *
 * 注意：后端在腾讯云，且服务器只有一个未备案的公网 IP，可用后端入口受限：
 *   - 用 sslip.io 等域名 → 会被腾讯云按 Host 拦截 302 到 dnspod.qcloud.com（webblock），
 *     且与端口无关（80/8080 都一样被拦）。
 *   - 用裸 IP（如 http://106.55.63.47:8080）→ 服务器侧能通，是当前唯一可用的 Host。
 *
 * 故 BACKEND_URL 用裸 IP + 非标准端口（服务器 nginx 在 8080 反代后端），例如：
 *   BACKEND_URL=http://106.55.63.47:8080
 */

// 与 backend/frontend nginx.conf 中的反代正则保持一致
const API_PATTERN = /^\/(auth|chats|message|files|knowledge-bases|uploads)(\/|$)/;

function textResp(body, status) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export const onRequest = async (context) => {
  const url = new URL(context.request.url);

  // 诊断探针：GET /__status 无需登录即可查看当前中间件版本与后端配置
  // 用于确认线上部署的 Worker 是否为最新构建（用户遇到 1101 时先看这里）
  if (url.pathname === '/__status') {
    const backendUrl = (context.env && context.env.BACKEND_URL) || '(unset)';
    return textResp(
      'middleware_version=04e8ed3-probe\n' +
      'BACKEND_URL=' + backendUrl + '\n' +
      '时间=' + new Date().toISOString(),
      200
    );
  }

  if (!API_PATTERN.test(url.pathname)) {
    return context.next(); // 静态资源交给 Pages 处理
  }

  let backendUrl = (context.env && context.env.BACKEND_URL) || '';
  if (!backendUrl) {
    return textResp('BACKEND_URL 未配置，请在 Cloudflare Pages 环境变量中设置后端地址', 500);
  }
  if (backendUrl === 'http://127.0.0.1:8000') {
    return textResp('BACKEND_URL 仍是默认占位值，请换成真实后端地址（例：http://106.55.63.47:8080）', 500);
  }
  // 容错：漏写 http:// 时自动补全
  if (!/^https?:\/\//i.test(backendUrl)) {
    backendUrl = 'http://' + backendUrl;
  }

  // 复制原始请求（保留 method / headers / body 流，兼容上传与 SSE），仅改后端地址
  // 整段放进 try：URL 拼错 / 域名解析失败 / 连接失败都会给出可读报错，而不抛 1101
  let resp;
  let upstream;
  try {
    upstream = new Request(backendUrl + url.pathname + url.search, context.request);
    upstream.headers.delete('host');
    upstream.headers.set('x-forwarded-host', url.host);
    upstream.headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

    // redirect:'manual'：不自动跟随后端 302，以免跟随到腾讯云拦截页(webblock)污染响应
    resp = await fetch(upstream, { redirect: 'manual' });
  } catch (e) {
    const reason = (e && e.message) ? e.message : String(e);
    return textResp(`后端请求失败。目标=${backendUrl}${url.pathname}。详情: ${reason}`, 502);
  }

  // 若后端返回 3xx 重定向（如腾讯云 webblock），转成明确报错而非透传
  if (resp.status >= 300 && resp.status < 400) {
    return textResp(`后端返回 ${resp.status} 重定向（目标可能被拦截）: ${resp.headers.get('location') || '未知'}`, 502);
  }

  // 透传响应体流与全部响应头（含 SSE 流式 / 图片 / 附件）
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
};