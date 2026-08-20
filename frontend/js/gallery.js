/**
 * gallery.js — 灵感画廊：瀑布流渲染 + 分类筛选 + 灯箱预览
 *
 * 职责：
 *   - 渲染 haowallpaper 风格的透明卡片网格（CSS columns 瀑布流）
 *   - 精选壁纸 + 动态壁纸（视频卡片）分类
 *   - 悬浮渐显信息层（标题 / 标签 / 分辨率 / 大小）
 *   - 点击卡片打开灯箱（图片或视频）
 *   - 滚动渐入动效（ScrollTrigger.batch）+ 分类切换交错动画
 */

(function () {
    'use strict';

    var PREFIX = 'assets/material/web/';

    /**
     * 画廊数据（精选，避免一股脑堆砌）：
     *  - 哲风壁纸已作为页面各区块的背景使用，画廊仅保留精选摄影 + 2 个动态壁纸
     *  - type: 'image' | 'video'
     */
    var GALLERY_ITEMS = [
        { title: '梵高·星夜', res: '3840×2160', size: '动态壁纸 · 8s', cat: 'live', tags: '后印象派 · 星空', type: 'video', thumb: 'hero-starry.jpg', full: 'starry-video.mp4' },
        { title: '月下红枫', res: '3840×2160', size: '动态壁纸 · 10s', cat: 'live', tags: '月光 · 枫叶', type: 'video', thumb: 't-moon.jpg', full: 'moon-video.mp4' },
        { title: '狮之瞳', res: '3840×2160', size: '1.1 MB', cat: 'life', tags: '微距 · 南非', type: 'image', thumb: 't-lion.jpg', full: 'lion.jpg' },
        { title: '深海光束', res: '3840×2160', size: '0.3 MB', cat: 'life', tags: '水下 · 体积光', type: 'image', thumb: 't-dolphin.jpg', full: 'dolphin.jpg' },
        { title: '草原长颈鹿', res: '3840×2160', size: '1.4 MB', cat: 'life', tags: '野生动物 · 航拍', type: 'image', thumb: 't-giraffe.jpg', full: 'giraffe.jpg' },
        { title: '费尔班克斯星夜', res: '3840×2160', size: '0.2 MB', cat: 'starry', tags: '星野 · 阿拉斯加', type: 'image', thumb: 't-fb20.jpg', full: 'fairbanks-20.jpg' },
        { title: '费尔班克斯雪林', res: '3840×2160', size: '0.2 MB', cat: 'starry', tags: '长曝光 · 星空', type: 'image', thumb: 't-fb24.jpg', full: 'fairbanks-24.jpg' },
        { title: '冷嘎措', res: '1920×1080', size: '0.2 MB', cat: 'nature', tags: '藏地雪山', type: 'image', thumb: 't-lengga.jpg', full: 'lenggacuo.jpg' },
        { title: '玉龙拉错', res: '1920×1080', size: '0.2 MB', cat: 'nature', tags: '高原湖泊', type: 'image', thumb: 't-yulong.jpg', full: 'yulonglacuo.jpg' },
        { title: '新龙红山', res: '1920×1080', size: '0.2 MB', cat: 'nature', tags: '丹霞地貌', type: 'image', thumb: 't-xinlong.jpg', full: 'xinlong.jpg' },
    ];

    var grid = document.getElementById('gallery-grid');
    var loginPage = document.getElementById('login-page');
    if (!grid || !loginPage) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasGsap = typeof gsap !== 'undefined';

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** 渲染卡片 */
    grid.innerHTML = GALLERY_ITEMS.map(function (it) {
        var badge = it.type === 'video'
            ? '<span class="g-live-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>动态</span>'
            : '';
        return '' +
            '<figure class="g-card" data-cat="' + it.cat + '" data-type="' + it.type + '" ' +
            'data-full="' + esc(PREFIX + it.full) + '" data-title="' + esc(it.title) + '" ' +
            'data-meta="' + esc(it.tags + ' · ' + it.res + ' · ' + it.size) + '" tabindex="0">' +
            '<div class="g-card-media"><img src="' + esc(PREFIX + it.thumb) + '" alt="' + esc(it.title) + '" loading="lazy"></div>' +
            badge +
            '<span class="g-res">' + esc(it.res) + '</span>' +
            '<figcaption class="g-info"><span class="g-title">' + esc(it.title) + '</span>' +
            '<span class="g-tags">' + esc(it.tags) + '</span>' +
            '<span class="g-size">' + esc(it.size) + '</span></figcaption>' +
            '</figure>';
    }).join('');

    var cards = Array.prototype.slice.call(grid.children);

    /* ---------- 滚动渐入 ---------- */
    if (hasGsap && !reduceMotion && typeof ScrollTrigger !== 'undefined') {
        gsap.set(cards, { autoAlpha: 0, y: 36 });
        ScrollTrigger.batch(cards, {
            scroller: loginPage,
            start: 'top 88%',
            once: true,
            onEnter: function (batch) {
                gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.06, ease: 'power2.out', overwrite: true });
            }
        });
    }

    /* ---------- 分类筛选 ---------- */
    var filtersBox = document.getElementById('gallery-filters');
    if (filtersBox) {
        filtersBox.addEventListener('click', function (e) {
            var btn = e.target.closest('.g-filter');
            if (!btn || btn.classList.contains('active')) return;

            filtersBox.querySelectorAll('.g-filter').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var cat = btn.dataset.cat;

            var show = [], hide = [];
            cards.forEach(function (c) {
                (cat === 'all' || c.dataset.cat === cat ? show : hide).push(c);
            });

            if (hasGsap && !reduceMotion) {
                gsap.to(hide, {
                    autoAlpha: 0, scale: 0.94, duration: 0.25, ease: 'power2.in',
                    onComplete: function () { hide.forEach(function (c) { c.style.display = 'none'; }); }
                });
                show.forEach(function (c) { c.style.display = ''; });
                gsap.fromTo(show,
                    { autoAlpha: 0, y: 22, scale: 0.96 },
                    { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.045, ease: 'power2.out', delay: 0.12, overwrite: true }
                );
            } else {
                hide.forEach(function (c) { c.style.display = 'none'; });
                show.forEach(function (c) { c.style.display = ''; });
            }
        });
    }

    /* ---------- 灯箱（图片 / 视频） ---------- */
    var lightbox = document.getElementById('g-lightbox');
    var lbImg = document.getElementById('g-lightbox-img');
    var lbVideo = document.getElementById('g-lightbox-video');
    var lbTitle = document.getElementById('g-lightbox-title');
    var lbMeta = document.getElementById('g-lightbox-meta');
    var lbBody = lightbox ? lightbox.querySelector('.g-lightbox-body') : null;

    function openLightbox(card) {
        if (!lightbox) return;
        var isVideo = card.dataset.type === 'video';
        var full = card.dataset.full;

        if (isVideo) {
            lbVideo.src = full;
            lbVideo.style.display = '';
            lbImg.style.display = 'none';
            lbImg.removeAttribute('src');
        } else {
            lbImg.src = full;
            lbImg.style.display = '';
            lbVideo.style.display = 'none';
            lbVideo.pause();
            lbVideo.removeAttribute('src');
        }

        lbTitle.textContent = card.dataset.title;
        lbMeta.textContent = card.dataset.meta;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        loginPage.style.overflow = 'hidden';

        if (hasGsap && !reduceMotion) {
            gsap.fromTo(lightbox, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out' });
            gsap.fromTo(lbBody, { autoAlpha: 0, scale: 0.93, y: 18 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: 'power3.out' });
        }
    }

    function closeLightbox() {
        if (!lightbox || !lightbox.classList.contains('open')) return;
        if (lbVideo) { lbVideo.pause(); }
        function done() {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            loginPage.style.overflow = '';
            if (lbImg) lbImg.src = '';
            if (lbVideo) { lbVideo.src = ''; }
        }
        if (hasGsap && !reduceMotion) {
            gsap.to(lbBody, { autoAlpha: 0, scale: 0.95, duration: 0.22, ease: 'power2.in' });
            gsap.to(lightbox, { autoAlpha: 0, duration: 0.25, ease: 'power1.in', onComplete: done });
        } else {
            done();
        }
    }

    grid.addEventListener('click', function (e) {
        var card = e.target.closest('.g-card');
        if (card) openLightbox(card);
    });

    grid.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('.g-card');
        if (card) { e.preventDefault(); openLightbox(card); }
    });

    if (lightbox) {
        document.getElementById('g-lightbox-backdrop').addEventListener('click', closeLightbox);
        document.getElementById('g-lightbox-close').addEventListener('click', closeLightbox);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeLightbox();
        });
    }
})();