/**
 * AI 智能助手 - 前端应用逻辑
 * 包含：登录注册、聊天交互、文件上传、历史记录管理
 *
 * 注意：当前为纯前端 Mock 模式，所有 API 调用均模拟返回
 * 接入后端时，将 mock 函数替换为真实 fetch 请求即可
 */

// ==================== 全局状态 ====================
const state = {
    currentUser: null,
    chats: [],
    currentChatId: null,
    selectedFiles: [],
    isWaitingResponse: false,
    knowledgeBases: [],
    currentKbId: null,
    currentDetailKbId: null,
};

// ==================== API 配置 ====================
const API_CONFIG = {
    baseURL: 'http://127.0.0.1:8000',           // 后端 API 基础地址，按需修改
    tokenKey: 'ai_chat_token', // localStorage 中存储 token 的 key
};

/**
 * 获取存储的 token
 */
function getToken() {
    return localStorage.getItem(API_CONFIG.tokenKey);
}

/**
 * 设置 token
 */
function setToken(token) {
    localStorage.setItem(API_CONFIG.tokenKey, token);
}

/**
 * 清除 token
 */
function clearToken() {
    localStorage.removeItem(API_CONFIG.tokenKey);
}

// ==================== 通用请求封装 ====================
/**
 * 封装 fetch 请求（接入后端时使用）
 * @param {string} url - 请求地址
 * @param {object} options - 请求配置
 * @returns {Promise<object>} 响应数据
 */
async function request(url, options = {}) {
    const token = getToken();

    // 判断 body 类型：FormData / URLSearchParams 用表单格式，其余用 JSON
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

    if (response.status === 401) {
        // 登录/注册接口的 401 是认证失败（密码错误/账号不存在），不是 token 过期
        const isAuthEndpoint = url.startsWith('/auth/login') || url.startsWith('/auth/register');
        if (!isAuthEndpoint) {
            clearToken();
            showLoginPage();
            throw new Error('登录已过期，请重新登录');
        }
        // 认证接口的 401 继续往下走，显示后端返回的具体错误信息
    }

    if (!response.ok) {
        // 兼容 FastAPI 的错误格式：detail 可能是字符串或验证错误数组
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

/**
 * 上传文件请求（FormData 格式）
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

// ==================== Mock API（开发阶段模拟） ====================
// 以下函数模拟后端响应，接入真实后端后删除这些函数
// 并使用上方的 request() 发送真实请求

function mockDelay(ms = 500) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function mockLogin(username, password) {
    return mockDelay(600).then(() => ({
        code: 200,
        message: '登录成功',
        data: {
            token: 'mock_token_' + Date.now(),
            user: {
                id: 1,
                username: username,
                email: username.includes('@') ? username : username + '@example.com',
                avatar: null,
            }
        }
    }));
}

function mockRegister(username, email, password) {
    return mockDelay(600).then(() => ({
        code: 200,
        message: '注册成功',
        data: {
            token: 'mock_token_' + Date.now(),
            user: {
                id: Date.now(),
                username: username,
                email: email,
                avatar: null,
            }
        }
    }));
}

function mockChatResponse(userMessage) {
    const responses = [
        `收到你的消息："${userMessage}"。这是一个模拟回复，接入后端后，AI 会根据你的消息生成智能回复。`,
        `这是一个示例回复。当你接入真实的 AI 后端后，这里会显示 AI 生成的回答。\n\n你可以尝试：\n- 上传图片让我分析\n- 上传文件让我解读\n- 进行多轮对话`,
        `好的，我理解了你的问题。这是一个 Mock 响应。\n\n\`\`\`python\n# 示例代码\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("World"))\n\`\`\``,
        `我是 AI 助手，目前运行在前端 Mock 模式下。接入后端 API 后，我就能真正理解你的问题并给出智能回复了。`,
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    return mockDelay(1000 + Math.random() * 1000).then(() => ({
        code: 200,
        message: '成功',
        data: {
            content: response,
            messageId: Date.now(),
        }
    }));
}

function mockFileUpload(file) {
    return mockDelay(800).then(() => ({
        code: 200,
        message: '上传成功',
        data: {
            fileId: 'file_' + Date.now(),
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        }
    }));
}

// ==================== 登录/注册逻辑 ====================

/**
 * 切换登录/注册表单
 */
function switchAuth(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (type === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
    } else {
        registerForm.style.display = 'none';
        loginForm.style.display = 'flex';
    }
}

/**
 * 切换密码可见性
 */
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.style.color = 'var(--primary)';
    } else {
        input.type = 'password';
        btn.style.color = 'var(--text-muted)';
    }
}

/**
 * 显示登录页面
 */
