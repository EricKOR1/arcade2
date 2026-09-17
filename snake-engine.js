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
    const P = 16, mk = () => { const c = document.createElement('canvas'); c.width = cs; c.height = cs; return c; };
    const px = (g, grid, pal) => { const u = cs / P; g.imageSmoothingEnabled = false;
      // 픽셀 경계를 정확히 나눠 칠합니다 (셀 크기가 16의 배수가 아니어도 겹침·틈 없이)
      const at = v => Math.floor(v * u);
      grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = pal[ch]; g.fillRect(at(x), at(y), at(x + 1) - at(x), at(y + 1) - at(y)); } }); };
    // 팔레트: G 밝은 초록 g 초록 d 진초록 y 노랑 배 w 흰 k 검정 r 빨강 R 진빨강 s 줄기 l 잎 o 주황 혀 p 분홍
    const pal = { G: '#7CFC8A', g: '#3DD36A', d: '#1E9A47', y: '#C8F5A3', w: '#FFFFFF', k: '#0B0D12', r: '#FF5C5C', R: '#C62A2A', s: '#7A4B1E', l: '#3DD36A', o: '#FF7A3D', p: '#FFB3C6', h: 'rgba(0,0,0,0.28)' };
    const head = [
      '................','................','.........ddddd..','.......ddGGGGGd.','......dGGgggggGd','......dGwkggwkgd','......dGwkggwkgd','......dGgggggggd',
      '......dGgggggggd','......dGyyyyyyyd','......dGyyyyyyyd','.......ddyyyyGd.','.........ddddd..','................','................','................'];
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
      '................','................','................','........dddddddd','........GGGGGGGG','........GgggggGG','........gggggggg','........gggggggg',
      '........gggggggg','........gggggggg','........yyyyyyyy','........yyyyyyyy','........dddddddd','................','................','................'];
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
      ctx.drawImage(sp.shadow, this.food[0] * cs, this.food[1] * cs + cs * 0.1);
      ctx.drawImage(sp.apple, this.food[0] * cs, this.food[1] * cs + bob);
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
    // 이웃 마디 방향 (화면 반대편으로 넘어간 경우 보정)
    const toward = (a, b) => { let dx = b[0] - a[0], dy = b[1] - a[1]; if (Math.abs(dx) > 1) dx = -Math.sign(dx); if (Math.abs(dy) > 1) dy = -Math.sign(dy); return Math.atan2(dy, dx); };
    const put = (img, x, y, a) => { ctx.save(); ctx.translate((x + 0.5) * cs, (y + 0.5) * cs); ctx.rotate(a); ctx.drawImage(img, -cs / 2, -cs / 2); ctx.restore(); };
    // 그림자
    for (let i = n - 1; i >= 0; i--) { const [x, y] = posOf(i); ctx.drawImage(sp.shadow, x * cs, y * cs + cs * 0.12); }
    // 몸통: 각 마디에서 앞·뒤 이웃을 향해 반쪽 관을 그리면 코너에서도 끊김 없이 이어집니다
    // 방향은 '보간된 위치끼리' 계산합니다 — 걸음 사이에도 이웃과 정확히 이어집니다
    const P = []; for (let i = 0; i < n; i++) P.push(posOf(i));
    for (let i = n - 1; i >= 1; i--) {
      const [x, y] = P[i];
      if (i < n - 1) put(sp.half, x, y, toward(P[i], P[i + 1]));   // 뒤쪽(꼬리 방향)
      put(sp.half, x, y, toward(P[i], P[i - 1]));                    // 앞쪽(머리 방향)
      if (i === n - 1) put(sp.tailTip, x, y, toward(P[i], P[i - 1]));
      if (i % 3 === 0) put(sp.scale, x, y, 0);
    }
    // 머리: 뒤로 반쪽 관 + 머리 스프라이트
    { const [x, y] = P[0], a = Math.atan2(this.dir[1], this.dir[0]);
      if (n > 1) put(sp.half, x, y, toward(P[0], P[1]));
      put(this.eatFlash > 0.3 ? sp.headOpen : sp.head, x, y, a); }
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
