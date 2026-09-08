// 카트 레이싱 엔진 — 실시간 멀티플레이, 트랙 벽 충돌, 아이템 6종

// ─────────── 트랙 ───────────
const TRACKS = {
  meadow: {
    name: '초원 서킷', desc: '넓고 완만한 코스. 처음 하는 학생에게 좋아요',
    width: 300, laps: 3,
    bg: '#16261C', grass: '#1E3427', road: '#33383F',
    pts: [[400,900],[400,500],[700,260],[1200,220],[1700,300],
          [2000,600],[2050,1000],[1850,1350],[1400,1480],[900,1420],[520,1250]]
  },
  figure8: {
    name: '교차로 코스', desc: '8자로 꼬인 코스. 코너가 많아 역전이 자주 나요',
    width: 270, laps: 3,
    bg: '#1D1A2B', grass: '#272338', road: '#35394A',
    pts: [[500,400],[1000,300],[1500,500],[1800,900],[1500,1250],
          [1000,1350],[600,1150],[500,800],[900,700],[1400,800],
          [1600,1100],[1200,1250],[800,1150],[600,800]]
  },
  canyon: {
    name: '협곡 레이스', desc: '좁고 긴 고난도 코스. 실력자용',
    width: 240, laps: 3,
    bg: '#241A12', grass: '#33251A', road: '#3B3B44',
    pts: [[350,800],[500,400],[900,250],[1300,380],[1500,700],
          [1850,780],[2150,550],[2400,800],[2300,1200],[1900,1400],
          [1500,1250],[1150,1400],[750,1350],[400,1150]]
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
    this.center = densify(def.pts, 16);
    this.n = this.center.length;
    this.halfW = def.width / 2;
    this.laps = def.laps;

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

    // 아이템 상자 (3줄)
    this.itemSpots = [];
    const gap = Math.floor(this.n / 9);
    for (let i = 24; i < this.n; i += gap) {
      const [tx, ty] = this.tangent[i], nx = -ty, ny = tx;
      [-0.5, 0, 0.5].forEach(off => this.itemSpots.push({
        x: this.center[i][0] + nx*this.halfW*off,
        y: this.center[i][1] + ny*this.halfW*off,
        takenUntil: 0
      }));
    }

    // 부스터 패드 — 구간마다 가장 곧은 지점을 골라 배치
    this.boostPads = [];
    const seg = Math.floor(this.n / 5);
    for (let s = 0; s < 5; s++) {
      let best = s*seg, bestC = Infinity;
      for (let k = 0; k < seg; k++) {
        const i = (s*seg + k) % this.n;
        const c = Math.abs(this.curve[i]);
        if (c < bestC) { bestC = c; best = i; }
      }
      const [tx, ty] = this.tangent[best], nx = -ty, ny = tx;
      const side = (s % 2 === 0) ? 0.34 : -0.34;
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

  startPos(slot) {
    const back = 30 + Math.floor(slot/2) * 38;
    let i = (this.n - Math.round(back/6)) % this.n;
    if (i < 0) i += this.n;
    const [tx, ty] = this.tangent[i], nx = -ty, ny = tx;
    const side = (slot % 2 === 0) ? -0.4 : 0.4;
    return {
      x: this.center[i][0] + nx*this.halfW*side,
      y: this.center[i][1] + ny*this.halfW*side,
      angle: Math.atan2(ty, tx), index: i
    };
  }

  nearestIndex(x, y, hint) {
    let best = hint || 0, bestD = Infinity;
    const span = (hint === undefined) ? this.n : 60;
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
    const w = Math.ceil((b.maxX - b.minX + pad*2) * scale);
    const h = Math.ceil((b.maxY - b.minY + pad*2) * scale);
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

    // 연석 흰 줄무늬
    for (let i = 0; i < this.n; i += 6) {
      if ((i / 6) % 2 !== 0) continue;
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

    // 진행 방향 화살표 (노면에 새김)
    for (let i = 8; i < this.n; i += 22) {
      const [tx, ty] = this.tangent[i];
      g.save();
      g.translate(c[i][0], c[i][1]);
      g.rotate(Math.atan2(ty, tx));
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.beginPath();
      g.moveTo(26, 0); g.lineTo(-12, -22); g.lineTo(-3, 0); g.lineTo(-12, 22);
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

    this.maxSpeed = 5.6;
    this.item = null;
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

  resize() { this.track.sprite = null; }

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
    if (!this.item || this.finished || this.countdown > 0) return;
    const it = this.item;
    this.item = null;
    const now = performance.now();

    if (it === 'boost') {
      this.boostUntil = now + 2200;
      this.addFx('boost');
      if (window.Sound) Sound.boost();
      this.showToast('부스터!', '#4CC9F0');

    } else if (it === 'banana') {
      const bx = this.x - Math.cos(this.angle)*52;
      const by = this.y - Math.sin(this.angle)*52;
      if (this.opts.onDropHazard) this.opts.onDropHazard(bx, by);
      if (window.Sound) Sound.pass();
      this.showToast('바나나를 놓았다', '#FFD166');

    } else if (it === 'shield') {
      this.shieldUntil = now + 8000;
      if (window.Sound) Sound.levelUp();
      this.showToast('방어막 8초', '#06D6A0');

    } else if (it === 'missile') {
      const target = this.nextAhead();
      if (!target) { this.showToast('앞에 아무도 없다', '#9AA3B2'); return; }
      if (this.opts.onAttack) this.opts.onAttack('missile', target, null);
      this.addFx('missile');
      if (window.Sound) Sound.hardDrop();
      this.showToast('미사일 발사!', '#EF476F');

    } else if (it === 'swap') {
      const target = this.nextAhead();
      if (!target) { this.showToast('앞에 아무도 없다', '#9AA3B2'); return; }
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
      this.item = this.pendingItem;
      this.pendingItem = null; this.itemRollUntil = 0;
      if (window.Sound) Sound.clear(1);
      this.showToast(ITEMS[this.item].name + ' 획득!', '#FFD166');
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
    else if (!stunned) this.angle += this.steer * 0.054 * Math.min(1, this.speed/3) * f;

    this.x += Math.cos(this.angle) * this.speed * f;
    this.y += Math.sin(this.angle) * this.speed * f;

    // ── 트랙 벽: 밖으로 못 나감 ──
    const near = this.track.nearestIndex(this.x, this.y, this.segIdx);
    const limit = this.track.halfW - 18;
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
      if (Math.hypot(p.x - this.x, p.y - this.y) < 40 && now > this.boostUntil - 400) {
        this.boostUntil = now + 1300;
        this.addFx('boost');
      }
    });

    // 아이템 상자
    this.track.itemSpots.forEach(s => {
      if (now < s.takenUntil) return;
      if (Math.hypot(s.x - this.x, s.y - this.y) < 36) {
        s.takenUntil = now + 5000;
        if (!this.item && !this.itemRollUntil) {
          this.pendingItem = rollItem(this.total > 1 ? (this.rank-1)/(this.total-1) : 0);
          this.itemRollUntil = now + 750;   // 룰렛 연출
        }
      }
    });

    // 바나나
    Object.keys(this.hazards).forEach(hid => {
      const h = this.hazards[hid];
      if (Math.hypot(h.x - this.x, h.y - this.y) < 32) {
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
      item: this.item, rolling: now < this.itemRollUntil,
      shield: now < this.shieldUntil,
      boost: now < this.boostUntil,
      wrongWay: this.wrongWay, corner: this.cornerHint,
      countdown: this.countdown, finished: this.finished, finishRank: this.finishRank
    };
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;
    const t = this.track;
    const now = performance.now();

    if (!t.sprite) t.buildSprite(0.62);

    this.camX += (this.x - this.camX) * 0.2;
    this.camY += (this.y - this.camY) * 0.2;
    const zoom = Math.min(1.2, Math.max(0.6, H/760));

    ctx.save();
    ctx.fillStyle = t.def.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.translate(W/2, H*0.62);           // 시야를 앞쪽으로
    ctx.scale(zoom, zoom);
    ctx.rotate(-this.angle - Math.PI/2);  // 진행 방향이 항상 위
    ctx.translate(-this.camX, -this.camY);

    const sp = t.sprite;
    ctx.drawImage(sp.canvas, sp.x, sp.y, sp.w, sp.h);

    this.drawItemBoxes(ctx, now);
    this.drawHazards(ctx);
    this.drawPeers(ctx);
    this.drawKart(ctx, this.x, this.y, this.angle, '#4CC9F0', this.myName, true,
                  now < this.spinUntil || now < this.stunUntil, now < this.shieldUntil, now < this.boostUntil);
    ctx.restore();

    if (now < this.boostUntil) this.drawSpeedLines(ctx, W, H);
    this.drawMinimap(ctx, W, H);
    this.drawCanvasOverlay(ctx, W, H, now);
  }

  drawSpeedLines(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(76,201,240,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const a = (i/14) * Math.PI*2 + performance.now()/400;
      const r1 = Math.min(W,H)*0.42, r2 = Math.min(W,H)*0.72;
      ctx.beginPath();
      ctx.moveTo(W/2 + Math.cos(a)*r1, H/2 + Math.sin(a)*r1);
      ctx.lineTo(W/2 + Math.cos(a)*r2, H/2 + Math.sin(a)*r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawItemBoxes(ctx, now) {
    const wob = Math.sin(now/260)*4;
    this.track.itemSpots.forEach(s => {
      if (now < s.takenUntil) return;
      ctx.save();
      ctx.translate(s.x, s.y + wob);
      ctx.rotate(now/650);
      const grd = ctx.createLinearGradient(-17,-17,17,17);
      grd.addColorStop(0, '#FFE9A3'); grd.addColorStop(1, '#F5A524');
      ctx.fillStyle = grd;
      ctx.strokeStyle = '#FFF6D8'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-17,-17,34,34,8); else ctx.rect(-17,-17,34,34);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6B4A00';
      ctx.font = 'bold 19px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 1);
      ctx.restore();
    });
  }

  drawHazards(ctx) {
    Object.keys(this.hazards).forEach(id => {
      const h = this.hazards[id];
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 5, 14, 7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#FFD166';
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, Math.PI/5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#8A6D1F'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    });
  }

  drawPeers(ctx) {
    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      p.x += ((p.tx !== undefined ? p.tx : p.x) - p.x) * 0.25;
      p.y += ((p.ty !== undefined ? p.ty : p.y) - p.y) * 0.25;
      let da = (p.tangle !== undefined ? p.tangle : p.angle) - p.angle;
      while (da >  Math.PI) da -= Math.PI*2;
      while (da < -Math.PI) da += Math.PI*2;
      p.angle += da * 0.25;
      this.drawKart(ctx, p.x, p.y, p.angle, p.finished ? '#565D6E' : '#EF476F',
                    p.name, false, p.spin, p.shield, p.boost);
    });
  }

  drawKart(ctx, x, y, angle, color, name, isMe, spinning, shield, boosting) {
    const now = performance.now();
    ctx.save();
    ctx.translate(x, y);

    if (boosting) {
      ctx.save(); ctx.rotate(angle);
      ctx.fillStyle = 'rgba(76,201,240,0.55)';
      ctx.beginPath();
      ctx.moveTo(-20, -9); ctx.lineTo(-20, 9);
      ctx.lineTo(-44 - Math.random()*14, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(0, 6, 21, 13, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#12151B';
    ctx.fillRect(-14,-16,12,9); ctx.fillRect(-14,8,12,9);
    ctx.fillRect(8,-16,12,9);   ctx.fillRect(8,8,12,9);

    const grd = ctx.createLinearGradient(0,-13,0,13);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-20,-13,40,26,8); else ctx.rect(-20,-13,40,26);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(4,-9,12,18,4); else ctx.rect(4,-9,12,18);
    ctx.fill();

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-20,-13,40,26,8); else ctx.rect(-20,-13,40,26);
      ctx.stroke();
    }
    ctx.restore();

    if (shield) {
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = 'rgba(6,214,160,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 29 + Math.sin(now/180)*2, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    if (spinning) {
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 3.5;
      const a0 = now/80 % (Math.PI*2);
      ctx.beginPath(); ctx.arc(0, 0, 27, a0, a0 + 2.2); ctx.stroke();
      ctx.restore();
    }

    if (name) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.angle + Math.PI/2);
      ctx.font = '700 13px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(name).width + 14;
      ctx.fillStyle = isMe ? 'rgba(76,201,240,0.9)' : 'rgba(12,15,22,0.78)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-w/2, -50, w, 21, 7); ctx.fill(); }
      ctx.fillStyle = isMe ? '#06121A' : '#EAECF2';
      ctx.fillText(name, 0, -35);
      ctx.restore();
    }
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
      ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), 3.2, 0, Math.PI*2); ctx.fill();
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
