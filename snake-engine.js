// 스네이크 — 먹이를 먹을수록 길어지고 빨라집니다. 벽이나 몸에 부딪히면 끝.

const SNAKE_COLS = 20, SNAKE_ROWS = 20;

class SnakeGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    const cx = Math.floor(SNAKE_COLS / 2), cy = Math.floor(SNAKE_ROWS / 2);
    this.body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];   // 머리가 맨 앞
    this.dir = [1, 0];
    this.nextDir = [1, 0];
    this.queue = [];                                     // 빠른 연타를 순서대로 처리
    this.food = null;
    this.score = 0;
    this.length = 3;
    this.level = 1;
    this.gameOver = false;
    this.lastStep = 0;
    this.eatFlash = 0;
    this.started = false;          // 첫 방향키를 누르기 전에는 움직이지 않습니다
    this.placeFood();
  }

  get stepMs() { return Math.max(75, 210 - (this.level - 1) * 14); }   // 처음은 조금 느리게(초당 약 5칸), 단계마다 빨라짐

  placeFood() {
    const taken = {};
    this.body.forEach(([x, y]) => { taken[x + ',' + y] = 1; });
    const free = [];
    for (let y = 0; y < SNAKE_ROWS; y++)
      for (let x = 0; x < SNAKE_COLS; x++)
        if (!taken[x + ',' + y]) free.push([x, y]);
    this.food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  // 방향 바꾸기 — 반대 방향으로는 못 꺾습니다
  turn(dx, dy) {
    if (this.gameOver) return;
    if (!this.started) { this.started = true; this.lastStep = 0; if (window.Sound) Sound.start(); }
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (last[0] === -dx && last[1] === -dy) return;
    if (last[0] === dx && last[1] === dy) return;
    if (this.queue.length < 2) this.queue.push([dx, dy]);
    if (window.Sound) Sound.move();
  }
  move(dir) { this.turn(dir, 0); }
  up()      { this.turn(0, -1); }
  down()    { this.turn(0, 1); }
  rotate()  { this.up(); }          // 키보드 ↑
  softDrop(){ this.down(); }        // ↓ 버튼 · 키보드 ↓ 누름
  hardDrop(){ this.down(); }        // 스페이스

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    if (this.softDropping && this.dir[1] !== -1 && this.dir[1] !== 1) this.turn(0, 1);
    if (this.started) {
      if (!this.lastStep) this.lastStep = now;          // 시작 직후 첫 걸음까지 한 박자 여유
      if (now - this.lastStep >= this.stepMs) {
        this.prevBody = this.body.map(c => c.slice());   // 이전 걸음의 위치 (미끄러지는 그림용)
        this.lastStep = now;
        this.step();
      }
    }
    if (this.eatFlash > 0) this.eatFlash -= 0.08;
    this.draw();
  }

  step() {
    if (this.queue.length) this.dir = this.queue.shift();
    const head = this.body[0];
    const nx = head[0] + this.dir[0], ny = head[1] + this.dir[1];

    // 벽 · 몸에 부딪힘
    if (nx < 0 || nx >= SNAKE_COLS || ny < 0 || ny >= SNAKE_ROWS) return this.die();
    const willGrow = this.food && nx === this.food[0] && ny === this.food[1];
    const tailIdx = this.body.length - (willGrow ? 0 : 1);
    for (let i = 0; i < tailIdx; i++)
      if (this.body[i][0] === nx && this.body[i][1] === ny) return this.die();

    this.body.unshift([nx, ny]);
    if (willGrow) {
      this.length = this.body.length;
      this.score += 10 * this.level;
      this.eatFlash = 1;
      if (window.Sound) Sound.clear(1);
      const nl = 1 + Math.floor((this.length - 3) / 5);
      if (nl > this.level) { this.level = nl; if (window.Sound) Sound.levelUp(); }
      this.placeFood();
    } else {
      this.body.pop();
    }
  }

  die() {
    this.gameOver = true;
    if (window.Sound) Sound.gameOver();
  }

  // 16×16 픽셀 격자 스프라이트를 셀 크기로 확대해 캔버스에 구워 둡니다
  buildSprites(cs) {
    const P = 16, S = Math.ceil(cs), mk = () => { const c = document.createElement('canvas'); c.width = S; c.height = S; return c; };
    const px = (g, grid, pal) => { const u = S / P; g.imageSmoothingEnabled = false;
      // 픽셀 경계를 정확히 나눠 칠합니다 (셀 크기가 16의 배수가 아니어도 겹침·틈 없이). 마지막 픽셀은 캔버스 끝까지
      const at = v => v >= P ? S : Math.floor(v * u);
      grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = pal[ch]; g.fillRect(at(x), at(y), at(x + 1) - at(x), at(y + 1) - at(y)); } }); };
    // 팔레트: G 밝은 초록 g 초록 d 진초록 y 노랑 배 w 흰 k 검정 r 빨강 R 진빨강 s 줄기 l 잎 o 주황 혀 p 분홍
    const pal = { G: '#6BEE7E', g: '#2FBF5C', d: '#166F35', y: '#B8F09A', w: '#FFFFFF', k: '#0B0D12', r: '#FF5C5C', R: '#C62A2A', s: '#7A4B1E', l: '#3DD36A', o: '#FF7A3D', p: '#FFB3C6', h: 'rgba(0,0,0,0.28)' };
    const head = [
      '................','.........ddddd..','.......dddGGGdd.','......ddGGgggGGd','.....ddGgggggggd','.....dGgwkggwkgd','.....dGgwkggwkgd','.....dGggggggggd',
      '.....dGggggggggd','.....dGgyyyyyyyd','.....ddGyyyyyyyd','......ddGyyyyGd.','.......dddGGGdd.','.........ddddd..','................','................'];
    const headOpen = head.map((r, y) => y >= 9 && y <= 11 ? r.replace(/y/g, 'p') : r);
    const body = [
      '................','.....dddddd.....','...ddGGGGGGdd...','..dGGGggggGGGd..','..dGGggggggGGd..','.dGGgggggggggGd.',
      '.dGGgggddgggGGd.','.dGGggddddggGGd.','.dGGggddddggGGd.','.dGGgggddgggGGd.','.dGGyyyyyyyyGGd.','..dGyyyyyyyyGd..',
      '..dGGyyyyyyGGd..','...ddGGGGGGdd...','.....dddddd.....','................'];
    const body2 = body.map(r => r.replace(/dd(dd)?/g, m => m.length === 4 ? 'gggg' : 'gg').replace(/^\.dGGgggddgggGGd\.$/, '.dGGggggggggGGd.'));
    const tail = [
      '................','................','.......ddd......','......dGGGdd....','.....dGGgggGd...','....dGGgggggGd..',
      '...dGGgggggggd..','..dGGggggggggGd.','..dGGyyyyyyyGd..','...dGyyyyyyyGd..','....dGyyyyyGd...','.....dGGyyGd....',
      '......ddGGd.....','........dd......','................','................'];
    const apple = [
      '................','.......ss.......','......ss.l......','.....s..lll.....','....rrrrr.ll....','...rrRRrrrrr....','..rrwRRrrrrrr...',
      '..rwwRRrrrrrr...','..rrwRRrrrrrr...','..rrRRRrrrrrr...','..rrRRRRrrrrr...','...rRRRRRrrr....','....RRRRRRr.....','.....RRRR.......',
      '................','................'];
    const shadow = ['................','................','................','................','................','................',
      '.....hhhhhh.....','...hhhhhhhhhh...','..hhhhhhhhhhhh..','..hhhhhhhhhhhh..','...hhhhhhhhhh...','.....hhhhhh.....','................','................','................','................'];
    // 반쪽 관: 셀 중심에서 오른쪽 가장자리까지 (회전해서 네 방향으로 씀)
    const half = [
      '................','................','................','........dddddddd','........GGGGGGGG','........gggggggg','........gggggggg','........gggggggg',
      '........gggggggg','........gggggggg','........gggggggg','........yyyyyyyy','........dddddddd','................','................','................'];
    // 관이 꺾이는 중심을 메우는 둥근 마디 (반쪽 관 두 개 위에 겹침)
    const scale = [
      '................','................','................','................','................','......dgggd.....','.....dggdgg.....','.....dgdddg.....',
      '.....dggdgg.....','......dgggd.....','................','................','................','................','................','................'];
    // 꼬리 끝: 중심에서 왼쪽으로 좁아지는 끝 (앞 마디 방향이 +x 이므로 -x 쪽에 그림)
    const tailTip = [
      '................','................','................','................','......ddddd.....','....ddGGGGG.....','...dGGggggg.....','..dGgggggg......',
      '..dGgggggg......','...dGyyyyy......','....ddyyyyy.....','......ddddd.....','................','................','................','................'];
    const bake = grid => { const c = mk(); px(c.getContext('2d'), grid, pal); return c; };
    // 바닥: 풀 타일 (두 가지 톤 + 작은 풀잎)
    const W = SNAKE_COLS * cs, H = SNAKE_ROWS * cs, bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    for (let y = 0; y < SNAKE_ROWS; y++) for (let x = 0; x < SNAKE_COLS; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#1F3A2A' : '#1B3325'; g.fillRect(x * cs, y * cs, cs, cs);
      const seed = (x * 73 + y * 151) % 17; if (seed < 5) { g.fillStyle = 'rgba(124,252,138,0.22)'; const u = cs / P; g.fillRect(x * cs + (seed + 3) * u, y * cs + (seed * 2 + 3) * u, u, u * 2); } }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
    this._sp = { head: bake(head), headOpen: bake(headOpen), half: bake(half), scale: bake(scale), tailTip: bake(tailTip), apple: bake(apple), shadow: bake(shadow), bg };
    this._spCs = cs;
  }

  getSnapshot() {
    const g = Array.from({ length: SNAKE_ROWS }, () => Array(SNAKE_COLS).fill(0));
    this.body.forEach(([x, y], i) => { g[y][x] = i === 0 ? 14 : 13; });
    if (this.food) g[this.food[1]][this.food[0]] = 15;
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize;
    const W = SNAKE_COLS * cs, H = SNAKE_ROWS * cs;
    // ── 픽셀아트 스프라이트 (코드로 생성 · 외부 파일 없음) ──
    // 16×16 픽셀 격자로 그린 뒤 셀 크기로 확대합니다 (image-smoothing 끔 → 또렷한 픽셀)
    if (!this._sp || this._spCs !== cs) this.buildSprites(cs);
    const sp = this._sp;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sp.bg, 0, 0);

    // 먹이: 사과 (살짝 둥실)
    if (this.food) {
      const bob = Math.sin(performance.now() / 220) * cs * 0.05;
      ctx.drawImage(sp.shadow, this.food[0] * cs, this.food[1] * cs + cs * 0.1, cs, cs);
      ctx.drawImage(sp.apple, this.food[0] * cs, this.food[1] * cs + bob, cs, cs);
    }

    const n = this.body.length;
    const now = this.now || performance.now();
    const k = (this.started && this.lastStep && this.prevBody) ? Math.min(1, (now - this.lastStep) / this.stepMs) : 1;
    const ease = k * k * (3 - 2 * k);
    const posOf = (i) => {
      const cur = this.body[i];
      const prev = this.prevBody && this.prevBody[i];
      if (!prev || k >= 1) return cur;
      if (Math.abs(cur[0] - prev[0]) > 1 || Math.abs(cur[1] - prev[1]) > 1) return cur;
      return [prev[0] + (cur[0] - prev[0]) * ease, prev[1] + (cur[1] - prev[1]) * ease];
    };
    // ── 몸통: 칸 단위 조각이 아니라 '하나의 이어진 선'으로 그립니다 ──
    // 조각을 이어 붙이면 기기 배율이 소수점일 때 마디마다 경계선이 보입니다.
    // 선 하나로 그리면 어떤 배율에서도 매끈합니다. (화면 반대편으로 넘어가는 구간은 끊어서 그림)
    const P = []; for (let i = 0; i < n; i++) P.push(posOf(i));
    const runs = [[P[0]]];
    for (let i = 1; i < n; i++) {
      const a = P[i - 1], b = P[i];
      if (Math.abs(a[0] - b[0]) > 1.5 || Math.abs(a[1] - b[1]) > 1.5) runs.push([b]);   // 벽을 통과한 지점
      else runs[runs.length - 1].push(b);
    }
    const path = (w) => { ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      runs.forEach(r => { if (r.length < 2) { ctx.beginPath(); ctx.arc((r[0][0] + .5) * cs, (r[0][1] + .5) * cs, w / 2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); return; }
        ctx.beginPath(); r.forEach((p, k) => { const X = (p[0] + .5) * cs, Y = (p[1] + .5) * cs; k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); }); };
    const BW = cs * 0.80;
    ctx.save();
    ctx.translate(0, cs * 0.06); ctx.strokeStyle = 'rgba(0,0,0,0.32)'; path(BW + cs * 0.06); ctx.translate(0, -cs * 0.06);   // 바닥 그림자
    ctx.strokeStyle = '#12572A'; path(BW);                                     // 테두리(진초록)
    ctx.strokeStyle = '#2FBF5C'; path(BW - cs * 0.16);                         // 본색
    // 윗면 하이라이트: 위로 살짝 올려 입체감
    ctx.save(); ctx.translate(0, -BW * 0.20); ctx.strokeStyle = '#7DF58F'; ctx.globalAlpha = 0.9; path(BW * 0.26); ctx.restore();
    ctx.globalAlpha = 1;
    // 비늘: 선을 따라 일정 간격으로 (칸이 아니라 '길이' 기준이라 경계선처럼 보이지 않습니다)
    ctx.fillStyle = 'rgba(18,87,42,0.45)';
    runs.forEach(r => { for (let k = 1; k < r.length; k++) { const a = r[k - 1], b = r[k];
      for (let t = 0; t < 1; t += 0.5) { const X = (a[0] + (b[0] - a[0]) * t + .5) * cs, Y = (a[1] + (b[1] - a[1]) * t + .5) * cs;
        if ((k * 2 + t * 2) % 3 !== 0) continue;
        ctx.beginPath(); ctx.arc(X, Y + BW * 0.12, BW * 0.13, 0, Math.PI * 2); ctx.fill(); } } });
    ctx.restore();
    // 머리 스프라이트 (픽셀아트 유지)
    { const [x, y] = P[0], a = Math.atan2(this.dir[1], this.dir[0]);
      const img = this.eatFlash > 0.3 ? sp.headOpen : sp.head;
      ctx.save(); ctx.translate((x + 0.5) * cs, (y + 0.5) * cs); ctx.rotate(a);
      ctx.drawImage(img, -cs * 0.72, -cs * 0.72, cs * 1.44, cs * 1.44); ctx.restore(); }
    ctx.imageSmoothingEnabled = true;

    if (this.eatFlash > 0) {
      ctx.fillStyle = 'rgba(6,214,160,' + (this.eatFlash * 0.18).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (!this.started && !this.gameOver) {
      const pulse = 0.65 + Math.sin(performance.now() / 350) * 0.2;
      ctx.fillStyle = 'rgba(11,13,18,0.5)'; ctx.fillRect(0, H * 0.4, W, H * 0.2);
      ctx.fillStyle = 'rgba(255,255,255,' + pulse.toFixed(2) + ')';
      ctx.font = '700 ' + Math.round(cs * 0.95) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('방향키를 누르면 출발', W / 2, H / 2);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H);
    }
  }
}
