/**
 * knowledge-base.js — 知识库管理 UI 逻辑
 *
 * 职责：
 *   - 侧边栏 Tab 切换
 *   - 知识库的创建、列表渲染、删除
 *   - 知识库文档的上传、列表、删除
 *   - 聊天输入区的知识库选择器
 */

// ==================== Tab 切换 ====================

/**
 * 侧边栏面板切换：GSAP 驱动的丝滑滑行（面板叠放 + 位移淡入淡出），
 * 同时滑动底部指示条；无 GSAP / 减少动态效果时退化为瞬时切换。
 */
function switchSidebarTab(tab) {
    var isChats = tab === 'chats';
    var showBtn = document.getElementById(isChats ? 'tab-chats' : 'tab-knowledge');
    var showEl = document.getElementById(isChats ? 'tab-content-chats' : 'tab-content-knowledge');
    var hideEl = document.getElementById(isChats ? 'tab-content-knowledge' : 'tab-content-chats');
    if (!showEl) return;

    var alreadyActive = showEl.classList.contains('active');

    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    if (showBtn) showBtn.classList.add('active');
    var tabsBox = document.getElementById('sidebar-tabs');
    if (tabsBox) tabsBox.dataset.active = tab;

    var dir = isChats ? -1 : 1; // chats→knowledge 向左滑，反向反之
    var canAnimate = typeof gsap !== 'undefined'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (alreadyActive && canAnimate && hideEl) {
        // 快速连点回同面板：仅复位另一面板的位移
        gsap.set(hideEl, { clearProps: 'x,opacity,visibility' });
    }

    if (!alreadyActive) {
        showEl.classList.add('active');
        if (hideEl) hideEl.classList.remove('active');

        if (canAnimate && hideEl) {
            gsap.to(hideEl, {
                x: -52 * dir,
                autoAlpha: 0,
                duration: 0.26,
                ease: 'power2.in',
                overwrite: true,
            });
            gsap.fromTo(showEl,
                { x: 52 * dir, autoAlpha: 0 },
                {
                    x: 0,
                    autoAlpha: 1,
                    duration: 0.46,
                    delay: 0.1,
                    ease: 'power3.out',
                    overwrite: true,
                }
            );
        }
    }

    if (!isChats) loadKnowledgeBases();
}

// ==================== 知识库列表 ====================

/** 从后端加载知识库列表 */
function loadKnowledgeBases() {
    request('/knowledge-bases').then(res => {
        state.knowledgeBases = res.data || res || [];
        renderKnowledgeBases();
        renderKbSelectorOptions();
    }).catch(() => {
        state.knowledgeBases = [];
        renderKnowledgeBases();
        renderKbSelectorOptions();
    });
}

/** 渲染侧边栏知识库列表 */
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
                <div class="kb-meta">${kb.documentCount || kb.doc_count || 0} 个文档</div>
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

    // 列表项依次滑入
    const items = listEl.querySelectorAll('.kb-item');
    if (items.length && typeof gsap !== 'undefined'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo(items,
            { autoAlpha: 0, x: 26 },
            { autoAlpha: 1, x: 0, duration: 0.42, stagger: 0.05, ease: 'power2.out', overwrite: true, clearProps: 'transform' }
        );
    }
}

// ==================== 创建知识库 ====================

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

// ==================== 删除知识库 ====================

/**
 * 删除知识库
 * 注意：后端尚未实现 DELETE /knowledge-bases/{kb_id} 接口
 */
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

// ==================== 知识库文档管理 ====================

/** 打开知识库文档管理弹窗 */
async function showKbDetail(kbId) {
    state.currentDetailKbId = kbId;
    const kb = state.knowledgeBases.find(k => k.id === kbId);
    if (kb) {
        document.getElementById('kb-detail-title').textContent = kb.name + ' - 文档管理';
    }
    openModal('kb-detail-modal');
    await loadKbDocuments(kbId);
}

