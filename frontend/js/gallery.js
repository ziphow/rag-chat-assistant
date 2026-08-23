/**
 * gallery.js — 灵感画廊：3D 圆柱轮播（滚轮 / 拖拽驱动，物理惯性 + 无限循环）
 *
 * 职责：
 *   - 把星空 / 自然壁纸渲染为围绕竖直圆柱排列的卡片
 *   - 中心卡片最大居中、两侧卡片绕 Y 轴向后退并呈梯形透视（rotateY + translateZ）
 *   - 物理惯性驱动：滚轮 / 水平拖拽累积角速度，松手后按摩擦衰减缓缓滑行
 *   - 旋转角度无界累加，实现无缝无限循环
 *   - 点击卡片打开灯箱（图片或视频）
 */

(function () {
    'use strict';

    var PREFIX = 'assets/material/web/';

    /** 壁纸数据（thumb 用于卡片封面，full 用于灯箱大图/视频） */
    var ITEMS = [
        { thumb: 'hero-starry.jpg', full: 'starry-video.mp4', type: 'video', title: '梵高·星夜', meta: '后印象派 · 星空' },
        { thumb: 't-fb20.jpg', full: 'fairbanks-20.jpg', type: 'image', title: '费尔班克斯星夜', meta: '星野 · 阿拉斯加' },
        { thumb: 't-fb24.jpg', full: 'fairbanks-24.jpg', type: 'image', title: '费尔班克斯雪林', meta: '长曝光 · 星空' },
        { thumb: 't-vortex.jpg', full: 'zhe-vortex.jpg', type: 'image', title: '星空漩涡', meta: '星轨 · 夜空' },
        { thumb: 't-night.jpg', full: 'zhe-night.jpg', type: 'image', title: '静夜星穹', meta: '银河 · 夜空' },
        { thumb: 't-moon.jpg', full: 'moon-video.mp4', type: 'video', title: '月下红枫', meta: '月光 · 枫叶' },
        { thumb: 't-lengga.jpg', full: 'lenggacuo.jpg', type: 'image', title: '冷嘎措', meta: '藏地雪山' },
        { thumb: 't-yulong.jpg', full: 'yulonglacuo.jpg', type: 'image', title: '玉龙拉错', meta: '高原湖泊' },
        { thumb: 't-horizon.jpg', full: 'zhe-horizon.jpg', type: 'image', title: '地平线', meta: '旷野 · 天际线' },
        { thumb: 't-xinlong.jpg', full: 'xinlong.jpg', type: 'image', title: '新龙红山', meta: '丹霞地貌' },
    ];

    var stage = document.getElementById('gallery-stage');
    var carousel = document.getElementById('carousel');
    var loginPage = document.getElementById('login-page');
    if (!stage || !carousel || !loginPage) return;

    // 可触发旋转的区域：扩大到整个画廊区块（含四周留白），只要露出一丁点即可交互
    var gallerySection = loginPage.querySelector('.lp-gallery') || stage;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hasGsap = typeof gsap !== 'undefined';

    var N = ITEMS.length;
    var isMobile = window.matchMedia('(max-width: 720px)').matches;
    var R = isMobile ? 300 : 640;   // 圆柱半径（px）
    var CW = isMobile ? 160 : 320;  // 卡片宽
    var CH = isMobile ? 106 : 210;  // 卡片高

    // 尺寸以 CSS 变量挂在 stage 上，卡片与椭圆均继承
    stage.style.setProperty('--cw', CW + 'px');
    stage.style.setProperty('--ch', CH + 'px');
    stage.style.setProperty('--r', R + 'px');

    /* ---------- 渲染卡片：均匀分布在 360°/N 的圆柱上 ---------- */
    var STEP_DEG = 360 / N;
    carousel.innerHTML = ITEMS.map(function (it, i) {
        return '' +
            '<figure class="g-card" data-full="' + PREFIX + it.full + '" data-type="' + it.type + '" ' +
            'data-title="' + it.title + '" data-meta="' + it.meta + '" tabindex="0" ' +
            'style="background-image:url(\'' + PREFIX + it.thumb + '\');transform:rotateY(' + (i * STEP_DEG) + 'deg) translateZ(var(--r));">' +
            '</figure>';
    }).join('');

    /* ---------- 物理惯性：角速度 + 摩擦衰减，旋转角度无界累加（无限循环） ---------- */
    var rotation = 0;          // 累积旋转角度（无界 → 无限循环）
    var velocity = 0;          // 角速度（度/帧）
    var FRICTION = 0.97;       // 转轴「润滑油」：越大松手后滑行越久
    var WHEEL_SENS = 0.03;     // 滚轮每 1 deltaY 的角速度增量
    var DRAG_SENS = 0.5;       // 水平拖拽每 1px 的旋转角度（跟手）
    // 触屏（移动端）灵敏度更高，滑动更跟手
    if (window.matchMedia('(pointer: coarse)').matches) {
        DRAG_SENS = 0.9;
    }
    var MAX_VEL = 32;          // 角速度上限，避免一次甩飞
    var MIN_VEL = 0.01;        // 低于此值视为静止

    var rafId = null;
    var lastT = 0;             // 上一帧时间戳（基于时间步进，保证高刷/无 vsync 环境手感一致）
    var dragging = false;
    var dragStartRotation = 0;
    var dragStartX = 0;
    var dragStartY = 0;        // 方向锁定的起点 Y（判断上滑/横向意图）
    var lastDragX = 0;
    var dragMoved = 0;         // 累计拖拽位移，用于区分点击与拖拽
    var instantV = 0;          // 拖拽过程中的瞬时角速度（松开后作为惯性初速度）
    var dragAxis = null;       // 方向锁定：'h' 横向旋转 / 'v' 纵向滚动（null = 未锁定）
    var AXIS_LOCK_THRESHOLD = 8; // 位移超过此值才锁定方向

    function applyTransform() {
        carousel.style.transform = 'translate(-50%, -50%) rotateY(' + rotation + 'deg)';
    }

    function start() {
        if (rafId != null) return;
        lastT = 0;
        rafId = requestAnimationFrame(tick);
    }

    function stop() {
        if (rafId != null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        lastT = 0;
    }

    function tick(t) {
        if (!lastT) lastT = t;
        var dt = t - lastT;
        lastT = t;
        if (dt < 0) dt = 0;
        if (dt > 50) dt = 50;   // 标签页切回等跳变不累积
        var k = dt / 16.667;    // 以 60fps 帧为基准的步长系数
        rotation += velocity * k;
        velocity *= Math.pow(FRICTION, k);
        if (Math.abs(velocity) < MIN_VEL) velocity = 0;
        applyTransform();
        if (velocity === 0) {
            rafId = null;
            lastT = 0;
            return;
        }
        rafId = requestAnimationFrame(tick);
    }

    function spin(dv) {
        if (reduceMotion) {
            // 减少动态偏好：直接累加角度，不做惯性滑行
            velocity = 0;
            rotation += dv;
            applyTransform();
            return;
        }
        velocity += dv;
        if (velocity > MAX_VEL) velocity = MAX_VEL;
        else if (velocity < -MAX_VEL) velocity = -MAX_VEL;
        start();
    }

    // 滚轮：上下滚动 → 转动。不 preventDefault，页面仍可正常上下滚动（不会锁定上滑）
    gallerySection.addEventListener('wheel', function (e) {
        spin(e.deltaY * WHEEL_SENS);
    }, { passive: true });

    // 指针拖拽：方向锁定 —— 首次位移超过阈值时判断主方向
    //   横向为主 → 跟手旋转（拦截）
    //   纵向为主 → 放弃旋转，交给页面垂直滚动（不阻止上滑）
    gallerySection.addEventListener('pointerdown', function (e) {
        dragging = true;
        dragMoved = 0;
        dragAxis = null;
        dragStartRotation = rotation;
        dragStartX = lastDragX = e.clientX;
        dragStartY = e.clientY;
        instantV = 0;
        velocity = 0;
        stop();
    });

    // pointermove 绑到 document：拖拽起点更大，移出画廊区也不中断旋转
    document.addEventListener('pointermove', function (e) {
        if (!dragging) return;

        // 方向未锁定：累计位移判断主方向
        if (dragAxis === null) {
            var totalDX = e.clientX - dragStartX;
            var totalDY = e.clientY - dragStartY;
            if (Math.abs(totalDX) < AXIS_LOCK_THRESHOLD && Math.abs(totalDY) < AXIS_LOCK_THRESHOLD) {
                return; // 位移太小，不锁定，等待更大移动
            }
            // 锁定方向：横向位移 >= 纵向位移 → 旋转；否则 → 放弃，交给页面滚动
            dragAxis = (Math.abs(totalDX) >= Math.abs(totalDY)) ? 'h' : 'v';
            if (dragAxis === 'h') {
                // 进入旋转拖拽
                stage.classList.add('dragging');
            } else {
                // 纵向滚动：彻底退出拖拽，不再接管本次指针
                dragging = false;
                return;
            }
        }

        // 已锁定为横向旋转：跟手转动
        var dx = e.clientX - lastDragX;
        dragMoved += Math.abs(dx);
        // 鼠标拖拽时阻止选中文本（触屏交给 CSS touch-action，不干预滚动链）
        if (e.cancelable && e.pointerType === 'mouse') e.preventDefault();
        // 右拖 → 卡片跟随手指右移（旋转角减小）
        rotation = dragStartRotation - (e.clientX - dragStartX) * DRAG_SENS;
        instantV = -dx * DRAG_SENS;
        lastDragX = e.clientX;
        applyTransform();
    });

    function endDrag() {
        if (!dragging) return;
        dragging = false;
        dragAxis = null;
        stage.classList.remove('dragging');
        if (!reduceMotion && Math.abs(instantV) >= MIN_VEL) {
            velocity = instantV;
            start();
        }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    // 安全兜底：若指针在 stage 之外松开（拖出边界），也能正确结束拖拽
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);

    applyTransform();

    /* ---------- 灯箱（图片 / 视频） ---------- */
    var lightbox = document.getElementById('g-lightbox');
    if (!lightbox) return;
    var lbImg = document.getElementById('g-lightbox-img');
    var lbVideo = document.getElementById('g-lightbox-video');
    var lbTitle = document.getElementById('g-lightbox-title');
    var lbMeta = document.getElementById('g-lightbox-meta');

    function openLightbox(card) {
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
        }
    }

    function closeLightbox() {
        if (!lightbox.classList.contains('open')) return;
        if (lbVideo) lbVideo.pause();
        function done() {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            loginPage.style.overflow = '';
            if (lbImg) lbImg.src = '';
            if (lbVideo) lbVideo.src = '';
        }
        if (hasGsap && !reduceMotion) {
            gsap.to(lightbox, { autoAlpha: 0, duration: 0.25, ease: 'power1.in', onComplete: done });
        } else {
            done();
        }
    }

    carousel.addEventListener('click', function (e) {
        // 拖拽旋转后不触发点开灯箱，避免误触
        if (dragMoved > 6) return;
        var card = e.target.closest('.g-card');
        if (card) openLightbox(card);
    });

    carousel.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('.g-card');
        if (card) { e.preventDefault(); openLightbox(card); }
    });

    document.getElementById('g-lightbox-backdrop').addEventListener('click', closeLightbox);
    document.getElementById('g-lightbox-close').addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
    });
})();