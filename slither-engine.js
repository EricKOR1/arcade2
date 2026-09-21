// 뱀 아레나 — 큰 뱀이 작은 뱀을 삼키며 자라는 실시간 대전 (넓은 원형 경기장 · 카메라가 내 머리를 따라감)
//   · 조이스틱 방향으로 미끄러지듯 회전, 부스트(길이 소모)로 가속
//   · 먹이를 먹으면 길이 +1. 내 머리가 상대 몸에 닿으면: 내가 1.5배 이상 크면 상대를 삼킴(길이 절반 흡수), 아니면 내가 죽음
//   · 머리끼리 부딪히면 20% 이상 큰 쪽이 이김(비슷하면 둘 다). 죽으면 몸을 따라 먹이를 떨어뜨리고 3초 뒤 작은 뱀으로 부활
//   네트워크: 머리 위치·각도·길이만 보내고, 받는 쪽이 머리 자취로 몸을 복원합니다 (몸 좌표를 보내지 않아 가볍습니다)

const SL_R = 72;               // 경기장 반지름(칸) — 30명 기준 1인당 약 540칸²(이전 30칸은 약 95칸²)
const SL_PELLETS = 1300;       // 먹이 수 — 넓이에 맞춰 밀도 유지
const SL_SEG = 0.45;           // 몸 마디 간격(칸)
const SL_COLORS = ['#06D6A0', '#4CC9F0', '#FFD166', '#FF5C7A', '#B15DFF', '#FF9F43', '#7DF58F', '#F78FB3'];

class SlitherGame {
  constructor(canvas, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {};
    this.cellSize = this.opts.cellSize || 20;
    this.myId = this.opts.myId || 'me'; this.myName = this.opts.myName || '';
    this.colorIdx = Math.abs(String(this.myId).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % SL_COLORS.length;
    this.peers = {}; this.parts = []; this.now = 0; this.lastTime = 0;
    this.score = 0; this.kills = 0; this.best = 0; this.gameOver = false; this.toasts = [];
    this.mx = 0; this.my = 0; this.boost = false;
    this.reset(6, this.opts.slot);
    this.pellets = []; this.seed = 12345; for (let i = 0; i < SL_PELLETS; i++) this.spawnPellet();
  }
  rnd() { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; }
  spawnPellet(x, y, v) {
    if (this.pellets && this.pellets.length > SL_PELLETS * 1.6) return;   // 먹이가 너무 쌓이지 않게
    if (x == null) { const a = this.rnd() * Math.PI * 2, r = Math.sqrt(this.rnd()) * (SL_R - 2); x = Math.cos(a) * r; y = Math.sin(a) * r; }
    this.pellets.push({ x, y, v: v || 1, c: SL_COLORS[Math.floor(this.rnd() * SL_COLORS.length)], ph: this.rnd() * 6 });
  }
  reset(len, slot) {
    let best = null, bd = -1;
    if (typeof slot === 'number') {
      // 첫 출발: 해바라기 배치(황금각). 30명이면 이웃 사이가 약 20칸 — 동시에 들어와도 서로 모르는 채로 겹치지 않음
      const k = slot % 40, a = k * 2.39996, r = Math.sqrt((k + 0.5) / 40) * (SL_R - 12);
      best = [Math.cos(a) * r, Math.sin(a) * r];
    } else
    // 부활 위치: 경기장 안쪽에서 다른 뱀 머리와 가장 먼 후보 (8곳 중)
    for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (SL_R - 10), x = Math.cos(a) * r, y = Math.sin(a) * r;
      let near = 1e9; Object.keys(this.peers || {}).forEach(id => { const p = this.peers[id]; if (!p.dead) near = Math.min(near, Math.hypot(p.x - x, p.y - y)); });
      if (near > bd) { bd = near; best = [x, y]; } }
    this.x = best[0]; this.y = best[1]; this.angle = Math.atan2(-this.y, -this.x) + (Math.random() - 0.5);   // 가운데 쪽을 보고 출발
    this.len = len || 6; this.trail = []; for (let i = 0; i < 40; i++) this.trail.push([this.x - Math.cos(this.angle) * i * SL_SEG, this.y - Math.sin(this.angle) * i * SL_SEG]);
    this.deadUntil = 0; this.invul = 2000; this.boostAcc = 0;
  }
  get isDead() { return this.now < this.deadUntil; }
  get radius() { return 0.28 + Math.min(1.1, Math.sqrt(this.len) * 0.07); }
  static radiusOf(len) { return 0.28 + Math.min(1.1, Math.sqrt(len) * 0.07); }
  clock() { return this.now || performance.now(); }
  toast(t, c) { this.toasts.push({ text: t, color: c || '#fff', until: this.clock() + 1600 }); }

