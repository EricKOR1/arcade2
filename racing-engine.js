// 카트 레이싱 엔진 — 여러 명이 같은 트랙에서 동시에 달리는 실시간 멀티플레이

// ─────────── 트랙 정의 ───────────
const TRACKS = {
  meadow: {
    name: '초원 서킷',
    desc: '넓고 완만한 코스. 처음 하는 학생에게 좋아요',
    width: 260, laps: 3, bg: '#1B2A22', road: '#31363F',
    pts: [
      [400, 900], [400, 500], [700, 260], [1200, 220], [1700, 300],
      [2000, 600], [2050, 1000], [1850, 1350], [1400, 1480], [900, 1420],
      [520, 1250]
    ]
  },
  figure8: {
    name: '교차로 코스',
    desc: '8자로 꼬인 코스. 코너가 많아 역전이 자주 나요',
    width: 240, laps: 3, bg: '#232033', road: '#343846',
    pts: [
      [500, 400], [1000, 300], [1500, 500], [1800, 900], [1500, 1250],
      [1000, 1350], [600, 1150], [500, 800], [900, 700], [1400, 800],
      [1600, 1100], [1200, 1250], [800, 1150], [600, 800]
    ]
  },
  canyon: {
    name: '협곡 레이스',
    desc: '길고 좁은 고난도 코스. 실력자용',
    width: 210, laps: 3, bg: '#2A2018', road: '#3A3A42',
    pts: [
      [350, 800], [500, 400], [900, 250], [1300, 380], [1500, 700],
      [1850, 780], [2150, 550], [2400, 800], [2300, 1200], [1900, 1400],
      [1500, 1250], [1150, 1400], [750, 1350], [400, 1150]
    ]
  }
};

