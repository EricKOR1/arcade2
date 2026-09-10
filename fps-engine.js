// 레이저 태그 (FPS) — 레이캐스팅 1인칭 시점. 개인전 · 팀전.
// 좌우 = 회전, 위/아래 = 전진/후진, 발사(꾹) = 연사. 맞으면 체력이 줄고, 0이 되면 3초 뒤 다시 등장합니다.

const FPS_MAP = [
  '########################',
  '#....#........#........#',
  '#.##.#.######.#.######.#',
  '#.#..#......#.#.#......#',
  '#.#.####.##.#...#.####.#',
  '#........#..#.###..#...#',
  '####.###.#..........#.##',
  '#....#...#.#######.....#',
  '#.##.#.###.#.....#.###.#',
  '#.#....#...#.###.#...#.#',
  '#.#.##.#.#.#.#.#.#.#.#.#',
  '#...#..#.#...#.#...#...#',
  '#.#.#.##.#####.#.#.##.##',
  '#.#.#....#...#...#....##',
  '#.#.####.#.#.#####.###.#',
  '#.#......#.#.......#...#',
  '#.######.#.#.######.#.##',
  '#......#.#.#......#.#..#',
  '#.####.#...######.#.##.#',
  '#....#.#.#........#....#',
  '#.##.#.#.#.########.##.#',
  '#....#...#.........#...#',
  '#.##...#...#######...#.#',
  '########################'
];
const FPS_SPAWNS = [[1.5,1.5],[22.5,1.5],[1.5,22.5],[22.5,22.5],[12,1.5],[1.5,12],[22.5,12],[12,22.5],[6.5,6.5],[17.5,17.5],[17.5,6.5],[6.5,17.5]];
const FPS_TEAM_COLORS = { red: '#FF5C7A', blue: '#4CC9F0' };

