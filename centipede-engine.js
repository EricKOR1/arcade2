// 지네 사냥 — 버섯밭 사이로 내려오는 지네를 쏘세요. 맞은 마디는 버섯이 되고, 지네는 둘로 갈라집니다.
// ← → 이동 · 발사(꾹). 지네가 바닥까지 오거나 부딪히면 목숨 -1.

const CP_COLS = 16, CP_ROWS = 24;

class CentipedeGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = CP_COLS; this.H = CP_ROWS;
    this.x = this.W / 2; this.y = this.H - 1.5; this.steer = 0; this.firing = false; this.lastFire = 0;
    this.bullets = []; this.parts = [];
    this.score = 0; this.lives = 3; this.wave = 1; this.gameOver = false; this.lastTime = 0; this.now = 0; this.invul = 0;
    this.mush = Array.from({ length: this.H }, () => Array(this.W).fill(0));
    for (let i = 0; i < 26; i++) { const x = Math.floor(Math.random() * this.W), y = 1 + Math.floor(Math.random() * (this.H - 6)); this.mush[y][x] = 3; }
    this.spawnWave();
  }
  spawnWave() {
    const len = Math.min(12, 6 + this.wave * 2);
    this.chains = [{ segs: Array.from({ length: len }, (_, i) => ({ x: -i, y: 0 })), dir: 1, speed: 0.045 + this.wave * 0.008, t: 0 }];
  }
  move(dir) { this.steer = dir; } releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  rotate() { this.fire(); } hardDrop() { this.fire(); } softDrop() {} up() {}
  fire() { if (this.gameOver || this.now - this.lastFire < 170 || this.bullets.length >= 3) return; this.lastFire = this.now; this.bullets.push({ x: this.x, y: this.y - 0.5 }); if (window.Sound) Sound.move(); }

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const { dt, f } = FX.frame(this, now);
    this.x = Math.max(0.5, Math.min(this.W - 0.5, this.x + this.steer * 0.16 * f));
    if (this.firing) this.fire();
    if (this.invul > 0) this.invul -= dt;
    // 총알
    for (let i = this.bullets.length - 1; i >= 0; i--) { const b = this.bullets[i]; b.y -= 0.5 * f; if (b.y < 0) { this.bullets.splice(i, 1); continue; }
      const cx = Math.floor(b.x), cy = Math.floor(b.y);
      if (this.mush[cy] && this.mush[cy][cx] > 0) { this.mush[cy][cx]--; this.bullets.splice(i, 1); if (!this.mush[cy][cx]) this.score += 1; continue; }
      let hit = false;
      this.chains.forEach(ch => { const k = ch.segs.findIndex(s => Math.abs(s.x + 0.5 - b.x) < 0.55 && Math.abs(s.y + 0.5 - b.y) < 0.55);
        if (k >= 0 && !hit) { hit = true; const s = ch.segs[k]; this.mush[Math.max(0, Math.round(s.y))][Math.max(0, Math.min(this.W - 1, Math.round(s.x)))] = 3;
          this.score += k === 0 ? 100 : 10; this.burst(s.x + 0.5, s.y + 0.5);
          const tail = ch.segs.splice(k + 1); ch.segs.splice(k, 1);
          if (tail.length) this.chains.push({ segs: tail, dir: -ch.dir, speed: ch.speed, t: 0 });
          if (window.Sound) Sound.clear(1); } });
      if (hit) this.bullets.splice(i, 1);
    }
    this.chains = this.chains.filter(ch => ch.segs.length);
    // 지네 이동: 머리가 격자 단위로 진행, 벽·버섯을 만나면 한 줄 내려가고 방향 전환
    this.chains.forEach(ch => { ch.t += ch.speed * f; if (ch.t < 1) return; ch.t = 0;
      const head = ch.segs[0]; let nx = head.x + ch.dir, ny = head.y;
      const blocked = nx < 0 || nx >= this.W || (this.mush[ny] && this.mush[ny][nx] > 0);
      if (blocked) { ny = head.y + 1; nx = head.x; ch.dir = -ch.dir; if (ny >= this.H - 1) { ny = this.H - 1; } }
      for (let i = ch.segs.length - 1; i > 0; i--) { ch.segs[i].x = ch.segs[i - 1].x; ch.segs[i].y = ch.segs[i - 1].y; }
      head.x = nx; head.y = ny;
      if (ny >= this.H - 1 && nx === head.x) { /* 바닥 도달: 위로 튕겨 다시 내려옴 */ if (head.y >= this.H - 1 && Math.random() < 0.5) head.y = this.H - 4; }
    });
    // 충돌
    if (this.invul <= 0 && this.chains.some(ch => ch.segs.some(s => Math.abs(s.x + 0.5 - this.x) < 0.7 && Math.abs(s.y + 0.5 - this.y) < 0.7))) {
      this.lives--; this.invul = 2000; this.burst(this.x, this.y, '#4CC9F0'); if (window.Sound) Sound.crash();
      if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
      else { this.chains.forEach(ch => ch.segs.forEach(s => { s.y = Math.max(0, s.y - 8); })); }
    }
    if (!this.chains.length) { this.wave++; this.score += 100 * this.wave; if (window.Sound) Sound.levelUp(); this.spawnWave(); }
    this.parts = FX.stepParts(this.parts, f, 0.05);
    this.draw();
  }
  burst(x, y, c) { for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.05; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: c || '#B15DFF' }); } }

  getSnapshot() {
    const g = this.mush.map(r => r.map(v => v ? 52 : 0));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cx < this.W && cy >= 0 && cy < this.H) g[cy][cx] = v; };
    this.chains.forEach(ch => ch.segs.forEach((s, i) => put(s.x + 0.5, s.y + 0.5, i === 0 ? 53 : 54)));
    this.bullets.forEach(b => put(b.x, b.y, 27)); put(this.x, this.y, 25);
    return g;
  }

  buildSprites(cs) {
    const P = 16;
    // 지네 머리 h 몸통 b 밝은몸통 B 다리 l 눈 w 검은눈 k 더듬이 a
    const hp = { h: '#FFD166', H: '#E0A800', k: '#1A1D24', w: '#FFFFFF', l: '#5B3AAF', a: '#FF8AB0' };
    const bp = { b: '#8B5CF6', B: '#A78BFA', d: '#5B3AAF', l: '#4C2E96', w: '#FFFFFF' };
    const head = [
      '....a........a..','.....a......a...','......aaaaaa....','....hhhhhhhhhh..','...hHHHHHHHHHHh.','..hHwwHHHHwwHHh.','..hHwkHHHHwkHHh.',
      '.lhHHHHHHHHHHhl.','.lhHHHHHHHHHHhl.','..hHHHHHHHHHHh..','..hHHkkkkkkHHh..','...hHHHHHHHHh...','.l..hhhhhhhh..l.','.l...........l..',
      '................','................'];
    const body = [
      '................','................','....bbbbbbbb....','...bBBBBBBBBb...','..bBBBBBBBBBBb..','.lbBBBbbbbBBBbl.','.lbBBbbbbbbBBbl.',
      '.lbBBbbbbbbBBbl.','.lbBBBbbbbBBBbl.','..bBBBBBBBBBBb..','...bBBBBBBBBb...','....bbbbbbbb....','..l..........l..','..l..........l..',
      '................','................'];
    // 버섯 3단계
    const mp = { c: '#C97A4A', C: '#E8A05A', s: '#F0DDB0', S: '#D8C398', w: '#FFFFFF', d: '#8A5A32' };
    const mush = [
      '................','.....CCCCCC.....','...CCCCCCCCCC...','..CCwwCCCCCCCC..','..CwwCCCCCCCCC..','.CCCCCCCCCCCCCC.','.CCCCCCCCCCCCCC.',
      '.dCCCCCCCCCCCd..','..ddddddddddd...','.....sSSSSs.....','.....sSSSSs.....','.....sSSSSs.....','.....sSSSSs.....','....SSSSSSSS....',
      '................','................'];
    // 내 캐릭터 (작은 우주선)
    const sp = { s: '#4CC9F0', S: '#2AA3CC', w: '#FFFFFF', k: '#12303F', y: '#FFD166' };
    const ship = [
      '................','.......ss.......','.......ss.......','......ssss......','......swws......','.....ssssss.....','.....sSwwSs.....',
      '....ssSwwSss....','....sSSssSSs....','...ssSSssSSss...','...sSS.ss.SSs...','..yss..ss..ssy..','..y...yyyy...y..','......y..y......',
      '................','................'];
    const bake = (grid, pal) => FX.sprite(grid, pal, cs);
    this._cs2 = { head: bake(head, hp), body: bake(body, bp), mush: [bake(mush, mp), bake(mush, { ...mp, C: '#E8A05A', c: '#E8A05A' }), bake(mush, { ...mp, C: '#F6C177', c: '#F6C177' })], ship: bake(ship, sp) };
    this._cs2Cs = cs;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs, now = this.now || 0;
    if (!this._cs2 || this._cs2Cs !== cs) this.buildSprites(cs);
    const SP = this._cs2;

    // 배경: 어두운 숲 바닥 + 격자 흙 질감
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0C1A14'); bg.addColorStop(1, '#071009');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(125,245,143,0.05)';
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { if ((x * 31 + y * 17) % 7 > 1) continue;
      ctx.fillRect(x * cs + cs * 0.3, y * cs + cs * 0.4, cs * 0.12, cs * 0.12); }
    // 아래쪽 내 구역 표시
    ctx.fillStyle = 'rgba(76,201,240,0.05)'; ctx.fillRect(0, H - cs * 5, W, cs * 5);
    ctx.strokeStyle = 'rgba(76,201,240,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, H - cs * 5); ctx.lineTo(W, H - cs * 5); ctx.stroke();

    ctx.imageSmoothingEnabled = false;
    // 버섯
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const v = this.mush[y][x]; if (!v) continue;
      ctx.drawImage(SP.mush[Math.min(2, v - 1)], x * cs, y * cs, cs, cs); }
    // 지네 (머리는 진행 방향으로 회전)
    this.chains.forEach(ch => ch.segs.forEach((sg, i) => {
      const px2 = (sg.x + 0.5) * cs, py2 = (sg.y + 0.5) * cs;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px2, py2 + cs * 0.34, cs * 0.34, cs * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      if (i === 0) { ctx.save(); ctx.translate(px2, py2);
        // 머리 그림은 위를 보도록 그려져 있습니다 — 진행 방향(좌/우)으로만 뒤집습니다
        if (ch.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(SP.head, -cs * 0.55, -cs * 0.55, cs * 1.1, cs * 1.1); ctx.restore(); }
      else { const wob = Math.sin(now / 130 + i * 0.9) * cs * 0.05;
        ctx.drawImage(SP.body, px2 - cs * 0.5, py2 - cs * 0.5 + wob, cs, cs); } }));
    // 총알 (빛나는 탄)
    this.bullets.forEach(b => { const bx = b.x * cs, by = b.y * cs;
      const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, cs * 0.35);
      g2.addColorStop(0, 'rgba(255,240,180,0.9)'); g2.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(bx, by, cs * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFF3C4'; ctx.fillRect(bx - Math.max(1.5, cs * 0.06), by - cs * 0.28, Math.max(3, cs * 0.12), cs * 0.44); });
    // 내 우주선
    if (!(this.invul > 0 && Math.floor(this.invul / 120) % 2 === 0)) {
      const px2 = this.x * cs, py2 = this.y * cs;
      ctx.fillStyle = 'rgba(76,201,240,0.18)'; ctx.beginPath(); ctx.ellipse(px2, py2 + cs * 0.38, cs * 0.4, cs * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(SP.ship, px2 - cs * 0.6, py2 - cs * 0.6, cs * 1.2, cs * 1.2);
    }
    // 목숨
    for (let i = 0; i < this.lives; i++) ctx.drawImage(SP.ship, cs * (0.2 + i * 0.6), H - cs * 0.72, cs * 0.55, cs * 0.55);
    ctx.imageSmoothingEnabled = true;

    FX.drawParts(ctx, this.parts, cs, 3);
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
