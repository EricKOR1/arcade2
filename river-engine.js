// 태화강 AI 안전망 — 특강 '첨단 바이오와 AI로 만드는 울산의 환경보건 안전망' 내용을 게임 규칙으로 옮겼습니다.
//   · 알아내기: 바이오센서 드론이 강을 따라 떠내려오는 것을 '분석'합니다 (발사 = 분석 펄스)
//   · 판단하기: 오염물(폐수·기름·벤젠·쓰레기)만 잡아야 합니다. 연어·은어·나뭇잎을 잡으면 '오경보' → 신뢰도 하락
//   · 알리기: 신뢰도가 낮으면 경보를 사람들이 무시해 잡아도 막지 못합니다 (특강 30쪽 "경보가 너무 자주 울리면")
//   · 오염물이 취수장까지 내려가면 BOD 가 오릅니다. 1996년 태화강 수준(11.3)에 닿으면 끝.
//   · 악취 이벤트: 바람 화살표를 보고 냄새의 출발 공장을 '역추적' (23쪽 울주군 악취 시스템)
//   · 하수 검사 보너스: 하수 통을 분석하면 독감 유행을 1주일 먼저 발견 (19쪽)

const RV_COLS = 12, RV_ROWS = 20, RV_LANES = 5;

const RV_ITEMS = {
  sewage:  { bad: true,  name: '폐수',      color: '#6B4A2B', score: 40, bod: 1.2 },
  oil:     { bad: true,  name: '기름',      color: '#1A1D24', score: 50, bod: 1.5 },
  benzene: { bad: true,  name: '벤젠',      color: '#B15DFF', score: 60, bod: 1.0 },
  trash:   { bad: true,  name: '쓰레기',    color: '#8A919E', score: 30, bod: 0.6 },
  salmon:  { bad: false, name: '연어',      color: '#FF8A80', score: -1 },
  sweet:   { bad: false, name: '은어',      color: '#A7D8F0', score: -1 },
  leaf:    { bad: false, name: '나뭇잎',    color: '#7BC47F', score: -1 },
  dna:     { bad: false, name: '환경DNA 병', color: '#06D6A0', score: 80, bonus: 'dna' },
  sewer:   { bad: false, name: '하수 시료',  color: '#FFD166', score: 100, bonus: 'flu' },
};
const RV_FACTS = [
  '1996년 태화강 BOD 11.3 — 물고기 떼죽음. 2007년 이후 1급수',
  '환경DNA: 물 1리터만 떠도 어떤 물고기가 사는지 압니다',
  '울산은 하수를 검사해 독감 유행을 병원보다 1주일 먼저 압니다',
  '경보가 너무 자주 울리면 사람들은 무시합니다 — 오경보를 줄이세요',
  '악취 센서 37대 + 바람 정보로 냄새의 출발지를 거꾸로 찾습니다',
  '바이오가 알아내고, AI가 판단하고, 사람이 결정합니다',
];

class RiverGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = RV_COLS; this.H = RV_ROWS;
    this.lane = 2; this.x = this.laneX(2); this.steer = 0; this.firing = false; this.lastFire = 0;
    this.items = []; this.pulses = []; this.parts = []; this.toasts = [];
    this.score = 0; this.bod = 2.0; this.trust = 100; this.wave = 1; this.caught = 0; this.falseAlarms = 0; this.gameOver = false;
    this.lastTime = 0; this.now = 0; this.flow = 0; this.spawnT = 1200; this.waveT = 0;
    this.odor = null; this.fluFound = 0; this.dnaFound = 0; this.factIdx = 0;
  }
  laneX(l) { return (l + 0.5) * (this.W / RV_LANES); }
  move(dir) { this.steer = dir; }
  releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  rotate() { this.fire(); } hardDrop() { this.fire(); } softDrop() {} up() {}
  fire() {
    if (this.gameOver || this.now - this.lastFire < 260) return;
    this.lastFire = this.now;
    this.pulses.push({ x: this.x, y: this.H - 2.2, r: 0.2 });
    if (window.Sound) Sound.move();
  }
  toast(text, color) { this.toasts.push({ text, color: color || '#fff', until: this.now + 1500 }); }

  get speedMul() { return 1 + (this.wave - 1) * 0.12; }
  get bodText() { return this.bod.toFixed(1); }

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    this.flow += 0.02 * f;
    // 드론: 차선 사이를 부드럽게
    if (this.steer && !this._steerLatch) { this.lane = Math.max(0, Math.min(RV_LANES - 1, this.lane + this.steer)); this._steerLatch = true; }
    if (!this.steer) this._steerLatch = false;
    this.x += (this.laneX(this.lane) - this.x) * Math.min(1, 0.25 * f);
    if (this.firing) this.fire();

    // 생성
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(420, 1300 - this.wave * 90) * (0.7 + Math.random() * 0.6);
      const rain = this.waveT % 5 === 4;                 // 5파도마다 '장맛비 다음 날' — 오염물 두 배
      const roll = Math.random();
      const bad = ['sewage', 'oil', 'benzene', 'trash'], good = ['salmon', 'sweet', 'leaf'];
      let kind;
      if (roll < (rain ? 0.7 : 0.5)) kind = bad[Math.floor(Math.random() * bad.length)];
      else if (roll < 0.9) kind = good[Math.floor(Math.random() * good.length)];
      else kind = Math.random() < 0.6 ? 'dna' : 'sewer';
      this.items.push({ kind, lane: Math.floor(Math.random() * RV_LANES), y: -1, wob: Math.random() * 6.28, spd: (0.028 + Math.random() * 0.012) * this.speedMul });
    }
    // 악취 이벤트: 20초마다 — 바람 화살표와 냄새 구름, 출발 공장(차선)을 맞히면 보너스
    if (this.lastOdor == null) this.lastOdor = now - 14000;      // 첫 악취는 2파도 진입 6초 뒤
    if (!this.odor && now - this.lastOdor > 20000 && this.wave >= 2) {
      const src = Math.floor(Math.random() * RV_LANES); const dir = Math.random() < 0.5 ? -1 : 1;
      const cloudLane = Math.max(0, Math.min(RV_LANES - 1, src + dir));
      this.odor = { src, cloudLane, windDir: dir, until: now + 9000 }; this.lastOdor = now;
      this.toast('악취 발생! 바람을 보고 출발 공장을 분석하세요', '#FFD166');
    }
    if (this.odor && now > this.odor.until) { this.odor = null; this.toast('악취 원인을 못 찾았어요', '#9AA3B2'); }

    // 흐름
    this.items.forEach(it => { it.y += it.spd * f; it.wob += 0.05 * f; });
    // 펄스
    this.pulses.forEach(p => { p.r += 0.32 * f; });
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      // 악취 역추적: 공장(맨 위) 차선을 펄스로 분석
      if (this.odor && p.r > 1.2 && p.r < 1.8) {
        const l = Math.round(p.x / (this.W / RV_LANES) - 0.5);
        if (l === this.odor.src) { this.score += 150; this.toast('역추적 성공! 원인 공장 점검 +150', '#06D6A0'); this.odor = null; if (window.Sound) Sound.levelUp(); }
      }
      let hit = false;
      for (let j = this.items.length - 1; j >= 0; j--) {
        const it = this.items[j], d = Math.hypot(this.laneX(it.lane) - p.x, it.y - (this.H - 2.2));
        if (d < p.r && d > p.r - 0.5) {
          const def = RV_ITEMS[it.kind]; this.items.splice(j, 1); hit = true;
          if (def.bad) {
            if (this.trust < 30) { this.toast('경보를 아무도 안 믿어요…', '#FF5C7A'); this.bod += def.bod * 0.5; }
            else { this.score += def.score; this.caught++; this.trust = Math.min(100, this.trust + 2); this.burst(this.laneX(it.lane), it.y, def.color); if (window.Sound) Sound.clear(1); }
          } else if (def.bonus === 'dna') { this.score += def.score; this.dnaFound++; this.toast('환경DNA: 연어 ' + (12 + this.dnaFound * 3) + '마리 확인 +80', '#06D6A0'); if (window.Sound) Sound.levelUp(); }
          else if (def.bonus === 'flu') { this.score += def.score; this.fluFound++; this.toast('하수 검사: 독감 유행 1주일 먼저 발견 +100', '#FFD166'); if (window.Sound) Sound.levelUp(); }
          else { this.falseAlarms++; this.trust = Math.max(0, this.trust - 15); this.score = Math.max(0, this.score - 20); this.toast('오경보! ' + def.name + '는 오염물이 아니에요 (신뢰도 -15)', '#FF5C7A'); if (window.Sound) Sound.crash(); if (window.Haptic) Haptic.hit(); }
        }
      }
      if (p.r > 3 || hit) this.pulses.splice(i, 1);
    }
    // 취수장 도달
    for (let j = this.items.length - 1; j >= 0; j--) {
      const it = this.items[j];
      if (it.y > this.H - 1) {
        const def = RV_ITEMS[it.kind]; this.items.splice(j, 1);
        if (def.bad) { this.bod += def.bod; this.burst(this.laneX(it.lane), this.H - 1, '#FF5C7A'); if (window.Sound) Sound.crash(); if (window.Haptic) Haptic.hit(); this.toast(def.name + ' 유입 — BOD ' + this.bod.toFixed(1), '#FF5C7A'); }
      }
    }
    // BOD 는 천천히 회복 (자정 작용)
    this.bod = Math.max(1.0, this.bod - 0.0006 * f);
    if (this.bod >= 11.3) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
    // 파도
    this.waveT += dt / 1000;
    if (this.waveT >= 18) { this.waveT = 0; this.wave++; this.score += 100; this.toast(RV_FACTS[this.factIdx++ % RV_FACTS.length], '#4CC9F0'); if (window.Sound) Sound.levelUp(); }
    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.05 * f; }); this.parts = this.parts.filter(p => p.l > 0);
    this.toasts = this.toasts.filter(t => t.until > now);
    this.draw();
  }
  burst(x, y, c) { for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.06; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }

  getSnapshot() {
    const g = Array.from({ length: this.H }, () => Array(this.W).fill(58));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cx < this.W && cy >= 0 && cy < this.H) g[cy][cx] = v; };
    for (let x = 0; x < this.W; x++) { g[0][x] = 46; g[this.H - 1][x] = 59; }
    this.items.forEach(it => put(this.laneX(it.lane), it.y, RV_ITEMS[it.kind].bad ? 60 : (RV_ITEMS[it.kind].bonus ? 48 : 61)));
    put(this.x, this.H - 2.2, 23);
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs, now = this.now;
    // 강물
    const water = ctx.createLinearGradient(0, 0, 0, H); water.addColorStop(0, '#0E3A5C'); water.addColorStop(1, '#134B73');
    ctx.fillStyle = water; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const y = ((this.flow * 40 + i * 70) % (H + 60)) - 30; ctx.beginPath(); ctx.moveTo((i % 3) * cs * 3, y); ctx.bezierCurveTo(W * 0.3, y - 6, W * 0.6, y + 6, W, y); ctx.stroke(); }
    // 위: 산업단지 (공장 5개 = 차선) · 아래: 취수장
    for (let l = 0; l < RV_LANES; l++) {
      const x = this.laneX(l) * cs;
      ctx.fillStyle = '#3A4256'; ctx.fillRect(x - cs * 0.9, 0, cs * 1.8, cs * 0.9);
      ctx.fillStyle = '#4B5566'; ctx.fillRect(x - cs * 0.25, -cs * 0.2, cs * 0.5, cs * 0.8);
      if (this.odor && l === this.odor.src) { ctx.fillStyle = 'rgba(255,209,102,0.25)'; ctx.fillRect(x - cs, 0, cs * 2, cs); }
    }
    ctx.fillStyle = '#1E2A3A'; ctx.fillRect(0, H - cs * 0.6, W, cs * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '700 ' + Math.round(cs * 0.45) + 'px Pretendard, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('취수장 →', cs * 0.3, H - cs * 0.18);
    // 악취 구름 + 바람
    if (this.odor) {
      const cx = this.laneX(this.odor.cloudLane) * cs, cy = cs * 2.2;
      ctx.fillStyle = 'rgba(180,120,200,0.45)'; [[-0.6, 0], [0, -0.3], [0.6, 0], [0, 0.3]].forEach(([ox, oy]) => { ctx.beginPath(); ctx.arc(cx + ox * cs, cy + oy * cs, cs * 0.55, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(cs * 0.5) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('냄새', cx, cy + cs * 0.15);
      // 바람 화살표: 구름에서 바람이 부는 쪽 → 출발지는 반대
      const ax = cx - this.odor.windDir * cs * 2.2, ay = cs * 3.4;
      ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + this.odor.windDir * cs * 2, ay); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax + this.odor.windDir * cs * 2, ay); ctx.lineTo(ax + this.odor.windDir * cs * 1.6, ay - cs * 0.3); ctx.lineTo(ax + this.odor.windDir * cs * 1.6, ay + cs * 0.3); ctx.closePath(); ctx.fillStyle = '#FFD166'; ctx.fill();
      ctx.font = '700 ' + Math.round(cs * 0.4) + 'px Pretendard, sans-serif'; ctx.fillText('바람', ax + this.odor.windDir * cs, ay + cs * 0.6);
      ctx.textAlign = 'left';
    }
    // 떠내려오는 것들
    this.items.forEach(it => {
      const def = RV_ITEMS[it.kind], x = this.laneX(it.lane) * cs + Math.sin(it.wob) * cs * 0.15, y = it.y * cs;
      ctx.fillStyle = def.color;
      if (it.kind === 'salmon' || it.kind === 'sweet') { ctx.beginPath(); ctx.ellipse(x, y, cs * 0.45, cs * 0.2, Math.sin(it.wob) * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - cs * 0.4, y); ctx.lineTo(x - cs * 0.65, y - cs * 0.18); ctx.lineTo(x - cs * 0.65, y + cs * 0.18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1A1D24'; ctx.beginPath(); ctx.arc(x + cs * 0.25, y - cs * 0.05, cs * 0.05, 0, Math.PI * 2); ctx.fill(); }
      else if (it.kind === 'leaf') { ctx.beginPath(); ctx.ellipse(x, y, cs * 0.35, cs * 0.2, 0.6, 0, Math.PI * 2); ctx.fill(); }
      else if (it.kind === 'oil') { ctx.beginPath(); ctx.ellipse(x, y, cs * 0.5, cs * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(140,120,255,0.5)'; ctx.beginPath(); ctx.ellipse(x - cs * 0.1, y - cs * 0.05, cs * 0.25, cs * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (it.kind === 'benzene') { ctx.globalAlpha = 0.75; [[-0.3, 0], [0.3, 0], [0, -0.25]].forEach(([ox, oy]) => { ctx.beginPath(); ctx.arc(x + ox * cs, y + oy * cs, cs * 0.3, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; }
      else if (it.kind === 'dna' || it.kind === 'sewer') { ctx.fillRect(x - cs * 0.2, y - cs * 0.35, cs * 0.4, cs * 0.7); ctx.fillStyle = '#fff'; ctx.fillRect(x - cs * 0.12, y - cs * 0.45, cs * 0.24, cs * 0.12); }
      else { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - cs * 0.35, y - cs * 0.28, cs * 0.7, cs * 0.56, cs * 0.12); else ctx.rect(x - cs * 0.35, y - cs * 0.28, cs * 0.7, cs * 0.56); ctx.fill(); }
      // 이름표 (가까워지면)
      if (it.y > this.H * 0.45) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 ' + Math.round(cs * 0.38) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(def.name, x, y - cs * 0.55); ctx.textAlign = 'left'; }
    });
    // 펄스
    this.pulses.forEach(p => { ctx.strokeStyle = 'rgba(76,201,240,' + (1 - p.r / 3).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x * cs, (this.H - 2.2) * cs, p.r * cs, 0, Math.PI * 2); ctx.stroke(); });
    // 드론
    { const x = this.x * cs, y = (this.H - 2.2) * cs;
      ctx.fillStyle = '#E6EAF0'; ctx.beginPath(); ctx.ellipse(x, y, cs * 0.5, cs * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4CC9F0'; ctx.beginPath(); ctx.arc(x, y, cs * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9AA3B2'; [[-0.6, -0.3], [0.6, -0.3]].forEach(([ox, oy]) => ctx.fillRect(x + ox * cs - cs * 0.15, y + oy * cs, cs * 0.3, cs * 0.06)); }
    this.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - 1.5, p.y * cs - 1.5, 3, 3); }); ctx.globalAlpha = 1;
    // HUD: BOD 게이지 · 신뢰도
    const gx = cs * 0.3, gy = cs * 1.3, gw = W - cs * 0.6;
    ctx.fillStyle = 'rgba(8,10,16,0.65)'; ctx.fillRect(gx, gy, gw, cs * 1.25);
    ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(cs * 0.38) + 'px Pretendard, sans-serif';
    ctx.fillText('수질 BOD ' + this.bod.toFixed(1) + ' / 11.3', gx + cs * 0.2, gy + cs * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(gx + cs * 0.2, gy + cs * 0.55, gw * 0.5, cs * 0.18);
    ctx.fillStyle = this.bod < 5 ? '#06D6A0' : this.bod < 8 ? '#FFD166' : '#FF5C7A'; ctx.fillRect(gx + cs * 0.2, gy + cs * 0.55, gw * 0.5 * Math.min(1, this.bod / 11.3), cs * 0.18);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText('경보 신뢰도 ' + Math.round(this.trust) + '%', gx + gw - cs * 0.2, gy + cs * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(gx + gw * 0.55, gy + cs * 0.55, gw * 0.45 - cs * 0.2, cs * 0.18);
    ctx.fillStyle = this.trust > 50 ? '#4CC9F0' : '#FF5C7A'; ctx.fillRect(gx + gw * 0.55, gy + cs * 0.55, (gw * 0.45 - cs * 0.2) * this.trust / 100, cs * 0.18);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 ' + Math.round(cs * 0.32) + 'px Pretendard, sans-serif';
    ctx.fillText('파도 ' + this.wave + ' · 잡은 오염물 ' + this.caught + ' · 오경보 ' + this.falseAlarms, gx + cs * 0.2, gy + cs * 1.1);
    // 문구
    this.toasts.slice(-2).forEach((t, i) => { ctx.fillStyle = 'rgba(8,10,16,0.75)'; const y = H * 0.32 + i * cs * 1.1; ctx.fillRect(cs * 0.4, y - cs * 0.55, W - cs * 0.8, cs * 0.9);
      ctx.fillStyle = t.color; ctx.font = '700 ' + Math.round(cs * 0.36) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t.text, W / 2, y + cs * 0.1); ctx.textAlign = 'left'; });
    // 첫 8초: 무엇을 잡고 무엇을 두는지 범례
    if (this.now - (this.startAt || (this.startAt = this.now)) < 8000 && !this.gameOver) {
      const k = Math.min(1, (8000 - (this.now - this.startAt)) / 600);
      ctx.globalAlpha = k;
      const bw = W - cs * 1.2, bh = cs * 3.6, bx = cs * 0.6, by = H * 0.5 - bh / 2;
      ctx.fillStyle = 'rgba(8,10,16,0.85)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, cs * 0.5); else ctx.rect(bx, by, bw, bh); ctx.fill();
      ctx.font = '800 ' + Math.round(cs * 0.42) + 'px Pretendard, sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = '#FF5C7A'; ctx.fillText('잡기 (분석)', bx + cs * 0.5, by + cs * 0.75);
      ctx.fillStyle = '#fff'; ctx.font = '600 ' + Math.round(cs * 0.36) + 'px Pretendard, sans-serif'; ctx.fillText('폐수 · 기름 · 벤젠 · 쓰레기 → 취수장 전에!', bx + cs * 0.5, by + cs * 1.35);
      ctx.fillStyle = '#06D6A0'; ctx.font = '800 ' + Math.round(cs * 0.42) + 'px Pretendard, sans-serif'; ctx.fillText('두기 (오경보 주의)', bx + cs * 0.5, by + cs * 2.15);
      ctx.fillStyle = '#fff'; ctx.font = '600 ' + Math.round(cs * 0.36) + 'px Pretendard, sans-serif'; ctx.fillText('연어 · 은어 · 나뭇잎 — 잡으면 신뢰도 -15', bx + cs * 0.5, by + cs * 2.75);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 ' + Math.round(cs * 0.3) + 'px Pretendard, sans-serif'; ctx.fillText('환경DNA 병 · 하수 시료는 보너스', bx + cs * 0.5, by + cs * 3.25);
      ctx.globalAlpha = 1;
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.6)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#FF5C7A'; ctx.font = '800 ' + Math.round(cs * 0.8) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BOD 11.3 — 1996년의 태화강', W / 2, H / 2); ctx.textAlign = 'left'; }
  }
}
