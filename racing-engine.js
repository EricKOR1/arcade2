// 카트 레이싱 엔진 — 실시간 멀티플레이, 트랙 벽 충돌, 아이템 6종

// ─────────── 트랙 ───────────
const TRACKS = {
  meadow: {
    name: '초원 서킷', desc: '넓고 완만한 코스. 처음 하는 학생에게 좋아요',
    tag: '입문 · 10~20명',
    scale: 3, width: 560, laps: 3, speed: 11.2,
    bg: '#16261C', grass: '#1E3427', road: '#33383F',
    pts: [[400,900],[400,500],[700,260],[1200,220],[1700,300],
          [2000,600],[2050,1000],[1850,1350],[1400,1480],[900,1420],[520,1250]]
  },
  figure8: {
    name: '교차로 코스', desc: '8자로 크게 꼬인 코스. 코너가 많아 역전이 자주 나요',
    tag: '보통 · 20~30명',
    scale: 3, width: 560, laps: 3, speed: 11.2,
    bg: '#1D1A2B', grass: '#272338', road: '#35394A',
    pts: [[1250,850],[1600,600],[2050,450],[2400,700],[2400,1150],[2050,1400],
          [1650,1300],[1350,950],[1000,600],[600,480],[250,750],[250,1200],
          [600,1480],[1050,1400]]
  },
  canyon: {
    name: '협곡 레이스', desc: '길게 이어지는 고난도 코스. 실력자용',
    tag: '어려움 · 20~30명',
    scale: 3, width: 560, laps: 3, speed: 11.6,
    bg: '#241A12', grass: '#33251A', road: '#3B3B44',
    pts: [[400,900],[500,450],[900,220],[1400,250],[1800,500],[2100,850],
          [2500,950],[2850,700],[3200,850],[3300,1300],[3000,1650],[2550,1750],
          [2100,1600],[1650,1750],[1200,1800],[750,1600],[450,1300]]
  },
  grand: {
    name: '그랜드 서킷',
    desc: '가장 넓고 긴 코스. 30명이 6열로 나란히 출발합니다',
    tag: '보통 · 30명 권장',
    scale: 3, width: 820, laps: 3, speed: 12,
    bg: '#131F2A', grass: '#1B2F3D', road: '#343A44',
    pts: [[600,1200],[600,700],[900,350],[1400,250],[1900,300],[2350,500],
          [2700,850],[3050,1150],[3150,1600],[2900,2000],[2450,2200],[1950,2250],
          [1500,2150],[1150,1900],[900,1550]]
  },
  alpine: {
    name: '알파인 그랑프리',
    desc: '가장 길고 코너가 많은 코스. S자 구간과 헤어핀이 이어집니다',
    tag: '어려움 · 30명 가능',
    scale: 3, width: 680, laps: 3, speed: 11.8,
    bg: '#1A1A26', grass: '#252536', road: '#383C48',
    pts: [[500,1300],[450,850],[700,450],[1150,300],[1600,420],[1850,780],
          [2200,950],[2600,780],[2950,900],[3100,1300],[2950,1750],[2550,1950],
          [2150,1800],[1800,1950],[1400,2100],[950,2050],[600,1750]]
  }
};

function densify(pts, per) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i-1+n)%n], p1 = pts[i], p2 = pts[(i+1)%n], p3 = pts[(i+2)%n];
    for (let t = 0; t < per; t++) {
      const s = t/per, s2 = s*s, s3 = s2*s;
      out.push([
        0.5*((2*p1[0]) + (-p0[0]+p2[0])*s + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*s2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*s3),
        0.5*((2*p1[1]) + (-p0[1]+p2[1])*s + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*s2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*s3)
      ]);
    }
  }
  return out;
}

