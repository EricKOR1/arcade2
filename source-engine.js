// 오염원 추적 — 태화강·산업단지 지도에서 센서 값과 물·바람의 흐름으로 '출발 진원지'를 알아맞힙니다.
//   특강 연계: 물벼룩 바이오센서(수질) · 악취 센서 37대 + 바람 역추적(대기) · 판단하기
// 게임 요소
//   · 사건 3종: 💧 수질(하류로 퍼짐) · 🌫 악취(바람 따라 퍼짐) · ⛈ 장마(넓고 옅게 퍼져 어려움)
//   · 센서 설치(톡) · 핀 두 번 톡 → 지목 · 제한 시간 · 연속 적중 콤보
//   · 🤖 AI 힌트(점수로 후보 하나 제외) · 🚁 드론 정찰(센서 2개로 3×3 한 번에) · 📋 범례
// UI: 글래스 카드(그라데이션 테두리) · 큰 숫자 · 레이더 스윕 · 홀로그램식 센서 태그 · 바람 입자 · 결과 카드

const SH_COLS = 12, SH_ROWS = 16;

class SourceHuntGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = SH_COLS; this.H = SH_ROWS;
    this.score = 0; this.round = 0; this.solved = 0; this.wrong = 0; this.combo = 0; this.bestCombo = 0; this.gameOver = false;
    this.lastTime = 0; this.now = 0; this.anim = []; this.parts = []; this.legend = false; this.droneArmed = false;
    this.river = [];
    for (let y = 0; y < this.H; y++) { const x = 2 + Math.round(Math.sin(y / 2.8) * 1.8 + y * 0.32); this.river.push([Math.max(1, Math.min(this.W - 2, x)), y]); }
    this.newCase();
  }
  get lives() { return Math.max(0, 3 - this.wrong); }
  get caseLimit() { return Math.max(30, 60 - this.round * 3); }             // 사건당 제한 시간(초)
  get budgetMax() { return Math.max(3, 7 - Math.floor(this.round / 2)); }

  // ── 사건 생성 ──
  newCase() {
    this.round++;
    const R = this.round;
    this.kind = R === 1 ? 'water' : (R === 2 ? 'air' : (R >= 4 && Math.random() < 0.3 ? 'storm' : (Math.random() < 0.5 ? 'water' : 'air')));
    this.budget = this.budgetMax; this.noise = Math.min(14, (R - 1) * 3);
    this.sensors = []; this.armed = null; this.revealed = false; this.caseStart = this.now || 0; this.result = null;
    this.excluded = []; this.hintUsed = false; this.droneUsed = false; this.droneArmed = false;
    const nCand = Math.min(7, 3 + Math.floor(R / 1.5));
    this.cands = [];
    if (this.kind !== 'air') {
      // 강 옆 자리는 유한하므로, 가능한 자리를 섞어서 앞에서부터 고릅니다 (무한 루프 방지)
      const slots = []; for (let ri = 1; ri <= this.river.length - 4; ri++) slots.push(ri);
      for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
      const want = Math.min(nCand, slots.length);
      const chosen = slots.slice(0, want).sort((a, b) => a - b);
      chosen.forEach(ri => { const [rx, ry] = this.river[ri]; const side = Math.random() < 0.5 ? -1 : 1;
        this.cands.push({ x: Math.max(0, Math.min(this.W - 1, rx + side)), y: ry, ri, name: '' }); });
      this.wind = null;
    } else {
      let guard = 0;
      while (this.cands.length < nCand && guard++ < 400) {
        const x = 5 + Math.floor(Math.random() * (this.W - 6)), y = 1 + Math.floor(Math.random() * (this.H - 5));
        if (this.cands.some(c => Math.abs(c.x - x) < 2 && Math.abs(c.y - y) < 2)) continue;
        this.cands.push({ x, y, name: '' });
      }
      const wa = Math.random() * Math.PI * 2, ws = Math.max(0.45, 1 - R * 0.08);
      this.wind = { ax: Math.cos(wa), ay: Math.sin(wa), speed: ws };
    }
    this.cands.sort((a, b) => a.y - b.y).forEach((c, i) => { c.name = (this.kind === 'air' ? '공장 ' : '배수구 ') + String.fromCharCode(65 + i); });
    this.source = this.cands[Math.floor(Math.random() * this.cands.length)];
    this.anim.push({ kind: 'case', t: 1 });
  }

  concentration(x, y) {
    const s = this.source;
    if (this.kind !== 'air') {
      let best = 1e9, bi = -1;
      this.river.forEach(([rx, ry], i) => { const d = Math.hypot(rx + 0.5 - x, ry + 0.5 - y); if (d < best) { best = d; bi = i; } });   // 셀 중심끼리 비교
      if (best > 1.6) return 0;
      const along = bi - s.ri; if (along < 0) return 0;
      const decay = this.kind === 'storm' ? 16 : 8;                         // 장마: 넓고 옅게
      return 100 * Math.exp(-along / decay) * Math.exp(-best * 0.9);
    }
    const dx = x - s.x, dy = y - s.y;
    const along = dx * this.wind.ax + dy * this.wind.ay, perp = -dx * this.wind.ay + dy * this.wind.ax;
    if (along < -0.6) return 0;
    const sigma = 0.9 + along * (0.45 / this.wind.speed);
    return 100 * Math.exp(-(perp * perp) / (2 * sigma * sigma)) * Math.exp(-Math.max(0, along) / (6 * this.wind.speed));
  }
  reading(cx, cy) { return Math.max(0, Math.min(100, this.concentration(cx + 0.5, cy + 0.5) + (Math.random() - 0.5) * this.noise * 2)); }

  // ── 조작 ──
  // 화면 아래 액션 바(범례·힌트·드론)는 마지막 두 줄(셀 좌표) 영역
  tapAt(x, y) {
    if (this.gameOver) return;
    if (this.result) { if (this.now - this.result.at > 900) { this.result = null; if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); } else this.newCase(); } return; }
    if (this.legend) { this.legend = false; return; }
    // 액션 바
    if (y >= this.H - 1.6) {
      const third = Math.floor(x / (this.W / 3));
      if (third === 0) { this.legend = true; }
      else if (third === 1) this.useHint();
      else this.armDrone();
      return;
    }
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= this.W || cy >= this.H - 1.6) return;
    const cand = this.cands.find(c => Math.abs(c.x + 0.5 - x) < 0.9 && Math.abs(c.y + 0.5 - y) < 0.9);
    if (cand && !this.droneArmed) {
      if (this.excluded.includes(cand)) { this.flash('AI 가 제외한 후보예요', '#9AA3B2'); return; }
      if (this.armed === cand) this.accuse(cand);
      else { this.armed = cand; if (window.Sound) Sound.move(); if (window.Haptic) Haptic.tap(); }
      return;
    }
    this.armed = null;
    if (this.droneArmed) { this.drone(cx, cy); return; }
    if (this.budget <= 0) { this.flash('센서가 다 떨어졌어요 — 후보를 지목하세요', '#FFD166'); return; }
    if (this.sensors.some(s => s.x === cx && s.y === cy)) return;
    this.sensors.push({ x: cx, y: cy, v: this.reading(cx, cy), at: this.now });
    this.budget--;
    if (window.Sound) Sound.lock(); if (window.Haptic) Haptic.tap();
    this.anim.push({ kind: 'ring', x: cx + 0.5, y: cy + 0.5, t: 1 });
  }
  useHint() {
    if (this.hintUsed) { this.flash('힌트는 사건당 한 번', '#9AA3B2'); return; }
    if (this.score < 80) { this.flash('점수가 80점 이상 필요해요', '#FF5C7A'); return; }
    const wrongs = this.cands.filter(c => c !== this.source && !this.excluded.includes(c));
    if (!wrongs.length) return;
    const pick = wrongs[Math.floor(Math.random() * wrongs.length)];
    this.excluded.push(pick); this.hintUsed = true; this.score -= 80;
    this.flash('🤖 AI 분석: ' + pick.name + '은(는) 아닙니다 (-80)', '#B15DFF'); if (window.Sound) Sound.rotate();
  }
  armDrone() {
    if (this.droneUsed) { this.flash('드론은 사건당 한 번', '#9AA3B2'); return; }
    if (this.budget < 2) { this.flash('드론 정찰에는 센서 2개가 필요해요', '#FF5C7A'); return; }
    this.droneArmed = !this.droneArmed; this.armed = null;
    if (this.droneArmed) this.flash('🚁 정찰할 지점을 톡 (주변 3×3 을 한 번에 측정)', '#4CC9F0');
  }
  drone(cx, cy) {
    this.droneArmed = false; this.droneUsed = true; this.budget -= 2;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= this.W || y >= this.H - 2) continue;
      if (this.sensors.some(s => s.x === x && s.y === y)) continue; this.sensors.push({ x, y, v: this.reading(x, y), at: this.now + (Math.abs(dx) + Math.abs(dy)) * 80, small: true }); }
    this.anim.push({ kind: 'ring', x: cx + 0.5, y: cy + 0.5, t: 1, big: true });
    if (window.Sound) Sound.levelUp(); if (window.Haptic) Haptic.good();
  }
  accuse(c) {
    const ok = c === this.source;
    const secs = (this.now - this.caseStart) / 1000, used = this.budgetMax - this.budget;
    let gain = 0;
    if (ok) { this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
      gain = Math.round((300 + Math.max(0, 200 - used * 30) + Math.max(0, 150 - Math.floor(secs) * 4)) * (1 + Math.min(1, (this.combo - 1) * 0.25)));
      this.solved++; if (window.Sound) Sound.levelUp(); if (window.Haptic) Haptic.big(); this.burst(this.source.x + 0.5, this.source.y + 0.5, '#06D6A0'); }
    else { gain = -100; this.wrong++; this.combo = 0; if (window.Sound) Sound.crash(); if (window.Haptic) Haptic.hit(); }
    this.score = Math.max(0, this.score + gain);
    this.result = { ok, gain, at: this.now, pick: c, secs: Math.floor(secs), used };
    this.revealed = true; this.armed = null; this.droneArmed = false;
  }
  timeout() { this.wrong++; this.combo = 0; this.result = { ok: false, gain: 0, at: this.now, pick: null, timeout: true }; this.revealed = true; if (window.Sound) Sound.crash(); }
  flash(text, color) { this.toast = { text, color, until: this.now + 1800 }; }
  burst(x, y, c) { for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.1; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }
  move() {} rotate() {} softDrop() {} hardDrop() {}

  tick(now) {
    this.now = now; if (!this.caseStart) this.caseStart = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    this.anim = this.anim.filter(a => (a.t -= 0.03 * f) > 0);
    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.03 * f; }); this.parts = this.parts.filter(p => p.l > 0);
    if (!this.result && !this.legend && (now - this.caseStart) / 1000 > this.caseLimit) this.timeout();
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
    const px = W / 100;                                     // 글자 크기는 화면 폭 기준 (셀이 작아도 글자는 읽히게)
    const F = (w, s) => w + ' ' + Math.round(s) + 'px Pretendard, sans-serif';
    const mapH = H - cs * 1.6;                              // 지도 영역 (아래 액션 바 제외)

    // 지도 바탕 — 진한 남색, 미세 격자, 레이더 스윕
    ctx.fillStyle = '#080D18'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,170,255,0.06)'; ctx.lineWidth = 1;
    for (let x = 0; x <= this.W; x++) { ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, mapH); ctx.stroke(); }
    for (let y = 0; y < this.H - 1; y++) { ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(W, y * cs); ctx.stroke(); }
    { const a = (now / 2600) % (Math.PI * 2), ccx = W / 2, ccy = mapH / 2, R = Math.hypot(W, mapH) / 2;
      const g = ctx.createConicGradient ? ctx.createConicGradient(a, ccx, ccy) : null;
      if (g) { g.addColorStop(0, 'rgba(76,201,240,0.16)'); g.addColorStop(0.12, 'rgba(76,201,240,0)'); g.addColorStop(1, 'rgba(76,201,240,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, mapH); } }
    // 산업단지
    if (this.kind === 'air') { ctx.fillStyle = 'rgba(255,209,102,0.05)'; ctx.fillRect(5 * cs, 0, W - 5 * cs, mapH); ctx.strokeStyle = 'rgba(255,209,102,0.25)'; ctx.setLineDash([6, 6]); ctx.strokeRect(5 * cs + 1, 1, W - 5 * cs - 2, mapH - 2); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,209,102,0.6)'; ctx.font = F('800', px * 3.2); ctx.textAlign = 'right'; ctx.fillText('산업단지', W - px * 2, mapH - px * 2); ctx.textAlign = 'left'; }
    // 강
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(76,201,240,0.16)'; ctx.lineWidth = cs * 1.7; this.riverPath(ctx, cs); ctx.stroke();
    const rg = ctx.createLinearGradient(0, 0, 0, mapH); rg.addColorStop(0, '#2B86CC'); rg.addColorStop(1, '#155A8E');
    ctx.strokeStyle = rg; ctx.lineWidth = cs * 1.05; this.riverPath(ctx, cs); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,235,255,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([cs * 0.45, cs * 0.5]); ctx.lineDashOffset = -now / 35; this.riverPath(ctx, cs); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(190,235,255,0.7)'; ctx.font = F('700', px * 2.8); ctx.fillText('상류', (this.river[0][0] + 1.2) * cs, cs * 0.75); ctx.fillText('하류 → 취수장', (this.river[this.H - 3][0] - 1.6) * cs, (this.H - 2.2) * cs);
    // 공개된 확산
    if (this.revealed) for (let y = 0; y < this.H - 2; y++) for (let x = 0; x < this.W; x++) { const v = this.concentration(x + 0.5, y + 0.5); if (v < 4) continue;
      ctx.fillStyle = (this.kind === 'air' ? 'rgba(177,93,255,' : 'rgba(255,92,122,') + (v / 100 * 0.55).toFixed(2) + ')'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x * cs + 2, y * cs + 2, cs - 4, cs - 4, 5) : ctx.rect(x * cs + 2, y * cs + 2, cs - 4, cs - 4); ctx.fill(); }
    // 센서 열 표시
    this.sensors.forEach(s => { if (now < s.at) return; const r = cs * (0.9 + s.v / 100 * 1.5), g = ctx.createRadialGradient((s.x + .5) * cs, (s.y + .5) * cs, 0, (s.x + .5) * cs, (s.y + .5) * cs, r);
      const col = s.v > 60 ? '255,92,122' : s.v > 25 ? '255,209,102' : '76,201,240';
      g.addColorStop(0, 'rgba(' + col + ',' + (0.22 + s.v / 100 * 0.35).toFixed(2) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc((s.x + .5) * cs, (s.y + .5) * cs, r, 0, Math.PI * 2); ctx.fill(); });
    // 후보 핀 (원형 배지 + 글자, 지목 대기는 금색 링, 제외는 흐리게·취소선)
    this.cands.forEach(c => {
      const cx = (c.x + 0.5) * cs, cy = (c.y + 0.5) * cs, armed = this.armed === c, isSrc = this.revealed && c === this.source, picked = this.result && this.result.pick === c, ex = this.excluded.includes(c);
      ctx.save(); if (ex) ctx.globalAlpha = 0.35;
      if (armed) { ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 3; ctx.shadowColor = '#FFD166'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(cx, cy, cs * 0.78 + Math.sin(now / 110) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
      const col = isSrc ? '#06D6A0' : (picked && !this.result.ok ? '#FF5C7A' : (this.kind === 'air' ? '#8FA0B8' : '#3B82F6'));
      ctx.fillStyle = 'rgba(8,13,24,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, cs * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = col; ctx.font = F('800', px * 4.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.name.slice(-1), cx, cy + 1);
      if (ex) { ctx.strokeStyle = '#FF5C7A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - cs * 0.42, cy - cs * 0.42); ctx.lineTo(cx + cs * 0.42, cy + cs * 0.42); ctx.stroke(); }
      ctx.restore();
    });
    // 센서 — 홀로그램 태그 (육각 배경 + 큰 숫자)
    this.sensors.forEach(s => { if (now < s.at) return; const cx = (s.x + .5) * cs, cy = (s.y + .5) * cs, k = Math.min(1, (now - s.at) / 260), r = cs * (s.small ? 0.36 : 0.42) * (0.6 + 0.4 * k);
      const col = s.v > 60 ? '#FF5C7A' : s.v > 25 ? '#FFD166' : '#4CC9F0';
      ctx.fillStyle = 'rgba(8,13,24,0.92)'; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.shadowColor = col; ctx.shadowBlur = 8 * k; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = F('800', px * (s.small ? 3.0 : 3.6)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.round(s.v)), cx, cy + 1); });
    this.anim.forEach(a => { if (a.kind !== 'ring') return; ctx.strokeStyle = 'rgba(255,255,255,' + a.t.toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x * cs, a.y * cs, cs * ((a.big ? 2.6 : 1.6) - a.t * 1.2), 0, Math.PI * 2); ctx.stroke(); });
    this.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - 2, p.y * cs - 2, 4, 4); }); ctx.globalAlpha = 1;
    // 바람 입자
    if (this.wind) for (let i = 0; i < 14; i++) { const ph = ((now / 1100) + i * 0.29) % 1; const bx = ((i * 1.37) % this.W) * cs + this.wind.ax * ph * W * 0.6, by = ((i * 2.3) % (this.H - 2)) * cs + this.wind.ay * ph * mapH * 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * (1 - ph)).toFixed(2) + ')'; ctx.lineWidth = 1.5; const x0 = ((bx % W) + W) % W, y0 = ((by % mapH) + mapH) % mapH;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + this.wind.ax * cs * 0.6, y0 + this.wind.ay * cs * 0.6); ctx.stroke(); }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // ── HUD (글래스 카드: 반투명 + 그라데이션 테두리 + 안쪽 광택) ──
    const glass = (x, y, w, h, r, accent) => {
      ctx.fillStyle = 'rgba(10,16,30,0.78)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill();
      const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, accent || 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 1, y + 1, w - 2, h * 0.45, r); else ctx.rect(x + 1, y + 1, w - 2, h * 0.45); ctx.fill();
    };
    const accent = this.kind === 'air' ? '#B15DFF' : this.kind === 'storm' ? '#4CC9F0' : '#3B82F6';
    // 상단 사건 카드
    const cardH = px * 15;
    glass(px * 3, px * 3, W - px * 6, cardH, px * 4, accent);
    ctx.fillStyle = accent; ctx.font = F('800', px * 4.4);
    ctx.fillText((this.kind === 'air' ? '🌫 악취 사건' : this.kind === 'storm' ? '⛈ 장마 사건' : '💧 수질 사건') + '  #' + this.round, px * 6, px * 8.4);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = F('600', px * 3.4);
    ctx.fillText(this.kind === 'air' ? '바람을 거슬러 올라가면 값이 커집니다' : this.kind === 'storm' ? '장맛비로 넓고 옅게 퍼졌어요. 상류 0 지점을 찾으세요' : '하류로 퍼집니다. 진원지 위쪽은 0', px * 6, px * 13.4);
    // 우측: 센서 · 시간 링 · ♥
    const remain = Math.max(0, this.caseLimit - (this.now - this.caseStart) / 1000), tr = px * 5.2, tx = W - px * 9, ty = px * 10.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = remain < 10 ? '#FF5C7A' : '#FFD166'; ctx.beginPath(); ctx.arc(tx, ty, tr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (remain / this.caseLimit)); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = F('800', px * 3.6); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.ceil(remain)), tx, ty + 1); ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right'; ctx.fillStyle = '#FFD166'; ctx.font = F('800', px * 3.8); ctx.fillText('센서 ' + this.budget, tx - px * 7.5, px * 8.4);
    ctx.fillStyle = '#FF5C7A'; ctx.font = F('800', px * 3.6); ctx.fillText('♥'.repeat(this.lives) + '♡'.repeat(3 - this.lives), tx - px * 7.5, px * 13.4); ctx.textAlign = 'left';
    // 콤보 · 점수 (지도 오른쪽 위 작은 카드)
    if (this.combo >= 2) { glass(W - px * 24, cardH + px * 5, px * 21, px * 7, px * 3, '#06D6A0'); ctx.fillStyle = '#06D6A0'; ctx.font = F('800', px * 3.4); ctx.textAlign = 'center'; ctx.fillText('🔥 ' + this.combo + '연속 적중 ×' + (1 + Math.min(1, (this.combo - 1) * 0.25)).toFixed(2), W - px * 13.5, cardH + px * 9.7); ctx.textAlign = 'left'; }
    // 바람 나침반
    if (this.wind) { const ccx = W - px * 9, ccy = cardH + px * 16 + (this.combo >= 2 ? px * 8 : 0), r = px * 5;
      glass(ccx - r - px, ccy - r - px, r * 2 + px * 2, r * 2 + px * 6, r, '#B15DFF');
      ctx.save(); ctx.translate(ccx, ccy); ctx.rotate(Math.atan2(this.wind.ay, this.wind.ax)); ctx.fillStyle = '#FFD166'; ctx.shadowColor = '#FFD166'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(r * 0.85, 0); ctx.lineTo(-r * 0.5, r * 0.5); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.5, -r * 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = F('700', px * 2.8); ctx.textAlign = 'center'; ctx.fillText('바람 ' + (this.wind.speed > 0.8 ? '강' : this.wind.speed > 0.6 ? '중' : '약'), ccx, ccy + r + px * 3.6); ctx.textAlign = 'left'; }
    // 액션 바 (아래): 범례 · AI 힌트 · 드론
    const barY = mapH + px * 1.2, bw = (W - px * 8) / 3, bh = H - barY - px * 1.5;
    [['📋 범례', '#8FA0B8', false], ['🤖 AI 힌트  -80', this.hintUsed ? '#5B6474' : '#B15DFF', this.hintUsed], ['🚁 드론  센서 2', this.droneUsed ? '#5B6474' : '#4CC9F0', this.droneUsed || this.droneArmed]].forEach(([label, col, dim], i) => {
      const x = px * 2 + i * (bw + px * 2); glass(x, barY, bw, bh, px * 3, col);
      if (i === 2 && this.droneArmed) { ctx.fillStyle = 'rgba(76,201,240,0.25)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, barY, bw, bh, px * 3); else ctx.rect(x, barY, bw, bh); ctx.fill(); }
      ctx.fillStyle = dim && !(i === 2 && this.droneArmed) ? 'rgba(255,255,255,0.4)' : '#fff'; ctx.font = F('800', px * 3.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + bw / 2, barY + bh / 2); });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // 지목 대기 · 안내
    if (this.armed && !this.result) { const t = this.armed.name + ' — 한 번 더 누르면 지목'; ctx.font = F('800', px * 3.6); const tw = ctx.measureText(t).width + px * 8;
      glass(W / 2 - tw / 2, mapH - px * 10, tw, px * 8, px * 4, '#FFD166'); ctx.fillStyle = '#FFD166'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, W / 2, mapH - px * 6); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; }
    else if (this.toast && now < this.toast.until) { ctx.font = F('700', px * 3.4); const tw = ctx.measureText(this.toast.text).width + px * 8;
      glass(W / 2 - tw / 2, mapH - px * 10, tw, px * 8, px * 4, this.toast.color); ctx.fillStyle = this.toast.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.toast.text, W / 2, mapH - px * 6); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; }
    // 사건 시작 배너
    const cb = this.anim.find(a => a.kind === 'case');
    if (cb) { ctx.fillStyle = 'rgba(8,13,24,' + (0.6 * Math.min(1, cb.t * 2)).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = accent; ctx.font = F('800', px * 9); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = Math.min(1, cb.t * 2);
      ctx.fillText('사건 #' + this.round, W / 2, H / 2 - px * 5); ctx.fillStyle = '#fff'; ctx.font = F('700', px * 4.4); ctx.fillText(this.kind === 'air' ? '악취 신고 접수' : this.kind === 'storm' ? '장맛비 뒤 수질 이상' : '수질 이상 감지', W / 2, H / 2 + px * 5); ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; }
    // 범례
    if (this.legend) { ctx.fillStyle = 'rgba(8,13,24,0.8)'; ctx.fillRect(0, 0, W, H); const lw = W - px * 10, lh = px * 46, lx = px * 5, ly = H / 2 - lh / 2; glass(lx, ly, lw, lh, px * 5);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = F('800', px * 4.6); ctx.fillText('📋 범례', lx + px * 4, ly + px * 7);
      const rows = [['#3B82F6', '● 배수구 핀 — 수질 사건의 후보'], ['#8FA0B8', '● 공장 핀 — 악취 사건의 후보'], ['#FF5C7A', '⬢ 60 이상 — 진하게 오염'], ['#FFD166', '⬢ 25~60 — 옅게 오염'], ['#4CC9F0', '⬢ 25 미만 — 거의 깨끗'], ['#FFD166', '금색 링 — 지목 대기 (한 번 더 톡)'], ['#B15DFF', '취소선 — AI 가 제외한 후보']];
      rows.forEach(([c, t], i) => { ctx.fillStyle = c; ctx.font = F('700', px * 3.4); ctx.fillText(t, lx + px * 4, ly + px * 14 + i * px * 4.4); });
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = F('600', px * 3); ctx.fillText('화면을 톡 → 닫기', lx + px * 4, ly + lh - px * 3); }
    // 결과 카드
    if (this.result) { const k = Math.min(1, (now - this.result.at) / 400); ctx.fillStyle = 'rgba(8,13,24,' + (0.6 * k).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
      const bw2 = W - px * 10, bh2 = px * 36, bx = px * 5, by = H / 2 - bh2 / 2 + (1 - k) * 20; glass(bx, by, bw2, bh2, px * 5, this.result.ok ? '#06D6A0' : '#FF5C7A');
      ctx.textAlign = 'center'; ctx.fillStyle = this.result.ok ? '#06D6A0' : '#FF5C7A'; ctx.font = F('800', px * 8);
      ctx.fillText(this.result.timeout ? '시간 초과' : this.result.ok ? '진원지 적중!' : '아닙니다', W / 2, by + px * 11);
      ctx.fillStyle = '#fff'; ctx.font = F('800', px * 5.2); ctx.fillText((this.result.gain > 0 ? '+' : '') + this.result.gain + '점', W / 2, by + px * 18.5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = F('600', px * 3.4); ctx.fillText('진원지: ' + this.source.name + (this.result.ok ? ' · 센서 ' + this.result.used + '개 · ' + this.result.secs + '초' : ''), W / 2, by + px * 24);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = F('600', px * 3);
      ctx.fillText(this.result.ok ? (this.kind === 'air' ? '바람을 거슬러 값이 커지는 끝이 진원지' : '하류 값이 크고 상류가 0인 지점 바로 위') : '공개된 확산 모양을 보고 다음엔 거슬러 올라가 보세요', W / 2, by + px * 28.5);
      ctx.fillStyle = '#FFD166'; ctx.font = F('700', px * 3.2); ctx.fillText('화면을 톡 → 다음 사건', W / 2, by + px * 33.5); ctx.textAlign = 'left'; }
    if (this.gameOver) { ctx.fillStyle = 'rgba(8,13,24,0.75)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = F('800', px * 7); ctx.fillText('수사 종료', W / 2, H / 2 - px * 4);
      ctx.font = F('600', px * 3.6); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(this.solved + '건 해결 · 최고 ' + this.bestCombo + '연속', W / 2, H / 2 + px * 4); ctx.textAlign = 'left'; }
  }
  riverPath(ctx, cs) { ctx.beginPath(); this.river.forEach(([x, y], i) => { if (y >= this.H - 2) return; const px = (x + 0.5) * cs, py = (y + 0.5) * cs; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); }
}