class FpsGame {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.myId = this.opts.myId || 'me';
    this.myName = this.opts.myName || '';
    this.teamMode = !!this.opts.teamMode;
    this.team = this.teamMode ? FpsGame.teamOf(this.myId) : null;
    this.map = FPS_MAP;
    this.peers = {};
    this.hp = 100; this.kills = 0; this.deaths = 0; this.score = 0;
    this.turn = 0; this.fwd = 0; this.firing = false; this.upHeld = false;
    this.lastFire = 0; this.muzzle = 0; this.hurt = 0; this.deadUntil = 0;
    this.gameOver = false; this.toast = null; this.feed = []; this.hits = [];
    this.lastTime = 0; this.now = 0;
    this.spawnAt(this.opts.slot || 0);
    this.zbuf = null;
  }

  static teamOf(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h & 1) ? 'red' : 'blue'; }
  static parse(raw) {
    const a = String(raw).split(',');
    return { x: +a[0], y: +a[1], angle: +a[2], hp: +a[3], kills: +a[4], deaths: +a[5], team: a[6] || null, fire: a[7] === '1', dead: a[8] === '1' };
  }
  get isDead() { return this.now < this.deadUntil; }
  clock() { return this.now || performance.now(); }

  spawnAt(slot) {
    // 적에게서 먼 곳으로
    let best = null, bestD = -1;
    FPS_SPAWNS.forEach((sp, i) => {
      let d = 1e9;
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead) return; d = Math.min(d, Math.hypot(p.x - sp[0], p.y - sp[1])); });
      if (d === 1e9) d = 100 + ((i + slot) % FPS_SPAWNS.length);
      if (d > bestD) { bestD = d; best = sp; }
    });
    this.x = best[0]; this.y = best[1];
    this.angle = Math.atan2(12 - this.y, 12 - this.x);
  }

  // ── 조작 (플랫폼 계약) ──
  move(dir) { this.turn = dir; }
  releaseSteer(dir) { if (this.turn === dir) this.turn = 0; }
  up() { this.upHeld = true; }
  softDrop() { this.fwd = -1; }
  rotate() { this.fire(); }
  hardDrop() { this.fire(); }
  fire() { this.shoot(); }

  wall(x, y) { const r = this.map[Math.floor(y)]; return !r || r[Math.floor(x)] !== '.'; }

  shoot() {
    const now = this.clock();
    if (this.isDead || now - this.lastFire < 320 || this.spectator) return;
    this.lastFire = now; this.muzzle = 1;
    if (window.Sound) Sound.hardDrop();
    // 히트스캔: 시야 중앙 가까이에 있고 벽에 안 가린 가장 가까운 적
    let best = null, bestD = 1e9;
    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      if (p.dead || (this.teamMode && p.team === this.team)) return;
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
      if (d > 14) return;
      let da = Math.atan2(dy, dx) - this.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > Math.max(0.035, 0.42 / d)) return;
      if (this.blocked(this.x, this.y, p.x, p.y)) return;
      if (d < bestD) { bestD = d; best = id; }
    });
    if (best) {
      const dmg = bestD < 3 ? 40 : 34;
      if (this.opts.onAttack) this.opts.onAttack('hit', best, { dmg: dmg });
      this.hits.push({ id: best, until: now + 220 });
      this.score += 5;
      if (window.Sound) Sound.lock();
    }
  }

  blocked(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 8);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.wall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true; }
    return false;
  }

  // ── 피격 (다른 학생이 보낸 이벤트) ──
  onEvent(e) {
    if (!e) return;
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead) return;
      this.hp = Math.max(0, this.hp - (e.dmg || 34)); this.hurt = 1;
      if (window.Sound) Sound.crash();
      const who = this.nameOf(e.by);
      if (this.hp <= 0) {
        this.deaths++; this.deadUntil = this.clock() + 3000; this.score = Math.max(0, this.score - 20);
        this.pushFeed(who + ' → ' + this.myName, '#FF5C7A');
        this.showToast(who + ' 에게 당했다!', '#FF5C7A');
        if (this.opts.onAttack) this.opts.onAttack('kill', e.by, { victim: this.myId });
        if (window.Sound) Sound.gameOver();
      } else this.showToast(who + ' 의 레이저에 맞았다  -' + (e.dmg || 34), '#FFD166');
    } else if (e.type === 'kill' && e.target === this.myId) {
      this.kills++; this.score += 100;
      this.pushFeed(this.myName + ' → ' + this.nameOf(e.victim), '#06D6A0');
      this.showToast(this.nameOf(e.victim) + ' 처치!  +100', '#06D6A0');
      if (window.Sound) Sound.levelUp();
    } else if (e.type === 'kill') {
      this.pushFeed(this.nameOf(e.by) + ' → ' + this.nameOf(e.victim), '#9AA3B2');
    }
  }
  nameOf(id) { if (this.peers[id] && this.peers[id].name) return this.peers[id].name; if (this.opts.nameOf) return this.opts.nameOf(id) || '?'; return '?'; }
  pushFeed(text, color) { this.feed.unshift({ text: text, color: color, until: this.clock() + 5000 }); this.feed = this.feed.slice(0, 4); }
  showToast(text, color) { this.toast = { text: text, color: color, until: this.clock() + 1600 }; }

  // ── 동기화 ──
  serialize() {
    return [this.x.toFixed(2), this.y.toFixed(2), this.angle.toFixed(2), this.hp, this.kills, this.deaths, this.team || '',
            this.muzzle > 0.5 ? 1 : 0, this.isDead ? 1 : 0].join(',');
  }
  applyPeerRaw(id, raw, name) {
    const d = FpsGame.parse(raw);
    if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle };
    const p = this.peers[id];
    Object.assign(p, { tx: d.x, ty: d.y, tangle: d.angle, hp: d.hp, kills: d.kills, deaths: d.deaths, team: d.team, fire: d.fire, dead: d.dead });
    if (name) p.name = name;
  }
  removePeer(id) { delete this.peers[id]; }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) delete this.peers[id]; }); }
  spectate(id) { this.spectator = true; this.followId = id; }

  // ── 프레임 ──
  tick(now) {
    this.now = now;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7;
    this.lastTime = now; const f = dt / 16.7;
    // 상대 위치 보간
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.tx == null) return;
      p.x += (p.tx - p.x) * 0.3; p.y += (p.ty - p.y) * 0.3;
      let da = p.tangle - p.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.angle += da * 0.3; });

    if (this.spectator) {
      const p = this.peers[this.followId];
      if (p) { this.x = p.x; this.y = p.y; this.angle = p.angle; this.hp = p.hp; this.kills = p.kills; this.deaths = p.deaths; this.team = p.team; this.myName = p.name || ''; this.deadUntil = p.dead ? now + 100 : 0; }
      this.draw(); return;
    }

    if (this.isDead) {
      if (!this._respawned && this.deadUntil - now < 50) { this._respawned = true; this.hp = 100; this.spawnAt(Math.floor(Math.random() * 12)); }
      this.draw(); return;
    }
    this._respawned = false;

    // 회전 · 이동 (벽에 미끄러지듯 막힘)
    this.angle += this.turn * 0.052 * f;
    let mv = this.fwd; if (this.upHeld) mv = 1;
    if (mv) {
      const sp = 0.075 * f * mv;
      const nx = this.x + Math.cos(this.angle) * sp, ny = this.y + Math.sin(this.angle) * sp;
      const R = 0.25;
      if (!this.wall(nx + Math.sign(nx - this.x) * R, this.y)) this.x = nx;
      if (!this.wall(this.x, ny + Math.sign(ny - this.y) * R)) this.y = ny;
    }
    this.fwd = 0;
    if (this.firing) this.shoot();
    this.muzzle = Math.max(0, this.muzzle - 0.12 * f); this.hurt = Math.max(0, this.hurt - 0.05 * f);
    this.hits = this.hits.filter(h => h.until > now);
    this.draw();
  }

  // ── 그리기 (레이캐스팅) ──
  getSnapshot() { return null; }

  draw() {
    const ctx = this.ctx, W = this.canvas.clientWidth || this.canvas.width, H = this.canvas.clientHeight || this.canvas.height;
    const now = this.clock();
    const FOV = Math.PI / 3, cols = Math.min(180, Math.floor(W / 2.5)), cw = W / cols;
    const zb = this.zbuf = new Float32Array(cols);
    const hy = H * 0.5, myTeamC = this.team ? FPS_TEAM_COLORS[this.team] : '#FFD166';

    // 천장 · 바닥
    const sky = ctx.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, '#0B1024'); sky.addColorStop(1, '#1E2A52');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy);
    const fl = ctx.createLinearGradient(0, hy, 0, H); fl.addColorStop(0, '#1A1F2B'); fl.addColorStop(1, '#3A4256');
    ctx.fillStyle = fl; ctx.fillRect(0, hy, W, H - hy);
    // 바닥 격자 느낌 (몇 줄만)
    ctx.strokeStyle = 'rgba(76,201,240,0.08)'; ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) { const y = hy + (H - hy) * (k * k) / 64; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // 벽 — 열마다 광선 하나 (DDA)
    for (let c = 0; c < cols; c++) {
      const ra = this.angle - FOV / 2 + (c / cols) * FOV;
      const dx = Math.cos(ra), dy = Math.sin(ra);
      let mx = Math.floor(this.x), my = Math.floor(this.y);
      const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
      let sx, sy, sdx, sdy;
      if (dx < 0) { sx = -1; sdx = (this.x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - this.x) * ddx; }
      if (dy < 0) { sy = -1; sdy = (this.y - my) * ddy; } else { sy = 1; sdy = (my + 1 - this.y) * ddy; }
      let side = 0, hit = 0, n = 0;
      while (!hit && n++ < 48) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        if (this.wall(mx + 0.5, my + 0.5)) hit = 1;
      }
      const dist = (side === 0 ? sdx - ddx : sdy - ddy) * Math.cos(ra - this.angle);
      zb[c] = dist;
      const lh = Math.min(H * 3, H / Math.max(0.05, dist));
      const shade = Math.max(0.18, 1 - dist / 14) * (side ? 0.75 : 1);
      const wallX = side === 0 ? this.y + (sdx - ddx) * dy : this.x + (sdy - ddy) * dx;
      const band = Math.floor((wallX - Math.floor(wallX)) * 4) % 2;
      const base = ((mx + my) % 3 === 0) ? [91, 108, 140] : [70, 84, 112];
      const k = shade * (band ? 1 : 0.9);
      ctx.fillStyle = 'rgb(' + Math.round(base[0] * k) + ',' + Math.round(base[1] * k) + ',' + Math.round(base[2] * k) + ')';
      ctx.fillRect(Math.floor(c * cw), hy - lh / 2, Math.ceil(cw) + 1, lh);
      // 벽 위쪽 네온 띠 (가까운 벽만)
      if (dist < 8) { ctx.fillStyle = 'rgba(76,201,240,' + (0.45 * shade).toFixed(2) + ')';
        ctx.fillRect(Math.floor(c * cw), hy - lh / 2, Math.ceil(cw) + 1, Math.max(1, lh * 0.05)); }
    }

    // 상대 (빌보드 스프라이트) — 멀리서부터
    const sprites = [];
    Object.keys(this.peers).forEach(id => {
      if (this.spectator && id === this.followId) return;
      const p = this.peers[id];
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
      let da = Math.atan2(dy, dx) - this.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > FOV / 2 + 0.3 || d < 0.2 || d > 18) return;
      sprites.push({ id: id, p: p, d: d * Math.cos(da), da: da });
    });
    sprites.sort((a, b) => b.d - a.d);
    if (sprites.length > 14) sprites.splice(0, sprites.length - 14);   // 가까운 14명까지만
    sprites.forEach(s => {
      const p = s.p;
      const sx = W / 2 + Math.tan(s.da) / Math.tan(FOV / 2) * (W / 2);
      const h = Math.min(H * 2, H / Math.max(0.05, s.d)) * 0.62, w = h * 0.55;
      const col = Math.floor(sx / cw);
      if (col >= 0 && col < cols && zb[col] < s.d) return;           // 벽 뒤
      const colr = p.team ? FPS_TEAM_COLORS[p.team] : (p.dead ? '#6B7280' : '#FFD166');
      const y0 = hy - h * 0.45, alpha = p.dead ? 0.35 : 1;
      ctx.save(); ctx.globalAlpha = alpha;
      // 몸통 캡슐 + 바이저
      ctx.fillStyle = colr; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(sx - w / 2, y0, w, h, w / 2); else ctx.rect(sx - w / 2, y0, w, h);
      ctx.fill();
      ctx.fillStyle = 'rgba(11,13,18,0.85)'; ctx.fillRect(sx - w * 0.36, y0 + h * 0.16, w * 0.72, h * 0.12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(sx - w * 0.3, y0 + h * 0.19, w * 0.25, h * 0.05);
      if (p.fire) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(sx + w * 0.4, y0 + h * 0.5, w * 0.16, 0, Math.PI * 2); ctx.fill(); }
      if (this.hits.some(x => x.id === s.id)) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(sx - w / 2, y0, w, h, w / 2); ctx.fill(); }
      // 이름 · 체력
      if (h > 18) {
        ctx.font = '700 ' + Math.max(10, Math.min(15, h * 0.13)) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#fff'; ctx.fillText(p.name || '', sx, y0 - 10);
        const bw = Math.max(24, w * 1.2);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx - bw / 2, y0 - 7, bw, 4);
        ctx.fillStyle = p.dead ? '#6B7280' : '#06D6A0'; ctx.fillRect(sx - bw / 2, y0 - 7, bw * Math.max(0, Math.min(1, (p.hp || 0) / 100)), 4);
      }
      ctx.restore();
    });
    ctx.textAlign = 'left';

    // 내 총 (오른쪽 아래) + 총구 섬광
    if (!this.spectator) {
      const gx = W * 0.68, gy = H - 10, gw = W * 0.26, gh = H * 0.2 + (this.upHeld || this.fwd ? Math.sin(now / 90) * 4 : 0);
      ctx.fillStyle = '#2B3140'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw * 0.25, gy - gh); ctx.lineTo(gx + gw * 0.55, gy - gh * 1.05); ctx.lineTo(gx + gw, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = myTeamC; ctx.fillRect(gx + gw * 0.3, gy - gh * 0.75, gw * 0.22, gh * 0.12);
      if (this.muzzle > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (this.muzzle * 0.9).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(gx + gw * 0.4, gy - gh * 1.05, 10 + this.muzzle * 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(76,201,240,' + (this.muzzle * 0.6).toFixed(2) + ')'; ctx.fillRect(gx + gw * 0.38, hy, 4, gy - gh * 1.05 - hy); }
    }

    // 조준점
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 10, hy); ctx.lineTo(W / 2 - 4, hy); ctx.moveTo(W / 2 + 4, hy); ctx.lineTo(W / 2 + 10, hy);
    ctx.moveTo(W / 2, hy - 10); ctx.lineTo(W / 2, hy - 4); ctx.moveTo(W / 2, hy + 4); ctx.lineTo(W / 2, hy + 10); ctx.stroke();

    // 피격 붉은 테두리
    if (this.hurt > 0) { const g = ctx.createRadialGradient(W / 2, hy, H * 0.3, W / 2, hy, H * 0.8); g.addColorStop(0, 'rgba(255,60,90,0)'); g.addColorStop(1, 'rgba(255,60,90,' + (this.hurt * 0.55).toFixed(2) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

    // HUD — 체력 · 킬/데스 · 팀
    ctx.fillStyle = 'rgba(8,10,16,0.7)'; if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(12, H - 46, 150, 34, 12); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(22, H - 33, 100, 8);
    ctx.fillStyle = this.hp > 40 ? '#06D6A0' : '#FF5C7A'; ctx.fillRect(22, H - 33, this.hp, 8);
    ctx.fillStyle = '#fff'; ctx.font = '800 13px Pretendard, sans-serif'; ctx.fillText(this.hp, 130, H - 24);
    ctx.fillStyle = 'rgba(8,10,16,0.7)'; if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W - 132, 12, 120, 30, 12); ctx.fill(); }
    ctx.fillStyle = '#FFD166'; ctx.font = '800 13px Pretendard, sans-serif'; ctx.fillText('K ' + this.kills + '   D ' + this.deaths, W - 120, 32);
    if (this.team) { ctx.fillStyle = myTeamC; ctx.font = '800 12px Pretendard, sans-serif'; ctx.fillText(this.team === 'red' ? '🔴 레드 팀' : '🔵 블루 팀', 14, 24); }
    if (this.teamMode) {
      let red = 0, blue = 0;
      const add = (t, k) => { if (t === 'red') red += k; else if (t === 'blue') blue += k; };
      add(this.team, this.kills); Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; add(p.team, p.kills || 0); });
      ctx.fillStyle = 'rgba(8,10,16,0.7)'; if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W / 2 - 60, 12, 120, 30, 12); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.font = '800 15px Pretendard, sans-serif';
      ctx.fillStyle = FPS_TEAM_COLORS.red; ctx.fillText(String(red), W / 2 - 24, 33);
      ctx.fillStyle = '#fff'; ctx.fillText(':', W / 2, 33);
      ctx.fillStyle = FPS_TEAM_COLORS.blue; ctx.fillText(String(blue), W / 2 + 24, 33);
      ctx.textAlign = 'left';
    }
    // 킬 피드
    this.feed = this.feed.filter(x => x.until > now);
    ctx.font = '700 12px Pretendard, sans-serif';
    this.feed.forEach((x, i) => { ctx.fillStyle = x.color; ctx.fillText(x.text, 14, 60 + i * 17); });
    // 미니맵
    this.drawMinimap(ctx, W, H);
    // 토스트 · 사망
    if (this.toast && now < this.toast.until) { ctx.textAlign = 'center'; ctx.font = '800 16px Pretendard, sans-serif'; ctx.fillStyle = this.toast.color; ctx.fillText(this.toast.text, W / 2, hy + 70); ctx.textAlign = 'left'; }
    if (this.isDead) {
      ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = '#FF5C7A'; ctx.font = '800 30px Pretendard, sans-serif'; ctx.fillText('당했다!', W / 2, hy - 10);
      ctx.fillStyle = '#fff'; ctx.font = '600 15px Pretendard, sans-serif'; ctx.fillText(Math.ceil((this.deadUntil - now) / 1000) + '초 뒤 다시 등장', W / 2, hy + 22); ctx.textAlign = 'left';
    }
    if (this.spectator) { ctx.textAlign = 'center'; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('👁 ' + this.myName + ' 의 화면', W / 2, 60); ctx.textAlign = 'left'; }
  }

  drawMinimap(ctx, W, H) {
    const n = this.map.length, size = Math.min(110, W * 0.3), cs = size / n, x0 = W - size - 12, y0 = 52;
    // 벽은 한 번만 그려 두고 이미지로 붙임 (매 프레임 300칸씩 그리지 않도록)
    if (!this._mm || this._mmSize !== size) {
      this._mm = document.createElement('canvas'); this._mm.width = Math.ceil(size + 8); this._mm.height = Math.ceil(size + 8); this._mmSize = size;
      const g = this._mm.getContext('2d');
      g.fillStyle = 'rgba(8,10,16,0.7)'; g.fillRect(0, 0, size + 8, size + 8);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (this.map[y][x] !== '.') g.fillRect(4 + x * cs, 4 + y * cs, cs, cs);
    }
    ctx.drawImage(this._mm, x0 - 4, y0 - 4);
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return;
      if (this.teamMode && p.team !== this.team && !this.spectator) return;     // 팀전: 우리 편만 보임
      ctx.fillStyle = p.dead ? '#6B7280' : (p.team ? FPS_TEAM_COLORS[p.team] : '#FFD166'); ctx.beginPath(); ctx.arc(x0 + p.x * cs, y0 + p.y * cs, 2.4, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + this.x * cs, y0 + this.y * cs, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + this.x * cs, y0 + this.y * cs); ctx.lineTo(x0 + (this.x + Math.cos(this.angle) * 1.6) * cs, y0 + (this.y + Math.sin(this.angle) * 1.6) * cs); ctx.stroke();
  }
}
