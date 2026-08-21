/**
 * config.js — 全局配置、状态管理、Token 管理
 *
 * 职责：
 *   - 保存后端 API 地址等配置
 *   - 维护全局应用状态（当前用户、对话列表、知识库等）
 *   - Token 的读取、设置、清除（localStorage）
 */

// ==================== API 配置 ====================

const API_CONFIG = {
    // 本地开发（http 或 file:// 直接打开）指向本地后端；部署后与后端同源（nginx 反代），走空字符串相对路径
    baseURL: (location.protocol !== 'http:' && location.protocol !== 'https:') || ['127.0.0.1', 'localhost'].includes(location.hostname) ? 'http://127.0.0.1:8000' : '',
    tokenKey: 'ai_chat_token',          // localStorage 中存储 token 的 key
};

// ==================== 全局状态 ====================
// 整个应用共享的状态对象，所有模块通过 state.xxx 读写

const state = {
    currentUser: null,       // 当前登录用户信息 {id, username, email}
    chats: [],               // 对话列表 [{id, title, messages, ...}]
    currentChatId: null,     // 当前选中的对话 ID
    selectedFiles: [],       // 待发送的已上传文件列表
    isWaitingResponse: false,// 是否正在等待 AI 回复（防止重复发送）
    knowledgeBases: [],      // 知识库列表
    currentKbId: null,       // 聊天时选择的知识库 ID（null = 不使用）
    currentDetailKbId: null, // 正在查看文档管理的知识库 ID
};

// ==================== Token 管理 ====================

function getToken() {
    return localStorage.getItem(API_CONFIG.tokenKey);
}

function setToken(token) {
    localStorage.setItem(API_CONFIG.tokenKey, token);
}

function clearToken() {
    localStorage.removeItem(API_CONFIG.tokenKey);
}