  // ── 신호 ──
  serialize() { return [this.x.toFixed(2), this.y.toFixed(2), this.angle.toFixed(2), Math.round(this.len), this.boost ? 1 : 0, this.isDead ? 1 : 0, this.colorIdx, this.kills].join(','); }
  static parse(raw) { const a = String(raw).split(','); return { x: +a[0], y: +a[1], angle: +a[2], len: +a[3] || 6, boost: a[4] === '1', dead: a[5] === '1', ci: +a[6] || 0, kills: +a[7] || 0 }; }
  applyPeerRaw(id, raw, name) {
    const d = SlitherGame.parse(raw), now = this.clock();
    if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle, trail: [[d.x, d.y]], len: d.len, dead: d.dead, ci: d.ci };
    const p = this.peers[id];
    if (p.dead && !d.dead) { p.trail = [[d.x, d.y]]; p.x = d.x; p.y = d.y; }            // 부활: 자취 새로
    if (!p.dead && d.dead) this.dropPellets(p.trail, p.len);                              // 상대가 죽음: 그 몸을 먹이로
    if (Math.hypot(p.x - d.x, p.y - d.y) > 6) { p.x = d.x; p.y = d.y; p.trail = [[d.x, d.y]]; }   // 순간이동(부활 등)
    Object.assign(p, { tx: d.x, ty: d.y, tangle: d.angle, len: d.len, boost: d.boost, dead: d.dead, ci: d.ci, kills: d.kills, name: name || p.name || '', seen: now });
  }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) delete this.peers[id]; }); }
  removePeer(id) { delete this.peers[id]; }
  onEvent(e) {
    if (!e) return;
    if (e.type === 'eaten' && e.target === this.myId && !this.isDead) { const who = this.peers[e.by] ? this.peers[e.by].name : ''; this.die((who || '큰 뱀') + '에게 삼켜졌다'); }
  }
  setMove(x, y) { this.mx = x; this.my = y; }
  setBoost(on) { this.boost = !!on; }
  fire() { this.boost = true; }            // 패드 호환: 발사 = 부스트
  releaseFire() { this.boost = false; }

  dropPellets(trail, len) { const n = Math.min(trail.length, Math.round(len / SL_SEG)); for (let i = 0; i < n; i += 2) { const t = trail[i]; this.spawnPellet(t[0] + (this.rnd() - .5) * .4, t[1] + (this.rnd() - .5) * .4, 2); } }
  die(reason) {
    this.deadUntil = this.clock() + 3000; this.best = Math.max(this.best, this.len);
    this.dropPellets(this.trail, this.len); this.burst(this.x, this.y, 24, SL_COLORS[this.colorIdx]);
    this.toast(reason + ' · 3초 뒤 부활', '#FF5C7A'); if (window.Sound) Sound.gameOver(); if (window.Haptic) Haptic.big();
  }
  burst(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.1; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }

  // ── 진행 ──
  tick(now) {
    const { dt, f } = FX.frame(this, now);
    if (this.deadUntil && now >= this.deadUntil && this.deadUntil > 0) { this.reset(6); this.toast('부활!', '#06D6A0'); }
    if (!this.isDead) {
      // 조향: 조이스틱 방향으로 서서히 회전
      const inLen = Math.hypot(this.mx, this.my);
      if (inLen > 0.15) { const want = Math.atan2(this.my, this.mx); let da = want - this.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const rate = (0.09 - Math.min(0.05, this.len * 0.0004)) * f; this.angle += Math.max(-rate, Math.min(rate, da)); }
      // 속도 · 부스트(길이 6 넘을 때만, 초당 길이 1.2 소모)
      const canBoost = this.boost && this.len > 8;
      const sp = 0.11 * (canBoost ? 1.7 : 1) * f;
      if (canBoost) { this.boostAcc += dt; if (this.boostAcc > 800) { this.boostAcc = 0; this.len -= 1; this.spawnPellet(this.trail[this.trail.length - 1][0], this.trail[this.trail.length - 1][1], 1); } }
      this.x += Math.cos(this.angle) * sp; this.y += Math.sin(this.angle) * sp;
      // 경기장 밖으로 나가면 죽음
      if (Math.hypot(this.x, this.y) > SL_R) { this.die('경기장 벽에 부딪혔다'); }
      // 자취 기록 (마디 간격마다)
      const h = this.trail[0]; if (Math.hypot(this.x - h[0], this.y - h[1]) >= SL_SEG) this.trail.unshift([this.x, this.y]);
      const maxPts = Math.round(this.len / SL_SEG) + 2; if (this.trail.length > maxPts) this.trail.length = maxPts;
      if (this.invul > 0) this.invul -= dt;
      // 먹이
      const R = this.radius;
      for (let i = this.pellets.length - 1; i >= 0; i--) { const pl = this.pellets[i]; const d = Math.hypot(pl.x - this.x, pl.y - this.y);
        if (d < R + 0.6) { pl.x += (this.x - pl.x) * 0.35; pl.y += (this.y - pl.y) * 0.35; }             // 빨려 들어옴
        if (d < R + 0.15) { this.len += pl.v; this.score = Math.max(this.score, Math.round(this.len)); this.pellets.splice(i, 1); this.spawnPellet(); if (window.Sound) Sound.move(); } }
      // 충돌: 상대 몸 · 머리
      if (this.invul <= 0) Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || this.isDead) return;
        const pr = SlitherGame.radiusOf(p.len);
        // 머리끼리
        if (Math.hypot(p.x - this.x, p.y - this.y) < R + pr) {
          if (this.len >= p.len * 1.2) this.eat(id, p); else if (p.len >= this.len * 1.2) this.die(p.name + '과(와) 정면 충돌'); else { this.die(p.name + '과(와) 정면 충돌'); }
          return; }
        // 상대 몸
        const n = Math.min(p.trail.length, Math.round(p.len / SL_SEG));
        for (let i = 1; i < n; i += 2) { const t = p.trail[i]; if (Math.hypot(t[0] - this.x, t[1] - this.y) < R + pr * 0.9) {
          if (this.len >= p.len * 1.5) this.eat(id, p); else this.die(p.name + '의 몸에 부딪혔다'); return; } } });
    }
    // 상대 머리 보간 + 자취 복원
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.tx == null) return;
      p.x += (p.tx - p.x) * 0.35; p.y += (p.ty - p.y) * 0.35; let da = (p.tangle != null ? p.tangle : p.angle) - p.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.angle += da * 0.35;
      const h = p.trail[0]; if (!h || Math.hypot(p.x - h[0], p.y - h[1]) >= SL_SEG) p.trail.unshift([p.x, p.y]);
      const maxPts = Math.round(p.len / SL_SEG) + 2; if (p.trail.length > maxPts) p.trail.length = maxPts; });
    this.parts = FX.stepParts(this.parts, f, 0.05);
    this.toasts = this.toasts.filter(t => t.until > now);
    this.draw();
  }
  eat(id, p) {
    const gain = Math.round(p.len / 2); this.len += gain; this.kills++; this.score = Math.max(this.score, Math.round(this.len));
    this.toast(p.name + ' 을(를) 삼켰다! +' + gain, '#FFD166'); this.burst(p.x, p.y, 20, SL_COLORS[p.ci || 0]);
    if (this.opts.onAttack) this.opts.onAttack('eaten', id, {}); if (window.Sound) Sound.levelUp(); if (window.Haptic) Haptic.good();
    p.dead = true;                                                     // 신호가 오기 전까지 내 화면에서 미리 치움
  }

  getSnapshot() {
    const N = 30, g = []; for (let y = 0; y < N; y++) { g.push([]); for (let x = 0; x < N; x++) { const wx = (x + .5) / N * 2 * SL_R - SL_R, wy = (y + .5) / N * 2 * SL_R - SL_R; g[y].push(Math.hypot(wx, wy) > SL_R ? 63 : 66); } }
    const put = (x, y, v) => { const gx = Math.floor((x + SL_R) / (2 * SL_R) * N), gy = Math.floor((y + SL_R) / (2 * SL_R) * N); if (g[gy] && g[gy][gx] != null) g[gy][gx] = v; };
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead) return; p.trail.forEach(t => put(t[0], t[1], 68)); });
    if (!this.isDead) this.trail.forEach(t => put(t[0], t[1], 23));
    return g;
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.canvas.clientWidth || this.canvas.width, H = this.canvas.clientHeight || this.canvas.height, now = this.now;   // CSS 픽셀 기준
    const vw = W / cs, vh = H / cs;
    // 카메라: 내 머리 중심 (죽었으면 마지막 위치)
    const camX = this.x, camY = this.y;
    const zoom = Math.max(0.6, 1 - Math.min(0.4, this.len / 400));         // 커질수록 살짝 멀어짐
    const tx = wx => (wx - camX) * cs * zoom + W / 2, ty = wy => (wy - camY) * cs * zoom + H / 2, sc = cs * zoom;
    // 배경: 어두운 격자 + 경기장 경계
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7); bg.addColorStop(0, '#16213A'); bg.addColorStop(1, '#0A0F1E'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,170,255,0.07)'; ctx.lineWidth = 1;
    const g0x = ((-camX * sc + W / 2) % (sc * 2) + sc * 2) % (sc * 2), g0y = ((-camY * sc + H / 2) % (sc * 2) + sc * 2) % (sc * 2);
    for (let x = g0x; x < W; x += sc * 2) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = g0y; y < H; y += sc * 2) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,92,122,0.55)'; ctx.lineWidth = 6; ctx.setLineDash([sc * 0.6, sc * 0.4]); ctx.beginPath(); ctx.arc(tx(0), ty(0), SL_R * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const outer = ctx.createRadialGradient(tx(0), ty(0), SL_R * sc, tx(0), ty(0), SL_R * sc + sc * 6); outer.addColorStop(0, 'rgba(255,92,122,0.18)'); outer.addColorStop(1, 'rgba(255,92,122,0)');
    ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(tx(0), ty(0), SL_R * sc + sc * 6, 0, Math.PI * 2); ctx.arc(tx(0), ty(0), SL_R * sc, 0, Math.PI * 2, true); ctx.fill();
    // 먹이
    this.pellets.forEach(pl => { const px = tx(pl.x), py = ty(pl.y); if (px < -20 || py < -20 || px > W + 20 || py > H + 20) return;
      const r = sc * (0.12 + pl.v * 0.05) * (1 + Math.sin(now / 300 + pl.ph) * 0.15);
      const gr = ctx.createRadialGradient(px, py, 0, px, py, r * 2.6); gr.addColorStop(0, pl.c + 'AA'); gr.addColorStop(1, pl.c + '00'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, r * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pl.c; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); });
    // 뱀들 (작은 순서로 그려 큰 뱀이 위에)
    const snakes = Object.keys(this.peers).map(id => this.peers[id]).filter(p => !p.dead && p.trail.length > 1).map(p => ({ trail: p.trail, len: p.len, ci: p.ci, angle: p.angle, x: p.x, y: p.y, name: p.name, boost: p.boost, me: false }));
    if (!this.isDead) snakes.push({ trail: this.trail, len: this.len, ci: this.colorIdx, angle: this.angle, x: this.x, y: this.y, name: this.myName, boost: this.boost && this.len > 8, me: true, inv: this.invul > 0 });
    snakes.sort((a, b) => a.len - b.len).forEach(sn => this.drawSnake(ctx, sn, tx, ty, sc, now));
    FX.drawParts(ctx, this.parts.map(p => ({ ...p, x: (p.x - camX) * zoom + W / 2 / cs, y: (p.y - camY) * zoom + H / 2 / cs })), cs, 3);
    // HUD: 길이 · 순위표
    const everyone = Object.keys(this.peers).map(id => this.peers[id]).filter(p => !p.dead).map(p => ({ name: p.name, len: p.len, me: false }));
    if (!this.isDead) everyone.push({ name: this.myName, len: this.len, me: true });
    const board = everyone.sort((a, b) => b.len - a.len).slice(0, 5);
    const myRank = everyone.findIndex(e => e.me) + 1;
    FX.glass(ctx, 12, 12, 130, 44, 12);
    FX.text(ctx, '길이 ' + Math.round(this.len), 24, 40, { size: 20, weight: 800, color: SL_COLORS[this.colorIdx] });
    if (!this.isDead && Object.keys(this.peers).length) FX.text(ctx, myRank + '위', 132, 40, { size: 13, weight: 800, color: 'rgba(255,255,255,0.7)', align: 'right' });
    // 순위표: 제목 한 줄 + 최대 5줄. 줄 높이 20 · 위아래 여백 포함해 상자 높이를 글자에 맞춤
    const lbW = 150, lbX = W - lbW - 12, lbH = 34 + board.length * 20;
    FX.glass(ctx, lbX, 12, lbW, lbH, 12);
    FX.text(ctx, '순위 · ' + everyone.length + '명', lbX + 12, 31, { size: 12, weight: 800, color: 'rgba(255,255,255,0.6)' });
    board.forEach((sn, i) => { const y = 52 + i * 20;
      if (sn.me) { ctx.fillStyle = 'rgba(255,209,102,0.14)'; FX.rr(ctx, lbX + 6, y - 14, lbW - 12, 19, 6); ctx.fill(); }
      FX.text(ctx, (i + 1) + '. ' + (sn.name || '?').slice(0, 6), lbX + 12, y, { size: 13, weight: sn.me ? 800 : 700, color: sn.me ? '#FFD166' : '#fff' });
      FX.text(ctx, String(Math.round(sn.len)), lbX + lbW - 12, y, { size: 13, weight: 800, color: sn.me ? '#FFD166' : 'rgba(255,255,255,0.85)', align: 'right' }); });
    // 내가 5위 밖이면 맨 아래에 내 순위 한 줄 더
    if (myRank > 5) { const y = 12 + lbH + 18; FX.glass(ctx, lbX, 12 + lbH + 4, lbW, 24, 10, '#FFD166');
      FX.text(ctx, myRank + '. ' + (this.myName || '나').slice(0, 6), lbX + 12, y, { size: 13, weight: 800, color: '#FFD166' });
      FX.text(ctx, String(Math.round(this.len)), lbX + lbW - 12, y, { size: 13, weight: 800, color: '#FFD166', align: 'right' }); }
    // 미니맵 (오른쪽 아래)
    // 미니맵: 왼쪽 위 (길이 카드 아래) — 오른쪽 아래는 부스트 버튼 자리
    { const mr = 46, mx2 = 12 + mr, my2 = 66 + mr; ctx.fillStyle = 'rgba(8,10,16,0.6)'; ctx.beginPath(); ctx.arc(mx2, my2, mr, 0, Math.PI * 2); ctx.fill();
      // 내 시야 범위 표시
      { const vr = Math.max(vw, vh) / 2 / zoom / SL_R * mr; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(mx2 + this.x / SL_R * mr - vw / 2 / zoom / SL_R * mr, my2 + this.y / SL_R * mr - vh / 2 / zoom / SL_R * mr, vw / zoom / SL_R * mr, vh / zoom / SL_R * mr); }
      ctx.strokeStyle = 'rgba(255,92,122,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      // 모든 뱀 (내 화면 밖 포함) — 큰 뱀일수록 점이 큼
      const all = Object.keys(this.peers).map(id => this.peers[id]).filter(p => !p.dead).map(p => ({ x: p.x, y: p.y, len: p.len, ci: p.ci, me: false }));
      if (!this.isDead) all.push({ x: this.x, y: this.y, len: this.len, ci: this.colorIdx, me: true });
      all.forEach(sn => { ctx.fillStyle = sn.me ? '#FFD166' : SL_COLORS[sn.ci] + 'AA'; ctx.beginPath(); ctx.arc(mx2 + sn.x / SL_R * mr, my2 + sn.y / SL_R * mr, sn.me ? 3.2 : Math.min(4, 1.4 + Math.sqrt(sn.len) * 0.15), 0, Math.PI * 2); ctx.fill(); }); }
    this.toasts.slice(-2).forEach((t, i) => FX.text(ctx, t.text, W / 2, H * 0.28 + i * 26, { size: 18, weight: 800, color: t.color, align: 'center', shadow: 8 }));
    if (this.isDead) { ctx.fillStyle = 'rgba(8,10,16,0.5)'; ctx.fillRect(0, 0, W, H); FX.text(ctx, '부활까지 ' + Math.ceil((this.deadUntil - now) / 1000), W / 2, H / 2, { size: 30, weight: 800, color: '#fff', align: 'center', baseline: 'middle', shadow: 10 }); FX.text(ctx, '최고 길이 ' + Math.round(this.best), W / 2, H / 2 + 34, { size: 15, weight: 700, color: '#FFD166', align: 'center', baseline: 'middle' }); }
    if (this.boost && this.len > 8 && !this.isDead) { ctx.strokeStyle = 'rgba(255,209,102,0.35)'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8); }
  }
  drawSnake(ctx, sn, tx, ty, sc, now) {
    const col = SL_COLORS[sn.ci % SL_COLORS.length], r = SlitherGame.radiusOf(sn.len) * sc, n = Math.min(sn.trail.length, Math.round(sn.len / SL_SEG) + 1);
    if (n < 2) return;
    const path = () => { ctx.beginPath(); ctx.moveTo(tx(sn.x), ty(sn.y)); for (let i = 0; i < n; i++) ctx.lineTo(tx(sn.trail[i][0]), ty(sn.trail[i][1])); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (sn.boost) { ctx.strokeStyle = col + '55'; ctx.lineWidth = r * 3.2; path(); ctx.stroke(); }               // 부스트 광채
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = r * 2.2; ctx.save(); ctx.translate(0, r * 0.35); path(); ctx.stroke(); ctx.restore();   // 그림자
    ctx.strokeStyle = FX.tint(col, -0.35); ctx.lineWidth = r * 2.1; path(); ctx.stroke();                          // 테두리
    ctx.strokeStyle = col; ctx.lineWidth = r * 1.7; path(); ctx.stroke();                                          // 본색
    ctx.save(); ctx.translate(0, -r * 0.35); ctx.strokeStyle = FX.tint(col, 0.45); ctx.globalAlpha = 0.55; ctx.lineWidth = r * 0.5; path(); ctx.stroke(); ctx.restore();   // 하이라이트
    // 무늬: 마디마다 점
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 2; i < n; i += 3) { ctx.beginPath(); ctx.arc(tx(sn.trail[i][0]), ty(sn.trail[i][1]), r * 0.35, 0, Math.PI * 2); ctx.fill(); }
    // 머리: 살짝 크고 눈 두 개
    const hx = tx(sn.x), hy = ty(sn.y);
    if (sn.inv) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(hx, hy, r * 1.6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy, r * 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = FX.tint(col, -0.35); ctx.lineWidth = Math.max(1, r * 0.2); ctx.stroke();
    const ex = Math.cos(sn.angle), ey = Math.sin(sn.angle), nx = -ey, ny = ex;
    [-1, 1].forEach(sd => { const ox = hx + ex * r * 0.35 + nx * sd * r * 0.5, oy = hy + ey * r * 0.35 + ny * sd * r * 0.5;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox, oy, r * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#12161F'; ctx.beginPath(); ctx.arc(ox + ex * r * 0.12, oy + ey * r * 0.12, r * 0.18, 0, Math.PI * 2); ctx.fill(); });
    if (sn.name) FX.text(ctx, sn.name + ' · ' + Math.round(sn.len), hx, hy - r * 1.6, { size: Math.max(11, sc * 0.5), weight: 800, color: sn.me ? '#FFD166' : '#fff', align: 'center', shadow: 4 });
  }
}