class Track {
  constructor(def) {
    this.def = def;
    // 웨이포인트 간격이 넓은 대형 코스일수록 곡선을 더 촘촘하게
    let avgSeg = 0;
    for (let i = 0; i < def.pts.length; i++) {
      const a = def.pts[i], b = def.pts[(i+1) % def.pts.length];
      avgSeg += Math.hypot(b[0]-a[0], b[1]-a[1]);
    }
    avgSeg /= def.pts.length;
    const sc = def.scale || 1;
    const pts = def.pts.map(p => [p[0]*sc, p[1]*sc]);
    avgSeg *= sc;
    const per = Math.max(14, Math.min(48, Math.round(avgSeg / 24)));
    this.center = densify(pts, per);

    // 카트 크기와 충돌 반경을 트랙 폭에 비례시켜 비율을 유지
    this.carLen = def.width * 0.135;      // 카트 길이 (기본 40)
    this.carScale = this.carLen / 40;
    this.pickR = def.width * 0.12;        // 아이템 상자 획득 반경
    this.n = this.center.length;
    this.halfW = def.width / 2;
    this.laps = def.laps;

    // 중앙선 한 칸의 실제 길이와 전체 둘레
    this.length = 0;
    for (let i = 0; i < this.n; i++) {
      const a = this.center[i], b = this.center[(i+1) % this.n];
      this.length += Math.hypot(b[0]-a[0], b[1]-a[1]);
    }
    this.stepLen = this.length / this.n;

    this.tangent = this.center.map((p, i) => {
      const q = this.center[(i+1) % this.n];
      const dx = q[0]-p[0], dy = q[1]-p[1], len = Math.hypot(dx,dy) || 1;
      return [dx/len, dy/len];
    });

    // 코너 곡률 (커브 판단 · 킥판 배치용)
    this.curve = this.center.map((_, i) => {
      const a = this.tangent[i], b = this.tangent[(i+12) % this.n];
      return a[0]*b[1] - a[1]*b[0];   // 양수 = 우회전, 음수 = 좌회전
    });

    // 아이템 상자 — 넓으면 5줄, 좁으면 3줄. 코스가 길수록 더 자주 배치
    this.itemSpots = [];
    const cols = this.halfW >= 340 ? [-0.72,-0.48,-0.24,0,0.24,0.48,0.72]
               : this.halfW >= 240 ? [-0.66,-0.33,0,0.33,0.66]
               : [-0.5,0,0.5];
    const rows = Math.max(9, Math.round(this.length / 2200));
    const gap = Math.max(12, Math.floor(this.n / rows));
    for (let i = 24; i < this.n; i += gap) {
      const [tx, ty] = this.tangent[i], nx = -ty, ny = tx;
      cols.forEach(off => this.itemSpots.push({
        x: this.center[i][0] + nx*this.halfW*off,
        y: this.center[i][1] + ny*this.halfW*off,
        takenUntil: 0
      }));
    }

    // 부스터 패드 — 구간마다 가장 곧은 지점을 골라 배치
    this.boostPads = [];
    const padCount = Math.max(6, Math.round(this.length / 3200));
    const seg = Math.floor(this.n / padCount);
    for (let s = 0; s < padCount; s++) {
      let best = s*seg, bestC = Infinity;
      for (let k = 0; k < seg; k++) {
        const i = (s*seg + k) % this.n;
        const c = Math.abs(this.curve[i]);
        if (c < bestC) { bestC = c; best = i; }
      }
      const [tx, ty] = this.tangent[best], nx = -ty, ny = tx;
      const side = (s % 2 === 0) ? 0.36 : -0.36;
      this.boostPads.push({
        x: this.center[best][0] + nx*this.halfW*side,
        y: this.center[best][1] + ny*this.halfW*side,
        angle: Math.atan2(ty, tx)
      });
    }

    this.bounds = this.center.reduce((b, p) => ({
      minX: Math.min(b.minX, p[0]), maxX: Math.max(b.maxX, p[0]),
      minY: Math.min(b.minY, p[1]), maxY: Math.max(b.maxY, p[1])
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    this.sprite = null;
  }

  // 출발 그리드 — 트랙이 넓을수록 한 줄에 여러 대를 세움
  get perRow() {
    if (this.halfW >= 380) return 6;
    if (this.halfW >= 260) return 5;
    if (this.halfW >= 200) return 4;
    if (this.halfW >= 150) return 3;
    return 2;
  }

  startPos(slot) {
    const per = this.perRow;
    const row = Math.floor(slot / per), col = slot % per;
    const back = this.carLen + row * (this.carLen * 1.2);
    let i = (this.n - Math.round(back / this.stepLen)) % this.n;
    if (i < 0) i += this.n;
    const [tx, ty] = this.tangent[i], nx = -ty, ny = tx;
    const spread = 0.68;
    const side = per === 1 ? 0 : (-spread + (2*spread) * (col / (per - 1)));
    return {
      x: this.center[i][0] + nx*this.halfW*side,
      y: this.center[i][1] + ny*this.halfW*side,
      angle: Math.atan2(ty, tx), index: i
    };
  }

  nearestIndex(x, y, hint) {
    let best = hint || 0, bestD = Infinity;
    const span = (hint === undefined) ? this.n : 45;
    for (let k = -span; k <= span; k++) {
      const i = ((hint||0) + k + this.n*2) % this.n;
      const dx = this.center[i][0]-x, dy = this.center[i][1]-y;
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { index: best, dist: Math.sqrt(bestD) };
  }

  // 트랙을 한 번만 그려두고 매 프레임 이미지로 재사용 (태블릿 성능용)
  buildSprite(scale) {
    const pad = this.def.width;
    const b = this.bounds;
    // 태블릿 메모리를 위해 스프라이트 최대 변을 제한
    const rawW = b.maxX - b.minX + pad*2, rawH = b.maxY - b.minY + pad*2;
    scale = Math.min(scale, 1700 / Math.max(rawW, rawH));
    const w = Math.ceil(rawW * scale);
    const h = Math.ceil(rawH * scale);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.scale(scale, scale);
    g.translate(-b.minX + pad, -b.minY + pad);

    const c = this.center, d = this.def;
    g.fillStyle = d.grass;
    g.fillRect(b.minX - pad, b.minY - pad, (b.maxX-b.minX)+pad*2, (b.maxY-b.minY)+pad*2);

    const stroke = (color, width, dash) => {
      g.strokeStyle = color; g.lineWidth = width;
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.setLineDash(dash || []);
      g.beginPath();
      g.moveTo(c[0][0], c[0][1]);
      for (let i = 1; i < c.length; i++) g.lineTo(c[i][0], c[i][1]);
      g.closePath(); g.stroke();
      g.setLineDash([]);
    };

    stroke('rgba(0,0,0,0.35)', d.width + 22);        // 바깥 그림자
    stroke('#D94A4A', d.width + 4);                  // 연석(빨강)
    stroke(d.road, d.width);                          // 노면
    stroke('rgba(255,255,255,0.10)', 4, [30, 34]);    // 중앙 점선

    // 연석 흰 줄무늬 (약 90px 간격)
    const kerbStep = Math.max(2, Math.round(45 / this.stepLen));
    for (let i = 0; i < this.n; i += kerbStep) {
      if ((i / kerbStep) % 2 !== 0) continue;
      const [tx, ty] = this.tangent[i], nx = -ty, ny = tx;
      [-1, 1].forEach(side => {
        g.save();
        g.translate(c[i][0] + nx*this.halfW*side, c[i][1] + ny*this.halfW*side);
        g.rotate(Math.atan2(ty, tx));
        g.fillStyle = '#F4F6FA';
        g.fillRect(-18, -8, 36, 16);
        g.restore();
      });
    }

    // 진행 방향 화살표 (약 380px 간격으로 노면에 새김)
    const arrowStep = Math.max(6, Math.round(380 / this.stepLen));
    for (let i = 8; i < this.n; i += arrowStep) {
      const [tx, ty] = this.tangent[i];
      g.save();
      g.translate(c[i][0], c[i][1]);
      g.rotate(Math.atan2(ty, tx));
      const as = Math.max(1, d.width / 300);
      g.fillStyle = 'rgba(255,255,255,0.17)';
      g.beginPath();
      g.moveTo(26*as, 0); g.lineTo(-12*as, -22*as); g.lineTo(-3*as, 0); g.lineTo(-12*as, 22*as);
      g.closePath(); g.fill();
      g.restore();
    }

    // 부스터 패드
    this.boostPads.forEach(p => {
      g.save(); g.translate(p.x, p.y); g.rotate(p.angle);
      g.fillStyle = 'rgba(76, 201, 240, 0.5)';
      g.fillRect(-34, -30, 68, 60);
      g.fillStyle = 'rgba(255,255,255,0.65)';
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(18, k*18); g.lineTo(-6, k*18-11); g.lineTo(-6, k*18+11);
        g.closePath(); g.fill();
      }
      g.restore();
    });

    // 출발 / 결승선
    const [tx0, ty0] = this.tangent[0], nx0 = -ty0, ny0 = tx0;
    const cells = 10, cw = d.width/cells;
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < cells; i++) {
        g.fillStyle = ((i+r) % 2 === 0) ? '#F4F6FA' : '#1A1D24';
        const off = -this.halfW + i*cw;
        g.save();
        g.translate(c[0][0] + nx0*off + tx0*(r*16), c[0][1] + ny0*off + ty0*(r*16));
        g.rotate(Math.atan2(ty0, tx0));
        g.fillRect(0, 0, 16, cw);
        g.restore();
      }
    }

    this.sprite = { canvas: cv, scale: scale, x: b.minX - pad, y: b.minY - pad,
                    w: (b.maxX-b.minX)+pad*2, h: (b.maxY-b.minY)+pad*2 };
    return this.sprite;
  }
}

// ─────────── 아이템 ───────────
const MAX_ITEMS = 2;   // 최대 보관 개수

const ITEMS = {
  banana:  { icon: '🍌', name: '바나나',   hint: '뒤에 떨어뜨립니다' },
  boost:   { icon: '⚡', name: '부스터',   hint: '2.2초간 가속' },
  missile: { icon: '🚀', name: '미사일',   hint: '바로 앞 주자를 멈춥니다' },
  swap:    { icon: '🌀', name: '위치 교환', hint: '앞 주자와 자리를 바꿉니다' },
  shield:  { icon: '🛡', name: '방어막',   hint: '8초간 공격을 막습니다' },
  bolt:    { icon: '🌩', name: '번개',     hint: '앞선 주자 전원 감속' }
};

// 뒤처질수록 좋은 아이템 (카트라이더식 보정)
function rollItem(rankRatio) {
  let pool;
  if (rankRatio < 0.25)      pool = ['banana','banana','banana','shield','boost','missile'];
  else if (rankRatio < 0.6)  pool = ['boost','boost','missile','banana','shield','bolt'];
  else                       pool = ['swap','swap','bolt','missile','boost','boost','missile'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────── 게임 ───────────
class KartGame {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.track = new Track(TRACKS[this.opts.trackId] || TRACKS.meadow);
    this.myId = this.opts.myId;
    this.myName = this.opts.myName || '';

    const st = this.track.startPos(this.opts.slot || 0);
    this.x = st.x; this.y = st.y; this.angle = st.angle;
    this.segIdx = st.index; this.lap = 0; this.progress = 0;
    this.speed = 0; this.steer = 0;

    this.maxSpeed = this.track.def.speed || 5.6;
    // 큰 트랙에서도 코너링 감각이 같도록 회전 속도를 배율에 맞춤
    this.turnRate = 0.054 * (5.6 / this.maxSpeed) * 1.55;
    this.items = [];          // 최대 2개까지 보관, 앞에서부터 사용
    this.itemRollUntil = 0;
    this.pendingItem = null;
    this.spinUntil = 0; this.stunUntil = 0;
    this.boostUntil = 0; this.slowUntil = 0; this.shieldUntil = 0;
    this.wallUntil = 0;
    this.wrongWay = false;
    this.cornerHint = 0;

    this.finished = false; this.finishRank = null;
    this.rank = 1; this.total = 1;
    this.gameOver = false; this.score = 0;

    this.peers = {}; this.hazards = {};
    this.lastTime = 0;
    this.camX = this.x; this.camY = this.y;
    this.countdown = 3.6;
    this.toast = null;
    this.fx = [];
  }

  resize() { /* 3D 뷰는 매 프레임 투영하므로 별도 갱신 불필요 */ }

  // ── 조작 ──
  move(dir) { this.steer = dir; }
  releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  softDrop() {}
  rotate() { this.useItem(); }
  hardDrop() { this.useItem(); }

  // 바로 앞 주자 찾기
  nextAhead() {
    let best = null, bestP = Infinity;
    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      if (p.finished) return;
      if (p.progress > this.progress && p.progress < bestP) { bestP = p.progress; best = id; }
    });
    return best;
  }

