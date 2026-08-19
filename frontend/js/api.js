/**
 * api.js — API 请求层
 *
 * 职责：
 *   - 封装通用 fetch 请求（自动携带 Token、统一错误处理）
 *   - 文件上传
 *   - 所有后端接口的调用入口
 */

// ==================== 通用请求封装 ====================

/**
 * 封装 fetch 请求
 * @param {string} url - 请求路径（如 /chats）
 * @param {object} options - 请求配置 {method, body, headers}
 * @returns {Promise<object>} 响应 JSON
 */
async function request(url, options = {}) {
    const token = getToken();

    // FormData / URLSearchParams 用表单格式，其余用 JSON
    const isFormData = options.body instanceof FormData || options.body instanceof URLSearchParams;

    const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_CONFIG.baseURL}${url}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    // 401 处理：区分认证接口和非认证接口
    if (response.status === 401) {
        const isAuthEndpoint = url.startsWith('/auth/login') || url.startsWith('/auth/register');
        if (!isAuthEndpoint) {
            clearToken();
            showLoginPage();
            throw new Error('登录已过期，请重新登录');
        }
    }

    if (!response.ok) {
        // 兼容 FastAPI 错误格式：detail 可能是字符串或验证错误数组
        let errorMsg = data.message;
        if (!errorMsg && data.detail) {
            if (typeof data.detail === 'string') {
                errorMsg = data.detail;
            } else if (Array.isArray(data.detail)) {
                errorMsg = data.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
            }
        }
        throw new Error(errorMsg || `请求失败 (${response.status})`);
    }

    return data;
}

// ==================== 文件上传 ====================

/**
 * 上传文件到后端（FormData 格式）
 * @param {File} file - 浏览器 File 对象
 * @returns {Promise<object>} 后端返回 {fileUrl, fileId, fileName, fileSize}
 */
async function uploadFile(file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_CONFIG.baseURL}/files/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || '文件上传失败');
    }

    return data;
}