// 웨이포인트를 부드러운 곡선으로 촘촘하게 변환 (Catmull-Rom)
function densify(pts, per) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let t = 0; t < per; t++) {
      const s = t / per, s2 = s * s, s3 = s2 * s;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)
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

    // 진행 방향(접선) 미리 계산
    this.tangent = this.center.map((p, i) => {
      const q = this.center[(i + 1) % this.n];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    });

    // 아이템 상자 위치 — 트랙을 따라 일정 간격, 좌/중/우 3줄
    this.itemSpots = [];
    for (let i = 20; i < this.n; i += Math.floor(this.n / 9)) {
      const [tx, ty] = this.tangent[i];
      const nx = -ty, ny = tx;
      [-0.5, 0, 0.5].forEach(off => {
        this.itemSpots.push({
          x: this.center[i][0] + nx * this.halfW * off,
          y: this.center[i][1] + ny * this.halfW * off,
          takenUntil: 0
        });
      });
    }
  }

  // 시작 그리드 위치 (출발선 뒤쪽에 지그재그 배치)
  startPos(slot) {
    const back = 26 + Math.floor(slot / 2) * 34;
    let i = (this.n - Math.round(back / 6)) % this.n;
    if (i < 0) i += this.n;
    const [tx, ty] = this.tangent[i];
    const nx = -ty, ny = tx;
    const side = (slot % 2 === 0) ? -0.38 : 0.38;
    return {
      x: this.center[i][0] + nx * this.halfW * side,
      y: this.center[i][1] + ny * this.halfW * side,
      angle: Math.atan2(ty, tx),
      index: i
    };
  }

  // 현재 위치에서 가장 가까운 중앙선 인덱스 (직전 위치 주변만 탐색)
  nearestIndex(x, y, hint) {
    let best = hint || 0, bestD = Infinity;
    const span = hint === undefined ? this.n : 60;
    for (let k = -span; k <= span; k++) {
      const i = ((hint || 0) + k + this.n * 2) % this.n;
      const dx = this.center[i][0] - x, dy = this.center[i][1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { index: best, dist: Math.sqrt(bestD) };
  }
}

// ─────────── 아이템 ───────────
const ITEMS = {
  banana: { name: '바나나', icon: '🍌', color: '#FFD166' },
  boost:  { name: '부스터', icon: '⚡', color: '#4CC9F0' },
  bolt:   { name: '번개',   icon: '🌩', color: '#B15DFF' }
};

// 뒤처진 사람일수록 좋은 아이템이 나오도록
function rollItem(rankRatio) {
  const r = Math.random();
  if (rankRatio > 0.6) {            // 하위권
    if (r < 0.35) return 'bolt';
    if (r < 0.75) return 'boost';
    return 'banana';
  }
  if (r < 0.5) return 'banana';
  if (r < 0.9) return 'boost';
  return 'bolt';
}

// ─────────── 게임 본체 ───────────
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
    this.segIdx = st.index;
    this.lap = 0;
    this.progress = 0;
    this.speed = 0;
    this.steer = 0;

    this.maxSpeed = 5.4;
    this.item = null;
    this.spinUntil = 0;
    this.boostUntil = 0;
    this.slowUntil = 0;
    this.finished = false;
    this.finishRank = null;
    this.rank = 1;
    this.total = 1;
    this.gameOver = false;
    this.score = 0;

    this.peers = {};       // 다른 플레이어 (보간용)
    this.hazards = {};     // 바나나 등
    this.lastTime = 0;
    this.camX = this.x; this.camY = this.y;
    this.countdown = 3.2;  // 출발 카운트다운(초)
    this.toast = null;
  }

  resize() { /* 캔버스 크기는 매 프레임 읽어서 대응 */ }

  // ── 조작 ──
  move(dir) { this.steer = dir; }
  releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }

  useItem() {
    if (!this.item || this.finished || this.countdown > 0) return;
    const it = this.item;
    this.item = null;
    if (it === 'boost') {
      this.boostUntil = performance.now() + 2000;
      if (window.Sound) Sound.boost();
      this.showToast('부스터!');
    } else if (it === 'banana') {
      const bx = this.x - Math.cos(this.angle) * 46;
      const by = this.y - Math.sin(this.angle) * 46;
      if (this.opts.onDropHazard) this.opts.onDropHazard(bx, by);
      if (window.Sound) Sound.pass();
      this.showToast('바나나 투척!');
    } else if (it === 'bolt') {
      if (this.opts.onBolt) this.opts.onBolt(this.progress);
      if (window.Sound) Sound.levelUp();
      this.showToast('번개! 앞선 주자 감속');
    }
  }

  // 테트리스와 버튼 이름을 공유하기 위한 별칭
  rotate() { this.useItem(); }
  hardDrop() { this.useItem(); }
  softDrop() {}

  showToast(text) { this.toast = { text: text, until: performance.now() + 1400 }; }

  hitByBolt() {
    if (this.finished) return;
    this.slowUntil = performance.now() + 1600;
    if (window.Sound) Sound.crash();
    this.showToast('번개에 맞았다!');
  }

  spinOut() {
    if (performance.now() < this.spinUntil || this.finished) return;
    this.spinUntil = performance.now() + 1200;
    this.speed *= 0.25;
    if (window.Sound) Sound.crash();
    this.showToast('미끄러졌다!');
  }

  setPeers(map) { 
    Object.keys(map).forEach(id => {
      const d = map[id];
      if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle, name: d.name, lap: d.lap, progress: d.progress, spin: d.spin, finished: d.finished };
      const p = this.peers[id];
      p.tx = d.x; p.ty = d.y; p.tangle = d.angle;
      p.name = d.name; p.lap = d.lap; p.progress = d.progress;
      p.spin = d.spin; p.finished = d.finished;
    });
    Object.keys(this.peers).forEach(id => { if (!map[id]) delete this.peers[id]; });
  }

  setHazards(list) { this.hazards = list; }

  // 서버로 보낼 압축 문자열
  serialize() {
    return [
      Math.round(this.x), Math.round(this.y), this.angle.toFixed(2),
      this.lap, Math.round(this.progress),
      (performance.now() < this.spinUntil) ? 1 : 0,
      this.finished ? 1 : 0
    ].join(',');
  }

  // ── 매 프레임 ──
  tick(now) {
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7;
    this.lastTime = now;
    const f = dt / 16.7;

    if (this.countdown > 0) {
      this.countdown -= dt / 1000;
      this.draw();
      return;
    }

    if (!this.finished) this.updateCar(now, f);
    this.updateRank();
    this.draw();
  }

  updateCar(now, f) {
    const spinning = now < this.spinUntil;
    const boosting = now < this.boostUntil;
    const slowed = now < this.slowUntil;

    // 코스 이탈 판정
    const near = this.track.nearestIndex(this.x, this.y, this.segIdx);
    const offroad = near.dist > this.track.halfW;

    let target = this.maxSpeed;
    if (boosting) target *= 1.85;
    if (offroad) target *= 0.42;
    if (slowed) target *= 0.45;
    if (spinning) target = 0.6;

    this.speed += (target - this.speed) * 0.055 * f;

    // 조향 (속도가 붙을수록 잘 돎)
    if (spinning) {
      this.angle += 0.32 * f;
    } else {
      const grip = Math.min(1, this.speed / 3);
      this.angle += this.steer * 0.052 * grip * f;
    }

    this.x += Math.cos(this.angle) * this.speed * f;
    this.y += Math.sin(this.angle) * this.speed * f;

    // 진행도 계산 (역주행/지름길 방지)
    const cur = this.track.nearestIndex(this.x, this.y, this.segIdx);
    const n = this.track.n;
    let delta = cur.index - this.segIdx;
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    if (Math.abs(delta) < n / 4) {
      if (this.segIdx + delta >= n) this.lap++;
      if (this.segIdx + delta < 0) this.lap--;
      this.segIdx = cur.index;
    }
    this.progress = this.lap * n + this.segIdx;
    this.score = Math.max(0, Math.round(this.progress / 4));

    // 아이템 상자
    this.track.itemSpots.forEach(spot => {
      if (now < spot.takenUntil) return;
      if (Math.hypot(spot.x - this.x, spot.y - this.y) < 34) {
        spot.takenUntil = now + 5000;
        if (!this.item) {
          this.item = rollItem(this.total > 1 ? (this.rank - 1) / (this.total - 1) : 0);
          if (window.Sound) Sound.clear(1);
          this.showToast(ITEMS[this.item].name + ' 획득!');
        }
      }
    });

    // 바나나 충돌
    Object.keys(this.hazards).forEach(hid => {
      const h = this.hazards[hid];
      if (Math.hypot(h.x - this.x, h.y - this.y) < 30) {
        if (this.opts.onHitHazard) this.opts.onHitHazard(hid);
        this.spinOut();
      }
    });

    // 완주 판정
    if (this.lap >= this.track.laps && !this.finished) {
      this.finished = true;
      this.speed *= 0.4;
      if (this.opts.onFinish) this.opts.onFinish();
      if (window.Sound) Sound.levelUp();
    }
  }

  updateRank() {
    const all = [{ progress: this.progress, me: true }];
    Object.keys(this.peers).forEach(id => all.push({ progress: this.peers[id].progress || 0 }));
    all.sort((a, b) => b.progress - a.progress);
    this.total = all.length;
    this.rank = all.findIndex(p => p.me) + 1;
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;
    const t = this.track;

    // 카메라 (부드럽게 따라감)
    this.camX += (this.x - this.camX) * 0.18;
    this.camY += (this.y - this.camY) * 0.18;
    const zoom = Math.min(1.15, Math.max(0.55, H / 780));

    ctx.save();
    ctx.fillStyle = t.def.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate(-this.angle - Math.PI / 2);   // 진행 방향이 항상 위쪽
    ctx.translate(-this.camX, -this.camY);

    this.drawTrack(ctx);
    this.drawItemBoxes(ctx);
    this.drawHazards(ctx);
    this.drawPeers(ctx);
    this.drawKart(ctx, this.x, this.y, this.angle, '#4CC9F0', this.myName, true,
                  performance.now() < this.spinUntil);
    ctx.restore();

    this.drawMinimap(ctx, W, H);
    this.drawOverlay(ctx, W, H);
  }

  drawTrack(ctx) {
    const t = this.track, c = t.center;
    // 노면
    ctx.strokeStyle = t.def.road;
    ctx.lineWidth = t.def.width;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c[0][0], c[0][1]);
    for (let i = 1; i < c.length; i++) ctx.lineTo(c[i][0], c[i][1]);
    ctx.closePath();
    ctx.stroke();

    // 가장자리 라인
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = t.def.width - 10;
    ctx.stroke();
    ctx.strokeStyle = t.def.road;
    ctx.lineWidth = t.def.width - 18;
    ctx.stroke();

    // 중앙 점선
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 26]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 출발/결승선
    const [tx, ty] = t.tangent[0];
    const nx = -ty, ny = tx;
    const sx = c[0][0], sy = c[0][1];
    const cells = 8, cw = t.def.width / cells;
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < cells; i++) {
        ctx.fillStyle = ((i + r) % 2 === 0) ? '#F2F4F8' : '#2A2F3D';
        const off = -t.halfW + i * cw;
        const px = sx + nx * off + tx * (r * 15);
        const py = sy + ny * off + ty * (r * 15);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2(ty, tx));
        ctx.fillRect(0, 0, 15, cw);
        ctx.restore();
      }
    }
  }

  drawItemBoxes(ctx) {
    const now = performance.now();
    const wob = Math.sin(now / 260) * 3;
    this.track.itemSpots.forEach(s => {
      if (now < s.takenUntil) return;
      ctx.save();
      ctx.translate(s.x, s.y + wob);
      ctx.rotate(now / 700);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.92)';
      ctx.strokeStyle = '#FFF3C4'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-15, -15, 30, 30, 7) : ctx.rect(-15, -15, 30, 30);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7A5A00';
      ctx.font = 'bold 17px sans-serif';
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
      ctx.fillStyle = '#FFD166';
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 8, Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8A6D1F'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  }

  drawPeers(ctx) {
    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      // 위치 보간 (통신 간격을 부드럽게 메움)
      p.x += ((p.tx !== undefined ? p.tx : p.x) - p.x) * 0.25;
      p.y += ((p.ty !== undefined ? p.ty : p.y) - p.y) * 0.25;
      let da = (p.tangle !== undefined ? p.tangle : p.angle) - p.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      p.angle += da * 0.25;
      this.drawKart(ctx, p.x, p.y, p.angle, p.finished ? '#565D6E' : '#EF476F', p.name, false, p.spin);
    });
  }

  drawKart(ctx, x, y, angle, color, name, isMe, spinning) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 바퀴
    ctx.fillStyle = '#15171D';
    ctx.fillRect(-13, -15, 11, 8);
    ctx.fillRect(-13, 7, 11, 8);
    ctx.fillRect(8, -15, 11, 8);
    ctx.fillRect(8, 7, 11, 8);

    // 차체
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-19, -12, 38, 24, 7); else ctx.rect(-19, -12, 38, 24);
    ctx.fill();

    // 앞유리
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(4, -8, 11, 16, 4); else ctx.rect(4, -8, 11, 16);
    ctx.fill();

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-19, -12, 38, 24, 7); else ctx.rect(-19, -12, 38, 24);
      ctx.stroke();
    }
    if (spinning) {
      ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26, performance.now() / 90 % (Math.PI * 2), performance.now() / 90 % (Math.PI * 2) + 2.2);
      ctx.stroke();
    }
    ctx.restore();

    // 이름표 (화면 기준으로 똑바로)
    if (name) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.angle + Math.PI / 2);
      ctx.font = '600 13px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(name).width + 12;
      ctx.fillStyle = 'rgba(10,12,18,0.72)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-w / 2, -46, w, 20, 6); ctx.fill(); }
      ctx.fillStyle = isMe ? '#4CC9F0' : '#EAECF2';
      ctx.fillText(name, 0, -32);
      ctx.restore();
    }
  }

  drawMinimap(ctx, W, H) {
    const t = this.track, c = t.center;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    c.forEach(p => {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    });
    const size = Math.min(108, W * 0.28);
    const pad = 12;
    const sc = (size - 16) / Math.max(maxX - minX, maxY - minY);
    const ox = W - size - pad, oy = pad;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(ox, oy, size, size, 12); else ctx.rect(ox, oy, size, size);
    ctx.fill();

    const mx = v => ox + 8 + (v - minX) * sc;
    const my = v => oy + 8 + (v - minY) * sc;

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(mx(c[0][0]), my(c[0][1]));
    for (let i = 4; i < c.length; i += 4) ctx.lineTo(mx(c[i][0]), my(c[i][1]));
    ctx.closePath(); ctx.stroke();

    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      ctx.fillStyle = '#EF476F';
      ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#4CC9F0';
    ctx.beginPath(); ctx.arc(mx(this.x), my(this.y), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawOverlay(ctx, W, H) {
    const now = performance.now();

    // 출발 카운트다운
    if (this.countdown > 0) {
      const n = Math.ceil(this.countdown);
      ctx.save();
      ctx.fillStyle = 'rgba(10,12,18,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '700 84px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n > 3 ? '준비' : (n === 0 ? 'GO!' : String(n)), W / 2, H / 2);
      ctx.restore();
    }

    // 안내 문구
    if (this.toast && now < this.toast.until) {
      ctx.save();
      ctx.font = '600 15px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(this.toast.text).width + 28;
      ctx.fillStyle = 'rgba(10,12,18,0.8)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, H - 76, w, 34, 17); ctx.fill(); }
      ctx.fillStyle = '#FFD166';
      ctx.fillText(this.toast.text, W / 2, H - 54);
      ctx.restore();
    }

    // 완주
    if (this.finished) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,12,18,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '700 22px Pretendard, sans-serif';
      ctx.fillText('완주!', W / 2, H / 2 - 18);
      ctx.font = '700 54px Pretendard, sans-serif';
      ctx.fillStyle = '#FFD166';
      ctx.fillText((this.finishRank || '-') + '등', W / 2, H / 2 + 40);
      ctx.restore();
    }
  }
}
