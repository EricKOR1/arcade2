// 타워 오르기 — 굴러오는 통을 뛰어넘고 사다리를 타고 꼭대기까지. ← → 이동 · ▲ 사다리 오르기 · 점프.
// 꼭대기에 닿으면 다음 층(통이 더 자주, 더 빠르게). 통에 닿으면 목숨 -1 (3개).

const TW_COLS = 14, TW_ROWS = 22;

class TowerGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = TW_COLS; this.H = TW_ROWS;
    // 층: y 좌표(발판 윗면). 사다리: [x, 아래층y, 위층y]
    this.floors = [21, 17, 13, 9, 5];
    this.ladders = [[11, 21, 17], [2, 17, 13], [10, 13, 9], [3, 9, 5], [7, 5, 1.5]];
    this.score = 0; this.lives = 3; this.level = 1; this.gameOver = false; this.climbed = 0;
    this.lastTime = 0; this.now = 0; this.steer = 0; this.upHeld = false;
    this.barrels = []; this.parts = []; this.spawnT = 3000; this.invul = 1500;
    this.resetPlayer();
  }
  resetPlayer() { this.x = 1.5; this.y = this.floors[0]; this.vy = 0; this.onLadder = false; this.jumping = false; this.face = 1; }
  move(dir) { this.steer = dir; } releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  up() { this.upHeld = true; }
  softDrop() { this.wantDown = true; }
  rotate() { this.jump(); } hardDrop() { this.jump(); } fire() { this.jump(); }
  jump() { if (this.gameOver || this.jumping || this.onLadder) return; this.jumping = true; this.vy = -0.42; if (window.Sound) Sound.rotate(); }

  floorAt(y) { return this.floors.find(fy => Math.abs(fy - y) < 0.3); }
  ladderAt(x, y) { return this.ladders.find(([lx, by, ty]) => Math.abs(lx + 0.5 - x) < 0.5 && y <= by + 0.3 && y >= ty - 0.3); }

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const { dt, f } = FX.frame(this, now);
    if (this.invul > 0) this.invul -= dt;
    // 사다리
    const lad = this.ladderAt(this.x, this.y);
    if (!this.jumping && lad && (this.upHeld || this.wantDown)) { this.onLadder = true; this.x = lad[0] + 0.5; }
    if (this.onLadder) {
      if (this.upHeld) this.y -= 0.12 * f; if (this.wantDown) this.y += 0.12 * f;
      const [, by, ty] = lad || [0, this.y, this.y];
      if (this.y <= ty) { this.y = ty; this.onLadder = false; }
      if (this.y >= by) { this.y = by; this.onLadder = false; }
      if (!lad) this.onLadder = false;
    } else {
      this.x = Math.max(0.5, Math.min(this.W - 0.5, this.x + this.steer * 0.13 * f));
      if (this.steer) this.face = this.steer;
      if (this.jumping) { this.vy += 0.028 * f; this.y += this.vy * f;
        const fl = this.floors.find(fy => this.vy > 0 && this.y >= fy - 0.05 && this.y <= fy + 0.5);
        if (fl != null) { this.y = fl; this.jumping = false; this.vy = 0; } }
      else { const fl = this.floorAt(this.y); if (fl == null) { this.jumping = true; this.vy = 0; } }
    }
    this.wantDown = false; this.upHeld = false;
    // 꼭대기 도달
    if (this.y <= 1.6) { this.level++; this.climbed++; this.score += 500 * this.level; if (window.Sound) Sound.levelUp(); this.barrels = []; this.resetPlayer(); this.invul = 1500; }
    // 통 생성 · 이동 (맨 위 층 왼쪽에서 출발, 층 끝에서 아래로 떨어지고 방향 전환, 가끔 사다리로 내려감)
    // 통 생성 간격: 1층 4초 → 층마다 0.35초씩 짧아져 최소 1초. 속도: 1층 0.07 → 층마다 +0.01
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = Math.max(1000, 4000 - (this.level - 1) * 350); this.barrels.push({ x: 1, y: 5, dir: 1, vy: 0, falling: false, rot: 0 }); }
    const bs = Math.min(0.16, 0.07 + (this.level - 1) * 0.01);
    const ladderChance = Math.min(0.5, 0.15 + (this.level - 1) * 0.06);   // 사다리로 내려올 확률: 1층 15% → 서서히
    this.barrels.forEach(b => { b.rot += b.dir * 0.2 * f;
      if (b.falling) { b.vy += 0.03 * f; b.y += b.vy * f;
        // 떨어지기 시작한 층보다 '아래'의 층에만 착지 (같은 층에 다시 걸려 영원히 튕기던 버그)
        const fl = this.floors.find(fy => fy > (b.fromY || 0) + 0.5 && b.y >= fy - 0.05 && b.y <= fy + 0.6);
        if (fl != null && b.y >= fl) { b.y = fl; b.falling = false; b.vy = 0; b.dir = -b.dir; b.fromY = null; } return; }
      b.x += b.dir * bs * f;
      const lad = this.ladders.find(([lx, by]) => by === b.y && Math.abs(lx + 0.5 - b.x) < 0.15);
      if (lad && Math.random() < ladderChance && !b.usedLadder) { b.usedLadder = true; b.falling = true; b.fromY = b.y; b.vy = 0.05; b.x = lad[0] + 0.5; return; }
      if (b.x < 0.5 || b.x > this.W - 0.5) { b.falling = true; b.fromY = b.y; b.vy = 0; b.x = Math.max(0.5, Math.min(this.W - 0.5, b.x)); b.usedLadder = false; }
    });
    this.barrels = this.barrels.filter(b => b.y < this.H + 1 && !(b.y >= this.floors[0] && (b.x <= 0.5 || b.x >= this.W - 0.5)));
    // 통과 충돌 · 뛰어넘기 점수
    this.barrels.forEach(b => { const dx = Math.abs(b.x - this.x), dy = this.y - b.y;
      if (!b.scored && dx < 0.5 && dy < -0.8 && dy > -2.2 && this.jumping) { b.scored = true; this.score += 50; }
      if (this.invul <= 0 && dx < 0.55 && Math.abs(dy) < 0.6) { this.lives--; this.invul = 2000; this.burst(this.x, this.y); if (window.Sound) Sound.crash();
        if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); } else { this.barrels = []; this.resetPlayer(); } } });
    this.parts = FX.stepParts(this.parts, f, 0.05);
    this.draw();
  }
  burst(x, y) { for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.08; this.parts.push({ x, y: y - 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05, l: 1, c: '#FF5C7A' }); } }

  getSnapshot() {
    const g = Array.from({ length: this.H }, () => Array(this.W).fill(0));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cx < this.W && cy >= 0 && cy < this.H) g[cy][cx] = v; };
    this.floors.forEach(fy => { for (let x = 0; x < this.W; x++) put(x, fy - 0.5, 55); });
    this.ladders.forEach(([lx, by, ty]) => { for (let y = ty; y < by; y++) put(lx, y, 56); });
    this.barrels.forEach(b => put(b.x, b.y - 0.6, 57)); put(this.x, this.y - 0.8, 23); put(7, 0.5, 48);
    return g;
  }

  // ── 스프라이트 (코드 생성 · 외부 파일 없음) ──
  buildSprites(cs) {
    const P = 16, S = Math.ceil(cs), mk = () => { const c = document.createElement('canvas'); c.width = S; c.height = S; return c; };
    const px = (g, grid, pal) => { const u = S / P; g.imageSmoothingEnabled = false;
      const at = v => v >= P ? S : Math.floor(v * u);
      grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = pal[ch]; g.fillRect(at(x), at(y), at(x + 1) - at(x), at(y + 1) - at(y)); } }); };
    // s 피부 h 머리 b 상의 B 상의그늘 p 바지 P 바지그늘 k 검정 w 흰 y 노랑(장갑·신발)
    const pal = { s: '#FFD9A8', h: '#5A3A22', b: '#06D6A0', B: '#049C6F', p: '#3A6EA5', P: '#28527A', k: '#161A24', w: '#FFFFFF', y: '#FFD166' };
    // 서 있는 모습 (아래 4행은 다리)
    const stand = [
      '................','......hhhh......','.....hhhhhh.....','.....hssssh.....','.....sskssk.....','.....ssssss.....','......ssss......',
      '....yybbbbyy....','...yybbbbbbyy...','...yybbBBbbyy...','.....bbbbbb.....','.....pppppp.....','.....pppppp.....','....pPPP.PPP....',
      '....pPP...PP....','...yyy.....yyy..'];
    // 걷기 (다리를 벌림)
    const walk = [
      '................','......hhhh......','.....hhhhhh.....','.....hssssh.....','.....sskssk.....','.....ssssss.....','......ssss......',
      '...yybbbbbbyy...','..yybbbbbbbbyy..','....bbBBBBbb....','.....bbbbbb.....','.....pppppp.....','.....pppppp.....','...pPP....PPp...',
      '..pPP.......PP..','.yyy.........yyy'];
    // 사다리 오르기 (팔을 위로)
    const climb = [
      '....y......y....','....y.hhhh.y....','....yhhhhhhy....','....yhssssh.y...','.....sskssk.....','.....ssssss.....','...y..ssss..y...',
      '...y.bbbbbb.y...','....bbbbbbbb....','....bbBBBBbb....','.....bbbbbb.....','.....pppppp.....','.....pppppp.....','....pPP..PPp....',
      '...pPP....PPp...','..yyy......yyy..'];
    // 점프 (다리 모음 · 팔 벌림)
    const jump = [
      '................','......hhhh......','.....hhhhhh.....','.....hssssh.....','.....sskssk.....','.....ssssss.....','.y....ssss....y.',
      'yybbbbbbbbbbbbyy','.yybbbbbbbbbbyy.','....bbBBBBbb....','.....bbbbbb.....','.....pppppp.....','.....pppppp.....','.....pPPPPp.....',
      '.....pPPPPp.....','....yyy..yyy....'];
    // 통 (옆에서 본 나무통)
    const barrel = [
      '................','...kkkkkkkkkk...','..kBBBBBBBBBBk..','.kBnnNNnnNNnnBk.','.kBnnNNnnNNnnBk.','kBnNNnnNNnnNNnBk','kBnNNnnNNnnNNnBk',
      'kBnNNnnNNnnNNnBk','kBnNNnnNNnnNNnBk','kBnNNnnNNnnNNnBk','kBnNNnnNNnnNNnBk','.kBnnNNnnNNnnBk.','.kBnnNNnnNNnnBk.','..kBBBBBBBBBBk..',
      '...kkkkkkkkkk...','................'];
    const bpal = { k: '#5A3E1E', B: '#8A6432', n: '#C79A5A', N: '#A87C42' };
    const bake = (grid, pl) => { const c = mk(); px(c.getContext('2d'), grid, pl || pal); return c; };
    this._ts = { stand: bake(stand), walk: bake(walk), climb: bake(climb), jump: bake(jump), barrel: bake(barrel, bpal) };
    this._tsCs = cs;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs, now = this.now;
    if (!this._ts || this._tsCs !== cs) this.buildSprites(cs);
    const SP = this._ts;

    // 배경: 밤하늘 + 멀리 도시 실루엣
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#241243'); bg.addColorStop(0.55, '#150E2B'); bg.addColorStop(1, '#0A0818');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 26; i++) { const sx = (i * 137) % W, sy = ((i * 89) % Math.round(H * 0.45));
      ctx.globalAlpha = 0.25 + ((i * 17) % 10) / 20; ctx.fillRect(sx, sy, 2, 2); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(70,50,110,0.55)';
    for (let i = 0; i < 9; i++) { const bw = cs * (0.8 + (i % 3) * 0.5), bx = i * (W / 9), bh2 = cs * (1.2 + ((i * 7) % 5) * 0.5);
      ctx.fillRect(bx, H * 0.55 - bh2, bw, bh2 + H); }

    // 사다리 (나무 기둥 + 가로대)
    this.ladders.forEach(([lx, by, ty]) => { const x = (lx + 0.5) * cs;
      ctx.fillStyle = '#8A6432'; ctx.fillRect(x - cs * 0.34, ty * cs, cs * 0.12, (by - ty) * cs); ctx.fillRect(x + cs * 0.22, ty * cs, cs * 0.12, (by - ty) * cs);
      ctx.fillStyle = '#C79A5A';
      for (let y = ty + 0.35; y < by; y += 0.55) ctx.fillRect(x - cs * 0.34, y * cs, cs * 0.68, Math.max(2, cs * 0.09));
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + cs * 0.3, ty * cs, cs * 0.04, (by - ty) * cs); });

    // 층 (강철 대들보 + 리벳)
    this.floors.forEach(fy => { const y = fy * cs;
      const gg = ctx.createLinearGradient(0, y, 0, y + cs * 0.38); gg.addColorStop(0, '#FF7A90'); gg.addColorStop(1, '#C8324C');
      ctx.fillStyle = gg; ctx.fillRect(0, y, W, cs * 0.38);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(0, y, W, Math.max(2, cs * 0.07));
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, y + cs * 0.32, W, Math.max(2, cs * 0.06));
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = cs * 0.3; x < W; x += cs * 0.8) { ctx.beginPath(); ctx.arc(x, y + cs * 0.19, Math.max(1.5, cs * 0.05), 0, Math.PI * 2); ctx.fill(); } });

    // 꼭대기 목표 (깃발 + 빛)
    { const gx = 7.5 * cs, gy = 1.6 * cs;
      const pulse = 0.5 + 0.5 * Math.sin(now / 320);
      const gr = ctx.createRadialGradient(gx, gy - cs * 0.2, 0, gx, gy - cs * 0.2, cs * 1.6);
      gr.addColorStop(0, 'rgba(255,209,102,' + (0.28 * pulse).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = gr; ctx.fillRect(gx - cs * 1.6, gy - cs * 1.8, cs * 3.2, cs * 3.2);
      ctx.fillStyle = '#C9CFD8'; ctx.fillRect(gx - cs * 0.06, gy - cs * 1.25, cs * 0.12, cs * 1.25);
      ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.moveTo(gx + cs * 0.06, gy - cs * 1.25);
      ctx.lineTo(gx + cs * 0.95, gy - cs * 0.95); ctx.lineTo(gx + cs * 0.06, gy - cs * 0.62); ctx.closePath(); ctx.fill();
      FX.text(ctx, 'GOAL', gx, gy + cs * 0.1, { size: cs * 0.42, weight: 800, color: '#FFD166', align: 'center', shadow: 6 }); }

    // 통 (굴러가며 회전)
    ctx.imageSmoothingEnabled = false;
    this.barrels.forEach(b => { const px2 = b.x * cs, py2 = (b.y - 0.45) * cs, r = cs * 0.46;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px2, py2 + r * 0.9, r * 0.8, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(px2, py2); ctx.rotate(b.rot); ctx.drawImage(SP.barrel, -r, -r, r * 2, r * 2); ctx.restore(); });

    // 등반가
    if (!(this.invul > 0 && Math.floor(this.invul / 120) % 2 === 0)) {
      const px2 = this.x * cs, py2 = this.y * cs, w = cs * 1.02;
      const img = this.onLadder ? SP.climb : (this.vy < -0.01 || this.jumping ? SP.jump : (this.steer ? (Math.floor(now / 110) % 2 ? SP.walk : SP.stand) : SP.stand));
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px2, py2 + cs * 0.06, cs * 0.32, cs * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(px2, py2 - w * 0.44);   // 발이 층 위에 닿도록
      if (this.face < 0 && !this.onLadder) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -w / 2, w, w); ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;

    FX.drawParts(ctx, this.parts, cs, 3);
    // 목숨: 작은 등반가 머리
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < this.lives; i++) ctx.drawImage(SP.stand, cs * (0.2 + i * 0.6), H - cs * 0.72, cs * 0.55, cs * 0.55);
    ctx.imageSmoothingEnabled = true;
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
