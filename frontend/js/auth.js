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
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('chat-app').style.display = 'none';
    if (window.Anim && window.Anim.loginInit) window.Anim.loginInit();
}

function showChatPage() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('chat-app').style.display = 'flex';
    renderSuggestions();
    if (window.Anim && window.Anim.loginCleanup) window.Anim.loginCleanup();
    requestAnimationFrame(() => {
        if (window.Anim) window.Anim.pageEntrance();
    });
}

/** 切换登录 / 注册表单显示 */
function switchAuth(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');

    if (type === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
    } else {
        registerForm.style.display = 'none';
        loginForm.style.display = 'flex';
        if (tabRegister) tabRegister.classList.remove('active');
        if (tabLogin) tabLogin.classList.add('active');
    }
}

/** 平滑滚动到登录 / 注册区，可选切换表单类型 */
function scrollToAuth(type) {
    const el = document.getElementById('lp-auth');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (type) switchAuth(type);
}

/** 平滑滚动到核心能力区 */
function scrollToFeatures() {
    const el = document.getElementById('lp-features');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        // 按用户名读取头像（无则随机分配），由 avatar.js 处理
        if (window.Avatar) window.Avatar.loadForUser(state.currentUser.username);
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
