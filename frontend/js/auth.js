/**
 * auth.js — 认证模块（登录 / 注册 / 退出）
 *
 * 职责：
 *   - 登录/注册表单的 UI 切换
 *   - 密码可见性切换
 *   - 登录/注册/退出的业务逻辑
 *   - 登录页与聊天页的切换
 */

// ==================== 页面切换 ====================

function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('chat-app').style.display = 'none';
}

function showChatPage() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('chat-app').style.display = 'flex';
    renderSuggestions();
}

/** 切换登录 / 注册表单显示 */
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

/** 切换密码输入框可见性 */
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

/** 更新顶部用户信息显示 */
function updateUserInfo() {
    if (state.currentUser) {
        document.getElementById('user-name').textContent = state.currentUser.username;
        document.getElementById('user-avatar').textContent =
            state.currentUser.username.charAt(0).toUpperCase();
    }
}

// ==================== 登录 ====================

function initAuthEvents() {
    // 登录表单提交
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
            const res = await request('/auth/login', {
                method: 'POST',
                body: new URLSearchParams({ username, password })
            });

            setToken(res.data.token);
            state.currentUser = res.data.user;

            updateUserInfo();
            showChatPage();
            showToast('登录成功', 'success');

            loadChatHistory();
            loadKnowledgeBases();
        } catch (err) {
            showToast(err.message || '登录失败', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // 注册表单提交
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
            const res = await request('/auth/register', {
                method: 'POST',
                body: new URLSearchParams({ username, email, password })
            });

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
}

// ==================== 退出登录 ====================

/**
 * 退出登录
 * 先通知后端将 token 加入黑名单，再清除本地状态
 */
async function logout() {
    try {
        await request('/auth/logout', { method: 'POST' });
    } catch (e) {
        // 即使后端调用失败，也要清除本地状态
    }

    clearToken();
    state.currentUser = null;
    state.chats = [];
    state.currentChatId = null;
    state.knowledgeBases = [];
    state.currentKbId = null;
    showLoginPage();
    showToast('已退出登录', 'info');
}