  useItem() {
    if (!this.items.length || this.finished || this.countdown > 0) return;
    const it = this.items[0];
    const now = performance.now();

    // 앞에 아무도 없으면 아이템을 소모하지 않고 되돌림
    if ((it === 'missile' || it === 'swap') && !this.nextAhead()) {
      this.showToast('앞에 아무도 없다', '#9AA3B2');
      return;
    }
    this.items.shift();

    if (it === 'boost') {
      this.boostUntil = now + 2200;
      this.addFx('boost');
      if (window.Sound) Sound.boost();
      this.showToast('부스터!', '#4CC9F0');

    } else if (it === 'banana') {
      const back = this.track.carLen * 1.3;
      const bx = this.x - Math.cos(this.angle)*back;
      const by = this.y - Math.sin(this.angle)*back;
      if (this.opts.onDropHazard) this.opts.onDropHazard(bx, by);
      if (window.Sound) Sound.pass();
      this.showToast('바나나를 놓았다', '#FFD166');

    } else if (it === 'shield') {
      this.shieldUntil = now + 8000;
      if (window.Sound) Sound.levelUp();
      this.showToast('방어막 8초', '#06D6A0');

    } else if (it === 'missile') {
      const target = this.nextAhead();
      if (this.opts.onAttack) this.opts.onAttack('missile', target, null);
      this.addFx('missile');
      if (window.Sound) Sound.hardDrop();
      this.showToast('미사일 발사!', '#EF476F');

    } else if (it === 'swap') {
      const target = this.nextAhead();
      const p = this.peers[target];
      const mine = { x: this.x, y: this.y, a: this.angle, i: this.segIdx, l: this.lap };
      // 나는 앞 주자 자리로
      this.x = p.x; this.y = p.y; this.angle = p.angle;
      this.segIdx = Math.round(p.progress) % this.track.n;
      this.lap = Math.floor(p.progress / this.track.n);
      this.camX = this.x; this.camY = this.y;
      this.speed *= 0.8;
      if (this.opts.onAttack) this.opts.onAttack('swap', target, mine);
      if (window.Sound) Sound.clear(3);
      this.showToast('위치 교환!', '#B15DFF');

    } else if (it === 'bolt') {
      if (this.opts.onAttack) this.opts.onAttack('bolt', null, { p: this.progress });
      if (window.Sound) Sound.levelUp();
      this.showToast('번개! 앞선 주자 감속', '#B15DFF');
    }
  }

