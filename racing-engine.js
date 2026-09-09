// 카트 레이싱 엔진 — 실시간 멀티플레이, 트랙 벽 충돌, 아이템 6종

// ─────────── 트랙 ───────────
/* 지물이 도로 가장자리에서 얼마나 떨어지는지 (반폭 배수: 기본, 흔들림) */
const DECO_OFFSET = {
  tree: [1.5, 1.6], pine: [1.4, 1.6], palm: [1.45, 1.2], cactus: [1.35, 1.0], rock: [1.3, 1.4],
  flower: [1.18, 0.4], tire: [1.2, 0.05], sign: [1.42, 0.1], billboard: [1.6, 0.2], stand: [2.0, 0.1],
  building: [1.9, 1.2], lamp: [1.14, 0.02], balloon: [1.6, 1.0], umbrella: [1.5, 0.6],
  snowman: [1.4, 0.5], windmill: [2.2, 1.2]
};

/* ─────────── 트랙 테마 ───────────
   far      : 원경 종류 (hills 언덕 · city 도시 · mesa 사막 바위 · ocean 바다 · peaks 설산)
   deco     : 노변 지물 종류와 비율
   particles: 화면에 흩날리는 것 (petal 꽃잎 · dust 모래 · snow 눈 · spark 반딧불 · null)
   kerb     : 연석 두 색
   arch     : 코스 중간 아치 문구 */
const THEMES = {
  meadow: { far: 'hills', particles: 'petal', kerb: ['#E8ECF2', '#D94A4A'], lampGlow: false,
            deco: [['tree', .40], ['flower', .18], ['balloon', .10], ['sign', .10], ['tire', .10], ['stand', .12]],
            arch: ['SECTOR 2', 'SECTOR 3', 'FINAL'] },
  city:   { far: 'city', particles: 'spark', kerb: ['#F2F4F8', '#4CC9F0'], lampGlow: true,
            deco: [['building', .42], ['lamp', .28], ['billboard', .18], ['stand', .12]],
            arch: ['DOWNTOWN', 'HARBOR', 'FINAL'] },
  desert: { far: 'mesa', particles: 'dust', kerb: ['#F2E6C8', '#D9772E'], lampGlow: false,
            deco: [['cactus', .34], ['rock', .30], ['windmill', .12], ['sign', .12], ['tire', .12]],
            arch: ['CANYON', 'OASIS', 'FINAL'] },
  coast:  { far: 'ocean', particles: null, kerb: ['#FFFFFF', '#FF5C7A'], lampGlow: false,
            deco: [['palm', .40], ['umbrella', .18], ['stand', .18], ['sign', .12], ['balloon', .12]],
            arch: ['MARINA', 'BEACH', 'FINAL'] },
  alpine: { far: 'peaks', particles: 'snow', kerb: ['#F4F6FA', '#3B82F6'], lampGlow: false,
            deco: [['pine', .48], ['rock', .16], ['snowman', .10], ['sign', .10], ['stand', .16]],
            arch: ['SUMMIT', 'GLACIER', 'FINAL'] }
};

