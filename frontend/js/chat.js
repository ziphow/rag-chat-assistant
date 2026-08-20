/**
 * chat.js — 对话管理 + 消息渲染 + SSE 流式接收
 *
 * 职责：
 *   - 对话列表的加载、创建、选择、重命名、删除、清空消息
 *   - 消息列表的渲染（含 Markdown、图片、文件附件）
 *   - 发送消息 + SSE 流式接收 AI 回复
 *   - "思考中"指示器
 */

// ==================== 侧边栏收起/展开 ====================

/** 所有提示语（每次进入新对话随机选 4 条展示） */
const SUGGESTIONS = [
    { icon: '✍️', title: '写一首诗', text: '帮我写一首关于春天的诗，要有意境和韵律' },
    { icon: '💡', title: '知识问答', text: '请解释什么是机器学习中的梯度下降算法' },
    { icon: '📋', title: '制定计划', text: '帮我制定一个为期三个月的 Python 全栈学习计划' },
    { icon: '🖼️', title: '图片分析', text: '上传一张图片，我来帮你分析其中的内容' },
    { icon: '🔍', title: '网页搜索', text: '帮我搜索今天科技领域的最新新闻' },
    { icon: '📚', title: '知识库问答', text: '选择一个知识库，然后向我提问文档中的内容' },
    { icon: '💻', title: '代码助手', text: '帮我写一个 FastAPI 的 CORS 中间件配置，并解释每行代码的作用' },
    { icon: '📊', title: '数据整理', text: '帮我把一段杂乱的文字整理成结构化的表格格式' },
    { icon: '🧠', title: '头脑风暴', text: '帮我构思一个面向大学生的移动端 App 产品创意，包含核心功能和盈利模式' },
    { icon: '📝', title: '文章润色', text: '帮我润色一段技术博客的草稿，使其更专业更易读' },
    { icon: '🤔', title: '对比分析', text: '帮我对比分析 React 和 Vue 的优缺点，给出选型建议' },
    { icon: '🐛', title: '调试求助', text: '我遇到一个 Python 报错：KeyError: 0，帮我分析可能的原因' },
];

