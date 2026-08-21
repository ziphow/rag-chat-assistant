/**
 * interactions.js — 鼠标/手指动态交互（卡片聚光灯 + 3D 倾斜）
 * 纯 JS、无第三方依赖，性能友好（requestAnimationFrame 节流）。
 */
(function () {
    var SPOT = '.lp-feature-card, .g-card, .book-page, .suggestion-card, .lp-auth-card, .lp-showcase-media';
    var TILT = '.lp-feature-card, .suggestion-card';
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var rafId = null;
    var pending = null;

    function apply() {
        rafId = null;
        if (!pending) return;
        var x = pending.x, y = pending.y, sp = pending.spot, tl = pending.tilt;
        pending = null;

        if (sp) {
            var r = sp.getBoundingClientRect();
            if (r.width && r.height) {
                sp.style.setProperty('--mx', (((x - r.left) / r.width) * 100).toFixed(2) + '%');
                sp.style.setProperty('--my', (((y - r.top) / r.height) * 100).toFixed(2) + '%');
            }
        }

        if (tl && !reduceMotion) {
            var rr = tl.getBoundingClientRect();
            if (rr.width && rr.height) {
                var px = (x - rr.left) / rr.width - 0.5;
                var py = (y - rr.top) / rr.height - 0.5;
                tl.style.transform =
                    'perspective(900px) rotateX(' + (-py * 9).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateY(-4px)';
            }
        }
    }

    document.addEventListener('pointermove', function (e) {
        var t = e.target;
        if (!(t instanceof Element)) return;
        var sp = t.closest(SPOT);
        var tl = t.closest(TILT);
        if (!sp && !tl) return;

        pending = { x: e.clientX, y: e.clientY, spot: sp, tilt: tl };
        if (rafId) return;
        rafId = requestAnimationFrame(apply);
    }, { passive: true });

    // 离开卡片时复位倾斜（聚光灯由 CSS :hover 控制显隐）
    document.addEventListener('pointerout', function (e) {
        var t = e.target;
        if (!(t instanceof Element)) return;
        var tl = t.closest(TILT);
        if (tl && !tl.contains(e.relatedTarget)) {
            tl.style.transform = '';
        }
    });
})();