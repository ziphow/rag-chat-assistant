/**
 * animations.js — GSAP 视觉增强（不改变业务逻辑）
 *
 * 依赖：全局 gsap、ScrollTrigger（CDN）
 * 通过 window.Anim 对外暴露，供 chat / utils / file-upload / auth 调用。
 */

(function () {
    if (typeof gsap === 'undefined') {
        window.Anim = createNoopAnim();
        return;
    }

    if (typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
    }

    gsap.defaults({ ease: 'power2.out', duration: 0.4 });

    let reduceMotion = false;
    gsap.matchMedia().add(
        {
            reduceMotion: '(prefers-reduced-motion: reduce)',
            motionOk: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
            reduceMotion = !!context.conditions.reduceMotion;
        }
    );

    let historyScrollCtx = null;
    let dragVisible = false;
    const streamPulses = new WeakMap();

    function dur(seconds) {
        return reduceMotion ? 0 : seconds;
    }

    function createNoopAnim() {
        const noop = () => {};
        return {
            loginInit: noop,
            loginCleanup: noop,
            pageEntrance: noop,
            staggerSuggestions: noop,
            batchHistory: noop,
            messageEnter: noop,
            startTypingDots: noop,
            startStreamPulse: noop,
            stopStreamPulse: noop,
            openModal: (id) => document.getElementById(id)?.classList.add('active'),
            closeModal: (id) => document.getElementById(id)?.classList.remove('active'),
            openImageModal: noop,
            closeImageModal: noop,
            showDragOverlay: noop,
            hideDragOverlay: noop,
        };
    }

    // -------------------- 登录页滚动叙事 --------------------

    let loginCtx = null;

    function loginInit() {
        const page = document.getElementById('login-page');
        if (!page) return;
        if (loginCtx) loginCtx.revert();

        page.scrollTop = 0;

        loginCtx = gsap.context(() => {
            // 滚动叙事：把标题拆成逐字 span（仅拆一次，避免重复包裹）
            const storyText = page.querySelector('.lp-story-text');
            if (storyText && !storyText.dataset.split) {
                // 英文按词、中文按字拆分为 span，用于滚动逐字/逐词点亮
                const tokenize = (line) =>
                    line
                        .split(/(\s+)/)
                        .map((seg) => {
                            if (/^\s+$/.test(seg)) return seg;
                            if (/[\u4e00-\u9fff]/.test(seg)) {
                                return Array.from(seg).map((ch) => `<span class="wp">${ch}</span>`).join('');
                            }
                            return `<span class="wp">${seg}</span>`;
                        })
                        .join('');
                storyText.innerHTML = storyText.innerHTML
                    .split(/<br\s*\/?>/i)
                    .map(tokenize)
                    .join('<br>');
                storyText.dataset.split = '1';
            }
            const words = page.querySelectorAll('.lp-story-text .wp');

            // Hero 入场（加载即播，非滚动）
            if (reduceMotion) {
                gsap.set(['.lp-nav', '.lp-hero-title', '.lp-hero-sub', '.lp-hero-cta'], {
                    clearProps: 'transform,opacity,visibility',
                });
                if (words.length) gsap.set(words, { opacity: 1 });
                return;
            }

            gsap.fromTo('.lp-nav', { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' });
            gsap.fromTo('.lp-hero-title', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.05 });
            gsap.fromTo('.lp-hero-sub', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.2 });
            gsap.fromTo('.lp-hero-cta', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: 0.35 });

            if (typeof ScrollTrigger === 'undefined') {
                // 无 ScrollTrigger 时不让叙事文字停留在暗色
                if (words.length) gsap.set(words, { opacity: 1 });
                return;
            }

            // 滚动叙事：sticky 固定区内逐词从模糊、下沉中点亮（炫酷滚动揭示）
            if (words.length) {
                gsap.set(words, { opacity: 0.14, y: 26, filter: 'blur(9px)' });
                const story = storyText.closest('.lp-story') || storyText;
                gsap.to(words, {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    stagger: 0.03,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: story,
                        start: 'top top',
                        end: 'bottom bottom',
                        scrub: true,
                        scroller: page,
                    },
                });
            }

            // 分镜展示：大图视差 + 文案滑入
            gsap.utils.toArray('.lp-showcase--media').forEach((sec) => {
                const img = sec.querySelector('.lp-showcase-media img');
                const copy = sec.querySelector('.lp-showcase-copy');
                if (img) {
                    gsap.fromTo(img, { yPercent: -7, scale: 1.18 }, {
                        yPercent: 7,
                        scale: 1,
                        ease: 'none',
                        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true, scroller: page },
                    });
                }
                if (copy) {
                    const fromX = sec.classList.contains('lp-showcase--reverse') ? -56 : 56;
                    gsap.fromTo(copy, { autoAlpha: 0, x: fromX }, {
                        autoAlpha: 1,
                        x: 0,
                        duration: 0.9,
                        ease: 'power3.out',
                        scrollTrigger: { trigger: sec, start: 'top 76%', scroller: page },
                    });
                }
            });

            // 核心能力卡片：滚动进入时 stagger 渐入
            gsap.fromTo('.lp-feature-card', { autoAlpha: 0, y: 40 }, {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.12,
                ease: 'power2.out',
                scrollTrigger: { trigger: '.lp-feature-grid', start: 'top 82%', scroller: page },
            });

            // 登录卡片：书本离场后从下方升起（滚动驱动，可随滚动倒退）
            gsap.fromTo('.lp-auth-card', { autoAlpha: 0, y: 220 }, {
                autoAlpha: 1,
                y: 0,
                ease: 'none',
                scrollTrigger: { trigger: '.lp-auth-section', start: 'top 96%', end: 'top 34%', scrub: true, scroller: page },
            });

            // Hero 背景视差：随滚动缓慢下移
            gsap.to('.lp-hero-bg', {
                yPercent: 16,
                ease: 'none',
                scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: 'bottom top', scrub: true, scroller: page },
            });

            // 滚动背景：哲风壁纸按区块「渐变交叉淡入」——进入某模块时其背景层柔和浮现，
            // 相邻模块通过图层叠加实现平滑渐变过渡，随滚动可正/倒向播放。
            const bgMap = [
                ['.lp-features', 'features'],
                ['.lp-story', 'story'],
                ['#lp-showcase-multimodal', 'multimodal'],
                ['#lp-showcase-knowledge', 'knowledge'],
                ['#lp-showcase-streaming', 'streaming'],
                ['#lp-showcase-conversations', 'conversations'],
                ['.lp-auth-section', 'auth'],
                ['.lp-gallery', 'gallery'],
            ];
            bgMap.forEach(([sel, key]) => {
                const layer = page.querySelector('.lp-bg-layer[data-layer="' + key + '"]');
                if (!layer) return;
                gsap.fromTo(layer, { opacity: 0 }, {
                    opacity: 1,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: sel,
                        start: 'top 88%',
                        end: 'top 38%',
                        scrub: true,
                        scroller: page,
                    },
                });
            });
        }, page);

        // 登出返回时页面从 display:none 恢复，需全局刷新触发器测量
        requestAnimationFrame(() => {
            if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        });
    }

    function loginCleanup() {
        if (loginCtx) {
            loginCtx.revert();
            loginCtx = null;
        }
    }

    // -------------------- 页面入场 --------------------

    function pageEntrance() {
        const sidebar = document.getElementById('sidebar');
        const main = document.getElementById('chat-main');
        if (!sidebar || !main) return;

        if (reduceMotion) {
            gsap.set([sidebar, main], { clearProps: 'transform,opacity,visibility' });
            return;
        }

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from(sidebar, {
            xPercent: -100,
            duration: 0.55,
            clearProps: 'transform',
        }, 0);
        tl.from(main, {
            autoAlpha: 0,
            y: 28,
            duration: 0.5,
            clearProps: 'transform',
        }, 0.08);
    }

    function staggerSuggestions() {
        const cards = document.querySelectorAll('#suggestion-cards .suggestion-card');
        if (!cards.length) return;
        gsap.killTweensOf(cards);
        if (reduceMotion) {
            gsap.set(cards, { autoAlpha: 1, y: 0, scale: 1 });
            return;
        }
        gsap.fromTo(
            cards,
            { autoAlpha: 0, y: 18, scale: 0.96 },
            {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.42,
                stagger: 0.08,
                ease: 'back.out(1.4)',
                overwrite: true,
            }
        );
    }

    function batchHistory() {
        if (typeof ScrollTrigger === 'undefined') return;
        if (historyScrollCtx) historyScrollCtx.revert();

        const list = document.getElementById('chat-history-list');
        if (!list) return;
        const items = list.querySelectorAll('.chat-history-item');
        if (!items.length) return;

        if (reduceMotion) {
            gsap.set(items, { autoAlpha: 1, x: 0 });
            return;
        }

        historyScrollCtx = gsap.context(() => {
            ScrollTrigger.batch(items, {
                scroller: list,
                start: 'top bottom',
                interval: 0.08,
                batchMax: 12,
                onEnter: (batch) => {
                    gsap.fromTo(
                        batch,
                        { autoAlpha: 0, x: -14 },
                        { autoAlpha: 1, x: 0, duration: 0.32, stagger: 0.04, overwrite: true }
                    );
                },
                once: true,
            });
        }, list);
    }

    // -------------------- 消息 --------------------

    function messageEnter(el) {
        if (!el) return;
        gsap.killTweensOf(el);
        if (reduceMotion) {
            gsap.set(el, { autoAlpha: 1, y: 0 });
            return;
        }
        gsap.fromTo(
            el,
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', overwrite: true }
        );
    }

    function startTypingDots(root) {
        if (!root) return;
        const dots = root.querySelectorAll('.typing-dots span');
        const spinner = root.querySelector('.thinking-spinner');
        gsap.killTweensOf(dots);
        if (spinner) gsap.killTweensOf(spinner);

        if (reduceMotion) {
            gsap.set(dots, { y: 0, autoAlpha: 1 });
            return;
        }

        dots.forEach((dot, i) => {
            gsap.fromTo(
                dot,
                { y: 0, autoAlpha: 0.35 },
                {
                    y: -6,
                    autoAlpha: 1,
                    duration: 0.32,
                    yoyo: true,
                    repeat: -1,
                    ease: 'sine.inOut',
                    delay: i * 0.14,
                }
            );
        });

        if (spinner) {
            gsap.to(spinner, {
                rotation: 360,
                duration: 0.8,
                ease: 'none',
                repeat: -1,
            });
        }
    }

    function startStreamPulse(msgEl) {
        if (!msgEl) return;
        stopStreamPulse(msgEl);
        const target = msgEl.querySelector('.message-content') || msgEl;
        if (reduceMotion) return;
        const tween = gsap.to(target, {
            scale: 1.012,
            duration: 0.9,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
            transformOrigin: msgEl.classList.contains('user') ? 'right center' : 'left center',
        });
        streamPulses.set(msgEl, { tween, target });
    }

    function stopStreamPulse(msgEl) {
        if (!msgEl) return;
        const rec = streamPulses.get(msgEl);
        if (rec) {
            rec.tween.kill();
            gsap.set(rec.target, { scale: 1, clearProps: 'transform' });
            streamPulses.delete(msgEl);
        }
    }

    // -------------------- 模态框 --------------------

    function getModalParts(overlay) {
        if (!overlay) return {};
        const card =
            overlay.querySelector('.modal-card') ||
            overlay.querySelector('.image-modal-content') ||
            overlay.firstElementChild;
        return { overlay, card };
    }

    function openModalAnim(id) {
        const overlay = typeof id === 'string' ? document.getElementById(id) : id;
        if (!overlay) return;
        const { card } = getModalParts(overlay);
        overlay.classList.add('active');
        gsap.set(overlay, { display: 'flex' });

        if (overlay._modalTl) overlay._modalTl.kill();

        if (reduceMotion) {
            gsap.set(overlay, { autoAlpha: 1 });
            if (card) gsap.set(card, { autoAlpha: 1, scale: 1 });
            return;
        }

        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
        overlay._modalTl = tl;
        tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22 }, 0);
        if (card) {
            tl.fromTo(
                card,
                { autoAlpha: 0, scale: 0.9 },
                { autoAlpha: 1, scale: 1, duration: 0.32 },
                0
            );
        }
    }

    function closeModalAnim(id) {
        const overlay = typeof id === 'string' ? document.getElementById(id) : id;
        if (!overlay) return;
        const { card } = getModalParts(overlay);

        const finish = () => {
            overlay.classList.remove('active');
            overlay._modalTl = null;
            gsap.set(overlay, { display: 'none', autoAlpha: 1 });
            if (card) gsap.set(card, { clearProps: 'transform,opacity,visibility' });
        };

        if (reduceMotion) {
            finish();
            return;
        }

        const existing = overlay._modalTl;
        if (existing && existing.progress() > 0) {
            existing.eventCallback('onReverseComplete', finish);
            existing.reverse();
            return;
        }

        const tl = gsap.timeline({ onComplete: finish, defaults: { ease: 'power2.in' } });
        if (card) {
            tl.to(card, { autoAlpha: 0, scale: 0.9, duration: 0.2 }, 0);
        }
        tl.to(overlay, { autoAlpha: 0, duration: 0.2 }, 0);
    }

    // -------------------- 拖拽遮罩 --------------------

    function showDragOverlay() {
        const overlay = document.getElementById('drag-drop-overlay');
        if (!overlay) return;
        const content = overlay.querySelector('.drag-drop-content');
        overlay.classList.add('active');

        if (dragVisible) return;
        dragVisible = true;

        if (reduceMotion) {
            gsap.set(overlay, { autoAlpha: 1 });
            if (content) gsap.set(content, { autoAlpha: 1, scale: 1 });
            return;
        }

        gsap.killTweensOf([overlay, content]);
        gsap.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power2.out' });
        if (content) {
            gsap.fromTo(
                content,
                { autoAlpha: 0, scale: 0.72 },
                { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'elastic.out(1, 0.55)' }
            );
        }
    }

    function hideDragOverlay() {
        const overlay = document.getElementById('drag-drop-overlay');
        if (!overlay) return;
        const content = overlay.querySelector('.drag-drop-content');
        dragVisible = false;

        const finish = () => {
            overlay.classList.remove('active');
            gsap.set(overlay, { autoAlpha: 0 });
        };

        if (reduceMotion) {
            finish();
            return;
        }

        gsap.killTweensOf([overlay, content]);
        const tl = gsap.timeline({ onComplete: finish, defaults: { ease: 'power2.inOut' } });
        if (content) {
            tl.to(content, { autoAlpha: 0, scale: 0.88, duration: 0.22 }, 0);
        }
        tl.to(overlay, { autoAlpha: 0, duration: 0.22 }, 0);
    }

    // -------------------- 交互微动画 --------------------

    const DELETE_SEL = '.chat-action-btn.delete, .kb-action-btn.delete, .kb-doc-delete, .file-preview-remove';

    function enteredFromOutside(el, related) {
        return el && (!related || !el.contains(related));
    }

    function shakeDelete(btn) {
        if (!btn || reduceMotion) return;
        gsap.killTweensOf(btn);
        gsap.fromTo(
            btn,
            { rotation: 0 },
            {
                rotation: 10,
                duration: 0.07,
                yoyo: true,
                repeat: 5,
                ease: 'power1.inOut',
                onComplete: () => gsap.set(btn, { rotation: 0 }),
            }
        );
    }

    document.addEventListener('pointerover', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;

        const item = t.closest('.chat-history-item');
        if (enteredFromOutside(item, related) && !reduceMotion) {
            gsap.to(item, { x: 6, duration: 0.22, overwrite: 'auto' });
        }

        const sendBtn = t.closest('#btn-send');
        if (enteredFromOutside(sendBtn, related) && !sendBtn.disabled && !reduceMotion) {
            gsap.to(sendBtn, {
                scale: 1.08,
                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.55)',
                duration: 0.22,
                overwrite: 'auto',
            });
        }

        const preview = t.closest('.file-preview');
        if (enteredFromOutside(preview, related) && !reduceMotion) {
            gsap.to(preview, {
                y: -4,
                boxShadow: '0 10px 18px rgba(15, 23, 42, 0.14)',
                duration: 0.22,
                overwrite: 'auto',
            });
        }

        const del = t.closest(DELETE_SEL);
        if (enteredFromOutside(del, related)) shakeDelete(del);
    });

    document.addEventListener('pointerout', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;

        const item = t.closest('.chat-history-item');
        if (item && !item.contains(related)) {
            gsap.to(item, { x: 0, duration: dur(0.22), overwrite: 'auto' });
        }

        const sendBtn = t.closest('#btn-send');
        if (sendBtn && !sendBtn.contains(related)) {
            gsap.to(sendBtn, {
                scale: 1,
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
                duration: dur(0.2),
                overwrite: 'auto',
            });
        }

        const preview = t.closest('.file-preview');
        if (preview && !preview.contains(related)) {
            gsap.to(preview, {
                y: 0,
                boxShadow: '0 0 0 rgba(0,0,0,0)',
                duration: dur(0.2),
                overwrite: 'auto',
            });
        }
    });

    window.Anim = {
        loginInit,
        loginCleanup,
        pageEntrance,
        staggerSuggestions,
        batchHistory,
        messageEnter,
        startTypingDots,
        startStreamPulse,
        stopStreamPulse,
        openModal: openModalAnim,
        closeModal: closeModalAnim,
        openImageModal: openModalAnim,
        closeImageModal: closeModalAnim,
        showDragOverlay,
        hideDragOverlay,
        prefersReducedMotion: () => reduceMotion,
    };
})();