function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('chat-app').style.display = 'none';
}

/**
 * 显示聊天页面
 */
function showChatPage() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('chat-app').style.display = 'flex';
}

/**
 * 处理登录表单提交
 */
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        showToast('请填写用户名和密码', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('.btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '登录中...';
    submitBtn.disabled = true;

    try {
        // ===== 接入后端时替换为 =====
        const res = await request('/auth/login', {
            method: 'POST',
            body: new URLSearchParams({ username, password })
        });
        // const res = await mockLogin(username, password);

        setToken(res.data.token);
        state.currentUser = res.data.user;

        updateUserInfo();
        showChatPage();
        showToast('登录成功', 'success');

        // 加载聊天历史和知识库
        loadChatHistory();
        loadKnowledgeBases();
    } catch (err) {
        showToast(err.message || '登录失败', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

/**
 * 处理注册表单提交
 */
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const confirmPassword = document.getElementById('reg-password-confirm').value.trim();

    if (!username || !email || !password) {
        showToast('请填写所有字段', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('密码至少需要6位', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('.btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '注册中...';
    submitBtn.disabled = true;

    try {
        // ===== 接入后端时替换为 =====
        const res = await request('/auth/register', {
            method: 'POST',
            body: new URLSearchParams({ username, email, password })
        });
        // const res = await mockRegister(username, email, password);

        setToken(res.data.token);
        state.currentUser = res.data.user;

        updateUserInfo();
        showChatPage();
        showToast('注册成功，欢迎使用！', 'success');
    } catch (err) {
        showToast(err.message || '注册失败', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

/**
 * 退出登录
 */
function logout() {
    clearToken();
    state.currentUser = null;
    state.chats = [];
    state.currentChatId = null;
    showLoginPage();
    showToast('已退出登录', 'info');
}

/**
 * 更新用户信息显示
 */
function updateUserInfo() {
    if (state.currentUser) {
        document.getElementById('user-name').textContent = state.currentUser.username;
        document.getElementById('user-avatar').textContent =
            state.currentUser.username.charAt(0).toUpperCase();
    }
}

// ==================== 聊天历史管理 ====================

/**
 * 加载聊天历史列表
 * 接入后端后替换为 API 请求
 */
function loadChatHistory() {
    // ===== 接入后端时替换为 =====
    request('/chats').then(res => { state.chats = res.data; renderChatHistory(); });

    // Mock：从 localStorage 加载
    // const saved = localStorage.getItem('chat_history');
    // if (saved) {
    //     state.chats = JSON.parse(saved);
    // }
    renderChatHistory();
}

// ==================== 知识库管理 ====================

/**
 * 加载知识库列表
 */
function loadKnowledgeBases() {
    request('/knowledge-bases').then(res => {
        state.knowledgeBases = res.data || [];
        renderKnowledgeBases();
        renderKbSelectorOptions();
    }).catch(() => {
        state.knowledgeBases = [];
        renderKnowledgeBases();
        renderKbSelectorOptions();
    });
}

/**
 * 渲染知识库列表（侧边栏）
 */
function renderKnowledgeBases() {
    const listEl = document.getElementById('kb-list');
    if (!listEl) return;

    if (state.knowledgeBases.length === 0) {
        listEl.innerHTML = '<div class="kb-empty">暂无知识库，点击上方按钮创建</div>';
        return;
    }

    listEl.innerHTML = '';
    state.knowledgeBases.forEach(kb => {
        const item = document.createElement('div');
        item.className = 'kb-item';
        item.onclick = () => showKbDetail(kb.id);
        item.innerHTML = `
            <div class="kb-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
            </div>
            <div class="kb-info">
                <div class="kb-name">${escapeHtml(kb.name)}</div>
                <div class="kb-meta">${kb.documentCount || 0} 个文档</div>
            </div>
            <div class="kb-actions">
                <button class="kb-action-btn delete" onclick="event.stopPropagation(); deleteKnowledgeBase(${kb.id})" title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

/**
 * 切换侧边栏 Tab
 */
function switchSidebarTab(tab) {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'chats') {
        document.getElementById('tab-chats').classList.add('active');
        document.getElementById('tab-content-chats').classList.add('active');
    } else if (tab === 'knowledge') {
        document.getElementById('tab-knowledge').classList.add('active');
        document.getElementById('tab-content-knowledge').classList.add('active');
        loadKnowledgeBases();
    }
}

// ----- 创建知识库 -----

function showCreateKbModal() {
    document.getElementById('kb-name-input').value = '';
    document.getElementById('kb-desc-input').value = '';
    openModal('create-kb-modal');
    setTimeout(() => document.getElementById('kb-name-input').focus(), 100);
}

async function confirmCreateKb() {
    const name = document.getElementById('kb-name-input').value.trim();
    const description = document.getElementById('kb-desc-input').value.trim();

    if (!name) {
        showToast('请输入知识库名称', 'error');
        return;
    }

    try {
        await request('/knowledge-bases', {
            method: 'POST',
            body: JSON.stringify({ name, description })
        });
        closeModal('create-kb-modal');
        showToast('知识库创建成功', 'success');
        loadKnowledgeBases();
    } catch (err) {
        showToast(err.message || '创建失败', 'error');
    }
}

// ----- 删除知识库 -----

async function deleteKnowledgeBase(kbId) {
    if (!confirm('确定删除这个知识库吗？所有文档和向量数据将被清除。')) return;

    try {
        await request(`/knowledge-bases/${kbId}`, { method: 'DELETE' });
        state.knowledgeBases = state.knowledgeBases.filter(kb => kb.id !== kbId);
        if (state.currentKbId === kbId) {
            selectKbForChat(null);
        }
        renderKnowledgeBases();
        renderKbSelectorOptions();
        showToast('知识库已删除', 'success');
    } catch (err) {
        showToast(err.message || '删除失败', 'error');
    }
}

// ----- 知识库详情（文档管理） -----

async function showKbDetail(kbId) {
    state.currentDetailKbId = kbId;
    const kb = state.knowledgeBases.find(k => k.id === kbId);
    if (kb) {
        document.getElementById('kb-detail-title').textContent = kb.name + ' - 文档管理';
    }
    openModal('kb-detail-modal');
    await loadKbDocuments(kbId);
}

async function loadKbDocuments(kbId) {
    const listEl = document.getElementById('kb-doc-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="kb-doc-empty">加载中...</div>';

    try {
        const res = await request(`/knowledge-bases/${kbId}/documents`);
        const docs = res.data || [];

        if (docs.length === 0) {
            listEl.innerHTML = '<div class="kb-doc-empty">暂无文档，点击上方按钮上传</div>';
            return;
        }

        listEl.innerHTML = '';
        docs.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'kb-doc-item';
            const ext = (doc.filename || '').split('.').pop().toUpperCase().slice(0, 4);
            const statusText = doc.status === 'ready' ? '已就绪' : doc.status === 'processing' ? '处理中' : '失败';
            item.innerHTML = `
                <div class="kb-doc-icon">${ext}</div>
                <div class="kb-doc-info">
                    <div class="kb-doc-name">${escapeHtml(doc.filename)}</div>
                    <div class="kb-doc-meta">
                        <span>${formatFileSize(doc.fileSize)}</span>
                        <span class="kb-doc-status ${doc.status}">${statusText}</span>
                    </div>
                </div>
                <button class="kb-doc-delete" onclick="deleteKbDocument(${doc.id})" title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            `;
            listEl.appendChild(item);
        });
    } catch (err) {
        listEl.innerHTML = '<div class="kb-doc-empty">加载失败</div>';
    }
}

function triggerKbDocUpload() {
    document.getElementById('kb-doc-input').click();
}

async function handleKbDocUpload(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';

    for (const file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            await request(`/knowledge-bases/${state.currentDetailKbId}/documents`, {
                method: 'POST',
                body: formData,
            });
            showToast(`${file.name} 上传成功`, 'success');
        } catch (err) {
            showToast(`${file.name} 上传失败: ${err.message}`, 'error');
        }
    }

    await loadKbDocuments(state.currentDetailKbId);
    loadKnowledgeBases();
}

async function deleteKbDocument(docId) {
    if (!confirm('确定删除这个文档吗？')) return;

    try {
        await request(`/knowledge-bases/${state.currentDetailKbId}/documents/${docId}`, { method: 'DELETE' });
        showToast('文档已删除', 'success');
        await loadKbDocuments(state.currentDetailKbId);
        loadKnowledgeBases();
    } catch (err) {
        showToast(err.message || '删除失败', 'error');
    }
}

// ----- 知识库选择器（聊天区） -----

function toggleKbSelector() {
    const menu = document.getElementById('kb-selector-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function renderKbSelectorOptions() {
    const optionsEl = document.getElementById('kb-selector-options');
    if (!optionsEl) return;

    optionsEl.innerHTML = '';
    state.knowledgeBases.forEach(kb => {
        const item = document.createElement('div');
        item.className = 'kb-selector-item' + (state.currentKbId === kb.id ? ' active' : '');
        item.onclick = () => selectKbForChat(kb.id);
        item.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>${escapeHtml(kb.name)}</span>
            <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;
        optionsEl.appendChild(item);
    });
}

function selectKbForChat(kbId) {
    state.currentKbId = kbId;
    const menu = document.getElementById('kb-selector-menu');
    menu.style.display = 'none';

    const labelEl = document.getElementById('kb-selector-label');
    const btnEl = document.getElementById('kb-selector-btn');

    if (kbId) {
        const kb = state.knowledgeBases.find(k => k.id === kbId);
        labelEl.textContent = kb ? kb.name : '未知知识库';
        btnEl.classList.add('active');
    } else {
        labelEl.textContent = '不使用知识库';
        btnEl.classList.remove('active');
    }

    renderKbSelectorOptions();
}

// 点击外部关闭知识库选择器
document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.kb-selector-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        document.getElementById('kb-selector-menu').style.display = 'none';
    }
});

// ----- 弹窗通用函数 -----

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function closeModalOnOverlay(event, id) {
    if (event.target === event.currentTarget) {
        closeModal(id);
    }
}

/**
 * 保存聊天历史到 localStorage
 * 接入后端后改为调用 API
 */
function saveChatHistory() {
    localStorage.setItem('chat_history', JSON.stringify(state.chats));
}

/**
 * 渲染聊天历史列表
 */
function renderChatHistory(filter = '') {
    const listEl = document.getElementById('chat-history-list');
    listEl.innerHTML = '';

    const filtered = filter
        ? state.chats.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()))
        : state.chats;

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted); font-size:13px;">
                ${filter ? '未找到匹配的对话' : '暂无对话记录'}
            </div>
        `;
        return;
    }

    filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-history-item' + (chat.id === state.currentChatId ? ' active' : '');
        item.onclick = () => selectChat(chat.id);
        item.innerHTML = `
            <div class="chat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="chat-info">
                <div class="chat-name">${escapeHtml(chat.title)}</div>
                <div class="chat-time">${formatTime(chat.updatedAt)}</div>
            </div>
            <div class="chat-actions">
                <button class="chat-action-btn rename" onclick="event.stopPropagation(); renameChat(${chat.id})" title="重命名">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="chat-action-btn delete" onclick="event.stopPropagation(); deleteChat(${chat.id})" title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

/**
 * 搜索聊天
 */
function searchChats() {
    const keyword = document.getElementById('search-chat').value;
    renderChatHistory(keyword);
}

/**
 * 创建新对话
 */
async function createNewChat() {
    try {
        const res = await request('/chats', {
            method: 'POST',
            body: JSON.stringify({ title: '新对话' })
        });
        const newChat = {
            id: res.data.id,
            title: res.data.title,
            messages: [],
            createdAt: res.data.createdAt,
            updatedAt: res.data.updatedAt,
        };
        state.chats.unshift(newChat);
        state.currentChatId = newChat.id;
        renderChatHistory();
        renderMessages();
        document.getElementById('current-chat-title').textContent = newChat.title;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 选择对话
 */
async function selectChat(chatId) {
    state.currentChatId = chatId;
    const chat = state.chats.find(c => c.id === chatId);
    if (chat) {
        document.getElementById('current-chat-title').textContent = chat.title;
        renderChatHistory();
        // 从后端加载该对话的消息
        try {
            const res = await request(`/chats/${chatId}`);
            chat.messages = res.data || [];
            renderMessages();
        } catch (error) {
            chat.messages = [];
            renderMessages();
            showToast(error.message, 'error');
        }
    }
}

/**
 * 重命名对话
 */
async function renameChat(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    const newTitle = prompt('请输入新的对话标题：', chat.title);
    if (!newTitle || newTitle.trim() === '' || newTitle.trim() === chat.title) return;

    try {
        await request(`/chats/${chatId}`, {
            method: 'PUT',
            body: JSON.stringify({ title: newTitle.trim() })
        });
        chat.title = newTitle.trim();
        if (state.currentChatId === chatId) {
            document.getElementById('current-chat-title').textContent = chat.title;
        }
        renderChatHistory();
        showToast('重命名成功', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 删除对话
 */
async function deleteChat(chatId) {
    if (!confirm('确定删除这个对话吗？')) return;

    try {
        await request(`/chats/${chatId}`, { method: 'DELETE' });
        state.chats = state.chats.filter(c => c.id !== chatId);

        if (state.currentChatId === chatId) {
            state.currentChatId = null;
            document.getElementById('current-chat-title').textContent = '新对话';
            renderMessages();
        }

        renderChatHistory();
        showToast('对话已删除', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * 清空当前对话消息
 */
async function clearCurrentChat() {
    if (!state.currentChatId) {
        showToast('当前没有对话', 'info');
        return;
    }
    if (!confirm('确定清空当前对话的所有消息吗？')) return;

    try {
        await request(`/chats/${state.currentChatId}/messages`, { method: 'DELETE' });
        const chat = state.chats.find(c => c.id === state.currentChatId);
        if (chat) {
            chat.messages = [];
            renderMessages();
        }
        showToast('已清空对话', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== 消息渲染 ====================

/**
 * 渲染消息列表
 */
function renderMessages() {
    const listEl = document.getElementById('message-list');
    const welcomeEl = document.getElementById('welcome-screen');

    // 只移除消息元素，不碰 welcome-screen
    listEl.querySelectorAll('.message').forEach(el => el.remove());

    if (!state.currentChatId) {
        if (welcomeEl) welcomeEl.style.display = 'flex';
        return;
    }

    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat || !chat.messages || chat.messages.length === 0) {
        if (welcomeEl) welcomeEl.style.display = 'flex';
        return;
    }

    if (welcomeEl) welcomeEl.style.display = 'none';

    chat.messages.forEach(msg => {
        listEl.appendChild(createMessageElement(msg));
    });

    scrollToBottom();
}

/**
 * 创建消息 DOM 元素
 */
function createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role}`;

    const avatarHtml = msg.role === 'user'
        ? (state.currentUser?.username?.charAt(0)?.toUpperCase() || 'U')
        : '<img src="ai-avatar.jpg" alt="AI" class="avatar-img">';

    let contentHtml = '';

    // 文本内容（简单 Markdown 渲染）
    if (msg.content) {
        contentHtml += `<div class="message-bubble">${renderMarkdown(msg.content)}</div>`;
    }

    // 图片
    if (msg.images && msg.images.length > 0) {
        contentHtml += '<div class="message-images">';
        msg.images.forEach(img => {
            contentHtml += `<img class="message-image" src="${img.url}" alt="${escapeHtml(img.name)}" onclick="openImageModal('${img.url}')">`;
        });
        contentHtml += '</div>';
    }

    // 文件
    if (msg.files && msg.files.length > 0) {
        contentHtml += '<div class="message-files">';
        msg.files.forEach(file => {
            const ext = file.name.split('.').pop().toUpperCase().slice(0, 3);
            contentHtml += `
                <div class="message-file" onclick="downloadFile('${file.url || ''}', '${escapeHtml(file.name)}')">
                    <div class="message-file-icon">${ext}</div>
                    <div class="message-file-info">
                        <div class="message-file-name">${escapeHtml(file.name)}</div>
                        <div class="message-file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
            `;
        });
        contentHtml += '</div>';
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarHtml}</div>
        <div class="message-content">${contentHtml}</div>
    `;

    return messageDiv;
}

/**
 * 流式更新单条消息的气泡内容（不重建整个列表）
 */
function updateMessageBubble(msgEl, content) {
    if (!msgEl) return;
    let bubble = msgEl.querySelector('.message-bubble');
    if (!bubble) {
        // 首次更新时 content 为空，bubble 还没创建，这里补建
        const contentDiv = msgEl.querySelector('.message-content');
        if (contentDiv) {
            bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            contentDiv.appendChild(bubble);
        }
    }
    if (bubble) {
        bubble.innerHTML = renderMarkdown(content);
    }
}

/**
 * Markdown 渲染
 * 支持：代码块、行内代码、标题、加粗、斜体、列表、表格、引用、链接、分隔线
 */
function renderMarkdown(text) {
    if (!text) return '';

    // 1. 先提取代码块，避免内部内容被其他规则破坏
    const codeBlocks = [];
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ placeholder, lang, code: code.trim() });
        return placeholder;
    });

    // 2. 提取行内代码
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINECODE_${inlineCodes.length}__`;
        inlineCodes.push({ placeholder, code });
        return placeholder;
    });

    // 3. 表格（必须在其他处理之前，按行匹配）
    html = html.replace(/^(\|.+\|)\n(\|[\s\-:|]+\|)\n((?:\|.+\|\n?)*)/gm, (match, headerRow, sepRow, bodyRows) => {
        const headers = headerRow.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(h => h.trim());
        const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r =>
            r.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim())
        );
        let table = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
        headers.forEach(h => table += `<th>${h}</th>`);
        table += '</tr></thead><tbody>';
        rows.forEach(r => {
            table += '<tr>';
            for (let i = 0; i < headers.length; i++) {
                table += `<td>${r[i] || ''}</td>`;
            }
            table += '</tr>';
        });
        table += '</tbody></table></div>';
        return table;
    });

    // 4. 标题
    html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

    // 5. 分隔线
    html = html.replace(/^---+$/gm, '<hr class="md-hr">');

    // 6. 引用块
    html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

    // 7. 加粗和斜体
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // 8. 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>');

    // 9. 无序列表
    html = html.replace(/^(\s*)[-*]\s+(.+)$/gm, '$1<li class="md-li">$2</li>');
    html = html.replace(/(<li class="md-li">.*?<\/li>\n?)+/g, (match) => '<ul class="md-ul">' + match + '</ul>');

    // 10. 有序列表
    html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li class="md-li">$2</li>');
    html = html.replace(/(<li class="md-li">.*?<\/li>\n?)+(?!<ul)/g, (match) => {
        if (match.includes('<ul')) return match;
        return '<ol class="md-ol">' + match + '</ol>';
    });

    // 11. 段落和换行
    html = html.split('\n\n').map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        // 已经是 HTML 标签开头的不包裹
        if (/^<(h\d|ul|ol|pre|blockquote|hr|div|table)/.test(trimmed)) return trimmed;
        // 连续的 HTML 块之间不加 <p>
        if (/^__CODEBLOCK_/.test(trimmed)) return trimmed;
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    // 12. 还原行内代码
    inlineCodes.forEach(item => {
        html = html.replace(item.placeholder, `<code>${item.code}</code>`);
    });

    // 13. 还原代码块
    codeBlocks.forEach(item => {
        html = html.replace(item.placeholder, `<pre><code>${item.code}</code></pre>`);
    });

    return html;
}

/**
 * 滚动到底部
 */
function scrollToBottom() {
    const listEl = document.getElementById('message-list');
    listEl.scrollTop = listEl.scrollHeight;
}

// ==================== 发送消息 ====================

/**
 * 处理发送消息
 */
async function sendMessage() {
    const inputEl = document.getElementById('message-input');
    const text = inputEl.value.trim();

    if (!text && state.selectedFiles.length === 0) {
        showToast('请输入消息或上传文件', 'info');
        return;
    }

    if (state.isWaitingResponse) {
        showToast('正在等待 AI 回复，请稍候...', 'info');
        return;
    }

    // 确保有当前对话
    if (!state.currentChatId) {
        createNewChat();
    }

    const chat = state.chats.find(c => c.id === state.currentChatId);

    // 构建用户消息
    const userMessage = {
        role: 'user',
        content: text,
        images: [],
        files: [],
        timestamp: new Date().toISOString(),
    };

    // 检查文件上传状态
    const uploadingFiles = state.selectedFiles.filter(f => f.uploading);
    if (uploadingFiles.length > 0) {
        showToast('文件正在上传，请稍候...', 'info');
        return;
    }
    const failedFiles = state.selectedFiles.filter(f => f.uploadError);
    if (failedFiles.length > 0) {
        showToast(`文件 ${failedFiles[0].name} 上传失败，请移除后重新选择`, 'error');
        return;
    }

    // 处理已上传的文件（使用后端返回的真实 URL）
    for (const file of state.selectedFiles) {
        if (file.type.startsWith('image/')) {
            userMessage.images.push({
                url: file.url,
                name: file.name,
                size: file.size,
            });
        } else {
            userMessage.files.push({
                name: file.name,
                size: file.size,
                url: file.url || '',
                fileId: file.fileId || '',
            });
        }
    }

    // 记录是否为新对话（发送前没有任何消息）
    const isNewChat = chat.messages.length === 0;

    // 添加到对话
    chat.messages.push(userMessage);

    chat.updatedAt = new Date().toISOString();

    // 清空输入
    inputEl.value = '';
    autoResize(inputEl);
    state.selectedFiles = [];
    renderFilePreview();
    renderMessages();
    renderChatHistory();
    saveChatHistory();

    // 显示打字指示器
    state.isWaitingResponse = true;
    const sendBtn = document.getElementById('btn-send');
    if (sendBtn) sendBtn.disabled = true;
    showTypingIndicator();

    try {
        // 使用 fetch 支持 SSE 流式回复
        const response = await fetch(API_CONFIG.baseURL + '/message/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
                chat_id: chat.id,
                content: text,
                images: userMessage.images,
                files: userMessage.files,
                kb_id: state.currentKbId,
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || errData.message || `请求失败 (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
            // ===== SSE 流式回复 =====
            hideTypingIndicator();

            const aiMessage = {
                role: 'ai',
                content: '',
                images: [],
                files: [],
                timestamp: new Date().toISOString(),
            };
            chat.messages.push(aiMessage);
            renderMessages();

            // 获取刚创建的 AI 消息 DOM 元素，后续直接更新它
            const listEl = document.getElementById('message-list');
            const msgEls = listEl.querySelectorAll('.message');
            const aiMsgEl = msgEls[msgEls.length - 1];

            // 立即在气泡中显示"思考中"
            let bubble = aiMsgEl.querySelector('.message-bubble');
            if (!bubble) {
                const contentDiv = aiMsgEl.querySelector('.message-content');
                if (contentDiv) {
                    bubble = document.createElement('div');
                    bubble.className = 'message-bubble';
                    contentDiv.appendChild(bubble);
                }
            }
            if (bubble) {
                bubble.innerHTML = '<span class="thinking-status"><span class="thinking-spinner"></span>思考中</span>';
            }

            let hasContent = false;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'start') {
                            // 保持"思考中"显示，等待首个 chunk
                        } else if (data.type === 'chunk' || data.type === 'delta') {
                            if (!hasContent) {
                                hasContent = true;
                            }
                            aiMessage.content += data.content || '';
                            updateMessageBubble(aiMsgEl, aiMessage.content);
                            scrollToBottom();
                        } else if (data.type === 'done' || data.type === 'end') {
                            if (data.content) aiMessage.content = data.content;
                            renderMessages();
                        } else if (data.type === 'error') {
                            throw new Error(data.content || data.message || 'AI 回复失败');
                        }
                    } catch (e) {
                        // 忽略解析失败的行
                    }
                }
            }

            // 如果流结束但没有任何内容，显示提示
            if (!hasContent && !aiMessage.content) {
                aiMessage.content = '（AI 未返回内容，请重试）';
                renderMessages();
            }
        } else {
            // ===== 普通JSON回复（向后兼容当前后端）=====
            const res = await response.json();
            hideTypingIndicator();

            const aiMessage = {
                role: 'ai',
                content: res.data.aiMessage.content,
                images: [],
                files: [],
                timestamp: new Date().toISOString(),
            };
            chat.messages.push(aiMessage);
            renderMessages();
        }

        chat.updatedAt = new Date().toISOString();
        renderChatHistory();

        // 如果是新对话的第一轮交流，调用后端生成标题
        if (isNewChat) {
            try {
                const titleRes = await request(`/chats/${chat.id}/craete_title`, { method: 'GET' });
                if (titleRes.data && titleRes.data.title) {
                    chat.title = titleRes.data.title;
                    document.getElementById('current-chat-title').textContent = chat.title;
                    renderChatHistory();
                }
            } catch (e) {
                // 标题生成失败，不影响主流程
            }
        }
    } catch (err) {
        hideTypingIndicator();
        showToast(err.message || '发送失败，请重试', 'error');
    } finally {
        state.isWaitingResponse = false;
        const sendBtn = document.getElementById('btn-send');
        if (sendBtn) sendBtn.disabled = false;
        document.getElementById('message-input').focus();
    }
}

/**
 * 显示打字指示器
 */
function showTypingIndicator() {
    const listEl = document.getElementById('message-list');
    const welcomeEl = document.getElementById('welcome-screen');
    if (welcomeEl) welcomeEl.style.display = 'none';

    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = 'typing-indicator-msg';
    typingDiv.innerHTML = `
        <div class="message-avatar"><img src="ai-avatar.jpg" alt="AI" class="avatar-img"></div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span class="typing-label">思考中</span>
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        </div>
    `;
    listEl.appendChild(typingDiv);
    scrollToBottom();
}

/**
 * 隐藏打字指示器
 */
function hideTypingIndicator() {
    const typingEl = document.getElementById('typing-indicator-msg');
    if (typingEl) typingEl.remove();
}

// ==================== 文件上传 ====================

/**
 * 触发文件选择
 */
function triggerFileUpload() {
    document.getElementById('file-input').click();
}

/**
 * 处理文件选择
 */
async function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    for (const file of files) {
        await processFile(file);
    }
    // 清空 input，允许重复选择同一文件
    event.target.value = '';
}

/**
 * 处理单个文件（供 handleFileSelect / 粘贴 / 拖拽共用）
 * 选择文件后立即上传到后端，拿到真实 URL 供 AI 访问
 */
async function processFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showToast(`文件 ${file.name} 超过 10MB 限制`, 'error');
        return;
    }

    const fileObj = {
        name: file.name,
        size: file.size,
        type: file.type,
        uploading: true,
        url: null,
        fileId: null,
        uploadError: false,
    };

    if (file.type.startsWith('image/')) {
        fileObj.preview = URL.createObjectURL(file);
    }

    state.selectedFiles.push(fileObj);
    renderFilePreview();

    try {
        const res = await uploadFile(file);
        fileObj.url = res.data.fileUrl;
        if (res.data.fileId) fileObj.fileId = res.data.fileId;
        fileObj.uploading = false;
    } catch (err) {
        fileObj.uploading = false;
        fileObj.uploadError = true;
        showToast(`文件 ${file.name} 上传失败: ${err.message}`, 'error');
    }
    renderFilePreview();
}

/**
 * 处理粘贴事件 — 支持粘贴图片和文件
 */
async function handlePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    let hasFile = false;
    for (const item of items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                await processFile(file);
                hasFile = true;
            }
        }
    }

    if (hasFile) {
        event.preventDefault();
    }
}

/**
 * 处理拖拽 — 支持拖拽图片和文件到聊天区
 */
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

async function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
        await processFile(file);
    }
}

/**
 * 渲染文件预览区
 */
function renderFilePreview() {
    const previewArea = document.getElementById('file-preview-area');

    if (state.selectedFiles.length === 0) {
        previewArea.style.display = 'none';
        previewArea.innerHTML = '';
        return;
    }

    previewArea.style.display = 'flex';
    previewArea.innerHTML = '';

    state.selectedFiles.forEach((file, index) => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'file-preview';

        const removeBtn = `
            <button class="file-preview-remove" onclick="removeFile(${index})">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        const statusText = file.uploading
            ? '<span style="color:var(--primary);font-size:11px;">上传中...</span>'
            : file.uploadError
                ? '<span style="color:#ef4444;font-size:11px;">上传失败</span>'
                : '';

        if (file.preview) {
            previewDiv.classList.add('image-preview');
            previewDiv.innerHTML = `
                <img src="${file.preview}" alt="${escapeHtml(file.name)}">
                ${statusText}
                ${removeBtn}
            `;
        } else {
            const ext = file.name.split('.').pop().toUpperCase().slice(0, 4);
            previewDiv.innerHTML = `
                <div class="message-file-icon" style="width:28px;height:28px;font-size:10px;">${ext}</div>
                <div class="file-preview-info">
                    <div class="file-preview-name">${escapeHtml(file.name)}</div>
                    <div class="file-preview-size">${formatFileSize(file.size)}</div>
                    ${statusText}
                </div>
                ${removeBtn}
            `;
        }

        previewArea.appendChild(previewDiv);
    });
}

/**
 * 移除已选文件
 */
function removeFile(index) {
    state.selectedFiles.splice(index, 1);
    renderFilePreview();
}

// ==================== 图片预览弹窗 ====================

/**
 * 打开图片预览
 */
function openImageModal(url) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modalImg.src = url;
    modal.classList.add('active');
}

/**
 * 关闭图片预览
 */
function closeImageModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('image-modal').classList.remove('active');
}

/**
 * 下载文件
 */
function downloadFile(url, name) {
    if (!url) {
        showToast('文件链接不可用', 'error');
        return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
}

// ==================== 输入框处理 ====================

/**
 * 自动调整输入框高度
 */
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

/**
 * 处理键盘事件
 */
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

/**
 * 使用建议消息
 */
function useSuggestion(text) {
    const inputEl = document.getElementById('message-input');
    inputEl.value = text;
    autoResize(inputEl);
    inputEl.focus();
}

// ==================== 侧边栏 ====================

/**
 * 切换侧边栏显示/隐藏
 */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

// ==================== 工具函数 ====================

/**
 * HTML 转义
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 格式化时间
 */
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
    };

    toast.innerHTML = `<span>${icons[type] || ''}</span> ${escapeHtml(message)}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== 拖拽上传 ====================

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        const input = document.getElementById('file-input');
        input.files = e.dataTransfer.files;
        handleFileSelect({ target: input });
    }
});

// ==================== 初始化 ====================

window.addEventListener('DOMContentLoaded', () => {
    // 注册粘贴事件 — 在输入框粘贴图片/文件
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('paste', handlePaste);
    }

    // 注册拖拽事件 — 拖拽文件到聊天区
    const messageList = document.getElementById('message-list');
    if (messageList) {
        messageList.addEventListener('dragover', handleDragOver);
        messageList.addEventListener('dragleave', handleDragLeave);
        messageList.addEventListener('drop', handleDrop);
    }

    // 检查是否已登录
    const token = getToken();
    if (token) {
        // ===== 接入后端时替换为验证 token 的请求 =====
        request('/auth/me').then(res => {
            state.currentUser = res.data;
            updateUserInfo();
            showChatPage();
            loadChatHistory();
            loadKnowledgeBases();
        }).catch(() => {
            clearToken();
            showLoginPage();
        });

        // Mock：直接显示登录页（因为 token 是 mock 的，刷新后需要重新登录）
        //showLoginPage();
    } else {
        showLoginPage();
    }
});
