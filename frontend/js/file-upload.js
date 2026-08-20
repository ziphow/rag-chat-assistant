/**
 * file-upload.js — 文件上传与预览
 *
 * 职责：
 *   - 文件选择按钮触发
 *   - 粘贴文件处理
 *   - 拖拽上传处理
 *   - 文件预览区渲染（图片缩略图 + 文件信息）
 *   - 图片预览弹窗
 *   - 文件下载
 */

// ==================== 文件选择 ====================

/** 触发文件选择对话框 */
function triggerFileUpload() {
    document.getElementById('file-input').click();
}

/** 处理文件选择（input change 事件） */
async function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    for (const file of files) {
        await processFile(file);
    }
    event.target.value = '';
}

/**
 * 处理单个文件 — 选择后立即上传到后端，拿到真实 URL
 * 供 handleFileSelect / handlePaste / handleDrop 共用
 * @param {File} file - 浏览器 File 对象
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

    // 图片生成本地预览 URL（临时）
    if (file.type.startsWith('image/')) {
        fileObj.preview = URL.createObjectURL(file);
    }

    state.selectedFiles.push(fileObj);
    renderFilePreview();

    // 立即上传到后端
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

// ==================== 粘贴上传 ====================

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

// ==================== 拖拽上传 ====================

function handleDragOver(event) {
    event.preventDefault();
    const overlay = document.getElementById('drag-drop-overlay');
    if (overlay) overlay.classList.add('active');
}

function handleDragLeave(event) {
    // relatedTarget 为鼠标进入的新元素；若它仍在 chat-main 内则不隐藏遮罩
    const chatMain = document.getElementById('chat-main');
    if (event.relatedTarget && chatMain && chatMain.contains(event.relatedTarget)) {
        return;
    }
    const overlay = document.getElementById('drag-drop-overlay');
    if (overlay) overlay.classList.remove('active');
}

async function handleDrop(event) {
    event.preventDefault();
    const overlay = document.getElementById('drag-drop-overlay');
    if (overlay) overlay.classList.remove('active');

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
        await processFile(file);
    }
}

// ==================== 文件预览区 ====================

/** 渲染输入框上方的文件预览区 */
function renderFilePreview() {
    const previewArea = document.getElementById('file-preview-area');
    const badge = document.getElementById('attach-badge');

    if (state.selectedFiles.length === 0) {
        previewArea.style.display = 'none';
        previewArea.innerHTML = '';
        if (badge) badge.style.display = 'none';
        return;
    }

    previewArea.style.display = 'flex';
    previewArea.innerHTML = '';

    // 更新上传按钮上的角标数字
    if (badge) {
        badge.textContent = state.selectedFiles.length;
        badge.style.display = 'flex';
    }

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

/** 移除已选文件 */
function removeFile(index) {
    state.selectedFiles.splice(index, 1);
    renderFilePreview();
}

// ==================== 图片预览弹窗 ====================

function openImageModal(url) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modalImg.src = url;
    modal.classList.add('active');
}

function closeImageModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('image-modal').classList.remove('active');
}

// ==================== 文件下载 ====================

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