const TRACKS = {
  meadow: {
    name: '초원 서킷', theme: 'meadow',
    sky: { top: '#1E3A5F', mid: '#4E8FC7', low: '#BFE0F5', sun: '#FFF3C4', stars: 0, haze: '#A9CDE8' },
    elev: [[0,0],[0.18,220],[0.36,60],[0.55,300],[0.74,-80],[0.9,90]], desc: '넓고 완만한 코스. 처음 하는 학생에게 좋아요',
    tag: '입문 · 10~20명',
    scale: 3, width: 560, laps: 3, speed: 11.2,
    bg: '#16261C', grass: '#1E3427', road: '#33383F',
    pts: [[400,900],[400,500],[700,260],[1200,220],[1700,300],
          [2000,600],[2050,1000],[1850,1350],[1400,1480],[900,1420],[520,1250]]
  },
  figure8: {
    name: '교차로 코스', theme: 'city',
    sky: { top: '#050816', mid: '#0F1B3A', low: '#2B3D6B', sun: '#DCE8FF', stars: 0.9, haze: '#3A4C7A', moon: true },
    elev: [[0,0],[0.14,-140],[0.3,380],[0.48,120],[0.62,-200],[0.8,260],[0.92,60]], desc: '8자로 크게 꼬인 코스. 코너가 많아 역전이 자주 나요',
    tag: '보통 · 20~30명',
    scale: 3, width: 560, laps: 3, speed: 11.2,
    bg: '#0B1020', grass: '#121A2E', road: '#2E3340',
    pts: [[1250,850],[1600,600],[2050,450],[2400,700],[2400,1150],[2050,1400],
          [1650,1300],[1350,950],[1000,600],[600,480],[250,750],[250,1200],
          [600,1480],[1050,1400]]
  },
  canyon: {
    name: '협곡 레이스', theme: 'desert',
    sky: { top: '#2A1439', mid: '#8B3A5E', low: '#F2A05A', sun: '#FFE3A8', stars: 0.15, haze: '#E6A070' },
    elev: [[0,0],[0.12,420],[0.26,180],[0.4,-320],[0.55,-120],[0.68,520],[0.82,200],[0.93,-60]], desc: '길게 이어지는 고난도 코스. 실력자용',
    tag: '어려움 · 20~30명',
    scale: 3, width: 560, laps: 3, speed: 11.6,
    bg: '#3A2417', grass: '#5A3A22', road: '#4A4048',
    pts: [[400,900],[500,450],[900,220],[1400,250],[1800,500],[2100,850],
          [2500,950],[2850,700],[3200,850],[3300,1300],[3000,1650],[2550,1750],
          [2100,1600],[1650,1750],[1200,1800],[750,1600],[450,1300]]
  },
  grand: {
    name: '그랜드 서킷', theme: 'coast',
    sky: { top: '#0E2A55', mid: '#2F7BD0', low: '#CFEAFF', sun: '#FFFAE0', stars: 0, haze: '#B5D6F0' },
    elev: [[0,0],[0.16,180],[0.33,-120],[0.5,340],[0.67,80],[0.84,-160]],
    desc: '가장 넓고 긴 코스. 30명이 6열로 나란히 출발합니다',
    tag: '보통 · 30명 권장',
    scale: 3, width: 820, laps: 3, speed: 12,
    bg: '#0F2A3A', grass: '#2E8F72', road: '#3A4048',
    pts: [[600,1200],[600,700],[900,350],[1400,250],[1900,300],[2350,500],
          [2700,850],[3050,1150],[3150,1600],[2900,2000],[2450,2200],[1950,2250],
          [1500,2150],[1150,1900],[900,1550]]
  },
  alpine: {
    name: '알파인 그랑프리', theme: 'alpine',
    sky: { top: '#1A2C4F', mid: '#5C7FB0', low: '#E7E2F0', sun: '#FFF0D8', stars: 0.15, haze: '#C9C4D8' },
    elev: [[0,0],[0.1,300],[0.22,620],[0.36,240],[0.5,-280],[0.62,120],[0.75,560],[0.88,180]],
    desc: '가장 길고 코너가 많은 코스. S자 구간과 헤어핀이 이어집니다',
    tag: '어려움 · 30명 가능',
    scale: 3, width: 680, laps: 3, speed: 11.8,
    bg: '#1A1F2E', grass: '#E6ECF4', road: '#3A4050',
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

    this.buildElevation();

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
        i: i, takenUntil: 0
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
        i: best, angle: Math.atan2(ty, tx)
      });
    }

    this.bounds = this.center.reduce((b, p) => ({
      minX: Math.min(b.minX, p[0]), maxX: Math.max(b.maxX, p[0]),
      minY: Math.min(b.minY, p[1]), maxY: Math.max(b.maxY, p[1])
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    this.buildScenery();
    this.sprite = null;
  }

  // ── 고도: 진행률 기준 제어점을 부드럽게 보간 ──
  buildElevation() {
    const ctl = this.def.elev || [[0, 0]];
    const m = ctl.length;
    this.elev = new Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const f = i / this.n;
      let a = 0;
      for (let j = 0; j < m; j++) if (ctl[j][0] <= f) a = j;
      const b = (a + 1) % m;
      const t0 = ctl[a][0], t1 = (b === 0 ? 1 : ctl[b][0]);
      const u = Math.min(1, Math.max(0, (f - t0) / ((t1 - t0) || 1)));
      const sm = 0.5 - 0.5 * Math.cos(Math.PI * u);   // 부드러운 언덕
      this.elev[i] = ctl[a][1] + (ctl[b][1] - ctl[a][1]) * sm;
    }
    // 최대 경사 (물리 계산용)
    this.maxGrade = 0;
    for (let i = 0; i < this.n; i++) {
      const g = Math.abs(this.elev[(i+1) % this.n] - this.elev[i]) / this.stepLen;
      if (g > this.maxGrade) this.maxGrade = g;
    }
  }

  elevAt(i) { return this.elev[((i % this.n) + this.n) % this.n]; }
  get theme() { return THEMES[this.def.theme] || THEMES.meadow; }

  // 앞쪽 구간의 평균 경사 (오르막 +, 내리막 -)
  gradeAt(i, look) {
    const a = this.elevAt(i), b = this.elevAt(i + (look || 8));
    return (b - a) / ((look || 8) * this.stepLen);
  }

  // ── 노변 지물: 가드레일 · 나무 · 타이어 · 표지판 · 관중석 ──
  buildScenery() {
    this.scenery = [];
    let seed = 20260908;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };
    const railStep = Math.max(3, Math.round(this.stepLen ? 150 / this.stepLen : 4));
    const decoStep = railStep * 3;

    for (let i = 0; i < this.n; i += railStep) {
      const [tx, ty] = this.tangent[i], nx = -ty, ny = tx;
      const c = this.center[i], e = this.elev[i];
      // 도로 양쪽 가드레일 기둥
      [-1, 1].forEach(side => {
        this.scenery.push({ kind: 'rail', i: i,
          x: c[0] + nx * this.halfW * 1.09 * side, y: c[1] + ny * this.halfW * 1.09 * side,
          e: e, side: side, r: rnd() });
      });

      if (i % decoStep !== 0) continue;
      [-1, 1].forEach(side => {
        const kind = this.pickDeco(rnd());
        if (!kind) return;
        const off = DECO_OFFSET[kind] ? DECO_OFFSET[kind][0] + rnd() * DECO_OFFSET[kind][1] : 1.5;
        this.scenery.push({ kind: kind, i: i,
          x: c[0] + nx * this.halfW * off * side, y: c[1] + ny * this.halfW * off * side,
          e: e, side: side, r: rnd(), r2: rnd() });
      });
    }

    // 코스 중간 아치 3개 (섹터 표시)
    const labels = this.theme.arch || [];
    this.arches = [1, 2, 3].map((k, j) => ({ i: Math.round(this.n * k / 4) % this.n, label: labels[j] || '' }));
  }

  // 테마의 지물 비율표에서 하나 고르기 (약간의 빈자리 포함)
  pickDeco(r) {
    if (r > 0.92) return null;
    const list = this.theme.deco;
    let acc = 0;
    for (const [kind, w] of list) { acc += w; if (r / 0.92 <= acc) return kind; }
    return list[list.length - 1][0];
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
    stroke(this.theme.kerb[1], d.width + 4);         // 연석(테마 색)
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
        g.fillStyle = this.theme.kerb[0];
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
/* ─────────── 카트 종류와 색 ───────────
   이름으로 정해지므로 모든 화면에서 같은 학생은 같은 카트로 보입니다. */
const KART_COLORS = ['#EF476F', '#F5A524', '#FFD166', '#06D6A0', '#4CC9F0', '#B15DFF', '#FF8A56', '#F4F6FA'];
const KART_STYLES = ['racer', 'buggy', 'truck', 'rocket'];
function kartLook(name) {
  let h = 0x811c9dc5;
  const str = String(name || '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  return { style: KART_STYLES[h % KART_STYLES.length], color: KART_COLORS[(h >>> 7) % KART_COLORS.length] };
}

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
    this.look = kartLook(this.myName || this.myId);

    const st = this.track.startPos(this.opts.slot || 0);
    this.x = st.x; this.y = st.y; this.angle = st.angle;
    this.segIdx = st.index; this.lap = 0; this.progress = st.index;   // 출발선 바로 뒤에서 시작
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
    this.startedAt = null;
    this.toast = null;
    this.fx = [];
    this.parts = [];          // 입자 효과
    this.shakeT = 0;          // 화면 흔들림 남은 시간
    this.lastRank = 1;
  }

  /* 입자 하나 — 세계 좌표 + 높이 */
  spawn(n, x, y, h, opt) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = (opt.speed || 4) * (0.4 + Math.random());
      this.parts.push({
        x: x + (Math.random() - .5) * (opt.spread || 0), y: y + (Math.random() - .5) * (opt.spread || 0), h: h,
        vx: Math.cos(a) * sp + (opt.vx || 0), vy: Math.sin(a) * sp + (opt.vy || 0),
        vh: (opt.up || 2) * (0.5 + Math.random()),
        life: 1, decay: (opt.decay || 1.6) * (0.7 + Math.random() * 0.6),
        size: (opt.size || 6) * (0.6 + Math.random() * 0.8),
        color: opt.colors[Math.floor(Math.random() * opt.colors.length)],
        g: opt.gravity == null ? 6 : opt.gravity
      });
    }
    if (this.parts.length > 140) this.parts.splice(0, this.parts.length - 140);
  }
  stepParts(f) {
    const dt = f / 60;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx * f; p.y += p.vy * f; p.h += p.vh * f;
      p.vh -= p.g * dt * 10; p.vx *= 0.96; p.vy *= 0.96;
      if (p.h < 0) { p.h = 0; p.vh = -p.vh * 0.3; }
      p.life -= p.decay * dt;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
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
      this.spawn(18, this.x, this.y, this.track.carLen * 0.3,
        { speed: 5, up: 3, size: 7, colors: ['#4CC9F0', '#9BE7FF', '#FFFFFF'], gravity: 2 });
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
      if (p.name !== d.name) p.look = null;
      p.name = d.name; p.id = id; p.lap = d.lap; p.progress = d.progress;
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
    this.stepParts(f);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt / 1000);

    if (now < this.boostUntil && !this.finished && Math.random() < 0.55) {
      const back = this.track.carLen * 0.6;
      this.spawn(2, this.x - Math.cos(this.angle) * back, this.y - Math.sin(this.angle) * back,
        this.track.carLen * 0.18,
        { speed: 1.2, vx: -Math.cos(this.angle) * 3, vy: -Math.sin(this.angle) * 3,
          up: 1.2, size: 6, colors: ['#4CC9F0', '#8FE3FF', '#FFFFFF'], decay: 2.6, gravity: 0.5 });
    }

    if (this.itemRollUntil && now > this.itemRollUntil) {
      if (this.items.length < MAX_ITEMS) this.items.push(this.pendingItem);
      const got = this.pendingItem;
      this.pendingItem = null; this.itemRollUntil = 0;
      if (window.Sound) Sound.clear(1);
      this.showToast(ITEMS[got].name + ' 획득! (' + this.items.length + '/' + MAX_ITEMS + ')', '#FFD166');
    }

    if (this.countdown > 0) {
      this.countdown -= dt/1000;
      if (this.countdown <= 0) this.startedAt = now;
      this.draw(); return;
    }
    if (!this.finished) this.updateCar(now, f);
    this.updateRank();
    if (this.rank < this.lastRank && !this.finished && this.countdown <= 0) {
      this.showToast('▲ ' + this.rank + '위로 추월!', '#FFD166');
      if (window.Sound) Sound.pass();
    }
    this.lastRank = this.rank;
    this.fx = this.fx.filter(x => now < x.until);
    this.draw();
  }

  updateCar(now, f) {
    const spinning = now < this.spinUntil;
    const stunned  = now < this.stunUntil;
    const boosting = now < this.boostUntil;
    const slowed   = now < this.slowUntil;

    // 오르막은 느려지고 내리막은 빨라짐
    const grade = this.track.gradeAt(this.segIdx, 10);
    const gradeMul = Math.max(0.62, Math.min(1.3, 1 - grade * 1.9));
    this.grade = grade;

    let target = this.maxSpeed * gradeMul;
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
      if (now - this.wallUntil > 400) {
        this.wallUntil = now;
        this.shakeT = 0.28;
        this.spawn(14, this.x, this.y, this.track.carLen * 0.25,
          { speed: 7, up: 4, size: 4, colors: ['#FFD166', '#FFB347', '#FFFFFF'], decay: 2.4, gravity: 9 });
        if (window.Sound) Sound.lock();
      }
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
        this.spawn(12, s.x, s.y, this.track.carLen * 0.6,
          { speed: 3, up: 3.5, size: 5, colors: ['#FFD166', '#FFF3C4', '#F5A524'], decay: 1.8, gravity: 3 });
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
      this.finished = true; this.speed *= 0.4; this.finishedAt = now;
      this.spawn(70, this.x, this.y, this.track.carLen * 1.2,
        { speed: 9, up: 9, size: 8, spread: this.track.carLen,
          colors: ['#FFD166', '#EF476F', '#06D6A0', '#4CC9F0', '#B15DFF', '#FFFFFF'], decay: 0.55, gravity: 4 });
      if (this.opts.onFinish) this.opts.onFinish();
      if (window.Sound) Sound.levelUp();
    }
  }

  updateRank() {
    const all = [{ p: this.progress, me: true }];
    Object.keys(this.peers).forEach(id => all.push({ p: this.peers[id].progress || 0 }));
    all.sort((a, b) => b.p - a.p);
    this.total = all.length;
    const prev = this.rank;
    this.rank = all.findIndex(x => x.me) + 1;
    // 순위가 바뀌면 잠깐 알려 줌 (출발 직후의 요동은 무시)
    const now = performance.now();
    if (prev && prev !== this.rank && this.total > 1 && this.countdown <= 0 && !this.finished &&
        now - (this.rankFlashAt || 0) > 900) {
      this.rankFlash = { up: this.rank < prev, rank: this.rank, until: now + 1400 };
      this.rankFlashAt = now;
      if (window.Sound) (this.rank < prev ? Sound.pass() : Sound.softDrop());
    }
    // 마지막 바퀴 진입
    if (!this.finalLapShown && this.lap === this.track.laps - 1 && this.countdown <= 0) {
      this.finalLapShown = true;
      this.finalLapUntil = now + 2200;
      if (window.Sound) Sound.levelUp();
    }
  }

  // 앞쪽에 부스터 패드가 있으면 HUD에 알림
  nearBoostPad() {
    const t = this.track, reach = t.stepLen * 26;
    for (let k = 0; k < t.boostPads.length; k++) {
      const p = t.boostPads[k];
      const dx = p.x - this.x, dy = p.y - this.y;
      const fwd = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
      if (fwd > 0 && fwd < reach && Math.abs(-dx*Math.sin(this.angle) + dy*Math.cos(this.angle)) < t.halfW) {
        return true;
      }
    }
    return false;
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
      grade: this.grade || 0, nearBoost: this.nearBoostPad(),
      countdown: this.countdown, finished: this.finished, finishRank: this.finishRank
    };
  }

  // ── 그리기 (원근 투영 3D 뷰 · 고저차 반영) ──
  draw() {
    const ctx = this.ctx;
    const W = this.canvas.clientWidth || this.canvas.width;
    const H = this.canvas.clientHeight || this.canvas.height;
    const now = performance.now();
    const cam = this.setupCamera(W, H);

    ctx.save();
    if (this.shakeT > 0) {
      const k = this.shakeT / 0.28 * 7;
      ctx.translate((Math.random() - .5) * k, (Math.random() - .5) * k);
    }
    this.drawSky(ctx, W, H, cam);
    this.drawRoad(ctx, W, H, cam, now);
    this.drawSprites(ctx, W, H, cam, now);
    this.drawGantry(ctx, cam);
    this.drawParts(ctx, cam);
    ctx.restore();

    this.drawParticles(ctx, W, H, now);
    if (now < this.boostUntil) this.drawSpeedLines(ctx, W, H);
    this.drawMinimap(ctx, W, H);
    this.drawCanvasOverlay(ctx, W, H, now);
  }

  setupCamera(W, H) {
    const t = this.track;
    const boosting = performance.now() < this.boostUntil;
    const back = t.carLen * (boosting ? 3.2 : 2.8);
    const f = (W * 0.62) * back / t.halfW;
    const height = (H * 0.45) * back / f;

    // 경사를 따라 시선이 부드럽게 따라감
    const g = this.track.gradeAt(this.segIdx, 8);
    this.viewGrade = (this.viewGrade === undefined) ? g : this.viewGrade + (g - this.viewGrade) * 0.08;
    const horizonY = Math.max(H * 0.14, Math.min(H * 0.56,
                       H * 0.33 + f * this.viewGrade * 1.35));

    const myElev = t.elevAt(this.segIdx);
    return {
      x: this.x - Math.cos(this.angle) * back,
      y: this.y - Math.sin(this.angle) * back,
      cos: Math.cos(this.angle), sin: Math.sin(this.angle),
      f: f, absH: myElev + height, horizonY: horizonY,
      near: t.carLen * 0.35, W: W, H: H, grade: this.viewGrade, angle0: this.angle
    };
  }

  // 세계 좌표 (wx, wy)의 절대 높이 h 지점을 화면으로 투영
  project(cam, wx, wy, h) {
    const dx = wx - cam.x, dy = wy - cam.y;
    const lz =  dx * cam.cos + dy * cam.sin;
    if (lz < cam.near) return null;
    const lx = -dx * cam.sin + dy * cam.cos;
    return {
      x: cam.W / 2 + cam.f * lx / lz,
      y: cam.horizonY + cam.f * (cam.absH - (h || 0)) / lz,
      s: cam.f / lz,
      z: lz
    };
  }

  // ── 하늘 · 원경 ──
  drawSky(ctx, W, H, cam) {
    const d = this.track.def;
    const sk = d.sky || { top: this.shade(d.bg, -0.25), mid: d.bg, low: this.lighten(d.grass, 0.5),
                          sun: '#FFF3C4', stars: 0, haze: this.lighten(d.grass, 0.35) };
    const hy = cam.horizonY;

    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, hy));
    sky.addColorStop(0, sk.top); sky.addColorStop(0.55, sk.mid); sky.addColorStop(1, sk.low);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hy + 1);

    // 별 (어두운 트랙일수록 많이) — 진행 방향에 따라 흘러갑니다
    if (sk.stars > 0) {
      const n = Math.round(48 * sk.stars);
      const shift = -this.angle * W * 0.5;
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < n; i++) {
        const sx = (((i * 977) % 1000) / 1000 * W * 2 + shift) % (W * 2) - W * 0.5;
        const sy = ((i * 613) % 1000) / 1000 * hy * 0.85;
        const tw = 0.4 + Math.sin(performance.now() / 700 + i) * 0.35;
        ctx.globalAlpha = sk.stars * (0.35 + tw * 0.65);
        ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1.2, i % 7 === 0 ? 2 : 1.2);
      }
      ctx.globalAlpha = 1;
    }

    // 태양 (또는 달) 과 렌즈 플레어
    const sunX = ((-this.angle * W * 0.5) % (W * 2.4) + W * 2.4) % (W * 2.4) - W * 0.7;
    const sunY = hy * 0.40;
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * (sk.moon ? 0.22 : 0.34));
    glow.addColorStop(0, this.rgba(sk.sun, sk.moon ? 0.35 : 0.62));
    glow.addColorStop(0.35, this.rgba(sk.sun, sk.moon ? 0.08 : 0.18));
    glow.addColorStop(1, this.rgba(sk.sun, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - W * 0.34, sunY - W * 0.34, W * 0.68, W * 0.68);
    ctx.fillStyle = this.rgba(sk.sun, 0.95);
    ctx.beginPath(); ctx.arc(sunX, sunY, W * (sk.moon ? 0.036 : 0.042), 0, Math.PI * 2); ctx.fill();
    if (sk.moon) {                                        // 초승달 — 그림자로 한쪽을 가림
      ctx.fillStyle = sk.top;
      ctx.beginPath(); ctx.arc(sunX + W * 0.014, sunY - W * 0.006, W * 0.031, 0, Math.PI * 2); ctx.fill();
    }
    if (!sk.moon && sunX > -W * 0.2 && sunX < W * 1.2) {
      const cx = W / 2, cy = H * 0.55;
      [[0.3, 0.05, 0.18], [0.55, 0.03, 0.12], [0.85, 0.06, 0.10], [1.25, 0.025, 0.14]].forEach(fl => {
        const fx = sunX + (cx - sunX) * fl[0], fy = sunY + (cy - sunY) * fl[0];
        ctx.fillStyle = this.rgba(sk.sun, fl[2]);
        ctx.beginPath(); ctx.arc(fx, fy, W * fl[1], 0, Math.PI * 2); ctx.fill();
      });
    }

    // 구름
    const cl = ((-this.angle * W * 0.34) % (W * 1.5) + W * 1.5) % (W * 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = -1; i < 3; i++) {
      const cx2 = cl + i * W * 0.75 - W * 0.4, cy2 = hy * (0.22 + (i & 1) * 0.16);
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, W * 0.2, hy * 0.045, 0, 0, Math.PI * 2);
      ctx.ellipse(cx2 + W * 0.09, cy2 - hy * 0.02, W * 0.11, hy * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 원경 — 테마마다 다른 풍경
    this.drawFar(ctx, W, H, hy, d, sk);

    // 지면 + 지평선 안개
    ctx.fillStyle = d.grass;
    ctx.fillRect(0, hy, W, H - hy);
    const fog = ctx.createLinearGradient(0, hy - 6, 0, hy + H * 0.16);
    fog.addColorStop(0, this.rgba(sk.haze, 0.55));
    fog.addColorStop(1, this.rgba(sk.haze, 0));
    ctx.fillStyle = fog;
    ctx.fillRect(0, hy - 6, W, H * 0.16 + 6);
  }

  // ── 원경 5종 ──
  // 바다를 뺀 나머지는 한 주기 폭의 띠를 한 번만 그려 두고, 방향에 따라 밀어 붙입니다 (성능)
  drawFar(ctx, W, H, hy, d, sk) {
    const far = this.track.theme.far;
    if (far === 'ocean') return this.drawFarLive(ctx, W, H, hy, d, sk);
    const key = far + ':' + W + 'x' + Math.round(hy);
    if (!this.farCache || this.farCache.key !== key) this.farCache = { key: key, layers: this.buildFarLayers(far, W, hy, d) };
    this.farCache.layers.forEach(L => {
      const period = L.canvas.width;
      const shift = ((-this.angle * W * L.k) % period + period) % period;
      for (let i = -1; i <= Math.ceil(W / period); i++) ctx.drawImage(L.canvas, shift + i * period - period, hy - L.canvas.height + 1);
    });
  }

  buildFarLayers(far, W, hy, d) {
    const specs = {
      city:  [{ k: 0.30, w: 1.4, c: '#0A1128', h: 0.34, win: 0.10 }, { k: 0.52, w: 1.0, c: '#141C3A', h: 0.24, win: 0.16 }],
      mesa:  [{ k: 0.32, w: 1.5, c: '#4A2439', h: 0.30 }, { k: 0.52, w: 1.1, c: '#6E3A3A', h: 0.20 }],
      peaks: [{ k: 0.30, w: 1.3, c: '#2E3B5C', h: 0.42 }, { k: 0.50, w: 0.95, c: '#3E4E74', h: 0.30 }, { k: 0.68, w: 0.7, c: '#55688F', h: 0.18 }],
      hills: [{ k: 0.34, w: 1.15, c: this.shade(d.grass, -0.30), h: 0.30 }, { k: 0.50, w: 0.85, c: this.shade(d.grass, -0.14), h: 0.22 }, { k: 0.68, w: 0.6, c: this.lighten(d.grass, 0.08), h: 0.14 }]
    }[far] || [];
    return specs.map((L, li) => {
      const period = Math.max(64, Math.round(W * L.w));
      const cv = document.createElement('canvas');
      const ch = Math.ceil(hy * L.h * 1.3) + 12;
      cv.width = period; cv.height = ch;
      const g = cv.getContext('2d');
      const base = ch - 1;                                   // 띠 안에서의 지평선 위치
      if (far === 'city') {
        for (let b = 0; b < 5; b++) {
          const seed = (b * 7 + li * 31);
          const bw = period * (0.06 + ((seed * 7) % 5) * 0.03);
          const bh = hy * L.h * (0.45 + ((seed * 11) % 7) * 0.09);
          const x0 = b * period * 0.19;
          g.fillStyle = L.c; g.fillRect(x0, base - bh, bw, bh + 2);
          g.fillStyle = 'rgba(255,214,120,' + L.win + ')';
          const cols = Math.max(1, Math.floor(bw / 9)), rows = Math.max(1, Math.floor(bh / 11));
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
            if (((seed + r * 3 + c * 5) % 4) === 0) g.fillRect(x0 + 3 + c * 9, base - bh + 4 + r * 11, 4, 6);
          if ((seed % 3) === 0) { g.fillStyle = '#FF5C7A'; g.fillRect(x0 + bw / 2, base - bh - 8, 2, 8); }
        }
      } else if (far === 'mesa') {
        for (let i = 0; i < 2; i++) {
          const seed = i * 5 + li * 3;
          const bw = period * (0.28 + (seed % 3) * 0.1), bh = hy * L.h * (0.5 + ((seed * 7) % 5) * 0.12);
          const bx = i * period * 0.5;
          g.fillStyle = L.c; g.beginPath();
          g.moveTo(bx, base + 1); g.lineTo(bx + bw * 0.16, base - bh); g.lineTo(bx + bw * 0.82, base - bh); g.lineTo(bx + bw, base + 1);
          g.closePath(); g.fill();
        }
      } else if (far === 'peaks') {
        for (let i = 0; i < 2; i++) {
          const bx = period * (0.25 + i * 0.5);
          const bh = hy * L.h * (0.6 + ((i * 7 + li * 3) % 5) * 0.16);
          g.fillStyle = L.c; g.beginPath();
          g.moveTo(bx - period * 0.5, base + 1); g.lineTo(bx, base - bh); g.lineTo(bx + period * 0.5, base + 1); g.closePath(); g.fill();
          g.fillStyle = 'rgba(244,246,250,0.92)';
          const cap = bh * 0.32, hw = period * 0.5 * (cap / bh);
          g.beginPath(); g.moveTo(bx, base - bh); g.lineTo(bx + hw, base - bh + cap); g.lineTo(bx + hw * 0.55, base - bh + cap * 0.8);
          g.lineTo(bx, base - bh + cap * 1.05); g.lineTo(bx - hw * 0.55, base - bh + cap * 0.75); g.lineTo(bx - hw, base - bh + cap); g.closePath(); g.fill();
        }
      } else {
        g.fillStyle = L.c; g.beginPath(); g.moveTo(-period, base + 1);
        for (let i = -1; i <= 2; i++) {
          const bx = period * (0.5 + i);
          const bh = hy * L.h * (0.6 + ((i * 7 + li * 3) % 5 + 5) % 5 * 0.16);
          g.lineTo(bx - period * 0.5, base + 1); g.lineTo(bx, base - bh); g.lineTo(bx + period * 0.5, base + 1);
        }
        g.lineTo(period * 3, base + 1); g.closePath(); g.fill();
      }
      return { k: L.k, canvas: cv };
    });
  }

  // 바다는 반짝임이 살아 움직이므로 매 프레임 그립니다
  drawFarLive(ctx, W, H, hy, d, sk) {
    const shiftOf = (k, w) => ((-this.angle * W * k) % (W * w) + W * w) % (W * w);

      // 바다 — 수평선 · 반짝임 · 멀리 섬과 요트
      const sea = ctx.createLinearGradient(0, hy * 0.78, 0, hy + 1);
      sea.addColorStop(0, '#1E6FB8'); sea.addColorStop(1, '#2A9BD8');
      ctx.fillStyle = sea; ctx.fillRect(0, hy * 0.78, W, hy * 0.22 + 1);
      const now = performance.now();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 26; i++) {
        const sx = ((i * 373 + now / 40) % (W + 40)) - 20, sy = hy * (0.8 + ((i * 97) % 100) / 500);
        ctx.fillRect(sx, sy, 8 + (i % 3) * 4, 1.2);
      }
      const shift = shiftOf(0.35, 1.6);
      ctx.fillStyle = '#1B4F3A';
      for (let i = -1; i <= 3; i++) {
        const bx = shift + i * W * 1.6 - W;
        ctx.beginPath(); ctx.ellipse(bx, hy * 0.8, W * 0.16, hy * 0.06, 0, Math.PI, 0); ctx.fill();
      }
      const shift2 = shiftOf(0.6, 1.2);
      for (let i = -1; i <= 3; i++) {
        const bx = shift2 + i * W * 1.2 - W * 0.5;
        ctx.fillStyle = '#F4F6FA';
        ctx.beginPath(); ctx.moveTo(bx, hy * 0.88); ctx.lineTo(bx + 10, hy * 0.72); ctx.lineTo(bx + 10, hy * 0.88); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2B3140'; ctx.fillRect(bx - 4, hy * 0.88, 18, 3);
      }
  }

  // ── 화면에 흩날리는 것들 (눈 · 모래 · 꽃잎 · 반딧불) ──
  drawParticles(ctx, W, H, now) {
    const kind = this.track.theme.particles;
    if (!kind) return;
    if (!this.pts || this.pts.kind !== kind) {
      this.pts = { kind: kind, list: Array.from({ length: kind === 'spark' ? 18 : 34 }, (_, i) => ({
        x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random(), ph: Math.random() * 6.28 })) };
    }
    const spd = this.speed / this.maxSpeed;
    ctx.save();
    this.pts.list.forEach((p, i) => {
      if (kind === 'snow') {
        p.y += (0.6 + p.s * 0.9) * (1 + spd * 1.5); p.x += Math.sin(now / 900 + p.ph) * 0.5 - spd * 0.6;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + p.s * 0.4).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.2 + p.s * 1.6, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'dust') {
        p.x += (1.5 + p.s * 2) * (1 + spd); p.y += 0.2 * p.s;
        ctx.fillStyle = 'rgba(242,214,160,' + (0.14 + p.s * 0.12).toFixed(2) + ')';
        ctx.fillRect(p.x, p.y, 10 + p.s * 14 * (1 + spd), 1.4);
      } else if (kind === 'petal') {
        p.y += (0.35 + p.s * 0.5) * (1 + spd); p.x += Math.sin(now / 600 + p.ph) * 0.8 + 0.3;
        ctx.fillStyle = 'rgba(255,170,200,' + (0.45 + p.s * 0.35).toFixed(2) + ')';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.2 + p.s * 1.6, 1.2 + p.s, now / 400 + p.ph, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'spark') {
        p.y -= 0.15 * p.s; p.x += Math.sin(now / 1200 + p.ph) * 0.3;
        const a = 0.25 + Math.sin(now / 300 + p.ph * 3) * 0.25;
        ctx.fillStyle = 'rgba(255,230,140,' + Math.max(0, a).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + p.s, 0, Math.PI * 2); ctx.fill();
      }
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x > W + 20) p.x = -20; if (p.x < -20) p.x = W + 20;
    });
    ctx.restore();
  }

  rgba(hex, a) {
    if (hex.charAt(0) !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ── 노면 ──
  drawRoad(ctx, W, H, cam, now) {
    const t = this.track, d = t.def, n = t.n;
    const K = Math.min(120, Math.ceil(2800 / t.stepLen));
    const DETAIL = 20;

    const segs = [];
    let k = -8;
    while (k < K) {
      const i = ((this.segIdx + k) % n + n) % n;
      const c = t.center[i], e = t.elev[i];
      const [tx, ty] = t.tangent[i];
      const nx = -ty, ny = tx;
      const L = this.project(cam, c[0] + nx * t.halfW, c[1] + ny * t.halfW, e);
      const R = this.project(cam, c[0] - nx * t.halfW, c[1] - ny * t.halfW, e);
      if (!L || !R) { if (segs.length) break; k += 1; continue; }
      segs.push({ i: i, L: L, R: R, cx: c[0], cy: c[1], e: e,
                  nx: nx, ny: ny, tx: tx, ty: ty, k: k, detail: k < DETAIL });
      k += (k < DETAIL) ? 1 : (k < DETAIL * 2 ? 2 : 4);
    }
    if (segs.length < 2) return;
    this.segsCache = segs;

    const quad = (a, b, c2, d2, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y);
      ctx.closePath(); ctx.fill();
    };

    const roadLight = this.lighten(d.road, 0.055);
    const grassLight = this.lighten(d.grass, 0.07);
    const grassDark = this.shade(d.grass, -0.06);

    for (let s2 = segs.length - 1; s2 > 0; s2--) {
      const far = segs[s2], near = segs[s2 - 1];
      const band = Math.floor(far.i / 5) % 2 === 0;

      if (near.detail && near.k < 16) {
        // 갓길 — 도로 바깥으로 넓게 (언덕 넘어가는 곳도 자연스럽게 덮음)
        const sL1 = this.edge(cam, far, 3.2),  sL2 = this.edge(cam, near, 3.2);
        const sR1 = this.edge(cam, far, -3.2), sR2 = this.edge(cam, near, -3.2);
        if (sL1 && sL2 && sR1 && sR2) quad(sL1, sR1, sR2, sL2, band ? grassLight : grassDark);
      }

      if (near.detail) {
        // 연석
        const kw = 0.058;
        const kL1 = this.edge(cam, far, 1 + kw), kL2 = this.edge(cam, near, 1 + kw);
        const kR1 = this.edge(cam, far, -1 - kw), kR2 = this.edge(cam, near, -1 - kw);
        const glow = (d.sky && d.sky.stars >= 0.3);
        const kc = band ? (glow ? '#F4F7FF' : '#E8ECF2') : (glow ? '#FF5A6A' : '#D94A4A');
        if (kL1 && kL2) quad(far.L, kL1, kL2, near.L, kc);
        if (kR1 && kR2) quad(far.R, kR1, kR2, near.R, kc);
      }

      quad(far.L, far.R, near.R, near.L, band ? roadLight : d.road);

      // 아스팔트 질감 — 가까운 구간에만 작은 얼룩
      if (near.detail && near.k < 8 && near.k >= -2) {
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        for (let q2 = 0; q2 < 3; q2++) {
          const u = ((far.i * 31 + q2 * 17) % 100) / 100;
          const off = -0.85 + u * 1.7;
          const pt = this.edge(cam, near, off);
          if (!pt) continue;
          const rr = Math.max(0.8, t.halfW * 0.02 * pt.s);
          ctx.beginPath(); ctx.ellipse(pt.x, pt.y, rr * 1.6, rr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        }
      }

      if (near.detail && near.k < 10) {
        // 흰 차선 (도로 가장자리 안쪽)
        [0.9, -0.9].forEach(o => {
          const a1 = this.edge(cam, far, o + 0.02), a2 = this.edge(cam, far, o - 0.02);
          const b1 = this.edge(cam, near, o + 0.02), b2 = this.edge(cam, near, o - 0.02);
          if (a1 && a2 && b1 && b2) quad(a1, a2, b2, b1, 'rgba(255,255,255,0.30)');
        });
      }

      if (near.detail) {
        // 중앙 점선
        if (Math.floor(far.i / 3) % 2 === 0) {
          const a1 = this.edge(cam, far, 0.035), a2 = this.edge(cam, far, -0.035);
          const b1 = this.edge(cam, near, 0.035), b2 = this.edge(cam, near, -0.035);
          if (a1 && a2 && b1 && b2) quad(a1, a2, b2, b1, 'rgba(255,255,255,0.16)');
        }
      }
    }

    this.drawRoadMarks(ctx, cam, segs, now);
  }

  edge(cam, seg, off) {
    return this.project(cam, seg.cx + seg.nx * this.track.halfW * off,
                             seg.cy + seg.ny * this.track.halfW * off, seg.e);
  }

  drawRoadMarks(ctx, cam, segs, now) {
    const t = this.track;
    const seen = {};
    segs.forEach(sg => { seen[sg.i] = sg; });

    // 진행 방향 화살표
    const arrowStep = Math.max(6, Math.round(380 / t.stepLen));
    for (let s = segs.length - 1; s >= 0; s--) {
      const sg = segs[s];
      if (sg.k > 60 || sg.i % arrowStep !== 0) continue;
      const len = t.halfW * 0.34;
      const tip = this.project(cam, sg.cx + sg.tx*len, sg.cy + sg.ty*len, sg.e);
      const bl  = this.project(cam, sg.cx - sg.tx*len*0.5 + sg.nx*len*0.55,
                                    sg.cy - sg.ty*len*0.5 + sg.ny*len*0.55, sg.e);
      const br  = this.project(cam, sg.cx - sg.tx*len*0.5 - sg.nx*len*0.55,
                                    sg.cy - sg.ty*len*0.5 - sg.ny*len*0.55, sg.e);
      if (!tip || !bl || !br) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y); ctx.lineTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
      ctx.closePath(); ctx.fill();
    }

    this.drawBoostPads(ctx, cam, now);

    // 출발 / 결승선
    const finish = seen[0];
    if (finish) {
      const cells = 10;
      const ahead = { cx: finish.cx + finish.tx * t.stepLen * 2.2,
                      cy: finish.cy + finish.ty * t.stepLen * 2.2,
                      nx: finish.nx, ny: finish.ny, e: t.elevAt(2) };
      for (let i = 0; i < cells; i++) {
        const o1 = 1 - (2*i/cells), o2 = 1 - (2*(i+1)/cells);
        const p1 = this.edge(cam, finish, o1), p2 = this.edge(cam, finish, o2);
        const p3 = this.edge(cam, ahead, o2), p4 = this.edge(cam, ahead, o1);
        if (!p1 || !p2 || !p3 || !p4) continue;
        ctx.fillStyle = (i % 2 === 0) ? '#F4F6FA' : '#1A1D24';
        ctx.beginPath();
        ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // ── 부스터 패드: 멀리서도 확실히 보이게 ──
  drawBoostPads(ctx, cam, now) {
    const t = this.track;
    const reach = t.stepLen * 110;
    t.boostPads.forEach(p => {
      if (Math.hypot(p.x - this.x, p.y - this.y) > reach) return;
      const e = t.elevAt(p.i);
      const co = Math.cos(p.angle), si = Math.sin(p.angle);
      const halfL = t.halfW * 0.30, halfW2 = t.halfW * 0.20;
      const corner = (a, b, h) => this.project(cam,
        p.x + co*a - si*b, p.y + si*a + co*b, e + (h || 0));

      const A = corner(halfL, -halfW2), B = corner(halfL, halfW2);
      const C = corner(-halfL, halfW2), D = corner(-halfL, -halfW2);
      if (!A || !B || !C || !D) return;

      const pulse = 0.55 + 0.35 * Math.sin(now / 170);
      // 바닥 발광판
      const g = ctx.createLinearGradient(D.x, D.y, A.x, A.y);
      g.addColorStop(0, 'rgba(20,110,150,0.85)');
      g.addColorStop(1, 'rgba(76,201,240,' + pulse.toFixed(2) + ')');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.lineTo(C.x,C.y); ctx.lineTo(D.x,D.y);
      ctx.closePath(); ctx.fill();

      // 흐르는 화살표 3개
      const flow = (now / 260) % 1;
      for (let i = 0; i < 2; i++) {
        const u = ((i / 2) + flow) % 1;              // 0(뒤) → 1(앞)
        const a0 = -halfL + u * halfL * 2;
        const tip = corner(a0 + halfL * 0.36, 0);
        const l1  = corner(a0 - halfL * 0.1, -halfW2 * 0.82);
        const l2  = corner(a0 - halfL * 0.1,  halfW2 * 0.82);
        if (!tip || !l1 || !l2) continue;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.9 - u * 0.45).toFixed(2) + ')';
        ctx.beginPath();
        ctx.moveTo(tip.x,tip.y); ctx.lineTo(l1.x,l1.y); ctx.lineTo(l2.x,l2.y);
        ctx.closePath(); ctx.fill();
      }

      // 양옆 빛기둥 — 멀리서도 위치를 알 수 있게
      if (A.z > reach * 0.6) return;
      [[-1],[1]].forEach(sd => {
        const b0 = corner(0, halfW2 * 1.15 * sd[0]);
        const b1 = corner(0, halfW2 * 1.15 * sd[0], t.carLen * 1.5);
        if (!b0 || !b1) return;
        const w = Math.max(1.5, t.carLen * 0.11 * b0.s);
        const lg = ctx.createLinearGradient(b0.x, b0.y, b1.x, b1.y);
        lg.addColorStop(0, 'rgba(76,201,240,' + (0.75 * pulse).toFixed(2) + ')');
        lg.addColorStop(1, 'rgba(76,201,240,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(b0.x - w/2, b1.y, w, b0.y - b1.y);
      });
    });
  }

  // ── 출발선 위 아치 ──
  // 출발 게이트 + 코스 중간 섹터 아치
  drawGantry(ctx, cam) {
    const t = this.track;
    this.drawArch(ctx, cam, 0, null, true);
    (t.arches || []).forEach(a => this.drawArch(ctx, cam, a.i, a.label, false));
  }

  drawArch(ctx, cam, i, label, isStart) {
    const t = this.track;
    const c = t.center[i], e = t.elev[i];
    if (Math.hypot(c[0] - this.x, c[1] - this.y) > t.stepLen * 90) return;
    const [tx, ty] = t.tangent[i], nx = -ty, ny = tx;
    const topH = t.halfW * (isStart ? 0.62 : 0.56), postW = t.halfW * 0.07;
    const kerb = t.theme.kerb;
    const postC = isStart ? '#2B3140' : this.shade(kerb[1], -0.35);

    const post = (side) => {
      const bx = c[0] + nx * t.halfW * 1.16 * side, by = c[1] + ny * t.halfW * 1.16 * side;
      const b0 = this.project(cam, bx - tx*postW, by - ty*postW, e);
      const b1 = this.project(cam, bx + tx*postW, by + ty*postW, e);
      const u0 = this.project(cam, bx - tx*postW, by - ty*postW, e + topH);
      const u1 = this.project(cam, bx + tx*postW, by + ty*postW, e + topH);
      if (!b0 || !b1 || !u0 || !u1) return null;
      this.fillPoly(ctx, [b0, b1, u1, u0], postC);
      return { u0: u0, u1: u1 };
    };
    const l = post(1), r = post(-1);
    if (!l || !r) return;
    const beamH = topH * 0.26;
    const P = (o, z) => this.project(cam, c[0] + nx*t.halfW*o, c[1] + ny*t.halfW*o, e + z);
    const bl0 = P(1.2, topH), br0 = P(-1.2, topH), bl1 = P(1.2, topH + beamH), br1 = P(-1.2, topH + beamH);
    if (!bl0 || !br0 || !bl1 || !br1) return;
    this.fillPoly(ctx, [bl0, br0, br1, bl1], isStart ? '#1F2530' : this.shade(kerb[1], -0.5));

    if (isStart) {
      // 체커 무늬 띠
      const cells = 12;
      for (let k = 0; k < cells; k++) {
        const o1 = 1.2 - (2.4*k/cells), o2 = 1.2 - (2.4*(k+1)/cells);
        const q1 = P(o1, topH + beamH*0.35), q2 = P(o2, topH + beamH*0.35), q3 = P(o2, topH + beamH*0.75), q4 = P(o1, topH + beamH*0.75);
        if (!q1 || !q2 || !q3 || !q4) continue;
        this.fillPoly(ctx, [q1,q2,q3,q4], (k % 2 === 0) ? '#F4F6FA' : '#12151C');
      }
    } else {
      // 섹터 이름 + 양쪽 깃발
      const mid = P(0, topH + beamH * 0.55);
      const edge = P(1.2, topH + beamH * 0.55);
      if (mid && edge) {
        const bw = Math.abs(edge.x - mid.x) * 2;
        const fs = Math.max(8, Math.min(28, bw * 0.09));
        ctx.fillStyle = kerb[0];
        ctx.font = '800 ' + fs.toFixed(0) + 'px Pretendard, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label || '', mid.x, mid.y);
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      }
      [1, -1].forEach(side => {
        const f0 = P(1.16 * side, topH + beamH), f1 = P(1.16 * side, topH + beamH * 2.2);
        if (!f0 || !f1) return;
        const flap = Math.sin(performance.now() / 260 + side) * 3;
        ctx.fillStyle = kerb[1];
        ctx.beginPath(); ctx.moveTo(f0.x, f1.y); ctx.lineTo(f0.x + (f0.y - f1.y) * 0.9 * side + flap, (f0.y + f1.y) / 2);
        ctx.lineTo(f0.x, f0.y - (f0.y - f1.y) * 0.15); ctx.closePath(); ctx.fill();
      });
    }
  }

  // ── 입체 물체 ──
  drawSprites(ctx, W, H, cam, now) {
    const t = this.track, n = t.n;
    const list = [];

    // 노변 지물 (앞쪽 구간만)
    const from = this.segIdx - 8, to = this.segIdx + Math.ceil(2400 / t.stepLen);
    t.scenery.forEach(o => {
      let d = o.i - this.segIdx;
      if (d < -n/2) d += n;
      if (d >  n/2) d -= n;
      if (d < -8 || d > (to - this.segIdx)) return;
      const p = this.project(cam, o.x, o.y, o.e);
      if (!p || p.x < -260 || p.x > W + 260) return;
      list.push({ z: p.z, kind: 'deco', o: o });
    });

    t.itemSpots.forEach(sp => {
      if (now < sp.takenUntil) return;
      const p = this.project(cam, sp.x, sp.y, t.elevAt(sp.i));
      if (!p || p.x < -200 || p.x > W + 200) return;
      list.push({ z: p.z, kind: 'box', sp: sp });
    });

    Object.keys(this.hazards).forEach(id => {
      const h = this.hazards[id];
      if (h.e === undefined) h.e = t.elevAt(t.nearestIndex(h.x, h.y).index);
      const p = this.project(cam, h.x, h.y, h.e);
      if (!p || p.x < -200 || p.x > W + 200) return;
      list.push({ z: p.z, kind: 'banana', h: h });
    });

    Object.keys(this.peers).forEach(id => {
      const pr = this.peers[id];
      pr.x += ((pr.tx !== undefined ? pr.tx : pr.x) - pr.x) * 0.25;
      pr.y += ((pr.ty !== undefined ? pr.ty : pr.y) - pr.y) * 0.25;
      let da = (pr.tangle !== undefined ? pr.tangle : pr.angle) - pr.angle;
      while (da >  Math.PI) da -= Math.PI*2;
      while (da < -Math.PI) da += Math.PI*2;
      pr.angle += da * 0.25;
      pr.e = t.elevAt(Math.round(pr.progress || 0));
      const p = this.project(cam, pr.x, pr.y, pr.e);
      if (!p) return;
      list.push({ z: p.z, kind: 'kart', peer: pr });
    });

    const myE = t.elevAt(this.segIdx);
    const me = this.project(cam, this.x, this.y, myE);
    if (me) list.push({ z: me.z, kind: 'me', e: myE });

    list.sort((a, b) => a.z - b.z);
    // 카트·아이템이 지물에 밀려 사라지지 않도록 따로 상한을 둡니다
    const objs = list.filter(o => o.kind !== 'deco').slice(0, 20);
    const decos = list.filter(o => o.kind === 'deco').slice(0, 10);
    const shown = objs.concat(decos).sort((a, b) => a.z - b.z);
    let fullLeft = 8;                                    // 정밀 모델은 가까운 8대까지만
    shown.forEach(o => { if (o.kind === 'kart' || o.kind === 'me') { o.full = fullLeft > 0; fullLeft--; } });
    shown.reverse();
    shown.forEach(o => {
      if (o.kind === 'deco')        this.drawDeco(ctx, cam, o.o, now);
      else if (o.kind === 'box')    this.drawBox3D(ctx, cam, o.sp.x, o.sp.y, t.elevAt(o.sp.i), now);
      else if (o.kind === 'banana') this.drawBanana3D(ctx, cam, o.h.x, o.h.y, o.h.e);
      else if (o.kind === 'kart') {
        if (!o.peer.look) o.peer.look = kartLook(o.peer.name || o.peer.id);
        this.drawKart3D(ctx, cam, o.peer.x, o.peer.y, o.peer.e, o.peer.angle,
                        o.peer.finished ? { style: o.peer.look.style, color: '#565D6E' } : o.peer.look,
                        o.peer.name, false, o.peer.spin, o.peer.shield, o.peer.boost, now, o.full);
      } else this.drawKart3D(ctx, cam, this.x, this.y, o.e, this.angle, this.look, this.myName, true,
                             now < this.spinUntil || now < this.stunUntil,
                             now < this.shieldUntil, now < this.boostUntil, now, true);
    });
  }

  // ── 노변 지물 그리기 (빌보드) ──
  drawDeco(ctx, cam, o, now) {
    const t = this.track;
    const base = this.project(cam, o.x, o.y, o.e);
    if (!base) return;
    const s = base.s, u = t.carLen;      // 화면 배율

    if (o.kind === 'rail') {
      const h = u * 0.55;
      const top = this.project(cam, o.x, o.y, o.e + h);
      if (!top) return;
      const w = Math.max(1.2, u * 0.09 * s);
      ctx.fillStyle = '#6B7484';
      ctx.fillRect(base.x - w/2, top.y, w, base.y - top.y);
      ctx.fillStyle = o.r < 0.5 ? '#C9D1DC' : '#D94A4A';
      ctx.fillRect(base.x - w*1.9, top.y, w*3.8, Math.max(1.2, u*0.13*s));

    } else if (o.kind === 'tree') {
      const th = u * (2.0 + o.r * 1.6);
      const top = this.project(cam, o.x, o.y, o.e + th);
      if (!top) return;
      const trunkW = Math.max(1.5, u * 0.16 * s);
      const hgt = base.y - top.y;
      ctx.fillStyle = '#4A3524';
      ctx.fillRect(base.x - trunkW/2, base.y - hgt*0.34, trunkW, hgt*0.34);
      const cw = Math.max(3, u * (0.75 + o.r*0.35) * s);
      ctx.fillStyle = this.shade(t.def.grass, 0.55 + o.r*0.3);
      ctx.beginPath();
      ctx.moveTo(base.x, top.y);
      ctx.lineTo(base.x - cw, base.y - hgt*0.28);
      ctx.lineTo(base.x + cw, base.y - hgt*0.28);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.shade(t.def.grass, 0.85);
      ctx.beginPath();
      ctx.moveTo(base.x, top.y);
      ctx.lineTo(base.x - cw*0.6, base.y - hgt*0.5);
      ctx.lineTo(base.x + cw*0.6, base.y - hgt*0.5);
      ctx.closePath(); ctx.fill();

    } else if (o.kind === 'tire') {
      const rows = 3;
      for (let i = 0; i < rows; i++) {
        const p = this.project(cam, o.x, o.y, o.e + u*0.26*i);
        if (!p) continue;
        const rw = u * 0.42 * s;
        ctx.fillStyle = i % 2 ? '#1B1E25' : '#262B34';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rw, rw*0.42, 0, 0, Math.PI*2); ctx.fill();
      }

    } else if (o.kind === 'sign') {
      const ph = u * 1.5;
      const top = this.project(cam, o.x, o.y, o.e + ph);
      if (!top) return;
      const pw = Math.max(1.2, u*0.1*s);
      ctx.fillStyle = '#7C8595';
      ctx.fillRect(base.x - pw/2, top.y, pw, base.y - top.y);
      const bw = u*0.95*s, bh = u*0.6*s;
      ctx.fillStyle = o.r < 0.5 ? '#F5A524' : '#4CC9F0';
      ctx.fillRect(top.x - bw/2, top.y - bh*0.5, bw, bh);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(top.x - bw*0.3, top.y - bh*0.16, bw*0.6, bh*0.16);

    } else if (o.kind === 'stand') {
      const sh = u * 2.2, sw = u * 3.4;
      const top = this.project(cam, o.x, o.y, o.e + sh);
      if (!top) return;
      const w = sw * s, hgt = base.y - top.y;
      ctx.fillStyle = '#2E3542';
      ctx.fillRect(base.x - w/2, top.y, w, hgt);
      ctx.fillStyle = '#3B4454';
      ctx.fillRect(base.x - w/2, top.y, w, hgt*0.22);
      // 관중 점묘
      for (let r = 0; r < 3; r++) {
        for (let cix = 0; cix < 6; cix++) {
          const seed = (r*9 + cix + Math.floor(o.r*100));
          ctx.fillStyle = ['#EF476F','#4CC9F0','#FFD166','#06D6A0'][seed % 4];
          ctx.globalAlpha = 0.75;
          ctx.fillRect(base.x - w/2 + w*(0.1 + cix*0.15), top.y + hgt*(0.32 + r*0.2),
                       Math.max(1, w*0.08), Math.max(1, hgt*0.12));
        }
      }
      ctx.globalAlpha = 1;

    } else if (o.kind === 'pine') {
      // 침엽수 — 세 겹 삼각형
      const th = u * (2.2 + o.r * 1.4);
      const top = this.project(cam, o.x, o.y, o.e + th);
      if (!top) return;
      const hgt = base.y - top.y, cw = Math.max(3, u * 0.7 * s);
      ctx.fillStyle = '#3B2A1E';
      ctx.fillRect(base.x - Math.max(1, u*0.12*s)/2, base.y - hgt*0.18, Math.max(1, u*0.12*s), hgt*0.18);
      [0.2, 0.48, 0.76].forEach((f, k) => {
        ctx.fillStyle = k === 2 ? '#1F5A3A' : (k === 1 ? '#246B44' : '#2C7A4E');
        ctx.beginPath();
        ctx.moveTo(base.x, top.y + hgt * (f - 0.24));
        ctx.lineTo(base.x - cw * (0.5 + k * 0.28), base.y - hgt * (1 - f) + hgt * 0.02);
        ctx.lineTo(base.x + cw * (0.5 + k * 0.28), base.y - hgt * (1 - f) + hgt * 0.02);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(244,246,250,0.75)';                       // 눈
        ctx.fillRect(base.x - cw * (0.28 + k * 0.16), top.y + hgt * (f - 0.06), cw * (0.56 + k * 0.32), Math.max(1, hgt * 0.03));
      });

    } else if (o.kind === 'palm') {
      // 야자수 — 휜 줄기와 잎
      const th = u * (2.4 + o.r * 1.2);
      const lean = (o.side || 1) * u * 0.5;
      const top = this.project(cam, o.x + lean, o.y, o.e + th);
      if (!top) return;
      const w = Math.max(1.5, u * 0.14 * s);
      ctx.strokeStyle = '#8A5A3A'; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.quadraticCurveTo(base.x, top.y + (base.y - top.y) * 0.4, top.x, top.y); ctx.stroke();
      ctx.strokeStyle = '#2FA35C'; ctx.lineWidth = Math.max(1.5, u * 0.11 * s);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + o.r;
        const lx = top.x + Math.cos(a) * u * 0.8 * s, ly = top.y + Math.sin(a) * u * 0.35 * s + u * 0.3 * s;
        ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo((top.x + lx) / 2, top.y - u * 0.2 * s, lx, ly); ctx.stroke();
      }

    } else if (o.kind === 'cactus') {
      const th = u * (1.4 + o.r * 1.0);
      const top = this.project(cam, o.x, o.y, o.e + th);
      if (!top) return;
      const w = Math.max(2, u * 0.26 * s), hgt = base.y - top.y;
      ctx.fillStyle = '#2E8B57';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(base.x - w/2, top.y, w, hgt, w/2); else ctx.rect(base.x - w/2, top.y, w, hgt); ctx.fill();
      [[-1, 0.45], [1, 0.6]].forEach(([sd, f]) => {
        const ax = base.x + sd * w * 0.9, ay = base.y - hgt * f;
        ctx.fillRect(base.x + (sd < 0 ? -w * 1.3 : w * 0.5), ay, w * 0.8, w * 0.45);
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(ax - w * 0.35, ay - hgt * 0.25, w * 0.7, hgt * 0.3, w * 0.35); else ctx.rect(ax - w * 0.35, ay - hgt * 0.25, w * 0.7, hgt * 0.3); ctx.fill();
      });

    } else if (o.kind === 'rock') {
      const rh = u * (0.5 + o.r * 0.7), rw = u * (0.9 + o.r2 * 0.8);
      const top = this.project(cam, o.x, o.y, o.e + rh);
      if (!top) return;
      ctx.fillStyle = this.shade(t.def.grass, -0.35);
      ctx.beginPath(); ctx.ellipse(base.x, base.y, rw * s, (base.y - top.y), 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.ellipse(base.x - rw * s * 0.3, base.y - (base.y - top.y) * 0.5, rw * s * 0.3, (base.y - top.y) * 0.25, 0, 0, Math.PI * 2); ctx.fill();

    } else if (o.kind === 'flower') {
      const cols = ['#FF5C7A', '#FFD166', '#F4F6FA', '#B15DFF'];
      for (let k = 0; k < 4; k++) {
        const fx = base.x + (k - 1.5) * u * 0.28 * s, fy = base.y - u * 0.18 * s * (0.6 + ((k * 3 + Math.floor(o.r * 10)) % 3) * 0.3);
        ctx.fillStyle = '#2E7D46'; ctx.fillRect(fx - 0.6, fy, Math.max(1, u * 0.03 * s), base.y - fy);
        ctx.fillStyle = cols[(k + Math.floor(o.r * 4)) % 4];
        ctx.beginPath(); ctx.arc(fx, fy, Math.max(1.2, u * 0.09 * s), 0, Math.PI * 2); ctx.fill();
      }

    } else if (o.kind === 'building') {
      // 건물 — 입체 상자 + 창문 격자 + 옥상 간판
      const bw = u * (1.6 + o.r * 1.4), bd = u * (1.2 + o.r2 * 1.0), bh = u * (2.2 + o.r * 4.5);
      const box = this.boxCorners(cam, o.x, o.y, o.e, 0, bd, bw, bh);
      if (!box) return;
      const tone = ['#1B2238', '#22304A', '#2A2A44', '#1F2A3E'][Math.floor(o.r * 4)];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        this.fillPoly(ctx, [box.g[i], box.g[j], box.u[j], box.u[i]], i % 2 ? this.shade(tone, -0.18) : tone);
      }
      this.fillPoly(ctx, box.u, this.shade(tone, 0.12));
      // 창문 — 앞면(카메라 쪽) 위에 격자
      const fL = box.g[3], fR = box.g[0], tL = box.u[3], tR = box.u[0];
      const faceW = Math.abs(fR.x - fL.x), faceH = Math.abs(fL.y - tL.y);
      const rows = faceH > 36 ? Math.min(4, Math.max(2, Math.floor(bh / (u * 1.0)))) : 0;
      const cols = faceW > 22 ? 2 : 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (((r * 7 + c * 3 + Math.floor(o.r * 100)) % 3) === 0) continue;
        const fx = (c + 0.5) / cols, fy = (r + 0.5) / rows;
        const x = fL.x + (fR.x - fL.x) * fx, yB = fL.y + (fR.y - fL.y) * fx, yT = tL.y + (tR.y - tL.y) * fx;
        const y = yT + (yB - yT) * fy;
        ctx.fillStyle = t.theme.lampGlow ? 'rgba(255,214,120,0.75)' : 'rgba(180,220,255,0.35)';
        ctx.fillRect(x - 1.5 * s * 3, y - 1.5 * s * 3, 3 * s * 3, 3 * s * 3);
      }
      if (o.r2 > 0.6) {                                                 // 옥상 네온 간판
        const sp = this.project(cam, o.x, o.y, o.e + bh + u * 0.5);
        if (sp) { ctx.fillStyle = ['#FF5C7A', '#4CC9F0', '#FFD166'][Math.floor(o.r * 3)];
          ctx.fillRect(sp.x - u * 0.6 * s, sp.y - u * 0.16 * s, u * 1.2 * s, u * 0.32 * s); }
      }

    } else if (o.kind === 'lamp') {
      const ph = u * 2.0;
      const top = this.project(cam, o.x, o.y, o.e + ph);
      if (!top) return;
      const w = Math.max(1, u * 0.07 * s);
      ctx.fillStyle = '#5B6474'; ctx.fillRect(base.x - w/2, top.y, w, base.y - top.y);
      const arm = (o.side || 1) * -1;                                   // 도로 쪽으로 팔
      ctx.fillRect(base.x - (arm < 0 ? u * 0.5 * s : 0), top.y, u * 0.5 * s, w);
      const lx = base.x + arm * u * 0.5 * s, ly = top.y;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, u * 0.9 * s);
      g.addColorStop(0, 'rgba(255,220,150,0.55)'); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, u * 0.9 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFE9B0'; ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.5, u * 0.1 * s), 0, Math.PI * 2); ctx.fill();

    } else if (o.kind === 'billboard') {
      const ph = u * 2.6;
      const top = this.project(cam, o.x, o.y, o.e + ph);
      if (!top) return;
      const pw = Math.max(1.2, u * 0.12 * s);
      ctx.fillStyle = '#4B5566'; ctx.fillRect(base.x - pw/2, top.y, pw, base.y - top.y);
      const bw = u * 2.2 * s, bh = u * 1.1 * s;
      const cols = [['#FF5C7A', 'GO!'], ['#4CC9F0', 'SPEED'], ['#FFD166', 'RACE'], ['#06D6A0', 'DRIFT']];
      const [cc, txt] = cols[Math.floor(o.r * 4)];
      ctx.fillStyle = '#0B0D12'; ctx.fillRect(top.x - bw/2 - 2, top.y - bh + 2, bw + 4, bh);
      ctx.fillStyle = cc; ctx.fillRect(top.x - bw/2, top.y - bh + 4, bw, bh - 4);
      if (bw > 26) { ctx.fillStyle = '#0B0D12'; ctx.font = '800 ' + Math.round(bh * 0.5) + 'px Pretendard, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(txt, top.x, top.y - bh * 0.28); ctx.textAlign = 'left'; }

    } else if (o.kind === 'balloon') {
      // 떠 있는 풍선 — 살랑살랑
      const bob = Math.sin(now / 700 + o.r * 6) * u * 0.2;
      const bh = u * (2.6 + o.r * 1.6) + bob;
      const top = this.project(cam, o.x, o.y, o.e + bh);
      if (!top) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      const r = Math.max(2, u * 0.42 * s);
      ctx.fillStyle = ['#FF5C7A', '#FFD166', '#4CC9F0', '#B15DFF'][Math.floor(o.r * 4)];
      ctx.beginPath(); ctx.ellipse(top.x, top.y - r, r, r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(top.x - r * 0.35, top.y - r * 1.4, r * 0.25, 0, Math.PI * 2); ctx.fill();

    } else if (o.kind === 'umbrella') {
      const ph = u * 1.5;
      const top = this.project(cam, o.x, o.y, o.e + ph);
      if (!top) return;
      ctx.fillStyle = '#E8DCC8'; ctx.fillRect(base.x - 1, top.y, Math.max(1, u * 0.06 * s), base.y - top.y);
      const r = Math.max(3, u * 0.9 * s);
      ctx.fillStyle = o.r < 0.5 ? '#FF5C7A' : '#4CC9F0';
      ctx.beginPath(); ctx.ellipse(top.x, top.y, r, r * 0.4, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = -1; k <= 1; k += 2) { ctx.beginPath(); ctx.ellipse(top.x + k * r * 0.5, top.y, r * 0.16, r * 0.4, 0, Math.PI, 0); ctx.fill(); }

    } else if (o.kind === 'snowman') {
      const rs = [0.5, 0.38, 0.28];
      let z = 0;
      rs.forEach((rr, k) => {
        z += (k === 0 ? rr : rs[k - 1] + rr * 0.9) * u;
        const p = this.project(cam, o.x, o.y, o.e + z);
        if (!p) return;
        ctx.fillStyle = '#F4F6FA'; ctx.beginPath(); ctx.arc(p.x, p.y, rr * u * s, 0, Math.PI * 2); ctx.fill();
        if (k === 2) { ctx.fillStyle = '#FF8A56'; ctx.fillRect(p.x, p.y - 1, rr * u * s * 0.8, Math.max(1, u * 0.05 * s));
          ctx.fillStyle = '#1A1D24'; ctx.beginPath(); ctx.arc(p.x - rr * u * s * 0.3, p.y - rr * u * s * 0.25, Math.max(1, u * 0.04 * s), 0, Math.PI * 2); ctx.fill(); }
      });

    } else if (o.kind === 'windmill') {
      const ph = u * 3.2;
      const top = this.project(cam, o.x, o.y, o.e + ph);
      if (!top) return;
      const w = Math.max(1.5, u * 0.16 * s);
      ctx.fillStyle = '#C9CFD8';
      ctx.beginPath(); ctx.moveTo(base.x - w * 1.6, base.y); ctx.lineTo(base.x + w * 1.6, base.y); ctx.lineTo(top.x + w * 0.5, top.y); ctx.lineTo(top.x - w * 0.5, top.y); ctx.closePath(); ctx.fill();
      const br = u * 1.1 * s, a0 = now / 900 + o.r * 6;
      ctx.strokeStyle = '#E6EAF0'; ctx.lineWidth = Math.max(1.5, u * 0.09 * s); ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(top.x + Math.cos(a) * br, top.y + Math.sin(a) * br); ctx.stroke();
      }
    }
  }

  boxCorners(cam, cx, cy, baseE, angle, len, wid, height) {
    const co = Math.cos(angle), si = Math.sin(angle);
    const pts = [[len/2,-wid/2],[len/2,wid/2],[-len/2,wid/2],[-len/2,-wid/2]];
    const g = [], u = [];
    for (const [dx, dy] of pts) {
      const wx = cx + dx*co - dy*si, wy = cy + dx*si + dy*co;
      const p0 = this.project(cam, wx, wy, baseE);
      const p1 = this.project(cam, wx, wy, baseE + height);
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

  drawKart3D(ctx, cam, x, y, e, angle, look, name, isMe, spinning, shield, boosting, now, allowFull) {
    const t = this.track;
    if (typeof look === 'string') look = { style: 'racer', color: look };
    const color = look.color, style = look.style || 'racer';
    const SHAPE = {
      racer:  { L: 1.05, W: 0.58, H: 0.26, cab: 0.42, cabH: 0.7, spoiler: 1.2, nose: true },
      buggy:  { L: 0.92, W: 0.72, H: 0.34, cab: 0.30, cabH: 0.55, spoiler: 0,   cage: true, wheel: 1.3 },
      truck:  { L: 0.98, W: 0.74, H: 0.44, cab: 0.36, cabH: 1.1,  spoiler: 0,   cabFront: true, bed: true },
      rocket: { L: 1.12, W: 0.50, H: 0.26, cab: 0.34, cabH: 0.75, spoiler: 0,   fins: true, nose: true }
    }[style] || {};
    const L = t.carLen * (SHAPE.L || 1), Wd = t.carLen * (SHAPE.W || 0.62), Hh = t.carLen * (SHAPE.H || 0.30);
    const co = Math.cos(angle), si = Math.sin(angle);
    const fwd = (d, w) => ({ x: x + co * d - si * w, y: y + si * d + co * w });

    // 그림자
    const sh = this.boxCorners(cam, x, y, e, angle, L * 1.05, Wd * 1.1, 0.01);
    if (!sh) return;
    this.fillPoly(ctx, sh.g, 'rgba(0,0,0,0.36)');

    // 화면에서 작게 보이면 단순 모델로 (성능)
    const px0 = this.project(cam, x, y, e);
    const screenLen = px0 ? L * px0.s : 0;
    const full = (allowFull !== false) && screenLen > 26;

    // 바퀴 4개 (차체보다 살짝 바깥, 어두운 원통 느낌)
    const wk = SHAPE.wheel || 1;
    const wl = L * 0.26 * wk, ww = Wd * 0.22 * wk, wh = Hh * 0.9 * wk;
    (full ? [[L * 0.30, Wd * 0.62], [L * 0.30, -Wd * 0.62], [-L * 0.32, Wd * 0.62], [-L * 0.32, -Wd * 0.62]] : [])
      .forEach(([d, w]) => {
        const c = fwd(d, w);
        const wb = this.boxCorners(cam, c.x, c.y, e, angle, wl, ww, wh);
        if (!wb) return;
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          this.fillPoly(ctx, [wb.g[i], wb.g[j], wb.u[j], wb.u[i]], i % 2 ? '#1A1D24' : '#262A33');
        }
        this.fillPoly(ctx, wb.u, '#3A3F4B');
        // 휠 림
        const rc = this.project(cam, c.x, c.y, e + wh);
        if (rc) { ctx.fillStyle = '#8A919E'; ctx.beginPath();
          ctx.ellipse(rc.x, rc.y, ww * 0.35 * rc.s, wl * 0.22 * rc.s, angle - cam.angle0, 0, Math.PI * 2); ctx.fill(); }
      });

    // 부스터 불꽃 (차체 뒤)
    if (boosting) {
      const fc = fwd(-L * 0.78, 0);
      const fl = this.boxCorners(cam, fc.x, fc.y, e + Hh * 0.2, angle, L * (0.45 + Math.random() * 0.25), Wd * 0.5, Hh * 0.45);
      if (fl) { this.fillPoly(ctx, fl.u, 'rgba(76,201,240,0.72)');
                const core = this.boxCorners(cam, fc.x, fc.y, e + Hh * 0.28, angle, L * 0.25, Wd * 0.22, Hh * 0.3);
                if (core) this.fillPoly(ctx, core.u, 'rgba(255,255,255,0.85)'); }
    }

    // 차체 (앞이 살짝 낮은 웨지 느낌: 앞쪽 상자를 낮게, 뒤쪽 상자를 높게)
    const dark = this.shade(color, -0.34), mid = this.shade(color, -0.16), hi = this.shade(color, 0.18);
    const body = this.boxCorners(cam, x, y, e + Hh * 0.35, angle, L, Wd, Hh);
    if (!body) return;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.fillPoly(ctx, [body.g[i], body.g[j], body.u[j], body.u[i]], i === 0 ? mid : (i === 2 ? dark : this.shade(color, -0.24)));
    }
    this.fillPoly(ctx, body.u, color);
    if (!full) {
      // 멀리: 차체 + 캐빈만
      const cabF = this.boxCorners(cam, fwd(-L * 0.12, 0).x, fwd(-L * 0.12, 0).y, e + Hh * 1.35, angle, L * 0.42, Wd * 0.7, Hh * 0.7);
      if (cabF) { this.fillPoly(ctx, cabF.g, this.shade(color, -0.35)); this.fillPoly(ctx, cabF.u, this.shade(color, 0.05)); }
    } else {
    // 보닛 하이라이트 줄
    const bh = this.boxCorners(cam, fwd(L * 0.18, 0).x, fwd(L * 0.18, 0).y, e + Hh * 1.36, angle, L * 0.5, Wd * 0.18, 0.01);
    if (bh) this.fillPoly(ctx, bh.u, this.rgba(hi, 0.55));

    // 캐빈 + 앞유리 (트럭은 앞쪽에, 버기는 롤케이지)
    const cc = fwd(SHAPE.cabFront ? L * 0.16 : -L * 0.12, 0);
    const cabLen = L * (SHAPE.cab || 0.42), cabHgt = Hh * (SHAPE.cabH || 0.75);
    const cab = SHAPE.cage ? null : this.boxCorners(cam, cc.x, cc.y, e + Hh * 1.35, angle, cabLen, Wd * 0.7, cabHgt);
    if (cab) {
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        this.fillPoly(ctx, [cab.g[i], cab.g[j], cab.u[j], cab.u[i]],
          i === 0 ? 'rgba(200,235,255,0.55)' : (i === 2 ? this.shade(color, -0.42) : this.shade(color, -0.3)));
      }
      this.fillPoly(ctx, cab.u, this.shade(color, 0.05));
    }
    if (SHAPE.cage) {                                   // 버기 롤케이지 — 얇은 기둥 4개 + 지붕 테
      [[L * 0.12, Wd * 0.34], [L * 0.12, -Wd * 0.34], [-L * 0.32, Wd * 0.34], [-L * 0.32, -Wd * 0.34]].forEach(([d, w]) => {
        const c2 = fwd(d, w);
        const bar = this.boxCorners(cam, c2.x, c2.y, e + Hh * 1.35, angle, L * 0.06, Wd * 0.08, Hh * 1.3);
        if (bar) { this.fillPoly(ctx, [bar.g[0], bar.g[1], bar.u[1], bar.u[0]], '#2B3140'); this.fillPoly(ctx, bar.u, '#8A919E'); }
      });
      const roof = this.boxCorners(cam, fwd(-L * 0.1, 0).x, fwd(-L * 0.1, 0).y, e + Hh * 2.6, angle, L * 0.5, Wd * 0.78, Hh * 0.08);
      if (roof) this.fillPoly(ctx, roof.u, '#8A919E');
    }
    if (SHAPE.bed) {                                    // 트럭 짐칸
      const bd = fwd(-L * 0.2, 0);
      const bed = this.boxCorners(cam, bd.x, bd.y, e + Hh * 1.35, angle, L * 0.5, Wd * 0.9, Hh * 0.35);
      if (bed) { this.fillPoly(ctx, [bed.g[2], bed.g[3], bed.u[3], bed.u[2]], this.shade(color, -0.45)); this.fillPoly(ctx, bed.u, '#2B3140'); }
    }
    if (SHAPE.fins) {                                   // 로켓 꼬리 지느러미
      [1, -1].forEach(sd => {
        const fc2 = fwd(-L * 0.42, Wd * 0.5 * sd);
        const fin = this.boxCorners(cam, fc2.x, fc2.y, e + Hh * 1.3, angle, L * 0.22, Wd * 0.06, Hh * 1.0);
        if (fin) { this.fillPoly(ctx, [fin.g[0], fin.g[1], fin.u[1], fin.u[0]], this.shade(color, -0.3)); this.fillPoly(ctx, fin.u, this.shade(color, 0.1)); }
      });
    }
    if (SHAPE.nose) {                                   // 뾰족한 앞코
      const nc = fwd(L * 0.58, 0);
      const nose = this.boxCorners(cam, nc.x, nc.y, e + Hh * 0.35, angle, L * 0.22, Wd * 0.5, Hh * 0.7);
      if (nose) { this.fillPoly(ctx, [nose.g[0], nose.g[1], nose.u[1], nose.u[0]], this.shade(color, -0.2)); this.fillPoly(ctx, nose.u, this.shade(color, 0.08)); }
    }
    // 헬멧 (운전자)
    const hm = this.project(cam, cc.x, cc.y, e + Hh * 2.35);
    if (hm) {
      ctx.fillStyle = isMe ? '#FFD166' : '#F4F6FA';
      ctx.beginPath(); ctx.arc(hm.x, hm.y, Wd * 0.2 * hm.s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1A1D24';
      ctx.beginPath(); ctx.ellipse(hm.x, hm.y + Wd * 0.03 * hm.s, Wd * 0.14 * hm.s, Wd * 0.07 * hm.s, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 스포일러 (레이서만 크게)
    if (SHAPE.spoiler) {
      const sp = fwd(-L * 0.46, 0);
      const spoiler = this.boxCorners(cam, sp.x, sp.y, e + Hh * 1.9, angle, L * 0.1, Wd * SHAPE.spoiler, Hh * 0.16);
      if (spoiler) { this.fillPoly(ctx, spoiler.g, dark); this.fillPoly(ctx, spoiler.u, this.shade(color, -0.1)); }
      [1, -1].forEach(sd => {
        const st = fwd(-L * 0.46, Wd * 0.4 * sd);
        const stem = this.boxCorners(cam, st.x, st.y, e + Hh * 1.35, angle, L * 0.05, Wd * 0.05, Hh * 0.55);
        if (stem) this.fillPoly(ctx, [stem.g[0], stem.g[1], stem.u[1], stem.u[0]], dark);
      });
    }

    // 전조등 · 후미등
    [[L * 0.5, Wd * 0.32, '#FFF8D0', 0.85], [L * 0.5, -Wd * 0.32, '#FFF8D0', 0.85],
     [-L * 0.5, Wd * 0.3, '#FF3B3B', 0.9], [-L * 0.5, -Wd * 0.3, '#FF3B3B', 0.9]].forEach(([d, w, cl, al]) => {
      const lp = fwd(d, w);
      const pp = this.project(cam, lp.x, lp.y, e + Hh * 0.95);
      if (!pp) return;
      ctx.fillStyle = this.rgba(cl, al);
      ctx.beginPath(); ctx.arc(pp.x, pp.y, Math.max(1.2, Wd * 0.09 * pp.s), 0, Math.PI * 2); ctx.fill();
    });
    }   // full

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(body.u[0].x, body.u[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(body.u[i].x, body.u[i].y);
      ctx.closePath(); ctx.stroke();
    }

    const c = this.project(cam, x, y, e + Hh);
    if (!c) return;
    if (shield) {
      ctx.strokeStyle = 'rgba(6,214,160,0.85)';
      ctx.lineWidth = Math.max(1.5, 3 * c.s * 12);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, L * 0.9 * c.s, L * 0.45 * c.s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (spinning) {
      ctx.strokeStyle = '#FFD166';
      ctx.lineWidth = Math.max(2, 3.5 * c.s * 12);
      const a0 = now / 80 % (Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, L * 0.82 * c.s, L * 0.42 * c.s, 0, a0, a0 + 2.2);
      ctx.stroke();
    }

    if (name) {
      const fs = Math.max(9, Math.min(15, 3200 * c.s / 100));
      const top = this.project(cam, x, y, e + Hh * 3.6);
      if (!top) return;
      ctx.font = '700 ' + fs.toFixed(1) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(name).width + fs;
      ctx.fillStyle = isMe ? 'rgba(76,201,240,0.92)' : 'rgba(12,15,22,0.8)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(top.x - tw / 2, top.y - fs * 1.35, tw, fs * 1.5, fs * 0.35);
        ctx.fill();
      }
      ctx.fillStyle = isMe ? '#06121A' : '#EAECF2';
      ctx.fillText(name, top.x, top.y - fs * 0.2);
    }
  }

  drawBox3D(ctx, cam, x, y, e, now) {
    const t = this.track;
    const sz = t.carLen * 0.55;
    const bob = Math.sin(now/280 + x*0.01) * sz * 0.3;
    const b = this.boxCorners(cam, x, y, e + sz*0.35 + bob, now/650, sz, sz, sz);
    if (!b) return;
    const gp = this.project(cam, x, y, e);
    if (gp) {
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath(); ctx.ellipse(gp.x, gp.y, sz*gp.s*0.8, sz*gp.s*0.34, 0, 0, Math.PI*2); ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      const j = (i+1) % 4;
      this.fillPoly(ctx, [b.g[i], b.g[j], b.u[j], b.u[i]], i % 2 ? '#C77F12' : '#E39A1C');
    }
    this.fillPoly(ctx, b.u, '#FFD166');
    const c = this.project(cam, x, y, e + sz*1.35 + bob);
    if (c) {
      const fs = Math.max(8, Math.min(26, 2600 * c.s / 100));
      ctx.fillStyle = '#6B4A00';
      ctx.font = 'bold ' + fs.toFixed(1) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', c.x, c.y);
      ctx.textBaseline = 'alphabetic';
    }
  }

  drawBanana3D(ctx, cam, x, y, e) {
    const t = this.track;
    const r = t.carLen * 0.3;
    const g = this.project(cam, x, y, e);
    const u = this.project(cam, x, y, e + r*0.7);
    if (!g || !u) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y, r*g.s*1.1, r*g.s*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FFD166';
    ctx.beginPath(); ctx.ellipse(u.x, u.y, r*u.s*1.1, r*u.s*0.62, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#8A6D1F'; ctx.lineWidth = Math.max(1, 2*u.s*12); ctx.stroke();
  }

  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, Math.round(v)));
    return 'rgb(' + cl(((n>>16)&255)*(1+amt)) + ',' + cl(((n>>8)&255)*(1+amt)) + ',' + cl((n&255)*(1+amt)) + ')';
  }
  lighten(hex, amt) { return this.shade(hex, amt); }

  drawParts(ctx, cam) {
    const t = this.track;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      const q = this.project(cam, p.x, p.y, p.h);
      if (!q) continue;
      const r = Math.max(0.8, p.size * t.carScale * q.s * 0.9);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawSpeedLines(ctx, W, H) {
    ctx.save();
    const cx = W / 2, cy = H * 0.55, t = performance.now();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + Math.sin(i * 3.1) * 0.2;
      const phase = ((t / 260) + i * 0.37) % 1;
      const r1 = Math.min(W, H) * (0.34 + phase * 0.3), r2 = r1 + Math.min(W, H) * 0.22;
      const g = ctx.createLinearGradient(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
                                         cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(160,230,255,' + (0.5 * (1 - phase)).toFixed(2) + ')');
      ctx.strokeStyle = g; ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // 가장자리 비네트
    const v = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(76,201,240,0)'); v.addColorStop(1, 'rgba(76,201,240,0.18)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
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

    // 카운트다운 — 유리 원판 + 링 + 큰 숫자
    if (this.countdown > 0) {
      const n = Math.ceil(this.countdown);
      const label = n > 3 ? 'READY' : (n === 0 ? 'GO!' : String(n));
      const frac = this.countdown - Math.floor(this.countdown);
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,16,0.5)'; ctx.fillRect(0, 0, W, H);
      const R = Math.min(W, H) * 0.2;
      ctx.translate(W/2, H*0.46);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = n <= 1 ? '#2DE2A6' : '#FFD166'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, R * 1.15, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * (1 - frac)); ctx.stroke();
      ctx.scale(1 + (1-frac)*0.18, 1 + (1-frac)*0.18);
      ctx.fillStyle = n <= 1 ? '#2DE2A6' : '#FFFFFF';
      ctx.font = '800 ' + (n > 3 || n === 0 ? R * 0.55 : R * 1.1).toFixed(0) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
      // 출발 시 트랙 이름
      ctx.save();
      ctx.font = '700 15px Pretendard, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(this.track.def.name + ' · ' + this.track.laps + '바퀴', W/2, H*0.46 + Math.min(W, H) * 0.32);
      ctx.restore();
    }

    // 출발 직후 GO! 잔상
    if (this.startedAt && now - this.startedAt < 900) {
      const k = 1 - (now - this.startedAt) / 900;
      ctx.save(); ctx.globalAlpha = k * 0.9;
      ctx.translate(W/2, H*0.46); ctx.scale(1 + (1-k) * 1.2, 1 + (1-k) * 1.2);
      ctx.fillStyle = '#2DE2A6'; ctx.font = '800 72px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GO!', 0, 0);
      ctx.restore();
    }

    // 마지막 바퀴 배너
    if (this.finalLapUntil && now < this.finalLapUntil) {
      const life = (this.finalLapUntil - now) / 2200;
      const slide = life > 0.85 ? (1 - (life - 0.85) / 0.15) : (life < 0.15 ? life / 0.15 : 1);
      ctx.save();
      ctx.globalAlpha = slide;
      const bw = Math.min(W * 0.86, 360), bh = 58, by = H * 0.2;
      ctx.translate(W/2 + (1 - slide) * 60, by);
      ctx.fillStyle = 'rgba(8,10,16,0.85)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-bw/2, -bh/2, bw, bh, 16); ctx.fill(); }
      ctx.fillStyle = '#FFD166'; ctx.fillRect(-bw/2, -bh/2, 6, bh);
      ctx.font = '800 24px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFD166'; ctx.fillText('FINAL LAP', 0, -8);
      ctx.font = '600 12px Pretendard, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('마지막 바퀴입니다', 0, 14);
      ctx.restore();
    }

    // 순위 변동
    if (this.rankFlash && now < this.rankFlash.until) {
      const life = (this.rankFlash.until - now) / 1400;
      const up = this.rankFlash.up;
      ctx.save();
      ctx.globalAlpha = Math.min(1, life * 3);
      ctx.translate(W/2, H * 0.34 - (1 - life) * 18);
      ctx.font = '800 30px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = up ? '#2DE2A6' : '#FF5C7A';
      ctx.fillText((up ? '▲ ' : '▼ ') + this.rankFlash.rank + '위', 0, 0);
      ctx.restore();
    }

    // 완주 — 결과 카드
    if (this.finished) {
      const k = Math.min(1, (now - (this.finishedAt || now)) / 600);
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,16,' + (0.55 * k).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
      const cw = Math.min(W * 0.82, 340), ch = 200;
      ctx.globalAlpha = k;
      ctx.translate(W/2, H/2 + (1 - k) * 30);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw, ch, 24); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-cw/2, -ch/2, cw, ch, 24); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('FINISH', 0, -ch/2 + 30);
      const rk = this.finishRank;
      ctx.font = '800 64px Pretendard, sans-serif';
      ctx.fillStyle = rk === 1 ? '#FFD166' : (rk === 2 ? '#E6EAF0' : (rk === 3 ? '#F5A524' : '#4CC9F0'));
      ctx.fillText(rk ? rk + '위' : '완주', 0, -4);
      ctx.font = '600 14px Pretendard, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(this.track.def.name + ' · ' + this.track.laps + '바퀴 완주', 0, ch/2 - 32);
      ctx.restore();
      // 1위 축하 — 색종이
      if (rk === 1 && now - (this.finishedAt || now) < 3000) {
        if (!this.confetti) this.confetti = Array.from({ length: 60 }, () => ({
          x: W/2 + (Math.random() - .5) * 60, y: H/2, vx: (Math.random() - .5) * 8, vy: -4 - Math.random() * 6,
          c: KART_COLORS[Math.floor(Math.random() * KART_COLORS.length)], r: 3 + Math.random() * 4, a: Math.random() * 6 }));
        this.confetti.forEach(p => { p.x += p.vx; p.vy += 0.18; p.y += p.vy; p.a += 0.2;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r); ctx.restore(); });
      }
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
