/**
 * legacy.js — 旧版 UI 初始化
 *
 * 职责：
 *   - 页面加载时为 body 添加 .legacy 类
 *   - 旧版登录页的登录/注册表单切换
 *   - 旧版模式下禁用主题系统（移除 html[data-theme]）
 *
 * 说明：仅保留旧版 UI，不再提供新版/旧版切换。
 */

function isLegacyMode() {
    // 始终为旧版模式
    return true;
}

function initLegacyMode() {
    document.body.classList.add('legacy');
    // 移除主题属性，使用 :root 默认变量（旧版只有一套配色）
    document.documentElement.removeAttribute('data-theme');
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