  // ── 피격 ──
  guarded() {
    if (performance.now() < this.shieldUntil) {
      this.shieldUntil = 0;
      this.showToast('방어막이 막았다!', '#06D6A0');
      if (window.Sound) Sound.rotate();
      return true;
    }
    return false;
  }

  hitByMissile() {
    if (this.finished || this.guarded()) return;
    this.stunUntil = performance.now() + 1500;
    this.speed = 0;
    this.addFx('hit');
    if (window.Sound) Sound.crash();
    this.showToast('미사일 피격!', '#EF476F');
  }

  hitByBolt() {
    if (this.finished || this.guarded()) return;
    this.slowUntil = performance.now() + 1800;
    if (window.Sound) Sound.crash();
    this.showToast('번개에 맞았다', '#B15DFF');
  }

  teleportTo(s) {
    if (this.finished) return;
    this.x = s.x; this.y = s.y; this.angle = s.a;
    this.segIdx = s.i; this.lap = s.l;
    this.camX = this.x; this.camY = this.y;
    this.speed *= 0.6;
    if (window.Sound) Sound.clear(2);
    this.showToast('자리를 빼앗겼다!', '#B15DFF');
  }

  spinOut() {
    if (performance.now() < this.spinUntil || this.finished || this.guarded()) return;
    this.spinUntil = performance.now() + 1300;
    this.speed *= 0.2;
    if (window.Sound) Sound.crash();
    this.showToast('미끄러졌다!', '#FFD166');
  }

  // 마음에 안 드는 아이템을 버려서 다음 상자를 받을 수 있게 함
  dropItem() {
    if (!this.items.length || this.finished) return;
    const it = this.items.shift();
    if (window.Sound) Sound.lock();
    this.showToast(ITEMS[it].name + ' 버림', '#9AA3B2');
  }

  showToast(text, color) { this.toast = { text, color: color || '#fff', until: performance.now() + 1500 }; }
  addFx(type) { this.fx.push({ type, until: performance.now() + 500 }); }

