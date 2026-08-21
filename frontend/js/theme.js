/**
 * theme.js — 主题系统
 *
 * 职责：
 *   - 定义多套质感主题（非纯黑/纯白），默认「暗夜」dark
 *   - 切换 document.documentElement 的 data-theme 属性
 *   - 个人设置面板渲染主题色块，点击即切，localStorage 持久化
 */

(function () {
    'use strict';

    var STORAGE_KEY = 'zy_theme';

    /** 主题定义：暗夜为默认；swatch 为色块展示色（用于选择面板） */
    var THEMES = [
        { id: 'dark', name: '暗夜', desc: '深邃蓝紫星空', swatch: 'linear-gradient(135deg, #10122a, #3b2f63)' },
        { id: 'light', name: '晨光', desc: '暖调米白石墨', swatch: 'linear-gradient(135deg, #f6f3ec, #d8d3c6)' },
        { id: 'twilight', name: '暮紫', desc: '薰衣草黄昏', swatch: 'linear-gradient(135deg, #4a3565, #a071a8)' },
        { id: 'sage', name: '苔青', desc: '森系草木绿', swatch: 'linear-gradient(135deg, #1d2f28, #4f7a5f)' },
    ];

    var current = null;

    function normalize(id) {
        return THEMES.some(function (t) { return t.id === id; }) ? id : null;
    }

    function load() {
        var saved = localStorage.getItem(STORAGE_KEY);
        current = normalize(saved) || 'dark';
        apply(current);
        renderOptions();
        return current;
    }

    function apply(id) {
        document.documentElement.setAttribute('data-theme', id);
    }

    function setTheme(id) {
        id = normalize(id);
        if (!id || id === current) return;
        current = id;
        localStorage.setItem(STORAGE_KEY, id);
        apply(id);
        renderOptions();
    }

    function renderOptions() {
        var box = document.getElementById('theme-options');
        if (!box) return;
        box.innerHTML = THEMES.map(function (t) {
            var active = t.id === current;
            return '<button class="theme-option' + (active ? ' active' : '') + '" data-theme="' + t.id +
                '" role="radio" aria-checked="' + active + '" aria-label="' + t.name + '">' +
                '<span class="theme-swatch" style="background:' + t.swatch + '"></span>' +
                '<span class="theme-meta"><span class="theme-name">' + t.name + '</span>' +
                '<span class="theme-desc">' + t.desc + '</span></span>' +
                (active ? '<span class="theme-check">✓</span>' : '') +
                '</button>';
        }).join('');
    }

    document.addEventListener('DOMContentLoaded', function () {
        load();
        var box = document.getElementById('theme-options');
        if (box) {
            box.addEventListener('click', function (e) {
                var opt = e.target.closest('.theme-option');
                if (opt) setTheme(opt.dataset.theme);
            });
        }
    });

    window.Theme = { list: THEMES, current: function () { return current; }, set: setTheme, load: load };
})();