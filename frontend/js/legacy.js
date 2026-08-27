/**
 * legacy.js — UI 模式切换（新版 / 旧版）
 *
 * 职责：
 *   - 读取/写入 localStorage 中的 ui_mode
 *   - 页面加载时为 body 添加 .legacy 类（与 <head> 中的防闪烁脚本配合）
 *   - 切换模式后刷新页面
 *   - 旧版登录页的登录/注册表单切换
 *   - 旧版模式下禁用主题系统（移除 html[data-theme]）
 */

// ==================== 模式读写 ====================

var LEGACY_KEY = 'ui_mode';

function isLegacyMode() {
    // 默认旧版 UI：仅在用户明确选择新版时返回 false
    return localStorage.getItem(LEGACY_KEY) !== 'modern';
}

function setLegacyMode(legacy) {
    localStorage.setItem(LEGACY_KEY, legacy ? 'legacy' : 'modern');
}

function toggleLegacyMode() {
    setLegacyMode(!isLegacyMode());
    location.reload();
}

// ==================== 初始化 ====================

function initLegacyMode() {
    var legacy = isLegacyMode();
    document.body.classList.toggle('legacy', legacy);

    if (legacy) {
        // 移除主题属性，使用 :root 默认变量（旧版只有一套配色）
        document.documentElement.removeAttribute('data-theme');
    }

    // 更新聊天页版本切换按钮文字
    var chatToggle = document.querySelector('.chat-version-toggle');
    if (chatToggle) {
        chatToggle.textContent = legacy ? '新版 UI' : '旧版 UI';
    }
}

// ==================== 旧版登录/注册表单切换 ====================

function legacySwitchAuth(type) {
    var loginForm = document.getElementById('legacy-login-form');
    var registerForm = document.getElementById('legacy-register-form');
    if (!loginForm || !registerForm) return;

    var toRegister = type === 'register';
    loginForm.style.display = toRegister ? 'none' : 'flex';
    registerForm.style.display = toRegister ? 'flex' : 'none';
}

// ==================== 旧版用户头像首字母 ====================

function updateLegacyAvatar() {
    var btn = document.getElementById('user-avatar');
    if (!btn) return;
    var name = (state.currentUser && state.currentUser.username) || 'U';
    btn.setAttribute('data-initial', name.charAt(0).toUpperCase());
}
