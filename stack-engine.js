// 블록 쌓기 타이밍 — 왔다 갔다 하는 블록을 톡 눌러 멈추고, 아래 블록과 겹친 부분만 남겨 높이 쌓습니다.
// 거의 딱 맞추면 '퍼펙트!' — 크기 유지, 3번 연속부터는 조금씩 다시 커짐. 완전히 빗나가면 끝.

const ST_COLS = 9, ST_ROWS = 16;
const ST_H = 0.2;          // 한 층 높이 (블록 기본 폭 = 1)
const ST_AMP = 1.2;        // 블록이 왔다 갔다 하는 폭 (아래 블록 중심에서 ±)
const ST_TOL = 0.04;       // 퍼펙트로 쳐 주는 오차
const ST_READY = 1400;     // 판 시작 뒤 블록이 멈춰 있는 시간 (페이지의 READY·GO 와 같은 길이) — 그동안 톡은 무시
const ST_SPAWN_GRACE = 250; // 새 블록이 나온 직후 무시하는 시간 — 새 블록은 탑 밖(빗나감 자리)에서 출발해, 바로 톡하면 한 번에 끝나던 문제
const ST_GROW = 0.06;      // 연속 퍼펙트 3번부터 한 번에 커지는 양
const ST_BASE = ['#2E3558', '#454E7A', '#6A74A6'];   // 받침대 색 (오른쪽 · 왼쪽 · 윗면)
const ST_C = 0.866, ST_S = 0.5;   // 아이소메트릭 cos30 · sin30

// 하늘 색 단계 (높이 층수 → 위/아래 색): 낮 → 노을 → 저녁 → 밤
const ST_SKY = [
  { at: 0,  top: [86, 182, 255],  bot: [205, 236, 255] },
  { at: 22, top: [120, 150, 235], bot: [255, 214, 160] },
  { at: 40, top: [150, 90, 170],  bot: [255, 140, 110] },
  { at: 60, top: [40, 36, 100],   bot: [140, 80, 140] },
  { at: 85, top: [8, 12, 38],     bot: [30, 34, 82] }
];

class StackGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.cols = ST_COLS; this.rows = ST_ROWS;
    this.score = 0; this.gameOver = false;
    this.height = 0; this.perfects = 0; this.streak = 0; this.bestStreak = 0;
    this.lastTime = 0; this.now = 0; this.age = 0; this.lastTap = -1e9; this.spawnAge = 0;
    this.hue0 = Math.floor(Math.random() * 360);
    this.layers = [{ x: 0, z: 0, w: 1, d: 1, hue: this.hue0 }];   // 0층 = 받침 위 첫 블록
    this.chops = []; this.flashes = []; this.parts = []; this.texts = [];
    this.camY = 0; this.zoom = 1; this.dying = 0; this.miss = false;
    // 별 · 구름 (한 번만 만들어 둠)
    this.stars = []; for (let i = 0; i < 70; i++) this.stars.push({ x: Math.random(), y: Math.random(), r: Math.random() < 0.15 ? 2 : 1, tw: Math.random() * 6.28 });
    this.clouds = []; for (let i = 0; i < 4; i++) this.clouds.push({ x: Math.random(), y: 0.15 + i * 0.22, s: 0.7 + Math.random() * 0.6, v: 0.00015 + Math.random() * 0.0002 });
    this.spawn();
  }

  // 겹친 부분 계산 (테스트에서도 씀) — prevC: 아래 블록 중심, size: 폭, delta: 멈춘 블록이 어긋난 거리
  static cut(prevC, size, delta, tol) {
    tol = tol == null ? ST_TOL : tol;
    if (Math.abs(delta) <= tol) return { perfect: true, miss: false, size, center: prevC, chopSize: 0, chopC: prevC };
    const over = size - Math.abs(delta);
    if (over <= 0) return { perfect: false, miss: true, size: 0, center: prevC + delta, chopSize: size, chopC: prevC + delta };
    const sg = delta > 0 ? 1 : -1;
    return { perfect: false, miss: false, size: over, center: prevC + delta / 2, chopSize: Math.abs(delta), chopC: prevC + sg * size / 2 + delta / 2 };
  }

  get top() { return this.layers[this.layers.length - 1]; }
  get speed() { return Math.min(0.045, 0.02 + this.height * 0.0005); }   // 층이 오를수록 조금씩 빨라짐 (상한)

  spawn() {
    const t = this.top, n = this.layers.length;
    this.cur = { x: t.x, z: t.z, w: t.w, d: t.d, hue: (this.hue0 + n * 7) % 360, axis: n % 2 ? 'x' : 'z', p: -ST_AMP, dir: 1 };
    this.spawnAge = this.age;
    this.syncCur();
  }
  syncCur() { const c = this.cur, t = this.top; if (c.axis === 'x') { c.x = t.x + c.p; c.z = t.z; } else { c.z = t.z + c.p; c.x = t.x; } }

  // ── 조작: 모두 '멈추기' ──
  stop() {
    if (this.gameOver || this.dying || !this.cur) return null;
    if (this.now - this.lastTap < 70) return null;          // 한 번 톡이 두 번 들어오는 것 막기
    if (this.age < ST_READY || this.age - this.spawnAge < ST_SPAWN_GRACE) return null;   // 시작 준비 중 · 새 블록이 막 나왔을 때
    this.lastTap = this.now;
    const c = this.cur, t = this.top, ax = c.axis;
    const prevC = ax === 'x' ? t.x : t.z, size = ax === 'x' ? t.w : t.d;
    const r = StackGame.cut(prevC, size, c.p);
    const y = this.layers.length * ST_H;
    if (r.miss) {   // 완전히 빗나감 → 블록 통째로 떨어지고 끝
      this.chops.push({ x: c.x, z: c.z, w: c.w, d: c.d, y, hue: c.hue, vy: 0, rot: 0, vr: (c.p > 0 ? 1 : -1) * 0.05, behind: c.p < 0 });
      this.cur = null; this.miss = true; this.dying = 1300; this.streak = 0;
      if (window.Sound) Sound.gameOver();
      return r;
    }
    const nb = { x: c.x, z: c.z, w: c.w, d: c.d, hue: c.hue };
    let size2 = r.size;
    if (r.perfect) {
      this.streak++; this.perfects++; this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (this.streak >= 3) size2 = Math.min(1, size2 + ST_GROW);
      this.score += 1 + Math.min(this.streak, 5);
      this.flashes.push({ x: t.x, z: t.z, w: ax === 'x' ? size2 : t.w, d: ax === 'z' ? size2 : t.d, y: y + ST_H, t: 0 });
      this.texts.length = 0; this.texts.push({ s: this.streak >= 2 ? '퍼펙트! x' + this.streak : '퍼펙트!', t: 0, big: this.streak >= 3 });
      this.sparkle(t.x, y + ST_H, t.z);
      if (window.Sound) Sound.note(523 * Math.pow(1.0595, Math.min(this.streak, 12) * 2), 0.12, 'triangle', 0.25);
    } else {
      this.streak = 0; this.score += 1;
      const ch = { y, hue: c.hue, vy: 0, rot: 0, vr: 0, behind: c.p < 0 };
      if (ax === 'x') { ch.x = r.chopC; ch.z = t.z; ch.w = r.chopSize; ch.d = t.d; }
      else { ch.z = r.chopC; ch.x = t.x; ch.d = r.chopSize; ch.w = t.w; }
      ch.vr = (c.p > 0 ? 1 : -1) * (0.04 + Math.random() * 0.03);
      this.chops.push(ch);
      if (window.Sound) Sound.note(330 + Math.min(this.height, 40) * 6, 0.08, 'sine', 0.2);
    }
    if (ax === 'x') { nb.x = r.center; nb.w = size2; nb.z = t.z; } else { nb.z = r.center; nb.d = size2; nb.x = t.x; }
    this.layers.push(nb); this.height++;
    this.spawn();
    return r;
  }
  tapAt() { this.stop(); }
  hardDrop() { this.stop(); }
  up() { this.stop(); }
  rotate() { this.stop(); }
  move() {} softDrop() {} down() {}

  sparkle(x, y, z) {
    const cs = this.cellSize;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * 6.28, v = 0.05 + Math.random() * 0.12;
      const p = this.proj(x, y, z);
      this.parts.push({ x: p[0] / cs, y: p[1] / cs, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 0.05, g: 0.006, l: 1, c: i % 3 ? '#FFFFFF' : '#FFE38A' });
    }
  }

  tick(now) {
    this.now = now;
    const { dt, f } = FX.frame(this, now);
    this.age += dt;
    if (!this.gameOver) {
      if (this.cur && this.age >= ST_READY) {   // 왔다 갔다 (시작 준비 시간에는 멈춰 있음)
        const c = this.cur; c.p += c.dir * this.speed * f;
        if (c.p > ST_AMP) { c.p = ST_AMP; c.dir = -1; } else if (c.p < -ST_AMP) { c.p = -ST_AMP; c.dir = 1; }
        this.syncCur();
      }
      if (this.dying) { this.dying -= dt; if (this.dying <= 0) { this.dying = 0; this.gameOver = true; } }
    }
    // 잘린 조각: 회전하며 떨어짐
    for (let i = this.chops.length - 1; i >= 0; i--) { const ch = this.chops[i]; ch.vy -= 0.006 * f; ch.y += ch.vy * f; ch.rot += ch.vr * f; if (ch.y < this.camY - 8) this.chops.splice(i, 1); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].t += dt / 450; if (this.flashes[i].t >= 1) this.flashes.splice(i, 1); }
    for (let i = this.texts.length - 1; i >= 0; i--) { this.texts[i].t += dt / 900; if (this.texts[i].t >= 1) this.texts.splice(i, 1); }
    if (this.parts.length) this.parts = FX.stepParts(this.parts, f, 0.03);
    // 카메라: 맨 위 층을 따라감 · 끝나면 탑 전체가 보이게 물러남
    const topY = this.layers.length * ST_H;
    let ty = topY, tz = 1;
    if (this.dying || this.gameOver) { const tall = topY + 0.4; tz = Math.min(1, 3.6 / tall); ty = tall / 2 - 0.2; }
    const k = 1 - Math.pow(0.9, f);
    this.camY += (ty - this.camY) * k; this.zoom += (tz - this.zoom) * k * 0.7;
    this.draw();
  }

  // 월드 → 화면 (px)
  proj(x, y, z) {
    const W = this.cols * this.cellSize, H = this.rows * this.cellSize, S = W * 0.29 * this.zoom;
    return [W / 2 + (x - z) * ST_C * S, H * 0.5 + (x + z) * ST_S * S - (y - this.camY) * S];
  }

  // 상자 하나 (윗면 + 앞쪽 두 면)
  box(ctx, x, y, z, w, d, h, hue, rot, alpha, pal) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
    const P = (a, b, c) => this.proj(a, b, c);
    const tA = P(x0, y1, z0), tB = P(x1, y1, z0), tC = P(x1, y1, z1), tD = P(x0, y1, z1), bB = P(x1, y, z0), bC = P(x1, y, z1), bD = P(x0, y, z1);
    if (rot) { const c = P(x, y + h / 2, z); ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(rot); ctx.translate(-c[0], -c[1]); }
    if (alpha != null) ctx.globalAlpha = alpha;
    // 오른쪽 면 (+x)
    ctx.fillStyle = pal ? pal[0] : 'hsl(' + hue + ',62%,46%)';
    ctx.beginPath(); ctx.moveTo(tB[0], tB[1]); ctx.lineTo(tC[0], tC[1]); ctx.lineTo(bC[0], bC[1]); ctx.lineTo(bB[0], bB[1]); ctx.closePath(); ctx.fill();
    // 왼쪽 면 (+z)
    ctx.fillStyle = pal ? pal[1] : 'hsl(' + hue + ',66%,56%)';
    ctx.beginPath(); ctx.moveTo(tD[0], tD[1]); ctx.lineTo(tC[0], tC[1]); ctx.lineTo(bC[0], bC[1]); ctx.lineTo(bD[0], bD[1]); ctx.closePath(); ctx.fill();
    // 윗면
    ctx.fillStyle = pal ? pal[2] : 'hsl(' + hue + ',75%,70%)';
    ctx.beginPath(); ctx.moveTo(tA[0], tA[1]); ctx.lineTo(tB[0], tB[1]); ctx.lineTo(tC[0], tC[1]); ctx.lineTo(tD[0], tD[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // 앞 모서리 하이라이트
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(tC[0], tC[1]); ctx.lineTo(bC[0], bC[1]); ctx.stroke();
    if (alpha != null) ctx.globalAlpha = 1;
    if (rot) ctx.restore();
  }

  skyAt(n) {
    const K = ST_SKY; let i = 0; while (i < K.length - 2 && n >= K[i + 1].at) i++;
    const a = K[i], b = K[i + 1], t = Math.max(0, Math.min(1, (n - a.at) / (b.at - a.at)));
    const mix = (p, q) => 'rgb(' + Math.round(p[0] + (q[0] - p[0]) * t) + ',' + Math.round(p[1] + (q[1] - p[1]) * t) + ',' + Math.round(p[2] + (q[2] - p[2]) * t) + ')';
    return [mix(a.top, b.top), mix(a.bot, b.bot)];
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.cols * cs, H = this.rows * cs;
    const lvl = this.camY / ST_H;                      // 지금 카메라 높이 (층)
    // 하늘
    const sky = this.skyAt(lvl), g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 별 (밤이 될수록 진하게)
    const night = Math.max(0, Math.min(1, (lvl - 50) / 30));
    if (night > 0) {
      ctx.fillStyle = '#fff';
      for (const s of this.stars) { ctx.globalAlpha = night * (0.55 + 0.45 * Math.sin(this.age * 0.003 + s.tw));
        const sy = ((s.y * H + lvl * 0.6) % H); ctx.fillRect(s.x * W, sy, s.r, s.r); }
      ctx.globalAlpha = 1;
    }
    // 구름 (낮일수록 진하게 · 올라가면 아래로 흘러감)
    const day = Math.max(0, 1 - lvl / 45);
    if (day > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * day).toFixed(3) + ')';
      for (const c of this.clouds) { const cx = ((c.x + this.age * c.v) % 1.3 - 0.15) * W, cy = ((c.y * H + lvl * 3) % (H * 1.2)) - H * 0.1, r = cs * c.s;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.arc(cx + r * 0.9, cy + r * 0.2, r * 0.75, 0, 6.28); ctx.arc(cx - r * 0.9, cy + r * 0.25, r * 0.65, 0, 6.28); ctx.fill(); }
    }
    // 받침대
    const S = W * 0.29 * this.zoom;
    const baseTopY = this.proj(0, 0, 0)[1];
    if (baseTopY < H + S * 2) {
      const sh = this.proj(0, -3, 0);   // 그림자 바닥
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(sh[0], Math.min(sh[1], H + 400), S * 1.3, S * 0.45, 0, 0, 6.28); ctx.fill();
      this.box(ctx, 0, -3, 0, 1.0, 1.0, 3, 0, 0, null, ST_BASE);
    }
    // 뒤쪽으로 떨어지는 조각 (탑보다 먼저)
    for (const ch of this.chops) if (ch.behind) this.box(ctx, ch.x, ch.y, ch.z, ch.w, ch.d, ST_H, ch.hue, ch.rot);
    // 탑 — 화면에 보이는 층만
    const n = this.layers.length, perPx = ST_H * S;
    const lo = Math.max(0, Math.floor((this.camY - (H * 0.5 + S) / S) / ST_H) - 1);
    for (let i = lo; i < n; i++) { const L = this.layers[i]; this.box(ctx, L.x, i * ST_H, L.z, L.w, L.d, ST_H, L.hue, 0); }
    // 움직이는 블록
    if (this.cur) { const c = this.cur; this.box(ctx, c.x, n * ST_H, c.z, c.w, c.d, ST_H, c.hue, 0); }
    // 앞쪽으로 떨어지는 조각
    for (const ch of this.chops) if (!ch.behind) this.box(ctx, ch.x, ch.y, ch.z, ch.w, ch.d, ST_H, ch.hue, ch.rot);
    // 퍼펙트 반짝: 윗면 테두리가 퍼져 나감
    for (const fl of this.flashes) {
      const k = FX.ease.outCubic(fl.t), gw = 1 + k * 0.5, hw = fl.w * gw / 2, hd = fl.d * gw / 2;
      const a = this.proj(fl.x - hw, fl.y, fl.z - hd), b = this.proj(fl.x + hw, fl.y, fl.z - hd), c = this.proj(fl.x + hw, fl.y, fl.z + hd), d = this.proj(fl.x - hw, fl.y, fl.z + hd);
      ctx.globalAlpha = 1 - fl.t; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * (1 - fl.t) + 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.parts.length) FX.drawParts(ctx, this.parts, cs, 3);
    // 점수
    const dark = lvl > 35;
    FX.text(ctx, String(this.score), W / 2, cs * 1.9, { size: cs * 1.5, weight: 800, color: '#fff', align: 'center', stroke: 'rgba(20,24,48,0.55)', strokeW: 5 });
    FX.text(ctx, this.height + '층', W / 2, cs * 2.75, { size: cs * 0.5, weight: 700, color: dark ? 'rgba(255,255,255,0.8)' : 'rgba(20,40,80,0.7)', align: 'center' });
    if (this.streak >= 2) {
      const bw = cs * 3.2, bx = W / 2 - bw / 2, by = cs * 3.05;
      ctx.fillStyle = 'rgba(255,209,102,0.92)'; FX.rr(ctx, bx, by, bw, cs * 0.62, cs * 0.31); ctx.fill();
      FX.text(ctx, '연속 퍼펙트 ' + this.streak, W / 2, by + cs * 0.31, { size: cs * 0.4, weight: 800, color: '#5A3A00', align: 'center', baseline: 'middle' });
    }
    // '퍼펙트!' 글자
    for (const t of this.texts) {
      const k = FX.ease.outBack(Math.min(1, t.t * 4)), y = H * 0.36 - t.t * cs * 1.2;
      ctx.globalAlpha = 1 - Math.max(0, (t.t - 0.6) / 0.4);
      FX.text(ctx, t.s, W / 2, y, { size: cs * (t.big ? 0.95 : 0.8) * (0.6 + 0.4 * k), weight: 900, color: t.big ? '#FFE066' : '#FFFFFF', align: 'center', baseline: 'middle', stroke: 'rgba(120,60,200,0.8)', strokeW: 5 });
      ctx.globalAlpha = 1;
    }
    // 처음 안내
    if (this.age < 4400 && this.height < 2 && !this.gameOver) {
      const a = Math.min(1, (4400 - this.age) / 600);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(15,20,45,0.6)'; FX.rr(ctx, W * 0.08, H * 0.7, W * 0.84, cs * 1.5, cs * 0.5); ctx.fill();
      FX.text(ctx, '화면을 톡! 블록을 멈춰요', W / 2, H * 0.7 + cs * 0.55, { size: cs * 0.5, weight: 800, color: '#fff', align: 'center', baseline: 'middle' });
      FX.text(ctx, '딱 맞추면 퍼펙트 · 삐져나온 곳은 잘려요', W / 2, H * 0.7 + cs * 1.05, { size: cs * 0.36, weight: 600, color: 'rgba(255,255,255,0.85)', align: 'center', baseline: 'middle' });
      ctx.globalAlpha = 1;
    }
    // 끝 화면
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(11,13,24,0.55)'; ctx.fillRect(0, 0, W, H);
      FX.text(ctx, '게임 끝', W / 2, H * 0.4, { size: cs * 1.3, weight: 900, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,0.4)', strokeW: 6 });
      FX.text(ctx, this.height + '층 · ' + this.score + '점', W / 2, H * 0.4 + cs * 1.1, { size: cs * 0.6, weight: 700, color: '#FFD166', align: 'center' });
      FX.text(ctx, '퍼펙트 ' + this.perfects + '번 · 최고 연속 ' + this.bestStreak, W / 2, H * 0.4 + cs * 1.8, { size: cs * 0.42, weight: 600, color: 'rgba(255,255,255,0.85)', align: 'center' });
    }
  }

  // 교사 미니보드: 탑 앞모습 (층마다 x 폭을 칸으로) — 위쪽 4줄 비우고 맨 위에 움직이는 블록
  getSnapshot() {
    const R = ST_ROWS, C = ST_COLS, out = [];
    for (let r = 0; r < R; r++) { const row = new Array(C); for (let c = 0; c < C; c++) row[c] = 0; out.push(row); }
    const toCells = (row, cx, w, col) => { // 폭 1 = 6칸, 가운데 4.5
      for (let c = 0; c < C; c++) { const mid = (c + 0.5 - C / 2) / 6; if (mid >= cx - w / 2 && mid <= cx + w / 2) row[c] = col; }
    };
    const n = this.layers.length, topRow = 4;
    if (this.cur) toCells(out[topRow - 1], this.cur.x, this.cur.w, 22);
    for (let r = topRow; r < R; r++) {
      const i = n - 1 - (r - topRow); if (i < 0) { for (let c = 0; c < C; c++) out[r][c] = 12; continue; }
      const L = this.layers[i]; toCells(out[r], L.x, L.w, 16 + (i % 5));
    }
    return out;
  }
}
if (typeof window !== 'undefined') window.StackGame = StackGame;
