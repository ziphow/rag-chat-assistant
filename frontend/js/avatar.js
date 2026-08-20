/**
 * avatar.js — 用户头像系统
 *
 * 职责：
 *   - 4 张默认头像的注册与选择
 *   - 登录后按用户名读取头像（无则随机分配）
 *   - 点击侧边栏头像弹出选择面板，自由切换
 *   - localStorage 按用户名持久化
 */

(function () {
    'use strict';

    var AVATARS = [
        { id: 0, src: 'assets/avatars/avatar-0.png', name: '赤林巨兽' },
        { id: 1, src: 'assets/avatars/avatar-1.png', name: '夜翼独角兽' },
        { id: 2, src: 'assets/avatars/avatar-2.png', name: '时代广场' },
        { id: 3, src: 'assets/avatars/avatar-3.png', name: '雪地赤狐' },
    ];

    var STORAGE_PREFIX = 'zy_avatar_';
    var currentUser = null;

    function storageKey(username) {
        return STORAGE_PREFIX + username;
    }

    function applyToDom(index) {
        var img = document.getElementById('user-avatar-img');
        if (img) img.src = AVATARS[index].src;
    }

    /** 读取指定用户头像；无记录则随机分配并持久化，返回 index */
    function loadForUser(username) {
        if (username) currentUser = username;
        if (!currentUser) return 0;

        var raw = localStorage.getItem(storageKey(currentUser));
        var idx = Number(raw);
        if (raw === null || isNaN(idx) || idx < 0 || idx >= AVATARS.length) {
            idx = Math.floor(Math.random() * AVATARS.length);
            localStorage.setItem(storageKey(currentUser), String(idx));
        }
        applyToDom(idx);
        return idx;
    }

    function currentIndex() {
        if (!currentUser) return -1;
        var raw = localStorage.getItem(storageKey(currentUser));
        var idx = Number(raw);
        return isNaN(idx) ? -1 : idx;
    }

    function currentSrc() {
        var idx = currentIndex();
        if (idx < 0 || idx >= AVATARS.length) return AVATARS[0].src;
        return AVATARS[idx].src;
    }

    function setAvatar(index) {
        index = Number(index);
        if (!currentUser || isNaN(index) || index < 0 || index >= AVATARS.length) return;
        localStorage.setItem(storageKey(currentUser), String(index));
        applyToDom(index);
        renderGrid();
    }

    function renderGrid() {
        var grid = document.getElementById('avatar-grid');
        if (!grid) return;
        var active = currentIndex();
        grid.innerHTML = AVATARS.map(function (a) {
            return '<button class="avatar-option' + (a.id === active ? ' active' : '') +
                '" data-idx="' + a.id + '" title="' + a.name + '" aria-label="' + a.name + '">' +
                '<img src="' + a.src + '" alt="' + a.name + '">' +
                '<span class="avatar-option-name">' + a.name + '</span></button>';
        }).join('');
    }

    function openPicker() {
        var picker = document.getElementById('avatar-picker');
        if (!picker) return;
        renderGrid();
        picker.classList.add('open');
        picker.setAttribute('aria-hidden', 'false');
    }

    function closePicker() {
        var picker = document.getElementById('avatar-picker');
        if (!picker) return;
        picker.classList.remove('open');
        picker.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var grid = document.getElementById('avatar-grid');
        if (grid) {
            grid.addEventListener('click', function (e) {
                var opt = e.target.closest('.avatar-option');
                if (opt) {
                    setAvatar(opt.dataset.idx);
                    closePicker();
                }
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closePicker();
        });
    });

    window.Avatar = { list: AVATARS, loadForUser: loadForUser, setAvatar: setAvatar, currentSrc: currentSrc, openPicker: openPicker, closePicker: closePicker };
    window.openAvatarPicker = openPicker;
    window.closeAvatarPicker = closePicker;
})();