  setPeers(map) {
    Object.keys(map).forEach(id => {
      const d = map[id];
      if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle };
      const p = this.peers[id];
      p.tx = d.x; p.ty = d.y; p.tangle = d.angle;
      p.name = d.name; p.lap = d.lap; p.progress = d.progress;
      p.spin = d.spin; p.shield = d.shield; p.boost = d.boost; p.finished = d.finished;
    });
    Object.keys(this.peers).forEach(id => { if (!map[id]) delete this.peers[id]; });
  }
  setHazards(list) { this.hazards = list; }

  serialize() {
    const now = performance.now();
    const flags = (now < this.spinUntil || now < this.stunUntil ? 1 : 0)
                | (now < this.shieldUntil ? 2 : 0)
                | (now < this.boostUntil ? 4 : 0);
    return [Math.round(this.x), Math.round(this.y), this.angle.toFixed(2),
            this.lap, Math.round(this.progress), flags, this.finished ? 1 : 0].join(',');
  }

  // ── 프레임 ──
  tick(now) {
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7;
    this.lastTime = now;
    const f = dt / 16.7;

    if (this.itemRollUntil && now > this.itemRollUntil) {
      if (this.items.length < MAX_ITEMS) this.items.push(this.pendingItem);
      const got = this.pendingItem;
      this.pendingItem = null; this.itemRollUntil = 0;
      if (window.Sound) Sound.clear(1);
      this.showToast(ITEMS[got].name + ' 획득! (' + this.items.length + '/' + MAX_ITEMS + ')', '#FFD166');
    }

    if (this.countdown > 0) { this.countdown -= dt/1000; this.draw(); return; }
    if (!this.finished) this.updateCar(now, f);
    this.updateRank();
    this.fx = this.fx.filter(x => now < x.until);
    this.draw();
  }

  updateCar(now, f) {
    const spinning = now < this.spinUntil;
    const stunned  = now < this.stunUntil;
    const boosting = now < this.boostUntil;
    const slowed   = now < this.slowUntil;

    let target = this.maxSpeed;
    if (boosting) target *= 1.9;
    if (slowed)   target *= 0.45;
    if (spinning) target = 0.8;
    if (stunned)  target = 0;

    this.speed += (target - this.speed) * (stunned ? 0.3 : 0.055) * f;

    if (spinning)      this.angle += 0.34 * f;
    else if (!stunned) this.angle += this.steer * this.turnRate * Math.min(1, this.speed/3) * f;

    this.x += Math.cos(this.angle) * this.speed * f;
    this.y += Math.sin(this.angle) * this.speed * f;

    // ── 트랙 벽: 밖으로 못 나감 ──
    const near = this.track.nearestIndex(this.x, this.y, this.segIdx);
    const limit = this.track.halfW - this.track.carLen * 0.45;
    if (near.dist > limit) {
      const c = this.track.center[near.index];
      const dx = this.x - c[0], dy = this.y - c[1];
      const d = Math.hypot(dx, dy) || 1;
      this.x = c[0] + dx/d * limit;
      this.y = c[1] + dy/d * limit;
      this.speed *= 0.62;
      if (now - this.wallUntil > 400) { this.wallUntil = now; if (window.Sound) Sound.lock(); }
    }

    // 진행도
    const cur = this.track.nearestIndex(this.x, this.y, this.segIdx);
    const n = this.track.n;
    let delta = cur.index - this.segIdx;
    if (delta >  n/2) delta -= n;
    if (delta < -n/2) delta += n;
    if (Math.abs(delta) < n/4) {
      if (this.segIdx + delta >= n) this.lap++;
      if (this.segIdx + delta < 0)  this.lap--;
      this.segIdx = cur.index;
    }
    this.progress = this.lap * n + this.segIdx;
    this.score = Math.max(0, Math.round(this.progress/4));

    // 역주행 · 다음 코너 방향
    const tg = this.track.tangent[this.segIdx];
    const dot = Math.cos(this.angle)*tg[0] + Math.sin(this.angle)*tg[1];
    this.wrongWay = dot < -0.15 && this.speed > 1;
    const ahead = this.track.curve[(this.segIdx + 26) % n];
    this.cornerHint = Math.abs(ahead) > 0.5 ? (ahead > 0 ? 1 : -1) : 0;

    // 부스터 패드
    this.track.boostPads.forEach(p => {
      if (Math.hypot(p.x - this.x, p.y - this.y) < this.track.pickR * 1.2 && now > this.boostUntil - 400) {
        this.boostUntil = now + 1300;
        this.addFx('boost');
      }
    });

    // 아이템 상자
    this.track.itemSpots.forEach(s => {
      if (now < s.takenUntil) return;
      if (Math.hypot(s.x - this.x, s.y - this.y) < this.track.pickR) {
        s.takenUntil = now + 5000;
        if (this.items.length < MAX_ITEMS && !this.itemRollUntil) {
          this.pendingItem = rollItem(this.total > 1 ? (this.rank-1)/(this.total-1) : 0);
          this.itemRollUntil = now + 750;   // 룰렛 연출
        }
      }
    });

    // 바나나
    Object.keys(this.hazards).forEach(hid => {
      const h = this.hazards[hid];
      if (Math.hypot(h.x - this.x, h.y - this.y) < this.track.carLen * 0.8) {
        if (this.opts.onHitHazard) this.opts.onHitHazard(hid);
        this.spinOut();
      }
    });

    if (this.lap >= this.track.laps && !this.finished) {
      this.finished = true; this.speed *= 0.4;
      if (this.opts.onFinish) this.opts.onFinish();
      if (window.Sound) Sound.levelUp();
    }
  }

  updateRank() {
    const all = [{ p: this.progress, me: true }];
    Object.keys(this.peers).forEach(id => all.push({ p: this.peers[id].progress || 0 }));
    all.sort((a, b) => b.p - a.p);
    this.total = all.length;
    this.rank = all.findIndex(x => x.me) + 1;
  }

  // 화면 HUD가 읽어가는 상태
  hud() {
    const now = performance.now();
    return {
      rank: this.rank, total: this.total,
      lap: Math.min(this.lap + 1, this.track.laps), laps: this.track.laps,
      speed: Math.round(this.speed * 34),
      speedPct: Math.min(100, (this.speed / (this.maxSpeed*1.9)) * 100),
      items: this.items.slice(), max: MAX_ITEMS, rolling: now < this.itemRollUntil,
      shield: now < this.shieldUntil,
      boost: now < this.boostUntil,
      wrongWay: this.wrongWay, corner: this.cornerHint,
      countdown: this.countdown, finished: this.finished, finishRank: this.finishRank
    };
  }

  // ── 그리기 (원근 투영 3D 뷰) ──
  draw() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;
    const t = this.track;
    const now = performance.now();

    // 카메라: 플레이어 뒤 위쪽에서 진행 방향을 바라봄
    const cam = this.setupCamera(W, H);

    this.drawSky(ctx, W, H, cam);
    this.drawRoad(ctx, W, H, cam, now);
    this.drawSprites(ctx, W, H, cam, now);

    if (now < this.boostUntil) this.drawSpeedLines(ctx, W, H);
    this.drawMinimap(ctx, W, H);
    this.drawCanvasOverlay(ctx, W, H, now);
  }

  setupCamera(W, H) {
    const t = this.track;
    const boosting = performance.now() < this.boostUntil;
    const back = t.carLen * (boosting ? 3.2 : 2.8);   // 부스터 중엔 살짝 뒤로 빠짐
    const horizonY = H * 0.33;
    // 도로 폭이 화면의 약 1.24배로 보이도록 초점거리 결정
    const f = (W * 0.62) * back / t.halfW;
    const height = (H * 0.45) * back / f;
    return {
      x: this.x - Math.cos(this.angle) * back,
      y: this.y - Math.sin(this.angle) * back,
      cos: Math.cos(this.angle), sin: Math.sin(this.angle),
      f: f, h: height, horizonY: horizonY, near: t.carLen * 0.35, W: W, H: H
    };
  }

  // 지면 위 한 점(높이 z)을 화면 좌표로 투영
  project(cam, wx, wy, z) {
    const dx = wx - cam.x, dy = wy - cam.y;
    const lz =  dx * cam.cos + dy * cam.sin;
    if (lz < cam.near) return null;
    const lx = -dx * cam.sin + dy * cam.cos;
    return {
      x: cam.W / 2 + cam.f * lx / lz,
      y: cam.horizonY + cam.f * (cam.h - (z || 0)) / lz,
      s: cam.f / lz,
      z: lz
    };
  }

  drawSky(ctx, W, H, cam) {
    const d = this.track.def;
    const sky = ctx.createLinearGradient(0, 0, 0, cam.horizonY);
    sky.addColorStop(0, d.bg);
    sky.addColorStop(1, this.lighten(d.grass, 0.35));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, cam.horizonY + 1);

    // 멀리 보이는 능선 — 방향을 틀 때 함께 흘러가서 회전감을 줌
    const shift = (-this.angle * W * 0.62) % (W * 0.9);
    ctx.fillStyle = this.lighten(d.grass, 0.12);
    ctx.beginPath();
    ctx.moveTo(-W, cam.horizonY);
    for (let i = -2; i <= 4; i++) {
      const bx = shift + i * W * 0.45;
      const bh = 26 + ((i * 37) % 5) * 9;
      ctx.lineTo(bx - W * 0.24, cam.horizonY);
      ctx.lineTo(bx, cam.horizonY - bh);
      ctx.lineTo(bx + W * 0.24, cam.horizonY);
    }
    ctx.lineTo(W * 3, cam.horizonY);
    ctx.closePath();
    ctx.fill();

    // 지면
    ctx.fillStyle = d.grass;
    ctx.fillRect(0, cam.horizonY, W, H - cam.horizonY);
  }

  drawRoad(ctx, W, H, cam, now) {
    const t = this.track, d = t.def, n = t.n;
    const K = Math.min(110, Math.ceil(2600 / t.stepLen));
    const DETAIL = 26;            // 이 거리까지만 연석·점선·잔디 줄무늬를 그림

    // 가까울수록 촘촘하게, 멀수록 듬성듬성 (성능)
    const segs = [];
    let k = -8;
    while (k < K) {
      const i = ((this.segIdx + k) % n + n) % n;
      const c = t.center[i];
      const [tx, ty] = t.tangent[i];
      const nx = -ty, ny = tx;
      const L = this.project(cam, c[0] + nx * t.halfW, c[1] + ny * t.halfW, 0);
      const R = this.project(cam, c[0] - nx * t.halfW, c[1] - ny * t.halfW, 0);
      if (!L || !R) {
        if (segs.length) break;
        k += 1; continue;
      }
      segs.push({ i: i, L: L, R: R, cx: c[0], cy: c[1], nx: nx, ny: ny, tx: tx, ty: ty, k: k,
                  detail: k < DETAIL });
      k += (k < DETAIL) ? 1 : (k < DETAIL * 2 ? 2 : 4);
    }
    if (segs.length < 2) return;

    const quad = (a, b, c2, d2, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y);
      ctx.closePath(); ctx.fill();
    };

    const roadLight = this.lighten(d.road, 0.055);
    const grassLight = this.lighten(d.grass, 0.06);

    // 먼 곳부터 그림 (화가 알고리즘)
    for (let s2 = segs.length - 1; s2 > 0; s2--) {
      const far = segs[s2], near = segs[s2 - 1];
      const band = Math.floor(far.i / 5) % 2 === 0;

      if (near.detail) {
        // 갓길 줄무늬 — 속도감
        if (band) {
          ctx.fillStyle = grassLight;
          ctx.beginPath();
          ctx.moveTo(0, far.L.y); ctx.lineTo(W, far.L.y);
          ctx.lineTo(W, near.L.y); ctx.lineTo(0, near.L.y);
          ctx.closePath(); ctx.fill();
        }
        // 연석
        const kerbW = 0.055;
        const kL1 = this.edge(cam, far, 1 + kerbW), kL2 = this.edge(cam, near, 1 + kerbW);
        const kR1 = this.edge(cam, far, -1 - kerbW), kR2 = this.edge(cam, near, -1 - kerbW);
        const kerbColor = band ? '#E4E9F0' : '#D94A4A';
        if (kL1 && kL2) quad(far.L, kL1, kL2, near.L, kerbColor);
        if (kR1 && kR2) quad(far.R, kR1, kR2, near.R, kerbColor);
      }

      // 노면
      quad(far.L, far.R, near.R, near.L, band ? roadLight : d.road);

      // 중앙 점선
      if (near.detail && Math.floor(far.i / 3) % 2 === 0) {
        const a1 = this.edge(cam, far, 0.035), a2 = this.edge(cam, far, -0.035);
        const b1 = this.edge(cam, near, 0.035), b2 = this.edge(cam, near, -0.035);
        if (a1 && a2 && b1 && b2) quad(a1, a2, b2, b1, 'rgba(255,255,255,0.13)');
      }
    }

    this.drawRoadMarks(ctx, cam, segs, now);
  }

  // 중앙선에서 좌우로 off(-1~1) 만큼 떨어진 지점을 투영
  edge(cam, seg, off) {
    return this.project(cam, seg.cx + seg.nx * this.track.halfW * off,
                             seg.cy + seg.ny * this.track.halfW * off, 0);
  }

  drawRoadMarks(ctx, cam, segs, now) {
    const t = this.track, n = t.n;
    const seen = {};
    segs.forEach(sg => { seen[sg.i] = sg; });

    // 진행 방향 화살표
    const arrowStep = Math.max(6, Math.round(380 / t.stepLen));
    for (let s = segs.length - 1; s >= 0; s--) {
      const sg = segs[s];
      if (sg.k > 60 || sg.i % arrowStep !== 0) continue;
      const len = t.halfW * 0.34;
      const tip = this.project(cam, sg.cx + sg.tx * len, sg.cy + sg.ty * len, 0);
      const bl  = this.project(cam, sg.cx - sg.tx * len * 0.5 + sg.nx * len * 0.55,
                                    sg.cy - sg.ty * len * 0.5 + sg.ny * len * 0.55, 0);
      const br  = this.project(cam, sg.cx - sg.tx * len * 0.5 - sg.nx * len * 0.55,
                                    sg.cy - sg.ty * len * 0.5 - sg.ny * len * 0.55, 0);
      if (!tip || !bl || !br) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
      ctx.closePath(); ctx.fill();
    }

    // 부스터 패드
    const padLimit = t.stepLen * 90;
    t.boostPads.forEach(p => {
      if (Math.hypot(p.x - this.x, p.y - this.y) > padLimit) return;
      const half = t.halfW * 0.17;
      const a = this.project(cam, p.x + Math.cos(p.angle)*half - Math.sin(p.angle)*half,
                                  p.y + Math.sin(p.angle)*half + Math.cos(p.angle)*half, 0);
      const b = this.project(cam, p.x + Math.cos(p.angle)*half + Math.sin(p.angle)*half,
                                  p.y + Math.sin(p.angle)*half - Math.cos(p.angle)*half, 0);
      const c = this.project(cam, p.x - Math.cos(p.angle)*half + Math.sin(p.angle)*half,
                                  p.y - Math.sin(p.angle)*half - Math.cos(p.angle)*half, 0);
      const dd = this.project(cam, p.x - Math.cos(p.angle)*half - Math.sin(p.angle)*half,
                                   p.y - Math.sin(p.angle)*half + Math.cos(p.angle)*half, 0);
      if (!a || !b || !c || !dd) return;
      ctx.fillStyle = 'rgba(76,201,240,0.55)';
      ctx.beginPath();
      ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(dd.x,dd.y);
      ctx.closePath(); ctx.fill();
    });

    // 출발/결승선
    const finish = seen[0];
    if (finish) {
      const cells = 10;
      for (let i = 0; i < cells; i++) {
        const o1 = 1 - (2 * i / cells), o2 = 1 - (2 * (i+1) / cells);
        const p1 = this.edge(cam, finish, o1), p2 = this.edge(cam, finish, o2);
        const ahead = { cx: finish.cx + finish.tx * t.stepLen * 2,
                        cy: finish.cy + finish.ty * t.stepLen * 2,
                        nx: finish.nx, ny: finish.ny };
        const p3 = this.edge(cam, ahead, o2), p4 = this.edge(cam, ahead, o1);
        if (!p1 || !p2 || !p3 || !p4) continue;
        ctx.fillStyle = (i % 2 === 0) ? '#F4F6FA' : '#1A1D24';
        ctx.beginPath();
        ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // ── 입체 물체 (카트 · 아이템 상자 · 바나나) ──
  drawSprites(ctx, W, H, cam, now) {
    const t = this.track;
    const list = [];

    this.track.itemSpots.forEach(sp => {
      if (now < sp.takenUntil) return;
      const p = this.project(cam, sp.x, sp.y, 0);
      if (!p || p.x < -200 || p.x > W + 200) return;
      list.push({ z: p.z, kind: 'box', wx: sp.x, wy: sp.y });
    });

    Object.keys(this.hazards).forEach(id => {
      const h = this.hazards[id];
      const p = this.project(cam, h.x, h.y, 0);
      if (!p || p.x < -200 || p.x > W + 200) return;
      list.push({ z: p.z, kind: 'banana', wx: h.x, wy: h.y });
    });

    Object.keys(this.peers).forEach(id => {
      const pr = this.peers[id];
      pr.x += ((pr.tx !== undefined ? pr.tx : pr.x) - pr.x) * 0.25;
      pr.y += ((pr.ty !== undefined ? pr.ty : pr.y) - pr.y) * 0.25;
      let da = (pr.tangle !== undefined ? pr.tangle : pr.angle) - pr.angle;
      while (da >  Math.PI) da -= Math.PI*2;
      while (da < -Math.PI) da += Math.PI*2;
      pr.angle += da * 0.25;
      const p = this.project(cam, pr.x, pr.y, 0);
      if (!p) return;
      list.push({ z: p.z, kind: 'kart', peer: pr });
    });

    const me = this.project(cam, this.x, this.y, 0);
    if (me) list.push({ z: me.z, kind: 'me' });

    // 가까운 것 위주로 상한을 둠 (30명 + 바나나 다수여도 부담 없게)
    list.sort((a, b) => a.z - b.z);
    const shown = list.slice(0, 26).reverse();   // 가까운 26개만, 먼 것부터 그림
    shown.forEach(o => {
      if (o.kind === 'box')        this.drawBox3D(ctx, cam, o.wx, o.wy, now);
      else if (o.kind === 'banana')this.drawBanana3D(ctx, cam, o.wx, o.wy);
      else if (o.kind === 'kart')  this.drawKart3D(ctx, cam, o.peer.x, o.peer.y, o.peer.angle,
                                     o.peer.finished ? '#565D6E' : '#EF476F', o.peer.name, false,
                                     o.peer.spin, o.peer.shield, o.peer.boost, now);
      else this.drawKart3D(ctx, cam, this.x, this.y, this.angle, '#4CC9F0', this.myName, true,
                           now < this.spinUntil || now < this.stunUntil,
                           now < this.shieldUntil, now < this.boostUntil, now);
    });
  }

  // 세계 좌표 (중심, 각도, 가로/세로, 높이)를 입체 상자로 그림
  boxCorners(cam, cx, cy, angle, len, wid, height) {
    const co = Math.cos(angle), si = Math.sin(angle);
    const pts = [[len/2,-wid/2],[len/2,wid/2],[-len/2,wid/2],[-len/2,-wid/2]];
    const g = [], u = [];
    for (const [dx, dy] of pts) {
      const wx = cx + dx*co - dy*si, wy = cy + dx*si + dy*co;
      const p0 = this.project(cam, wx, wy, 0);
      const p1 = this.project(cam, wx, wy, height);
      if (!p0 || !p1) return null;
      g.push(p0); u.push(p1);
    }
    return { g: g, u: u };
  }

  fillPoly(ctx, pts, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.fill();
  }

  drawKart3D(ctx, cam, x, y, angle, color, name, isMe, spinning, shield, boosting, now) {
    const t = this.track;
    const L = t.carLen, Wd = t.carLen * 0.66, Hh = t.carLen * 0.42;
    const b = this.boxCorners(cam, x, y, angle, L, Wd, Hh);
    if (!b) return;

    // 그림자
    this.fillPoly(ctx, b.g, 'rgba(0,0,0,0.34)');

    // 부스터 불꽃
    if (boosting) {
      const fl = this.boxCorners(cam, x - Math.cos(angle)*L*0.75, y - Math.sin(angle)*L*0.75,
                                 angle, L*0.5, Wd*0.5, Hh*0.5);
      if (fl) this.fillPoly(ctx, fl.u, 'rgba(76,201,240,0.6)');
    }

    // 옆면 4개 (뒤쪽부터)
    const dark = this.shade(color, -0.32), mid = this.shade(color, -0.14);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const face = [b.g[i], b.g[j], b.u[j], b.u[i]];
      this.fillPoly(ctx, face, i === 0 ? mid : dark);
    }
    // 윗면
    this.fillPoly(ctx, b.u, color);
    // 앞유리
    const gw = this.boxCorners(cam, x + Math.cos(angle)*L*0.16, y + Math.sin(angle)*L*0.16,
                               angle, L*0.3, Wd*0.62, Hh * 1.02);
    if (gw) this.fillPoly(ctx, gw.u, 'rgba(255,255,255,0.34)');

    const c = this.project(cam, x, y, Hh);
    if (!c) return;

    if (shield) {
      ctx.strokeStyle = 'rgba(6,214,160,0.85)';
      ctx.lineWidth = Math.max(1.5, 3 * c.s * 12);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, L * 0.85 * c.s, L * 0.42 * c.s, 0, 0, Math.PI*2);
      ctx.stroke();
    }
    if (spinning) {
      ctx.strokeStyle = '#FFD166';
      ctx.lineWidth = Math.max(2, 3.5 * c.s * 12);
      const a0 = now/80 % (Math.PI*2);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, L * 0.8 * c.s, L * 0.4 * c.s, 0, a0, a0 + 2.2);
      ctx.stroke();
    }

    // 이름표 (화면 기준 고정 크기)
    if (name) {
      const fs = Math.max(9, Math.min(15, 3200 * c.s / 100));
      const top = this.project(cam, x, y, Hh * 2.6);
      if (!top) return;
      ctx.font = '700 ' + fs.toFixed(1) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(name).width + fs;
      ctx.fillStyle = isMe ? 'rgba(76,201,240,0.92)' : 'rgba(12,15,22,0.8)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(top.x - tw/2, top.y - fs*1.35, tw, fs*1.5, fs*0.35);
        ctx.fill();
      }
      ctx.fillStyle = isMe ? '#06121A' : '#EAECF2';
      ctx.fillText(name, top.x, top.y - fs*0.2);
    }
  }

  drawBox3D(ctx, cam, x, y, now) {
    const t = this.track;
    const sz = t.carLen * 0.55;
    const bob = Math.sin(now/280 + x*0.01) * sz * 0.16;
    const b = this.boxCorners(cam, x, y, now/650, sz, sz, sz);
    if (!b) return;
    const lift = p => ({ x: p.x, y: p.y - bob, s: p.s });
    const g = b.g.map(lift), u = b.u.map(lift);
    this.fillPoly(ctx, b.g, 'rgba(0,0,0,0.28)');
    for (let i = 0; i < 4; i++) {
      const j = (i+1) % 4;
      this.fillPoly(ctx, [g[i], g[j], u[j], u[i]], i % 2 ? '#C77F12' : '#E39A1C');
    }
    this.fillPoly(ctx, u, '#FFD166');
    const c = this.project(cam, x, y, sz);
    if (c) {
      const fs = Math.max(8, Math.min(26, 2600 * c.s / 100));
      ctx.fillStyle = '#6B4A00';
      ctx.font = 'bold ' + fs.toFixed(1) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', c.x, c.y - bob);
      ctx.textBaseline = 'alphabetic';
    }
  }

  drawBanana3D(ctx, cam, x, y) {
    const t = this.track;
    const r = t.carLen * 0.3;
    const g = this.project(cam, x, y, 0);
    const u = this.project(cam, x, y, r * 0.7);
    if (!g || !u) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y, r*g.s*1.1, r*g.s*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFD166';
    ctx.beginPath(); ctx.ellipse(u.x, u.y, r*u.s*1.1, r*u.s*0.62, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#8A6D1F'; ctx.lineWidth = Math.max(1, 2*u.s*12); ctx.stroke();
  }

  // 색 보조
  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, Math.round(v)));
    const r = cl(((n >> 16) & 255) * (1 + amt));
    const g = cl(((n >> 8) & 255) * (1 + amt));
    const b = cl((n & 255) * (1 + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  lighten(hex, amt) { return this.shade(hex, amt); }

  drawSpeedLines(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(76,201,240,0.32)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const a = (i/16) * Math.PI*2 + performance.now()/380;
      const r1 = Math.min(W,H)*0.4, r2 = Math.min(W,H)*0.78;
      ctx.beginPath();
      ctx.moveTo(W/2 + Math.cos(a)*r1, H*0.55 + Math.sin(a)*r1);
      ctx.lineTo(W/2 + Math.cos(a)*r2, H*0.55 + Math.sin(a)*r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMinimap(ctx, W, H) {
    const t = this.track, c = t.center, b = t.bounds;
    const size = Math.min(112, W*0.29), pad = 12;
    const sc = (size-18) / Math.max(b.maxX-b.minX, b.maxY-b.minY);
    const ox = W - size - pad, oy = pad + 46;
    const mx = v => ox + 9 + (v - b.minX)*sc;
    const my = v => oy + 9 + (v - b.minY)*sc;

    ctx.save();
    ctx.fillStyle = 'rgba(10,13,20,0.78)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(ox, oy, size, size, 14); else ctx.rect(ox, oy, size, size);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 4.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(mx(c[0][0]), my(c[0][1]));
    for (let i = 4; i < c.length; i += 4) ctx.lineTo(mx(c[i][0]), my(c[i][1]));
    ctx.closePath(); ctx.stroke();
    // 결승선
    ctx.strokeStyle = '#F4F6FA'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(mx(c[0][0]), my(c[0][1]), 4, 0, Math.PI*2); ctx.stroke();

    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      ctx.fillStyle = p.finished ? '#565D6E' : '#EF476F';
      ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), 3.4, 0, Math.PI*2); ctx.fill();
    });
    ctx.fillStyle = '#4CC9F0';
    ctx.beginPath(); ctx.arc(mx(this.x), my(this.y), 4.8, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  drawCanvasOverlay(ctx, W, H, now) {
    // 다음 코너 방향
    if (this.cornerHint && this.countdown <= 0 && !this.finished) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(now/220)*0.25;
      ctx.fillStyle = '#FFD166';
      const cx = this.cornerHint > 0 ? W - 46 : 46, cy = H*0.42;
      ctx.beginPath();
      const s = this.cornerHint;
      ctx.moveTo(cx + 16*s, cy); ctx.lineTo(cx - 12*s, cy - 22); ctx.lineTo(cx - 12*s, cy + 22);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // 역주행 경고
    if (this.wrongWay) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(now/140)*0.4;
      ctx.fillStyle = '#EF476F';
      ctx.font = '800 26px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ 역주행', W/2, H*0.3);
      ctx.font = '600 14px Pretendard, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('화살표 방향으로 달리세요', W/2, H*0.3 + 24);
      ctx.restore();
    }

    // 카운트다운
    if (this.countdown > 0) {
      const n = Math.ceil(this.countdown);
      const label = n > 3 ? '준비' : (n === 0 ? 'GO!' : String(n));
      const frac = this.countdown - Math.floor(this.countdown);
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,16,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W/2, H/2);
      ctx.scale(1 + (1-frac)*0.25, 1 + (1-frac)*0.25);
      ctx.fillStyle = n <= 1 ? '#4ADE80' : '#FFD166';
      ctx.font = '800 92px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // 안내 문구
    if (this.toast && now < this.toast.until) {
      ctx.save();
      ctx.font = '700 15px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(this.toast.text).width + 32;
      ctx.fillStyle = 'rgba(8,10,16,0.85)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W/2-w/2, H-104, w, 36, 18); ctx.fill(); }
      ctx.fillStyle = this.toast.color;
      ctx.fillText(this.toast.text, W/2, H-80);
      ctx.restore();
    }
  }
}
