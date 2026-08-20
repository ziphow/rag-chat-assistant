/**
 * file-history.js — 查看用户通过消息发送过的文件
 *
 * 职责：
 *   - 查看当前对话发送的所有文件（showChatFiles）
 *   - 查看所有对话发送的所有文件，按对话分组（showAllSentFiles）
 *
 * 后端接口：
 *   - GET /chats/{chat_id}/files  单个对话的文件
 *   - GET /files/sent             所有对话的文件（按对话分组）
 */

/** 设置弹窗标题 */
function setSentFilesTitle(text) {
    const el = document.querySelector('#sent-files-modal .modal-header h3');
    if (el) el.textContent = text;
}

/** 打开弹窗并进入加载态 */
function openSentFilesModal(title) {
    const body = document.getElementById('sent-files-body');
    body.innerHTML = '<div class="sent-files-empty">加载中...</div>';
    setSentFilesTitle(title);
    openModal('sent-files-modal');
}

/** 构建一组图片 + 文件的 HTML */
function buildFilesSection(images, files) {
    let html = '';

    if (images.length > 0) {
        html += '<div class="sent-files-images">';
        images.forEach(img => {
            html += `
                <div class="sent-image-item" title="${escapeHtml(img.name)}">
                    <img src="${img.url}" alt="${escapeHtml(img.name)}" loading="lazy" onclick="openImageModal('${img.url}')">
                </div>
            `;
        });
        html += '</div>';
    }

    if (files.length > 0) {
        html += '<div class="sent-files-list">';
        files.forEach(f => {
            const ext = (f.name || '').split('.').pop().toUpperCase().slice(0, 4);
            html += `
                <div class="sent-file-item" onclick="downloadFile('${f.url || ''}', '${escapeHtml(f.name)}')">
                    <div class="message-file-icon" style="width:32px;height:32px;font-size:11px;">${ext}</div>
                    <div class="message-file-info">
                        <div class="message-file-name">${escapeHtml(f.name)}</div>
                        <div class="message-file-size">${formatFileSize(f.size || 0)}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    return html;
}

/** 查看当前对话发送的所有文件 */
async function showChatFiles() {
    if (!state.currentChatId) {
        showToast('请先选择或新建一个对话', 'info');
        return;
    }
    openSentFilesModal('当前对话的文件');
    const body = document.getElementById('sent-files-body');

    try {
        const res = await request(`/chats/${state.currentChatId}/files`);
        const data = res.data || {};
        const images = data.images || [];
        const files = data.files || [];

        if (images.length === 0 && files.length === 0) {
            body.innerHTML = '<div class="sent-files-empty">当前对话还没有发送过文件</div>';
            return;
        }
        body.innerHTML = buildFilesSection(images, files);
    } catch (err) {
        body.innerHTML = `<div class="sent-files-empty">加载失败：${escapeHtml(err.message)}</div>`;
    }
}

/** 查看所有对话发送的文件，按对话分组 */
async function showAllSentFiles() {
    openSentFilesModal('所有对话的文件');
    const body = document.getElementById('sent-files-body');

    try {
        const res = await request('/files/sent');
        const groups = res.data || [];

        const total = groups.reduce(
            (n, g) => n + (g.images?.length || 0) + (g.files?.length || 0),
            0
        );
        if (total === 0) {
            body.innerHTML = '<div class="sent-files-empty">还没有通过消息发送过任何文件</div>';
            return;
        }

        let html = '';
        groups.forEach(g => {
            html += `<div class="sent-files-group-title">${escapeHtml(g.chat_title || '未命名对话')}</div>`;
            html += buildFilesSection(g.images || [], g.files || []);
        });
        body.innerHTML = html;
    } catch (err) {
        body.innerHTML = `<div class="sent-files-empty">加载失败：${escapeHtml(err.message)}</div>`;
    }
}