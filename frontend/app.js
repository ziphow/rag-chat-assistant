/**
 * app.js — 应用入口：初始化 + 事件绑定
 *
 * 这个文件只负责：
 *   1. 注册全局事件监听（粘贴、拖拽）
 *   2. 初始化认证表单
 *   3. 页面加载后检查 token 状态，自动登录或显示登录页
 *
 * 所有业务逻辑已拆分到 js/ 目录下的各模块文件中。
 */

// ==================== 初始化 ====================

window.addEventListener('DOMContentLoaded', () => {
    // 移动端默认收起侧边栏，避免遮挡聊天画面（窄屏判定，与 CSS 900px 断点一致）
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.matchMedia('(max-width: 900px)').matches) {
        sidebar.classList.add('collapsed');
    }

    // 注册粘贴事件 — 输入框粘贴图片/文件
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

    // 初始化登录/注册表单事件
    initAuthEvents();

    // 检查登录状态
    const token = getToken();
    if (token) {
        // 向后端验证 token 是否有效
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
    } else {
        showLoginPage();
    }
});
