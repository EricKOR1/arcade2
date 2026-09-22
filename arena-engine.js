// 젬 아레나 — 탑다운 실시간 대전 (인기 모바일 브롤 게임의 '방식' 오마주 · 캐릭터·그림·이름은 전부 자체 제작)
//   · 왼쪽 조이스틱 이동, 오른쪽 조이스틱 조준(끌어서 놓으면 발사 · 톡 = 자동 조준)
//   · 두 팀. 가운데 광산에서 젬이 솟고, 한 팀이 젬 10개를 모아 15초 버티면 승리. 쓰러지면 들고 있던 젬을 떨어뜨림
//   · 수풀에 들어가면 가까이 오지 않는 한 상대에게 안 보임 · 맞히면 궁극기 게이지 충전 → 큰 폭발탄
//   네트워크는 레이저 태그와 같은 방식: 위치는 문자열, 피격은 이벤트

const AR_MAP = [
  '####################',
  '#1..bb........bb..1#',
  '#...bb..####..bb...#',
  '#........##........#',
  '#..##..........##..#',
  '#..##...bbbb...##..#',
  '#.......b..b.......#',
  '#...##..b..b..##...#',
  '#...##........##...#',
  '#........##........#',
  '#.bb....####....bb.#',
  '#.bb....#GG#....bb.#',
  '#.bb....#GG#....bb.#',
  '#.bb....####....bb.#',
  '#........##........#',
  '#...##........##...#',
  '#...##..b..b..##...#',
  '#.......b..b.......#',
  '#..##...bbbb...##..#',
  '#..##..........##..#',
  '#........##........#',
  '#...bb..####..bb...#',
  '#2..bb........bb..2#',
  '####################'
];
const AR_COLS = AR_MAP[0].length, AR_ROWS = AR_MAP.length;
const AR_TEAM = { r: { name: '레드', color: '#FF5C7A', dark: '#B3213F' }, b: { name: '블루', color: '#4CC9F0', dark: '#1D7FA6' } };