/** 加载知识库的文档列表 */
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
            const ext = (doc.filename || doc.name || '').split('.').pop().toUpperCase().slice(0, 4);
            const statusText = doc.status === 'ready' || doc.status === 'success'
                ? '已就绪'
                : doc.status === 'processing' ? '处理中' : '失败';
            item.innerHTML = `
                <div class="kb-doc-icon">${ext}</div>
                <div class="kb-doc-info">
                    <div class="kb-doc-name">${escapeHtml(doc.filename || doc.name)}</div>
                    <div class="kb-doc-meta">
                        <span>${formatFileSize(doc.fileSize || doc.file_size)}</span>
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

/** 触发文件选择（知识库文档上传） */
function triggerKbDocUpload() {
    document.getElementById('kb-doc-input').click();
}

/** 处理知识库文档上传 */
async function handleKbDocUpload(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';

    for (const file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await request(`/knowledge-bases/${state.currentDetailKbId}/documents`, {
                method: 'POST',
                body: formData,
            });
            // 后端立即返回 processing 状态
            showToast(`${file.name} 上传成功，正在处理...`, 'info');
        } catch (err) {
            showToast(`${file.name} 上传失败: ${err.message}`, 'error');
        }
    }

    // 立即刷新文档列表（显示 processing 状态），然后启动轮询
    await loadKbDocuments(state.currentDetailKbId);
    loadKnowledgeBases();
    pollKbDocumentStatus();
}

/** 轮询知识库文档状态，直到所有文档不再是 processing */
let kbPollingTimer = null;
function pollKbDocumentStatus() {
    if (kbPollingTimer) clearTimeout(kbPollingTimer);

    kbPollingTimer = setTimeout(async () => {
        try {
            const res = await request(`/knowledge-bases/${state.currentDetailKbId}/documents`);
            const docs = res.data || [];
            const hasProcessing = docs.some(d => d.status === 'processing');

            // 刷新文档列表
            renderKbDocumentList(docs);

            if (hasProcessing) {
                // 还有处理中的文档，继续轮询
                pollKbDocumentStatus();
            } else {
                // 全部处理完毕，刷新知识库计数
                loadKnowledgeBases();
            }
        } catch (err) {
            // 轮询出错则停止
        }
    }, 3000);
}

/** 仅渲染文档列表（不重新请求） */
function renderKbDocumentList(docs) {
    const listEl = document.getElementById('kb-doc-list');
    if (!listEl) return;

    if (!docs || docs.length === 0) {
        listEl.innerHTML = '<div class="kb-doc-empty">暂无文档，点击上方按钮上传</div>';
        return;
    }

    listEl.innerHTML = '';
    docs.forEach(doc => {
        const item = document.createElement('div');
        item.className = 'kb-doc-item';
        const ext = (doc.filename || doc.name || '').split('.').pop().toUpperCase().slice(0, 4);
        const statusText = doc.status === 'success' || doc.status === 'ready'
            ? '已就绪'
            : doc.status === 'processing' ? '处理中' : '失败';
        item.innerHTML = `
            <div class="kb-doc-icon">${ext}</div>
            <div class="kb-doc-info">
                <div class="kb-doc-name">${escapeHtml(doc.filename || doc.name)}</div>
                <div class="kb-doc-meta">
                    <span>${formatFileSize(doc.fileSize || doc.file_size)}</span>
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
}

/**
 * 删除知识库文档
 * 注意：后端尚未实现 DELETE /knowledge-bases/{kb_id}/documents/{doc_id} 接口
 */
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

// ==================== 聊天区知识库选择器 ====================

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

/** 选择/取消选择聊天用的知识库 */
function selectKbForChat(kbId) {
    state.currentKbId = kbId;
    document.getElementById('kb-selector-menu').style.display = 'none';

    const labelEl = document.getElementById('kb-selector-label');
    const btnEl = document.getElementById('kb-selector-btn');

    if (kbId) {
        const kb = state.knowledgeBases.find(k => k.id === kbId);
        labelEl.textContent = kb ? kb.name : '未知知识库';
        btnEl.classList.add('active');

        // 知识库无文档时提醒（不阻止操作）
        const docCount = kb ? (kb.documentCount || kb.doc_count || 0) : 0;
        if (docCount === 0) {
            showToast(`知识库「${kb ? kb.name : '未知'}」还没有文档，回答将不会使用知识库内容`, 'warning');
        }
    } else {
        labelEl.textContent = '不使用知识库';
        btnEl.classList.remove('active');
    }

    renderKbSelectorOptions();
}
