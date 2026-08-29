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
    var legacy = isLegacyMode();
    document.getElementById('login-page').style.display = legacy ? 'none' : 'block';
    var legacyPage = document.getElementById('legacy-login-page');
    if (legacyPage) legacyPage.style.display = legacy ? 'flex' : 'none';
    document.getElementById('chat-app').style.display = 'none';
    if (!legacy && window.Anim && window.Anim.loginInit) window.Anim.loginInit();
}

function showChatPage() {
    document.getElementById('login-page').style.display = 'none';
    var legacyPage = document.getElementById('legacy-login-page');
    if (legacyPage) legacyPage.style.display = 'none';
    document.getElementById('chat-app').style.display = 'flex';
    // 清空上一次渲染的消息残留（切换账号时左侧列表已刷新，主消息区须同步重置）
    renderMessages();
    renderSuggestions();
    // 侧边栏对话/知识库随当前用户状态同步渲染（配合登录/注册后的 load* 请求异步更新）
    renderChatHistory();
    renderKnowledgeBases();
    renderKbSelectorOptions();
    if (window.Anim && window.Anim.loginCleanup) window.Anim.loginCleanup();
    requestAnimationFrame(() => {
        if (window.Anim) window.Anim.pageEntrance();
    });
    if (isLegacyMode()) updateLegacyAvatar();
}

/** 切换登录 / 注册表单显示 */
function switchAuth(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');

    const toRegister = type === 'register';
    const showForm = toRegister ? registerForm : loginForm;
    const hideForm = toRegister ? loginForm : registerForm;

    if (tabLogin) tabLogin.classList.toggle('active', !toRegister);
    if (tabRegister) tabRegister.classList.toggle('active', toRegister);

    // 目标表单已显示则无需切换
    if (hideForm.style.display === 'none') return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        hideForm.style.display = 'none';
        showForm.style.display = 'flex';
        return;
    }

    // 出场动画 → 切换显示 → 入场动画
    hideForm.classList.remove('auth-form--in');
    hideForm.classList.add('auth-form--out');
    window.setTimeout(function () {
        hideForm.classList.remove('auth-form--out');
        hideForm.style.display = 'none';
        showForm.style.display = 'flex';
        showForm.classList.remove('auth-form--in');
        void showForm.offsetWidth; // 触发回流以重启入场动画
        showForm.classList.add('auth-form--in');
    }, 250);
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
        // 设置头像首字母（旧版模式 CSS 用）
        var avatarBtn = document.getElementById('user-avatar');
        if (avatarBtn) {
            avatarBtn.setAttribute('data-initial', state.currentUser.username.charAt(0).toUpperCase());
        }
        // 按用户名读取头像（无则随机分配），由 avatar.js 处理
        if (window.Avatar) window.Avatar.loadForUser(state.currentUser.username);
    }
}

// ==================== 登录 ====================

/** 通用登录提交处理，prefix 区分新版 ('') 与旧版 ('legacy-') */
async function handleLoginSubmit(e, prefix) {
    e.preventDefault();
    const username = document.getElementById(prefix + 'login-username').value.trim();
    const password = document.getElementById(prefix + 'login-password').value.trim();

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
}

/** 通用注册提交处理，prefix 区分新版 ('') 与旧版 ('legacy-') */
async function handleRegisterSubmit(e, prefix) {
    e.preventDefault();
    const username = document.getElementById(prefix + 'reg-username').value.trim();
    const email = document.getElementById(prefix + 'reg-email').value.trim();
    const password = document.getElementById(prefix + 'reg-password').value.trim();
    const confirmPassword = document.getElementById(prefix + 'reg-password-confirm').value.trim();

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
        loadChatHistory();
        loadKnowledgeBases();
    } catch (err) {
        showToast(err.message || '注册失败', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function initAuthEvents() {
    // 新版表单
    var loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) { handleLoginSubmit(e, ''); });
    }
    var registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) { handleRegisterSubmit(e, ''); });
    }

    // 旧版表单
    var legacyLoginForm = document.getElementById('legacy-login-form');
    if (legacyLoginForm) {
        legacyLoginForm.addEventListener('submit', function (e) { handleLoginSubmit(e, 'legacy-'); });
    }
    var legacyRegisterForm = document.getElementById('legacy-register-form');
    if (legacyRegisterForm) {
        legacyRegisterForm.addEventListener('submit', function (e) { handleRegisterSubmit(e, 'legacy-'); });
    }
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
    state.currentDetailKbId = null;
    state.selectedFiles = [];
    state.isWaitingResponse = false;
    // 同步清空侧边栏/知识库的 DOM，避免下一账号登录后残留上一账号的列表
    renderChatHistory();
    renderKnowledgeBases();
    renderKbSelectorOptions();
    showLoginPage();
    showToast('已退出登录', 'info');
}

// ==================== 真机键盘稳定 ====================
// 移动端键盘弹出/收起会改变 visualViewport 并可能把页面误跳到别处。
// 这里在视口变化后把当前聚焦的登录/注册输入框滚回可视区，抵消误跳。
(function () {
    var vv = window.visualViewport;
    var isCoarse = window.matchMedia('(pointer: coarse)').matches;
    if (!vv || !isCoarse) return;

    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var legacyLoginForm = document.getElementById('legacy-login-form');
    var legacyRegisterForm = document.getElementById('legacy-register-form');

    var recenter = function () {
        var el = document.activeElement;
        if (!el) return;
        var tag = el.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
        // 仅处理登录/注册表单内的输入框（新版 + 旧版）
        if (!(loginForm && loginForm.contains(el)) &&
            !(registerForm && registerForm.contains(el)) &&
            !(legacyLoginForm && legacyLoginForm.contains(el)) &&
            !(legacyRegisterForm && legacyRegisterForm.contains(el))) return;
        clearTimeout(recenter._t);
        recenter._t = setTimeout(function () {
            try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* ignore */ }
        }, 60);
    };

    vv.addEventListener('resize', recenter);
})();