class ArenaGame {
  constructor(canvas, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {};
    this.cellSize = this.opts.cellSize || 20;
    this.myId = this.opts.myId; this.myName = this.opts.myName || '';
    this.team = this.opts.team || 'r';
    this.W = AR_COLS; this.H = AR_ROWS;
    this.peers = {}; this.bullets = []; this.parts = []; this.gems = {}; this.held = 0;
    this.hp = 100; this.maxHp = 100; this.super = 0; this.kills = 0; this.score = 0; this.gameOver = false;
    this.mx = 0; this.my = 0; this.aim = null; this.angle = -Math.PI / 2; this.lastFire = 0; this.lastHurt = 0;
    this.deadUntil = 0; this.hidden = false; this.toasts = []; this.winner = null; this.countUntil = 0; this.countTeam = null;
    this.now = 0; this.lastTime = 0; this.face = 1;
    this.spawnAt(this.opts.slot || 0);
  }
  static parse(raw) {
    const a = String(raw).split(',');
    return { x: +a[0], y: +a[1], angle: +a[2], hp: +a[3], gems: +a[4] || 0, team: a[5] || 'r', dead: a[6] === '1', hidden: a[7] === '1', sup: +a[8] || 0, kills: +a[9] || 0 };
  }
  serialize() { return [this.x.toFixed(2), this.y.toFixed(2), this.angle.toFixed(2), this.hp, this.held, this.team, this.isDead ? 1 : 0, this.hidden ? 1 : 0, Math.round(this.super), this.kills].join(','); }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string') return;                       // 이전 게임의 옛 신호 등 형식이 다르면 무시
    const d = ArenaGame.parse(raw);
    if (!isFinite(d.x) || !isFinite(d.y) || !isFinite(d.angle)) return;   // 숫자가 아니면 무시 (그리기가 매 프레임 멈추는 것을 막음)
    if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle, buf: [] };
    const p = this.peers[id]; const now = this.clock();
    const last = p.buf[p.buf.length - 1];
    if (!last || Math.abs(last.x - d.x) > 1e-4 || Math.abs(last.y - d.y) > 1e-4) { if (last && Math.hypot(last.x - d.x, last.y - d.y) > 6) p.buf.length = 0; p.buf.push({ t: now, x: d.x, y: d.y }); if (p.buf.length > 5) p.buf.shift(); }
    Object.assign(p, { tx: d.x, ty: d.y, tangle: d.angle, hp: d.hp, gems: d.gems, team: d.team, dead: d.dead, hidden: d.hidden, sup: d.sup, kills: d.kills, name: name || p.name || '' });
  }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) delete this.peers[id]; }); }
  removePeer(id) { delete this.peers[id]; }
  setGems(map) { this.gems = map || {}; }
  get isDead() { return this.now < this.deadUntil; }
  clock() { return this.now || performance.now(); }
  cell(x, y) { const r = AR_MAP[Math.floor(y)]; return r ? (r[Math.floor(x)] || '#') : '#'; }
  wall(x, y) { const c = this.cell(x, y); return c === '#' || c === 'G'; }
  bush(x, y) { return this.cell(x, y) === 'b'; }
  spawnAt(slot) {
    const pts = []; AR_MAP.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === (this.team === 'r' ? '1' : '2')) pts.push([x + 0.5, y + 0.5]); });
    const p = pts[slot % pts.length] || [10, 2]; this.x = p[0]; this.y = p[1];
    this.angle = this.team === 'r' ? Math.PI / 2 : -Math.PI / 2;   // 경기장 가운데(상대 진영)를 보고 출발 — 벽을 보고 있으면 첫 발이 벽에 박힙니다
  }
  toast(text, color) { this.toasts.push({ text, color: color || '#fff', until: this.clock() + 1600 }); }

  // ── 조작 ──
  setMove(x, y) { this.mx = x; this.my = y; }
  setAim(dx, dy) { this.aim = (dx == null) ? null : [dx, dy]; if (this.aim && Math.hypot(dx, dy) > 0.15) this.angle = Math.atan2(dy, dx); }
  // 오른쪽 조이스틱을 놓으면 그 방향으로 발사. 거의 안 끌었으면 자동 조준
  releaseAim(dx, dy) { const d = Math.hypot(dx || 0, dy || 0); if (d > 0.15) this.angle = Math.atan2(dy, dx); else this.autoAim(); this.aim = null; this.fire(); }
  autoAim() {
    let best = null, bd = 9;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || p.team === this.team || p.hidden) return;
      const d = Math.hypot(p.x - this.x, p.y - this.y); if (d < bd) { bd = d; best = p; } });
    if (best) this.angle = Math.atan2(best.y - this.y, best.x - this.x);
  }
  fire() {
    const now = this.clock();
    if (this.isDead || this.gameOver || now - this.lastFire < 480) return;
    if (!this.aim) this.autoAim();                                    // 조준 조이스틱 없이 발사 버튼만 누르면: 가까운 적을 자동 조준, 없으면 바라보는 방향
    this.lastFire = now; this.recoil = 1;
    for (let i = -1; i <= 1; i++) { const a = this.angle + i * 0.09;
      this.bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 0.32, vy: Math.sin(a) * 0.32, life: 22, dmg: 22, big: false }); }
    if (window.Sound) Sound.hardDrop(); if (window.Haptic) Haptic.tap();
  }
  useSuper() {
    const now = this.clock();
    if (this.isDead || this.gameOver || this.super < 100) return;
    this.super = 0; this.autoAim();
    this.bullets.push({ x: this.x, y: this.y, vx: Math.cos(this.angle) * 0.22, vy: Math.sin(this.angle) * 0.22, life: 34, dmg: 60, big: true });
    this.toast('궁극기!', '#FFD166'); if (window.Sound) Sound.boost && Sound.boost(); if (window.Haptic) Haptic.big();
  }
  onEvent(e) {
    if (!e) return;
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead) return;
      this.hp = Math.max(0, this.hp - (e.dmg || 22)); this.lastHurt = this.clock(); this.hurt = 1;
      if (window.Haptic) Haptic.hit(); if (window.Sound) Sound.crash();
      if (this.hp <= 0) this.die(e.by);
    }
  }
  die(byId) {
    const now = this.clock();
    this.deadUntil = now + 3200;
    // 들고 있던 젬을 그 자리에 떨어뜨림
    if (this.held > 0 && this.opts.onDropGems) { const drops = []; for (let i = 0; i < this.held; i++) { const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.9; drops.push([this.x + Math.cos(a) * r, this.y + Math.sin(a) * r]); } this.opts.onDropGems(drops); }
    this.held = 0; this.super = 0;
    this.burst(this.x, this.y, 18, AR_TEAM[this.team].color);
    const who = this.peers[byId] && this.peers[byId].name; this.toast((who ? who + '에게 ' : '') + '쓰러졌다 · 3초 뒤 부활', '#FF5C7A');
    if (this.opts.onAttack) this.opts.onAttack('kill', byId, { victim: this.myId });
  }
  burst(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.1; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }

  // ── 진행 ──
  tick(now) {
    const { dt, f } = FX.frame(this, now);
    if (this.gameOver) { this.draw(); return; }
    // 부활
    if (this.deadUntil && now >= this.deadUntil && this.hp <= 0) { this.hp = this.maxHp; this.deadUntil = 0; this.spawnAt(Math.floor(Math.random() * 2)); this.toast('부활!', '#06D6A0'); }
    if (!this.isDead) {
      // 이동 (벽 충돌: 축별로 나눠 미끄러지게)
      const len = Math.hypot(this.mx, this.my), sp = 0.085 * f * Math.min(1, len);
      if (len > 0.1) { const ux = this.mx / len, uy = this.my / len;
        const nx = this.x + ux * sp; if (!this.blocked(nx, this.y)) this.x = nx;
        const ny = this.y + uy * sp; if (!this.blocked(this.x, ny)) this.y = ny;
        if (!this.aim) this.angle = Math.atan2(uy, ux); this.face = ux < 0 ? -1 : 1; }
      this.hidden = this.bush(this.x, this.y);
      // 체력 회복: 3초간 안 맞으면
      if (now - this.lastHurt > 3000 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 0.25 * f);
      // 젬 줍기
      Object.keys(this.gems).forEach(id => { const g = this.gems[id]; if (!g || g.by) return;
        if (Math.hypot(g.x - this.x, g.y - this.y) < 0.62) { g.by = this.myId; this.held++; this.score += 10; this.burst(g.x, g.y, 6, '#B15DFF');
          if (this.opts.onGem) this.opts.onGem(id); if (window.Sound) Sound.clear(1); } });
    }
    // 탄
    for (let i = this.bullets.length - 1; i >= 0; i--) { const b = this.bullets[i];
      b.x += b.vx * f; b.y += b.vy * f; b.life -= f;
      let done = b.life <= 0 || this.wall(b.x, b.y);
      if (!done) Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (done || p.dead || p.team === this.team) return;
        if (Math.hypot(p.x - b.x, p.y - b.y) < (b.big ? 1.1 : 0.55)) { done = true;
          if (this.opts.onAttack) this.opts.onAttack('hit', id, { dmg: b.dmg });
          this.super = Math.min(100, this.super + (b.big ? 0 : 25)); this.hitMark = now + 250; this.score += 2;
          this.burst(b.x, b.y, 5, '#FFD166'); if (window.Sound) Sound.lock(); } });
      if (done) { if (b.big) this.burst(b.x, b.y, 24, '#FFD166'); this.bullets.splice(i, 1); }
    }
    this.parts = FX.stepParts(this.parts, f, 0.05);
    this.recoil = Math.max(0, (this.recoil || 0) - 0.08 * f); this.hurt = Math.max(0, (this.hurt || 0) - 0.05 * f);
    // 승리 판정: 팀 젬 10개 → 15초 카운트다운
    const cnt = { r: 0, b: 0 }; cnt[this.team] += this.held;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; cnt[p.team === 'b' ? 'b' : 'r'] += p.gems || 0; });
    this.teamGems = cnt;
    const lead = cnt.r >= 10 ? 'r' : (cnt.b >= 10 ? 'b' : null);
    if (lead && this.countTeam !== lead) { this.countTeam = lead; this.countUntil = now + 15000; this.toast(AR_TEAM[lead].name + ' 팀이 젬 10개! 15초 버티면 승리', AR_TEAM[lead].color); }
    if (!lead) { this.countTeam = null; this.countUntil = 0; }
    if (lead && now >= this.countUntil) { this.gameOver = true; this.winner = lead; if (this.opts.onFinish) this.opts.onFinish(lead === this.team); if (window.Sound) Sound.levelUp(); }
    this.toasts = this.toasts.filter(t => t.until > now);
    this.draw();
  }
  blocked(x, y) { const r = 0.32; return this.wall(x - r, y - r) || this.wall(x + r, y - r) || this.wall(x - r, y + r) || this.wall(x + r, y + r); }

  getSnapshot() {
    const g = []; for (let y = 0; y < this.H; y++) { g.push([]); for (let x = 0; x < this.W; x++) { const c = AR_MAP[y][x]; g[y].push(c === '#' ? 63 : c === 'G' ? 64 : c === 'b' ? 65 : 66); } }
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (gm && !gm.by) { const x = Math.floor(gm.x), y = Math.floor(gm.y); if (g[y] && g[y][x] != null) g[y][x] = 67; } });
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; const x = Math.floor(p.x), y = Math.floor(p.y); if (g[y] && g[y][x] != null) g[y][x] = p.team === 'b' ? 69 : 68; });
    const x = Math.floor(this.x), y = Math.floor(this.y); if (g[y] && g[y][x] != null) g[y][x] = 23;
    return g;
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, now = this.now;
    // 화면(CSS 픽셀) 과 지도(월드) 를 구분합니다. 예전엔 지도 전체를 화면에 욱여넣어 캐릭터가 손톱만 했습니다.
    const SW = this.canvas.clientWidth || this.W * cs, SH = this.canvas.clientHeight || this.H * cs;
    const W = this.W * cs, H = this.H * cs;                        // 지도 크기 (월드 픽셀)
    const z = Math.max(1, (Math.min(SW, SH * 0.75) / 10.5) / cs);   // 한 화면에 가로 약 10칸이 보이게 확대
    const vw = SW / z, vh = SH / z;                                  // 화면이 담는 월드 크기
    const camX = W <= vw ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, this.x * cs));
    const camY = H <= vh ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, this.y * cs));
    this._view = { z, camX, camY, SW, SH };
    if (!this._bg || this._bgCs !== cs) this.buildBg(cs);
    ctx.fillStyle = '#0F1626'; ctx.fillRect(0, 0, SW, SH);          // 지도 밖 여백
    ctx.save(); ctx.translate(SW / 2 - camX * z, SH / 2 - camY * z); ctx.scale(z, z);
    ctx.drawImage(this._bg, 0, 0);
    // 젬 (빛나는 보석)
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (!gm || gm.by) return; const gx = gm.x * cs, gy = gm.y * cs + Math.sin(now / 260 + gm.x) * cs * 0.06;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, cs * 0.7); gr.addColorStop(0, 'rgba(177,93,255,0.45)'); gr.addColorStop(1, 'rgba(177,93,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, cs * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#B15DFF'; ctx.beginPath(); ctx.moveTo(gx, gy - cs * 0.3); ctx.lineTo(gx + cs * 0.22, gy); ctx.lineTo(gx, gy + cs * 0.3); ctx.lineTo(gx - cs * 0.22, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(gx, gy - cs * 0.3); ctx.lineTo(gx + cs * 0.22, gy); ctx.lineTo(gx, gy - cs * 0.02); ctx.closePath(); ctx.fill(); });
    // 상대 (수풀 은신은 가까울 때만)
    Object.keys(this.peers).forEach(id => { const p = this.peers[id];
      const k = FX.ease.outCubic(1); const b = p.buf; let px = p.tx != null ? p.tx : p.x, py = p.ty != null ? p.ty : p.y;
      p.x += (px - p.x) * 0.5; p.y += (py - p.y) * 0.5; p.angle = p.tangle != null ? p.tangle : p.angle;
      if (p.dead) return;
      if (p.hidden && p.team !== this.team && Math.hypot(p.x - this.x, p.y - this.y) > 2.2) return;
      this.drawBrawler(ctx, cs, p.x, p.y, p.angle, p.team, p.hp / 100, p.name, p.hidden ? 0.55 : 1, false, p.gems, p.sup); });
    // 탄
    this.bullets.forEach(b => { const bx = b.x * cs, by = b.y * cs, r = cs * (b.big ? 0.42 : 0.16);
      const gr = ctx.createRadialGradient(bx, by, 0, bx, by, r * 2.2); gr.addColorStop(0, b.big ? 'rgba(255,209,102,0.9)' : 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.big ? '#FFD166' : '#FFF3C4'; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); });
    // 나
    if (!this.isDead) {
      // 조준선
      if (this.aim && Math.hypot(this.aim[0], this.aim[1]) > 0.15) { ctx.save(); ctx.translate(this.x * cs, this.y * cs); ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(cs * 0.5, -cs * 0.12); ctx.lineTo(cs * 7, -cs * 0.7); ctx.lineTo(cs * 7, cs * 0.7); ctx.lineTo(cs * 0.5, cs * 0.12); ctx.closePath(); ctx.fill(); ctx.restore(); }
      this.drawBrawler(ctx, cs, this.x, this.y, this.angle, this.team, this.hp / this.maxHp, this.myName, this.hidden ? 0.7 : 1, true, this.held, this.super);
    }
    FX.drawParts(ctx, this.parts, cs, 3);
    ctx.restore();
    // ── 여기부터 화면 좌표 (HUD) ──
    const HW = SW, HH = SH;
    // 피격 붉은 테두리
    if (this.hurt > 0.01) { ctx.fillStyle = 'rgba(255,60,80,' + (this.hurt * 0.35).toFixed(2) + ')'; ctx.fillRect(0, 0, HW, HH); }
    this.drawMinimap(ctx, HW, HH);
    // ── HUD: 팀 젬 · 카운트다운 ──
    const tg = this.teamGems || { r: 0, b: 0 };
    FX.glass(ctx, HW / 2 - 160, 10, 320, 44, 14);
    FX.text(ctx, '◆ ' + tg.r, HW / 2 - 70, 31, { size: 22, weight: 800, color: AR_TEAM.r.color, align: 'center' });
    FX.text(ctx, this.countTeam ? Math.ceil((this.countUntil - now) / 1000) + '' : '10개', HW / 2, 31, { size: (this.countTeam ? 24 : 13), weight: 800, color: this.countTeam ? AR_TEAM[this.countTeam].color : 'rgba(255,255,255,0.6)', align: 'center' });
    FX.text(ctx, tg.b + ' ◆', HW / 2 + 70, 31, { size: 22, weight: 800, color: AR_TEAM.b.color, align: 'center' });
    // 궁극기 게이지 (아래 가운데)
    FX.glass(ctx, HW / 2 - cs * 3, HH - 44, cs * 6, cs * 1.0, 14, this.super >= 100 ? '#FFD166' : undefined);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; FX.rr(ctx, HW / 2 - cs * 2.7, HH - cs * 1.15, cs * 5.4, 10, cs * 0.15); ctx.fill();
    ctx.fillStyle = this.super >= 100 ? '#FFD166' : '#B15DFF'; FX.rr(ctx, HW / 2 - cs * 2.7, HH - cs * 1.15, cs * 5.4 * (this.super / 100), 10, cs * 0.15); ctx.fill();
    FX.text(ctx, this.super >= 100 ? '★ 궁극기 준비!' : '궁극기 ' + Math.round(this.super) + '%', HW / 2, HH - 19, { size: 12, weight: 800, color: '#fff', align: 'center' });
    this.toasts.slice(-2).forEach((t, i) => { FX.text(ctx, t.text, HW / 2, HH * 0.3 + i * 28, { size: 18, weight: 800, color: t.color, align: 'center', shadow: 8 }); });
    if (this.isDead) { ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(0, 0, HW, HH); FX.text(ctx, '부활까지 ' + Math.ceil((this.deadUntil - now) / 1000), HW / 2, HH / 2, { size: 34, weight: 800, color: '#fff', align: 'center', baseline: 'middle', shadow: 10 }); }
    if (this.gameOver) { ctx.fillStyle = 'rgba(8,10,16,0.65)'; ctx.fillRect(0, 0, HW, HH); const win = this.winner === this.team;
      FX.text(ctx, win ? '승리!' : '패배', HW / 2, HH / 2 - 20, { size: 52, weight: 800, color: win ? '#FFD166' : '#9AA3B2', align: 'center', baseline: 'middle', shadow: 12 });
      FX.text(ctx, AR_TEAM[this.winner].name + ' 팀이 젬 10개를 지켰습니다', HW / 2, HH / 2 + 30, { size: 17, weight: 700, color: '#fff', align: 'center', baseline: 'middle' }); }
  }
  drawBrawler(ctx, cs, x, y, angle, team, hpK, name, alpha, isMe, gems, sup) {
    const px = x * cs, py = y * cs, T = AR_TEAM[team] || AR_TEAM.r, r = cs * 0.42;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px, py + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (isMe) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r * 1.35, 0, Math.PI * 2); ctx.stroke(); }
    // 몸: 팀색 원 + 어두운 아래쪽 + 총구 방향 표시
    const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.35, r * 0.1, px, py, r * 1.1); g.addColorStop(0, FX.tint(T.color, 0.35)); g.addColorStop(1, T.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1.5, cs * 0.06); ctx.stroke();
    ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
    ctx.fillStyle = '#2B3140'; FX.rr(ctx, r * 0.35, -r * 0.18, r * 0.95, r * 0.36, r * 0.12); ctx.fill();
    ctx.fillStyle = '#FFD166'; ctx.fillRect(r * 1.15, -r * 0.1, r * 0.15, r * 0.2); ctx.restore();
    // 얼굴 (눈 두 개 · 진행 방향 쪽)
    const ex = Math.cos(angle) * r * 0.25, ey = Math.sin(angle) * r * 0.25;
    ctx.fillStyle = '#fff'; [[-0.28, 0], [0.28, 0]].forEach(([ox]) => { const ax = -Math.sin(angle) * ox * r, ay = Math.cos(angle) * ox * r; ctx.beginPath(); ctx.arc(px + ex + ax, py + ey + ay, r * 0.2, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#12161F'; [[-0.28, 0], [0.28, 0]].forEach(([ox]) => { const ax = -Math.sin(angle) * ox * r, ay = Math.cos(angle) * ox * r; ctx.beginPath(); ctx.arc(px + ex * 1.3 + ax, py + ey * 1.3 + ay, r * 0.1, 0, Math.PI * 2); ctx.fill(); });
    // 체력바 · 이름 · 젬 수
    const bw = cs * 1.4, bx = px - bw / 2, by = py - r - cs * 0.42;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; FX.rr(ctx, bx, by, bw, cs * 0.2, cs * 0.1); ctx.fill();
    ctx.fillStyle = hpK > 0.5 ? '#06D6A0' : hpK > 0.25 ? '#FFD166' : '#FF5C7A'; FX.rr(ctx, bx, by, bw * Math.max(0, hpK), cs * 0.2, cs * 0.1); ctx.fill();
    if (sup >= 100) { ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 2; FX.rr(ctx, bx - 1, by - 1, bw + 2, cs * 0.2 + 2, cs * 0.1); ctx.stroke(); }
    FX.text(ctx, (name || '') + (gems ? '  ◆' + gems : ''), px, by - cs * 0.12, { size: cs * 0.42, weight: 800, color: '#fff', align: 'center', shadow: 4 });
    ctx.restore();
  }
  // 미니맵: 지도 전체를 작게 — 벽·수풀·광산, 젬(보라), 브롤러(팀색, 나는 금색), 내 시야 사각형
  drawMinimap(ctx, SW, SH) {
    const u = 3.4, mw = this.W * u, mh = this.H * u, mx = 12, my = 62;   // 20×24 → 68×82px
    if (!this._mm) { const c = document.createElement('canvas'); c.width = Math.ceil(mw); c.height = Math.ceil(mh); const g = c.getContext('2d');
      g.fillStyle = 'rgba(8,10,16,0.75)'; g.fillRect(0, 0, mw, mh);
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const c2 = AR_MAP[y][x]; if (c2 === '.') continue;
        g.fillStyle = c2 === 'b' ? '#2E8B57' : c2 === 'G' ? '#8B5CF6' : '#5C6B85'; g.fillRect(x * u, y * u, u, u); } this._mm = c; }
    ctx.drawImage(this._mm, mx, my);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(mx - 0.5, my - 0.5, mw + 1, mh + 1);
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (!gm || gm.by) return; ctx.fillStyle = '#B15DFF'; ctx.fillRect(mx + gm.x * u - 1, my + gm.y * u - 1, 2.5, 2.5); });
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead) return; if (p.hidden && p.team !== this.team) return;
      ctx.fillStyle = AR_TEAM[p.team === 'b' ? 'b' : 'r'].color; ctx.beginPath(); ctx.arc(mx + p.x * u, my + p.y * u, 2.2, 0, Math.PI * 2); ctx.fill(); });
    if (!this.isDead) { ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(mx + this.x * u, my + this.y * u, 2.8, 0, Math.PI * 2); ctx.fill(); }
    const v = this._view; if (v) { const cs = this.cellSize; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(mx + (v.camX - v.SW / v.z / 2) / cs * u, my + (v.camY - v.SH / v.z / 2) / cs * u, v.SW / v.z / cs * u, v.SH / v.z / cs * u); }
  }
  buildBg(cs) {
    const W = this.W * cs, H = this.H * cs, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2A3A55'); bg.addColorStop(1, '#1B2739'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // 바닥 타일
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)'; g.fillRect(x * cs, y * cs, cs, cs); }
    // 팀 진영 색
    g.fillStyle = 'rgba(255,92,122,0.10)'; g.fillRect(0, 0, W, cs * 3); g.fillStyle = 'rgba(76,201,240,0.10)'; g.fillRect(0, H - cs * 3, W, cs * 3);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const c = AR_MAP[y][x], px = x * cs, py = y * cs;
      if (c === '#' || c === 'G') { // 벽: 윗면 + 측면
        g.fillStyle = c === 'G' ? '#5B3AAF' : '#5C6B85'; FX.rr(g, px + 1, py + 1, cs - 2, cs - 2, cs * 0.18); g.fill();
        g.fillStyle = c === 'G' ? '#8B5CF6' : '#7E8FAB'; FX.rr(g, px + 1, py + 1, cs - 2, cs * 0.62, cs * 0.18); g.fill();
        if (c === 'G') { g.fillStyle = '#B15DFF'; g.beginPath(); g.moveTo(px + cs / 2, py + cs * 0.15); g.lineTo(px + cs * 0.75, py + cs * 0.4); g.lineTo(px + cs / 2, py + cs * 0.65); g.lineTo(px + cs * 0.25, py + cs * 0.4); g.closePath(); g.fill(); }
      } else if (c === 'b') { // 수풀
        g.fillStyle = '#2E8B57'; [[0.3, 0.35, 0.34], [0.68, 0.4, 0.3], [0.5, 0.68, 0.36]].forEach(([ox, oy, rr]) => { g.beginPath(); g.arc(px + cs * ox, py + cs * oy, cs * rr, 0, Math.PI * 2); g.fill(); });
        g.fillStyle = '#3DB870'; [[0.35, 0.3, 0.2], [0.65, 0.34, 0.18]].forEach(([ox, oy, rr]) => { g.beginPath(); g.arc(px + cs * ox, py + cs * oy, cs * rr, 0, Math.PI * 2); g.fill(); });
      } }
    this._bg = cv; this._bgCs = cs;
  }
}