/** 随机选取 n 条不重复的提示语 */
function pickRandomSuggestions(n = 4) {
    const shuffled = [...SUGGESTIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

/** 渲染欢迎页的提示卡片 */
function renderSuggestions() {
    const container = document.getElementById('suggestion-cards');
    if (!container) return;
    const picks = pickRandomSuggestions(4);
    container.innerHTML = picks.map(s => `
        <div class="suggestion-card" data-text="${escapeHtml(s.text)}">
            <div class="suggestion-icon">${s.icon}</div>
            <div class="suggestion-text">
                <strong>${escapeHtml(s.title)}</strong>
                <span>${escapeHtml(s.text)}</span>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            useSuggestion(card.dataset.text || '');
        });
    });
}

/** 切换侧边栏收起/展开状态 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
}

// ==================== 复制 AI 消息 ====================

/** 复制消息的纯文本内容到剪贴板（AI 和用户消息通用） */
function copyMessage(btn) {
    const msgEl = btn.closest('.message');
    if (!msgEl) return;
    const bubble = msgEl.querySelector('.message-bubble');
    if (!bubble) return;

    const text = bubble.innerText || bubble.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span class="copy-label">已复制</span>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = original;
        }, 1500);
    }).catch(() => {
        showToast('复制失败', 'error');
    });
}

// ==================== 对话列表管理 ====================

/**
 * 从后端加载对话列表
 */
function loadChatHistory() {
    request('/chats').then(res => {
        state.chats = res.data;
        renderChatHistory();
    });
}

/**
 * 渲染侧边栏对话列表
 * @param {string} filter - 搜索过滤关键词（空字符串 = 显示全部）
 */
function renderChatHistory(filter = '') {
    const listEl = document.getElementById('chat-history-list');
    listEl.innerHTML = '';

    const filtered = filter
        ? state.chats.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()))
        : state.chats;

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted); font-size:13px;">
                ${filter ? '未找到匹配的对话' : '暂无对话记录'}
            </div>
        `;
        return;
    }

    filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-history-item' + (chat.id === state.currentChatId ? ' active' : '');
        item.onclick = () => selectChat(chat.id);
        item.innerHTML = `
            <div class="chat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="chat-info">
                <div class="chat-name">${escapeHtml(chat.title)}</div>
                <div class="chat-time">${formatTime(chat.updatedAt)}</div>
            </div>
            <div class="chat-actions">
                <button class="chat-action-btn rename" onclick="event.stopPropagation(); renameChat(${chat.id})" title="重命名">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="chat-action-btn delete" onclick="event.stopPropagation(); deleteChat(${chat.id})" title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

/** 搜索对话 */
function searchChats() {
    const keyword = document.getElementById('search-chat').value;
    renderChatHistory(keyword);
}

/** 创建新对话 */
async function createNewChat() {
    try {
        const res = await request('/chats', {
            method: 'POST',
            body: JSON.stringify({ title: '新对话' })
        });
        const newChat = {
            id: res.data.id,
            title: res.data.title,
            messages: [],
            createdAt: res.data.createdAt,
            updatedAt: res.data.updatedAt,
        };
        state.chats.unshift(newChat);
        state.currentChatId = newChat.id;
        renderChatHistory();
        renderMessages();
        document.getElementById('current-chat-title').textContent = newChat.title;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/** 选择对话（加载该对话的消息） */
async function selectChat(chatId) {
    state.currentChatId = chatId;
    const chat = state.chats.find(c => c.id === chatId);
    if (chat) {
        document.getElementById('current-chat-title').textContent = chat.title;
        renderChatHistory();
        try {
            const res = await request(`/chats/${chatId}`);
            chat.messages = res.data || [];
            renderMessages();
        } catch (error) {
            chat.messages = [];
            renderMessages();
            showToast(error.message, 'error');
        }
    }
}

/** 重命名对话 */
async function renameChat(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    const newTitle = prompt('请输入新的对话标题：', chat.title);
    if (!newTitle || newTitle.trim() === '' || newTitle.trim() === chat.title) return;

    try {
        await request(`/chats/${chatId}`, {
            method: 'PUT',
            body: JSON.stringify({ title: newTitle.trim() })
        });
        chat.title = newTitle.trim();
        if (state.currentChatId === chatId) {
            document.getElementById('current-chat-title').textContent = chat.title;
        }
        renderChatHistory();
        showToast('重命名成功', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/** 删除对话 */
async function deleteChat(chatId) {
    if (!confirm('确定删除这个对话吗？')) return;

    try {
        await request(`/chats/${chatId}`, { method: 'DELETE' });
        state.chats = state.chats.filter(c => c.id !== chatId);

        if (state.currentChatId === chatId) {
            state.currentChatId = null;
            document.getElementById('current-chat-title').textContent = '新对话';
            renderMessages();
        }
        renderChatHistory();
        showToast('对话已删除', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/** 清空当前对话的所有消息 */
async function clearCurrentChat() {
    if (!state.currentChatId) {
        showToast('当前没有对话', 'info');
        return;
    }
    if (!confirm('确定清空当前对话的所有消息吗？')) return;

    try {
        await request(`/chats/${state.currentChatId}/messages`, { method: 'DELETE' });
        const chat = state.chats.find(c => c.id === state.currentChatId);
        if (chat) {
            chat.messages = [];
            renderMessages();
        }
        showToast('已清空对话', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== 消息渲染 ====================

/** 渲染消息列表（保留 welcome-screen，只移除 .message 元素） */
function renderMessages() {
    const listEl = document.getElementById('message-list');
    const welcomeEl = document.getElementById('welcome-screen');

    listEl.querySelectorAll('.message').forEach(el => el.remove());

    if (!state.currentChatId) {
        if (welcomeEl) {
            welcomeEl.style.display = 'flex';
            renderSuggestions();
        }
        return;
    }

    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat || !chat.messages || chat.messages.length === 0) {
        if (welcomeEl) {
            welcomeEl.style.display = 'flex';
            renderSuggestions();
        }
        return;
    }

    if (welcomeEl) welcomeEl.style.display = 'none';

    chat.messages.forEach(msg => {
        listEl.appendChild(createMessageElement(msg));
    });

    scrollToBottom();
}

/**
 * 创建单条消息的 DOM 元素
 * @param {object} msg - 消息对象 {role, content, images, files}
 */
function createMessageElement(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role}`;

    const avatarHtml = msg.role === 'user'
        ? (state.currentUser?.username?.charAt(0)?.toUpperCase() || 'U')
        : '<img src="ai-avatar.jpg" alt="AI" class="avatar-img">';

    let contentHtml = '';

    // 文本内容（Markdown 渲染）
    if (msg.content) {
        contentHtml += `<div class="message-bubble">${renderMarkdown(msg.content)}</div>`;
    }

    // 图片附件
    if (msg.images && msg.images.length > 0) {
        contentHtml += '<div class="message-images">';
        msg.images.forEach(img => {
            contentHtml += `<img class="message-image" src="${img.url}" alt="${escapeHtml(img.name)}" onclick="openImageModal('${img.url}')">`;
        });
        contentHtml += '</div>';
    }

    // 文件附件
    if (msg.files && msg.files.length > 0) {
        contentHtml += '<div class="message-files">';
        msg.files.forEach(file => {
            const ext = file.name.split('.').pop().toUpperCase().slice(0, 3);
            contentHtml += `
                <div class="message-file" onclick="downloadFile('${file.url || ''}', '${escapeHtml(file.name)}')">
                    <div class="message-file-icon">${ext}</div>
                    <div class="message-file-info">
                        <div class="message-file-name">${escapeHtml(file.name)}</div>
                        <div class="message-file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
            `;
        });
        contentHtml += '</div>';
    }

    // 所有消息添加复制按钮（AI 和用户消息均可复制）
    let actionsHtml = '';
    if (msg.content) {
        actionsHtml = `
            <div class="message-actions">
                <button class="msg-action-btn copy-btn" onclick="copyMessage(this)" title="复制">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span class="copy-label">复制</span>
                </button>
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarHtml}</div>
        <div class="message-content">
            ${contentHtml}
            ${actionsHtml}
        </div>
    `;

    return messageDiv;
}

/**
 * 流式更新单条消息的气泡内容（不重建整个列表）
 * @param {HTMLElement} msgEl - 消息 DOM 元素
 * @param {string} content - 当前累积的完整内容
 */
function updateMessageBubble(msgEl, content) {
    if (!msgEl) return;
    let bubble = msgEl.querySelector('.message-bubble');
    if (!bubble) {
        // 首次更新时 content 为空，bubble 还没创建，这里补建
        const contentDiv = msgEl.querySelector('.message-content');
        if (contentDiv) {
            bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            contentDiv.appendChild(bubble);
        }
    }
    if (bubble) {
        bubble.innerHTML = renderMarkdown(content);
    }
}

// ==================== "思考中" 指示器 ====================

function showTypingIndicator() {
    const listEl = document.getElementById('message-list');
    const welcomeEl = document.getElementById('welcome-screen');
    if (welcomeEl) welcomeEl.style.display = 'none';

    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = 'typing-indicator-msg';
    typingDiv.innerHTML = `
        <div class="message-avatar"><img src="ai-avatar.jpg" alt="AI" class="avatar-img"></div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span class="typing-label">思考中</span>
                    <div class="typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        </div>
    `;
    listEl.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typingEl = document.getElementById('typing-indicator-msg');
    if (typingEl) typingEl.remove();
}

// ==================== 发送消息 + SSE 流式接收 ====================

async function sendMessage() {
    const inputEl = document.getElementById('message-input');
    const text = inputEl.value.trim();

    // 无效内容校验：纯空格/空内容且无文件时阻止发送
    if (!text && state.selectedFiles.length === 0) {
        showToast('请输入消息内容或上传文件', 'info');
        return;
    }
    if (state.isWaitingResponse) {
        showToast('正在等待 AI 回复，请稍候...', 'info');
        return;
    }

    // 确保有当前对话
    if (!state.currentChatId) {
        await createNewChat();
    }

    const chat = state.chats.find(c => c.id === state.currentChatId);

    // 构建用户消息
    const userMessage = {
        role: 'user',
        content: text,
        images: [],
        files: [],
        timestamp: new Date().toISOString(),
    };

    // 检查文件上传状态
    const uploadingFiles = state.selectedFiles.filter(f => f.uploading);
    if (uploadingFiles.length > 0) {
        showToast('文件正在上传，请稍候...', 'info');
        return;
    }
    const failedFiles = state.selectedFiles.filter(f => f.uploadError);
    if (failedFiles.length > 0) {
        showToast(`文件 ${failedFiles[0].name} 上传失败，请移除后重新选择`, 'error');
        return;
    }

    // 将已上传文件加入消息
    for (const file of state.selectedFiles) {
        if (file.type.startsWith('image/')) {
            userMessage.images.push({ url: file.url, name: file.name, size: file.size });
        } else {
            userMessage.files.push({ name: file.name, size: file.size, url: file.url || '', fileId: file.fileId || '' });
        }
    }

    // 记录是否为新对话（发送前没有任何消息）
    const isNewChat = chat.messages.length === 0;

    // 渲染用户消息
    chat.messages.push(userMessage);
    chat.updatedAt = new Date().toISOString();
    inputEl.value = '';
    autoResize(inputEl);
    state.selectedFiles = [];
    renderFilePreview();
    renderMessages();
    renderChatHistory();

    // 显示思考中
    state.isWaitingResponse = true;
    const sendBtn = document.getElementById('btn-send');
    if (sendBtn) sendBtn.disabled = true;
    showTypingIndicator();

    try {
        // 发送请求（支持 SSE 流式回复）
        const response = await fetch(API_CONFIG.baseURL + '/message/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
                chat_id: chat.id,
                content: text,
                images: userMessage.images,
                files: userMessage.files,
                kb_id: state.currentKbId,
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || errData.message || `请求失败 (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
            // ===== SSE 流式回复 =====
            hideTypingIndicator();

            const aiMessage = {
                role: 'ai',
                content: '',
                images: [],
                files: [],
                timestamp: new Date().toISOString(),
            };
            chat.messages.push(aiMessage);
            renderMessages();

            // 获取刚创建的 AI 消息 DOM 元素
            const listEl = document.getElementById('message-list');
            const msgEls = listEl.querySelectorAll('.message');
            const aiMsgEl = msgEls[msgEls.length - 1];

            // 在气泡中显示"思考中"
            let bubble = aiMsgEl.querySelector('.message-bubble');
            if (!bubble) {
                const contentDiv = aiMsgEl.querySelector('.message-content');
                if (contentDiv) {
                    bubble = document.createElement('div');
                    bubble.className = 'message-bubble';
                    contentDiv.appendChild(bubble);
                }
            }
            if (bubble) {
                bubble.innerHTML = '<span class="thinking-status"><span class="thinking-spinner"></span>思考中</span>';
            }

            // 逐块读取 SSE 事件
            let hasContent = false;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'start') {
                            // 保持"思考中"显示
                        } else if (data.type === 'chunk' || data.type === 'delta') {
                            if (!hasContent) hasContent = true;
                            aiMessage.content += data.content || '';
                            updateMessageBubble(aiMsgEl, aiMessage.content);
                            scrollToBottom();
                        } else if (data.type === 'done' || data.type === 'end') {
                            if (data.content) aiMessage.content = data.content;
                            renderMessages();
                        } else if (data.type === 'error') {
                            throw new Error(data.content || data.message || 'AI 回复失败');
                        }
                    } catch (e) {
                        // 忽略解析失败的行
                    }
                }
            }

            // 流结束但无内容
            if (!hasContent && !aiMessage.content) {
                aiMessage.content = '（AI 未返回内容，请重试）';
                renderMessages();
            }
        } else {
            // ===== 普通JSON回复（向后兼容）=====
            const res = await response.json();
            hideTypingIndicator();

            const aiMessage = {
                role: 'ai',
                content: res.data.aiMessage.content,
                images: [],
                files: [],
                timestamp: new Date().toISOString(),
            };
            chat.messages.push(aiMessage);
            renderMessages();
        }

        chat.updatedAt = new Date().toISOString();
        renderChatHistory();

        // 新对话第一轮交流后，调用后端生成标题
        if (isNewChat) {
            try {
                const titleRes = await request(`/chats/${chat.id}/create_title`, { method: 'GET' });
                if (titleRes.data && titleRes.data.title) {
                    chat.title = titleRes.data.title;
                    document.getElementById('current-chat-title').textContent = chat.title;
                    renderChatHistory();
                }
            } catch (e) {
                // 标题生成失败不影响主流程
            }
        }
    } catch (err) {
        hideTypingIndicator();
        showToast(err.message || '发送失败，请重试', 'error');
    } finally {
        state.isWaitingResponse = false;
        const sendBtn = document.getElementById('btn-send');
        if (sendBtn) sendBtn.disabled = false;
        document.getElementById('message-input').focus();
    }
}

/** 键盘事件：Enter 发送，Shift+Enter 换行 */
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

/** 使用欢迎页建议消息 */
function useSuggestion(text) {
    const inputEl = document.getElementById('message-input');
    inputEl.value = text;
    autoResize(inputEl);
    inputEl.focus();
}
