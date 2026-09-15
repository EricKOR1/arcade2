// 오염원 추적 — 태화강·산업단지 지도에서 센서를 놓아 값을 읽고, 물의 흐름과 바람으로 '출발 진원지'를 알아맞힙니다.
//   · 사건: 수질(강 하류로 퍼짐) 또는 대기(바람 따라 퍼지는 악취 구름)
//   · 화면을 톡 → 그 자리에 센서 설치 → 농도(0~100)가 뜸. 센서 수는 제한
//   · 후보지(공장·배수구) 핀을 두 번 톡 → 지목. 맞히면 큰 점수, 센서를 적게 쓸수록·빠를수록 더 큼
//   · 라운드가 오를수록 후보가 많아지고 바람이 약해지며 값에 잡음이 섞입니다
// 특강 연계: 물벼룩 바이오센서(수질) · 악취 센서 37대 + 바람 정보 역추적(대기) · '판단하기'

const SH_COLS = 14, SH_ROWS = 18;

class SourceHuntGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = SH_COLS; this.H = SH_ROWS;
    this.score = 0; this.round = 0; this.solved = 0; this.wrong = 0; this.gameOver = false;
    this.lastTime = 0; this.now = 0; this.anim = []; this.parts = [];
    // 강: 왼쪽 위에서 오른쪽 아래로 굽이치며 흐름 (셀 좌표 목록, 상류 → 하류)
    this.river = [];
    for (let y = 0; y < this.H; y++) { const x = 3 + Math.round(Math.sin(y / 3.1) * 2.2 + y * 0.28); this.river.push([Math.max(1, Math.min(this.W - 2, x)), y]); }
    this.newCase();
  }
  get lives() { return Math.max(0, 3 - this.wrong); }

  // ── 사건 생성 ──
  newCase() {
    this.round++;
    const R = this.round;
    this.kind = R === 1 ? 'water' : (R === 2 ? 'air' : (Math.random() < 0.5 ? 'water' : 'air'));
    this.budget = Math.max(3, 7 - Math.floor(R / 2));
    this.noise = Math.min(14, (R - 1) * 3);
    this.sensors = []; this.armed = null; this.revealed = false; this.caseStart = this.now || 0; this.result = null;
    const nCand = Math.min(7, 3 + Math.floor(R / 1.5));
    this.cands = [];
    if (this.kind === 'water') {
      // 후보: 강 옆 배수구 (강 셀에 붙은 위치), 상류~중류에
      const picks = new Set();
      while (this.cands.length < nCand) {
        const ri = 2 + Math.floor(Math.random() * (this.river.length - 7)); if (picks.has(ri)) continue; picks.add(ri);
        const [rx, ry] = this.river[ri]; const side = Math.random() < 0.5 ? -1 : 1;
        this.cands.push({ x: Math.max(0, Math.min(this.W - 1, rx + side)), y: ry, ri, name: '배수구 ' + String.fromCharCode(65 + this.cands.length) });
      }
      this.wind = null;
    } else {
      // 후보: 산업단지 공장들 (오른쪽 절반에 흩어짐)
      const used = new Set();
      while (this.cands.length < nCand) {
        const x = 6 + Math.floor(Math.random() * (this.W - 7)), y = 1 + Math.floor(Math.random() * (this.H - 3)); const k = x + ',' + y;
        if (used.has(k) || this.cands.some(c => Math.abs(c.x - x) < 2 && Math.abs(c.y - y) < 2)) continue; used.add(k);
        this.cands.push({ x, y, name: '공장 ' + String.fromCharCode(65 + this.cands.length) });
      }
      const wa = Math.random() * Math.PI * 2, ws = Math.max(0.45, 1 - R * 0.08);
      this.wind = { ax: Math.cos(wa), ay: Math.sin(wa), speed: ws };
    }
    this.source = this.cands[Math.floor(Math.random() * this.cands.length)];
    this.anim.push({ kind: 'case', t: 1 });
  }

  // 참 농도 (0~100) — 센서를 놓았을 때 읽히는 값
  concentration(x, y) {
    const s = this.source;
    if (this.kind === 'water') {
      // 강 셀만 유효. 진원지 하류로 갈수록 서서히 옅어짐, 상류는 0. 강에서 멀면 약해짐
      let best = 1e9, bi = -1;
      this.river.forEach(([rx, ry], i) => { const d = Math.hypot(rx - x, ry - y); if (d < best) { best = d; bi = i; } });
      if (best > 1.6) return 0;
      const along = bi - s.ri;                          // 하류가 +
      if (along < 0) return 0;
      return 100 * Math.exp(-along / 9) * Math.exp(-best * 0.9);
    }
    const dx = x - s.x, dy = y - s.y;
    const along = dx * this.wind.ax + dy * this.wind.ay, perp = -dx * this.wind.ay + dy * this.wind.ax;
    if (along < -0.6) return 0;
    const sigma = 0.9 + along * (0.45 / this.wind.speed);   // 바람이 약할수록 넓게 퍼짐
    return 100 * Math.exp(-(perp * perp) / (2 * sigma * sigma)) * Math.exp(-Math.max(0, along) / (7 * this.wind.speed));
  }

  // ── 조작 ──
  tapAt(x, y) {
    if (this.gameOver) return;
    const cx = Math.floor(x), cy = Math.floor(y);
    if (this.result) { if (this.now - this.result.at > 900) { this.result = null; if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); } else this.newCase(); } return; }
    if (cx < 0 || cy < 0 || cx >= this.W || cy >= this.H) return;
    // 후보 핀 근처?
    const cand = this.cands.find(c => Math.abs(c.x + 0.5 - x) < 0.9 && Math.abs(c.y + 0.5 - y) < 0.9);
    if (cand) {
      if (this.armed === cand) { this.accuse(cand); }
      else { this.armed = cand; if (window.Sound) Sound.move(); if (window.Haptic) Haptic.tap(); }
      return;
    }
    this.armed = null;
    if (this.budget <= 0) { this.flash('센서가 다 떨어졌어요 — 후보를 지목하세요', '#FFD166'); return; }
    if (this.sensors.some(s => s.x === cx && s.y === cy)) return;
    const v = Math.max(0, Math.min(100, this.concentration(cx + 0.5, cy + 0.5) + (Math.random() - 0.5) * this.noise * 2));
    this.sensors.push({ x: cx, y: cy, v, at: this.now });
    this.budget--;
    if (window.Sound) Sound.lock(); if (window.Haptic) Haptic.tap();
    this.anim.push({ kind: 'ring', x: cx + 0.5, y: cy + 0.5, t: 1 });
  }
  accuse(c) {
    const ok = c === this.source;
    const secs = (this.now - this.caseStart) / 1000;
    const used = Math.max(3, 7 - Math.floor(this.round / 2)) - this.budget;
    let gain = 0;
    if (ok) { gain = 300 + Math.max(0, 200 - used * 30) + Math.max(0, 150 - Math.floor(secs) * 5); this.solved++; if (window.Sound) Sound.levelUp(); if (window.Haptic) Haptic.big(); }
    else { gain = -100; this.wrong++; if (window.Sound) Sound.crash(); if (window.Haptic) Haptic.hit(); }
    this.score = Math.max(0, this.score + gain);
    this.result = { ok, gain, at: this.now, pick: c };
    this.revealed = true; this.armed = null;
    if (ok) this.burst(this.source.x + 0.5, this.source.y + 0.5, '#06D6A0');
  }
  flash(text, color) { this.toast = { text, color, until: this.now + 1500 }; }
  burst(x, y, c) { for (let i = 0; i < 18; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.1; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }
  move() {} rotate() {} softDrop() {} hardDrop() {}

  tick(now) {
    this.now = now; if (!this.caseStart) this.caseStart = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    this.anim = this.anim.filter(a => (a.t -= 0.03 * f) > 0);
    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.03 * f; }); this.parts = this.parts.filter(p => p.l > 0);
    this.draw();
  }

  getSnapshot() {
    const g = Array.from({ length: this.H }, () => Array(this.W).fill(62));
    this.river.forEach(([x, y]) => { g[y][x] = 58; });
    this.cands.forEach(c => { g[c.y][c.x] = 49; });
    this.sensors.forEach(s => { g[s.y][s.x] = s.v > 50 ? 60 : (s.v > 15 ? 47 : 48); });
    if (this.revealed) g[this.source.y][this.source.x] = 23;
    return g;
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs, now = this.now;
    // 지도 바탕: 어두운 남색 + 격자
    ctx.fillStyle = '#0B1220'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let x = 0; x <= this.W; x++) { ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, H); ctx.stroke(); }
    for (let y = 0; y <= this.H; y++) { ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(W, y * cs); ctx.stroke(); }
    // 산업단지 구역 (대기 사건): 오른쪽 옅은 사각
    if (this.kind === 'air') { ctx.fillStyle = 'rgba(255,209,102,0.05)'; ctx.fillRect(6 * cs, 0, W - 6 * cs, H); }
    // 강: 빛나는 굽은 띠
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(76,201,240,0.18)'; ctx.lineWidth = cs * 1.6; this.riverPath(ctx, cs); ctx.stroke();
    ctx.strokeStyle = '#1E6FA8'; ctx.lineWidth = cs * 1.0; this.riverPath(ctx, cs); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,220,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([cs * 0.4, cs * 0.5]); ctx.lineDashOffset = -now / 40; this.riverPath(ctx, cs); ctx.stroke(); ctx.setLineDash([]);
    // 흐름 표시 화살표 (하류 방향) 3개
    [4, 9, 14].forEach(i => { if (!this.river[i + 1]) return; const [x1, y1] = this.river[i], [x2, y2] = this.river[i + 1]; const a = Math.atan2(y2 - y1, x2 - x1), px = (x1 + 0.5) * cs, py = (y1 + 0.5) * cs;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(cs * 0.25, 0); ctx.lineTo(-cs * 0.12, cs * 0.16); ctx.lineTo(-cs * 0.12, -cs * 0.16); ctx.closePath(); ctx.fill(); ctx.restore(); });
    // 공개된 오염 확산 (정답 후)
    if (this.revealed) {
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const v = this.concentration(x + 0.5, y + 0.5); if (v < 4) continue;
        ctx.fillStyle = (this.kind === 'water' ? 'rgba(255,92,122,' : 'rgba(177,93,255,') + (v / 100 * 0.55).toFixed(2) + ')'; ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2); }
    }
    // 센서 값 히트: 읽은 값 주변 은은한 색 (추리를 돕는 시각화)
    this.sensors.forEach(s => { const r = cs * (0.8 + s.v / 100 * 1.4); const g = ctx.createRadialGradient((s.x + .5) * cs, (s.y + .5) * cs, 0, (s.x + .5) * cs, (s.y + .5) * cs, r);
      const col = s.v > 60 ? '255,92,122' : s.v > 25 ? '255,209,102' : '76,201,240';
      g.addColorStop(0, 'rgba(' + col + ',' + (0.25 + s.v / 100 * 0.35).toFixed(2) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc((s.x + .5) * cs, (s.y + .5) * cs, r, 0, Math.PI * 2); ctx.fill(); });
    // 후보 핀
    this.cands.forEach(c => {
      const px = (c.x + 0.5) * cs, py = (c.y + 0.5) * cs, armed = this.armed === c, isSrc = this.revealed && c === this.source, picked = this.result && this.result.pick === c;
      ctx.save();
      if (armed) { ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, cs * 0.75 + Math.sin(now / 120) * 2, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = isSrc ? '#06D6A0' : (picked && !this.result.ok ? '#FF5C7A' : (this.kind === 'water' ? '#3B82F6' : '#8A94A8'));
      if (this.kind === 'water') { ctx.beginPath(); ctx.arc(px, py, cs * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0B1220'; ctx.beginPath(); ctx.arc(px, py, cs * 0.16, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillRect(px - cs * 0.4, py - cs * 0.2, cs * 0.8, cs * 0.55); ctx.fillRect(px - cs * 0.28, py - cs * 0.5, cs * 0.16, cs * 0.35); ctx.fillRect(px + 0.08 * cs, py - cs * 0.42, cs * 0.14, cs * 0.28); }
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(cs * 0.42) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.name.slice(-1), px, py + cs * 0.02);
      ctx.restore();
    });
    // 센서 (값 표시)
    this.sensors.forEach(s => { const px = (s.x + .5) * cs, py = (s.y + .5) * cs;
      ctx.fillStyle = '#0B1220'; ctx.beginPath(); ctx.arc(px, py, cs * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = s.v > 60 ? '#FF5C7A' : s.v > 25 ? '#FFD166' : '#4CC9F0'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(cs * 0.34) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.round(s.v)), px, py + 1); });
    // 설치 링 애니메이션
    this.anim.forEach(a => { if (a.kind !== 'ring') return; ctx.strokeStyle = 'rgba(255,255,255,' + a.t.toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x * cs, a.y * cs, cs * (1.6 - a.t * 1.2), 0, Math.PI * 2); ctx.stroke(); });
    this.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - 2, p.y * cs - 2, 4, 4); }); ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // ── HUD ──
    const rr = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke(); };
    // 상단: 사건 카드
    rr(cs * 0.3, cs * 0.3, W - cs * 0.6, cs * 2.2, cs * 0.4, 'rgba(8,12,22,0.82)');
    ctx.fillStyle = this.kind === 'water' ? '#4CC9F0' : '#B15DFF'; ctx.font = '800 ' + Math.round(cs * 0.36) + 'px Pretendard, sans-serif';
    ctx.fillText((this.kind === 'water' ? '💧 수질 사건' : '🌫 악취 사건') + ' · 라운드 ' + this.round, cs * 0.7, cs * 0.95);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '600 ' + Math.round(cs * 0.33) + 'px Pretendard, sans-serif';
    ctx.fillText(this.kind === 'water' ? '강 하류로 퍼집니다. 진원지 위쪽은 0' : '바람 방향으로 퍼집니다. 바람을 거슬러 올라가세요', cs * 0.7, cs * 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 ' + Math.round(cs * 0.3) + 'px Pretendard, sans-serif';
    ctx.fillText('화면을 톡 → 센서 · 핀을 두 번 톡 → 지목', cs * 0.7, cs * 2.1);
    // 우측 상단: 센서 남은 수 · 목숨
    ctx.textAlign = 'right'; ctx.fillStyle = '#FFD166'; ctx.font = '800 ' + Math.round(cs * 0.38) + 'px Pretendard, sans-serif';
    ctx.fillText('센서 ' + this.budget, W - cs * 0.7, cs * 0.95);
    ctx.fillStyle = '#FF5C7A'; ctx.fillText('♥'.repeat(this.lives) + '♡'.repeat(3 - this.lives), W - cs * 0.7, cs * 1.55);
    ctx.textAlign = 'left';
    // 바람 나침반 (대기 사건)
    if (this.wind) {
      const cx = W - cs * 1.5, cy = cs * 4.2, r = cs * 0.9;
      rr(cx - r - 6, cy - r - 6, r * 2 + 12, r * 2 + 12, r, 'rgba(8,12,22,0.8)');
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(this.wind.ay, this.wind.ax));
      ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.moveTo(r * 0.85, 0); ctx.lineTo(-r * 0.5, r * 0.5); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.5, -r * 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '700 ' + Math.round(cs * 0.28) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('바람 ' + (this.wind.speed > 0.8 ? '강' : this.wind.speed > 0.6 ? '중' : '약'), cx, cy + r + cs * 0.55); ctx.textAlign = 'left';
      // 바람 입자
      for (let i = 0; i < 10; i++) { const ph = ((now / 900) + i * 0.37) % 1; const bx = (i * 1.37 % this.W) * cs + this.wind.ax * ph * W * 0.5, by = (i * 2.3 % this.H) * cs + this.wind.ay * ph * H * 0.5;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 * (1 - ph)).toFixed(2) + ')'; ctx.fillRect(((bx % W) + W) % W, ((by % H) + H) % H, cs * 0.35, 1.5); }
    }
    // 지목 대기 안내
    if (this.armed && !this.result) { ctx.fillStyle = 'rgba(8,12,22,0.85)'; const t = this.armed.name + ' — 한 번 더 누르면 지목'; ctx.font = '800 ' + Math.round(cs * 0.36) + 'px Pretendard, sans-serif'; const tw = ctx.measureText(t).width + cs;
      ctx.fillRect(W / 2 - tw / 2, H - cs * 1.9, tw, cs * 0.9); ctx.fillStyle = '#FFD166'; ctx.textAlign = 'center'; ctx.fillText(t, W / 2, H - cs * 1.3); ctx.textAlign = 'left'; }
    if (this.toast && now < this.toast.until) { ctx.fillStyle = this.toast.color; ctx.font = '700 ' + Math.round(cs * 0.34) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(this.toast.text, W / 2, H - cs * 0.6); ctx.textAlign = 'left'; }
    // 결과 카드
    if (this.result) {
      const k = Math.min(1, (now - this.result.at) / 400);
      ctx.fillStyle = 'rgba(8,12,22,' + (0.55 * k).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
      const bw = W - cs * 1.6, bh = cs * 3.4, bx = cs * 0.8, by = H / 2 - bh / 2 + (1 - k) * 20;
      rr(bx, by, bw, bh, cs * 0.5, 'rgba(12,16,28,0.96)');
      ctx.fillStyle = this.result.ok ? '#06D6A0' : '#FF5C7A'; ctx.font = '800 ' + Math.round(cs * 0.6) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(this.result.ok ? '진원지 적중!' : '아닙니다', W / 2, by + cs * 1.0);
      ctx.fillStyle = '#fff'; ctx.font = '600 ' + Math.round(cs * 0.34) + 'px Pretendard, sans-serif';
      ctx.fillText((this.result.ok ? '+' : '') + this.result.gain + '점 · 진원지는 ' + this.source.name, W / 2, by + cs * 1.7);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 ' + Math.round(cs * 0.3) + 'px Pretendard, sans-serif';
      ctx.fillText(this.result.ok ? (this.kind === 'water' ? '하류 값이 크고 상류가 0인 지점 바로 위가 진원지' : '바람을 거슬러 값이 커지는 끝이 진원지') : '확산 모양을 보고 다음엔 거슬러 올라가 보세요', W / 2, by + cs * 2.3);
      ctx.fillStyle = '#FFD166'; ctx.fillText('화면을 톡 → 다음 사건', W / 2, by + cs * 3.0); ctx.textAlign = 'left';
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(8,12,22,0.7)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(cs * 0.6) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('수사 종료 · ' + this.solved + '건 해결', W / 2, H / 2); ctx.textAlign = 'left'; }
  }
  riverPath(ctx, cs) { ctx.beginPath(); this.river.forEach(([x, y], i) => { const px = (x + 0.5) * cs, py = (y + 0.5) * cs; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); }
}
