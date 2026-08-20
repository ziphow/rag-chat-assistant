/**
 * markdown.js — 轻量 Markdown 渲染器
 *
 * 支持：代码块、行内代码、标题、加粗、斜体、
 *       无序列表、有序列表、表格、引用、链接、分隔线、
 *       数学公式（KaTeX：$...$ 行内 / $$...$$ 块级）
 *
 * 注意：这是简易实现，不是完整的 Markdown 解析器。
 *       对于 AI 回复内容足够使用，复杂文档建议用 marked.js 等库。
 */

/**
 * 将 Markdown 文本渲染为 HTML
 * @param {string} text - Markdown 原文
 * @returns {string} HTML 字符串
 */
function renderMarkdown(text) {
    if (!text) return '';

    // 0. 先提取数学公式（$$...$$ 块级、$...$ 行内），避免被后续规则破坏
    const mathBlocks = [];
    let html = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        const ph = `__MATHBLOCK_${mathBlocks.length}__`;
        mathBlocks.push({ ph, formula: formula.trim(), display: true });
        return ph;
    });
    html = html.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
        const ph = `__MATHBLOCK_${mathBlocks.length}__`;
        mathBlocks.push({ ph, formula: formula.trim(), display: false });
        return ph;
    });

    // 1. 先提取代码块，避免内部内容被其他规则破坏
    const codeBlocks = [];
    html = escapeHtml(html);
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ placeholder, lang, code: code.trim() });
        return placeholder;
    });

    // 2. 提取行内代码
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINECODE_${inlineCodes.length}__`;
        inlineCodes.push({ placeholder, code });
        return placeholder;
    });

    // 3. 表格（必须在其他处理之前，按行匹配）
    html = html.replace(/^(\|.+\|)\n(\|[\s\-:|]+\|)\n((?:\|.+\|\n?)*)/gm, (match, headerRow, sepRow, bodyRows) => {
        const headers = headerRow.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(h => h.trim());
        const rows = bodyRows.trim().split('\n').filter(r => r.trim()).map(r =>
            r.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim())
        );
        let table = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
        headers.forEach(h => table += `<th>${h}</th>`);
        table += '</tr></thead><tbody>';
        rows.forEach(r => {
            table += '<tr>';
            for (let i = 0; i < headers.length; i++) {
                table += `<td>${r[i] || ''}</td>`;
            }
            table += '</tr>';
        });
        table += '</tbody></table></div>';
        return table;
    });

    // 4. 标题（h4 → h1，倒序匹配避免 # 被吃掉）
    html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

    // 5. 分隔线
    html = html.replace(/^---+$/gm, '<hr class="md-hr">');

    // 6. 引用块
    html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

    // 7. 加粗和斜体
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // 8. 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>');

    // 9. 无序列表
    html = html.replace(/^(\s*)[-*]\s+(.+)$/gm, '$1<li class="md-li">$2</li>');
    html = html.replace(/(<li class="md-li">.*?<\/li>\n?)+/g, (match) => '<ul class="md-ul">' + match + '</ul>');

    // 10. 有序列表
    html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1<li class="md-li">$2</li>');
    html = html.replace(/(<li class="md-li">.*?<\/li>\n?)+(?!<ul)/g, (match) => {
        if (match.includes('<ul')) return match;
        return '<ol class="md-ol">' + match + '</ol>';
    });

    // 11. 段落和换行（已经是 HTML 标签开头的不包裹 <p>）
    html = html.split('\n\n').map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (/^<(h\d|ul|ol|pre|blockquote|hr|div|table)/.test(trimmed)) return trimmed;
        if (/^__CODEBLOCK_/.test(trimmed)) return trimmed;
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    // 12. 还原行内代码
    inlineCodes.forEach(item => {
        html = html.replace(item.placeholder, `<code>${item.code}</code>`);
    });

    // 13. 还原代码块
    codeBlocks.forEach(item => {
        html = html.replace(item.placeholder, `<pre><code>${item.code}</code></pre>`);
    });

    // 14. 还原数学公式（用 KaTeX 渲染，失败则回退为转义后的原文）
    mathBlocks.forEach(item => {
        let rendered;
        try {
            rendered = katex.renderToString(item.formula, {
                throwOnError: false,
                displayMode: item.display,
            });
        } catch (e) {
            rendered = escapeHtml(item.formula);
        }
        html = html.split(item.ph).join(rendered);
    });

    return html;
}