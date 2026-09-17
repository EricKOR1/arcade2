// fx.js — 모든 캔버스 게임이 함께 쓰는 공용 도구.
//   FX.frame   프레임 간격(dt·f) 계산 — 엔진 10곳에 흩어져 있던 코드를 한 곳으로
//   FX.rr      둥근 사각형 path (roundRect 미지원 브라우저 대체 포함)
//   FX.text    글자 (크기·굵기·색·정렬·그림자 한 번에)
//   FX.glass   글래스 카드 (반투명 + 그라데이션 테두리 + 안쪽 광택)
//   FX.Particles 파티클 시스템 한 벌 (6개 엔진이 각자 갖고 있던 것을 통일)
//   FX.ease    이징 함수
//   FX.juice   '손맛' 층 — 피격 섬광·화면 흔들림·단계 배너·점수 팝업.
//              엔진은 손댈 필요 없이 Sound.crash / levelUp / clear 호출을 가로채 자동으로 붙습니다.

const FX = (function () {
  // ── 프레임 간격 ──
  // 한 프레임이 오래 걸려도 최대 50ms 로 잘라 물리가 튀지 않게 합니다. f = 60fps 기준 배율
  function frame(game, now) {
    const dt = game.lastTime ? Math.min(50, now - game.lastTime) : 16.7;
    game.lastTime = now; game.now = now;
    return { dt, f: dt / 16.7 };
  }

  // ── 둥근 사각형 ──
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    const q = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + q, y); ctx.lineTo(x + w - q, y); ctx.quadraticCurveTo(x + w, y, x + w, y + q);
    ctx.lineTo(x + w, y + h - q); ctx.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
    ctx.lineTo(x + q, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - q);
    ctx.lineTo(x, y + q); ctx.quadraticCurveTo(x, y, x + q, y); ctx.closePath();
  }

  // ── 글자 ──
  function text(ctx, str, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 700) + ' ' + Math.round(o.size || 14) + 'px Pretendard, sans-serif';
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = o.shadow; }
    ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, x, y);
    ctx.shadowBlur = 0; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── 글래스 카드 ──
  function glass(ctx, x, y, w, h, r, accent) {
    ctx.fillStyle = 'rgba(10,16,30,0.78)'; rr(ctx, x, y, w, h, r); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, accent || 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; rr(ctx, x + 1, y + 1, w - 2, h * 0.45, r); ctx.fill();
  }

  // ── 이징 ──
  const ease = {
    outCubic: k => 1 - Math.pow(1 - k, 3),
    inOut:    k => k * k * (3 - 2 * k),
    outBack:  k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
  };

  // ── 파티클 ──
  class Particles {
    constructor() { this.list = []; }
    burst(x, y, n, o) {
      o = o || {};
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread || 1.2) : Math.random() * Math.PI * 2;
        const v = (o.speed || 0.06) * (0.5 + Math.random());
        this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), l: 1, decay: o.decay || 0.03,
                         c: Array.isArray(o.colors) ? o.colors[i % o.colors.length] : (o.color || '#fff'), s: o.size || 3, g: o.gravity || 0 });
      }
    }
    step(f) { for (const p of this.list) { p.x += p.vx * f; p.y += p.vy * f; p.vy += p.g * f; p.l -= p.decay * f; } this.list = this.list.filter(p => p.l > 0); }
    draw(ctx, cs) { for (const p of this.list) { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - p.s / 2, p.y * cs - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; }
    get length() { return this.list.length; }
  }

  // ── 손맛 층 ──
  // 화면 위에 덧그리는 효과. 상태는 게임 객체가 아니라 여기 한 곳에만 둡니다.
  const juice = {
    flash: 0, shake: 0, banners: [], pops: [], lastLevel: null, enabled: true,
    hit(strength) { this.flash = Math.max(this.flash, strength || 0.6); this.shake = Math.max(this.shake, (strength || 0.6) * 10); },
    banner(text, color) { this.banners.push({ text, color: color || '#FFD166', t: 0 }); },
    pop(text, x, y, color) { this.pops.push({ text, x, y, color: color || '#FFD166', t: 0 }); },
    reset() { this.flash = 0; this.shake = 0; this.banners.length = 0; this.pops.length = 0; this.lastLevel = null; },
    // 한 프레임 진행 + 그리기. ctx 는 게임 캔버스, W/H 는 CSS 픽셀 크기
    draw(ctx, W, H, f, game) {
      if (!this.enabled) return;
      f = f || 1;
      // 단계가 오르면 자동 배너
      if (game && typeof game.level === 'number') {
        if (this.lastLevel != null && game.level > this.lastLevel) this.banner('LEVEL ' + game.level, '#FFD166');
        this.lastLevel = game.level;
      }
      // 피격 섬광 (붉은 테두리 비네트)
      if (this.flash > 0.01) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, 'rgba(255,60,80,0)'); g.addColorStop(1, 'rgba(255,60,80,' + (0.55 * this.flash).toFixed(3) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        this.flash *= Math.pow(0.86, f);
      }
      this.shake *= Math.pow(0.85, f);
      // 점수 팝업: 떠오르며 사라짐
      for (let i = this.pops.length - 1; i >= 0; i--) {
        const p = this.pops[i]; p.t += 0.03 * f; if (p.t >= 1) { this.pops.splice(i, 1); continue; }
        const k = ease.outCubic(p.t);
        ctx.globalAlpha = 1 - p.t;
        text(ctx, p.text, p.x, p.y - k * 36, { size: 16 + 6 * (1 - p.t), weight: 800, color: p.color, align: 'center', shadow: 6 });
        ctx.globalAlpha = 1;
      }
      // 배너: 커졌다 머물다 사라짐
      for (let i = this.banners.length - 1; i >= 0; i--) {
        const b = this.banners[i]; b.t += 0.018 * f; if (b.t >= 1) { this.banners.splice(i, 1); continue; }
        const inK = Math.min(1, b.t / 0.18), outK = Math.max(0, (b.t - 0.75) / 0.25);
        const sc = 0.7 + 0.3 * ease.outBack(inK), al = (1 - outK) * Math.min(1, inK * 2);
        ctx.save(); ctx.globalAlpha = al; ctx.translate(W / 2, H * 0.38); ctx.scale(sc, sc);
        const w = Math.min(W * 0.8, 320), h = 58;
        glass(ctx, -w / 2, -h / 2, w, h, 16, b.color);
        text(ctx, b.text, 0, 9, { size: 26, weight: 800, color: b.color, align: 'center', shadow: 8 });
        ctx.restore();
      }
    },
    // 그리기 전에 호출: 흔들림 만큼 캔버스를 옮깁니다 (draw 뒤 restoreShake 로 복구)
    applyShake(ctx) { if (this.shake > 0.3) { ctx.save(); ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); return true; } return false; },
    restoreShake(ctx, applied) { if (applied) ctx.restore(); }
  };

  // Sound 호출을 가로채 손맛을 자동으로 붙입니다 (엔진 수정 없이)
  function hookSound(SoundObj) {
    if (!SoundObj || SoundObj.__fxHooked) return; SoundObj.__fxHooked = true;
    const wrap = (name, fn) => { const orig = SoundObj[name]; if (typeof orig !== 'function') return; SoundObj[name] = function () { try { fn.apply(null, arguments); } catch (e) {} return orig.apply(this, arguments); }; };
    wrap('crash',    () => juice.hit(0.7));
    wrap('gameOver', () => juice.hit(1.0));
    wrap('levelUp',  () => {});                          // 배너는 level 값 변화로 자동
  }

  // 기존 엔진들의 단순 파티클 배열({x,y,vx,vy,l,c})용 공용 진행·그리기
  function stepParts(list, f, decay) { for (const p of list) { p.x += p.vx * f; p.y += p.vy * f; if (p.g) p.vy += p.g * f; p.l -= (decay || 0.05) * f; } return list.filter(p => p.l > 0); }
  function drawParts(ctx, list, cs, size) { const s = size || 3; for (const p of list) { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - s / 2, p.y * cs - s / 2, s, s); } ctx.globalAlpha = 1; }

  return { frame, rr, text, glass, ease, Particles, stepParts, drawParts, juice, hookSound };
})();
if (typeof window !== 'undefined') window.FX = FX;
