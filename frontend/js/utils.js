/**
 * utils.js — 通用工具函数
 *
 * 职责：
 *   - HTML 转义、格式化（文件大小、时间）
 *   - Toast 提示
 *   - 弹窗（Modal）通用函数
 *   - 滚动控制
 */

// ==================== HTML 转义 ====================

/**
 * 将文本转义为安全的 HTML（防止 XSS）
 * @param {string} text - 原始文本
 * @returns {string} 转义后的 HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 格式化 ====================

/**
 * 格式化文件大小（字节 → B/KB/MB）
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 格式化时间（ISO 字符串 → "刚刚 / X分钟前 / X小时前 / MM-DD"）
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

// ==================== Toast 提示 ====================

/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 * @param {'success'|'error'|'info'} type - 提示类型
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${escapeHtml(message)}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== 弹窗通用函数 ====================

function openModal(id) {
    if (window.Anim && window.Anim.openModal) {
        window.Anim.openModal(id);
        return;
    }
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    if (window.Anim && window.Anim.closeModal) {
        window.Anim.closeModal(id);
        return;
    }
    document.getElementById(id).classList.remove('active');
}

/** 点击遮罩层关闭弹窗（仅在点击 overlay 本身时触发） */
function closeModalOnOverlay(event, id) {
    if (event.target === event.currentTarget) {
        closeModal(id);
    }
}

// ==================== 滚动 ====================

/** 滚动消息列表到底部 */
function scrollToBottom() {
    const listEl = document.getElementById('message-list');
    listEl.scrollTop = listEl.scrollHeight;
}

/** 仅在用户停留在底部附近时滚到最新；用户已上滑查看时不打扰 */
function scrollToBottomIfNear(threshold = 120) {
    const listEl = document.getElementById('message-list');
    if (!listEl) return;
    const dist = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight;
    if (dist < threshold) listEl.scrollTop = listEl.scrollHeight;
}

// ==================== 输入框 ====================

/** 自动调整 textarea 高度（随内容增长） */
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}
