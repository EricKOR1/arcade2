// 리듬 터치 — 네 줄로 떨어지는 노트가 판정선에 닿을 때 그 줄을 톡. 반주·멜로디는 모두 직접 만든 곡을 코드로 연주합니다.
// 타이밍은 오디오가 아니라 now(ms) 기준이라 소리를 꺼도 게임은 똑같이 됩니다.

const RH_COLS = 8, RH_ROWS = 14, RH_LANES = 4;
const RH_JUDGE_Y = 12;                     // 판정선 (칸 단위)
const RH_PERFECT = 50, RH_GOOD = 110;      // 판정 창 (ms)
const RH_LANE_COLORS = ['#4CC9F0', '#B15DFF', '#EF476F', '#FFD166'];
const RH_LANE_CELLS = [1, 6, 7, 4];        // 미니보드 색 번호
const RH_KEYS = { d: 0, f: 1, j: 2, k: 3 };

// 반주 패턴: 한 마디 = 8분음표 8칸. 글자 하나 = window.Sound.note 한 번 (C 는 화음이라 3번)
//   B 베이스 근음 · b 베이스 5도 · K 킥 · S 스네어 · H 하이햇 · C 화음
const RH_PATTERNS = {
  easy:   ['BK', '', 'CH', '', 'bK', '', 'CH', ''],
  normal: ['BK', 'H', 'CH', 'H', 'bK', 'H', 'CHB', 'H'],
  hard:   ['BK', 'BH', 'CSB', 'bH', 'BK', 'BH', 'CSb', 'BHK']
};
function rhCallsPerBar(pat) { let n = 0; for (const s of pat) for (const c of s) n += c === 'C' ? 3 : 1; return n; }

// ── 곡 데이터 (직접 지은 곡 · 마디마다 [화음, '8분음표 8칸'] · '.' 쉼 · 'C5/E5' 동시 두 노트) ──
const RH_SONGS = [
  { id: 'easy', name: '햇살 산책', level: '쉬움', bpm: 92, color: '#06D6A0', approach: 1700,
    sections: {
      I: [['C', 'C5 . . . E5 . . .'], ['G', 'G4 . . . B4 . . .']],
      A: [['C', 'E5 . G5 . E5 . C5 .'], ['G', 'D5 . G4 . B4 . D5 .'], ['Am', 'C5 . E5 . A5 . G5 .'], ['F', 'F5 . E5 . C5 . . .'],
          ['C', 'E5 . G5 . C6 . G5 .'], ['G', 'D5 . B4 . D5 . G5 .'], ['F', 'A5 . F5 . D5 . . .'], ['C', 'C5/E5 . . . G4 . C5 .']],
      B: [['F', 'A4 . C5 . F5 . . .'], ['G', 'G4 . B4 . D5 . . .'], ['Em', 'E5 . G5 . B5 . G5 .'], ['Am', 'A5 . . . E5 . C5 .'],
          ['F', 'F5 . E5 . D5 . C5 .'], ['G', 'D5 . E5 . F5 . D5 .'], ['C', 'E5 . G5 . C6 . . .'], ['C', 'C5/G5 . . . . . . .']],
      E: [['F', 'A4/F5 . . . . . . .'], ['C', 'C5/E5 . . . . . . .']]
    }, order: 'IABAE' },
  { id: 'normal', name: '구름 자전거', level: '보통', bpm: 110, color: '#4CC9F0', approach: 1450,
    sections: {
      I: [['G', 'G4 . . . B4 . . .'], ['D', 'D5 . . . F#5 . . .']],
      A: [['G', 'G4 . B4 D5 G5 . D5 .'], ['D', 'F#5 . E5 D5 A4 . D5 .'], ['Em', 'E5 . G5 . B5 . G5 E5'], ['C', 'C5 . E5 G5 E5 . C5 .'],
          ['G', 'B4 D5 G5 . B5 . G5 .'], ['D', 'A5 . F#5 . D5 E5 F#5 .'], ['C', 'G5 . E5 . C5 . E5 G5'], ['D', 'F#5/A5 . . . D5 . . .']],
      B: [['Em', 'E5 . E5 G5 B4 . E5 .'], ['C', 'C5 . E5 . G5 . E5 .'], ['G', 'D5 . G5 . B5 A5 G5 .'], ['D', 'F#5 . A5 . D5/F#5 . . .'],
          ['Em', 'G5 . F#5 E5 B4 . E5 G5'], ['C', 'C6 . B5 . G5 . E5 .'], ['D', 'D5 E5 F#5 G5 A5 . F#5 .'], ['D', 'D5/A5 . . . A4 . D5 .']],
      C: [['C', 'E5 . G5 . C6 . G5 .'], ['D', 'F#5 . A5 . D6 . A5 .'], ['Bm', 'B5 . F#5 . D5 . F#5 .'], ['Em', 'E5 G5 B5 . G5 . E5 .'],
          ['C', 'C5/E5 . G5 . C5/E5 . G5 .'], ['D', 'D5/F#5 . A5 . D5/F#5 . A5 .'], ['G', 'G5 . D5 . B4 . D5 .'], ['G', 'G4/D5 . . . . . . .']],
      E: [['C', 'E5/G5 . . . . . . .'], ['G', 'G4/G5 . . . . . . .']]
    }, order: 'IABACE' },
  { id: 'hard', name: '별빛 질주', level: '어려움', bpm: 130, color: '#EF476F', approach: 1200,
    sections: {
      I: [['Am', 'A4 . . . E5 . . .'], ['E', 'E5 . . . G#5 . . .']],
      A: [['Am', 'A4 C5 E5 A5 . E5 C5 E5'], ['F', 'F5 . A5 . C6 A5 F5 .'], ['C', 'G5 E5 C5 E5 G5 . C6 .'], ['G', 'B5 . G5 D5 B4 D5 G5 .'],
          ['Am', 'A5 . E5 A5 C6 . A5 E5'], ['F', 'F5 A5 C6 . A5 F5 C5 .'], ['G', 'D5 G5 B5 . D6 B5 G5 D5'], ['E', 'E5/G#5 . B4 . E5/G#5 . B5 .']],
      B: [['F', 'A4/C5 . F5 . A4/C5 . F5 A5'], ['G', 'B4/D5 . G5 . B4/D5 . G5 B5'], ['Am', 'C6 B5 A5 G5 A5 . E5 .'], ['Am', 'A5 . C6 . E5/A5 . . .'],
          ['F', 'F5 G5 A5 C6 A5 G5 F5 .'], ['G', 'G5 A5 B5 D6 B5 A5 G5 .'], ['E', 'G#5 . B5 . E6 . B5 G#5'], ['E', 'E5/B5 . . E5 G#5 B5 E6 .']],
      C: [['Dm', 'D5 F5 A5 D6 A5 F5 D5 F5'], ['G', 'G5 . B5 . D6 . B5 G5'], ['C', 'C5/E5 . G5 C6 G5 . E5 .'], ['Am', 'A4/C5 . E5 A5 E5 C5 A4 .'],
          ['Dm', 'F5 . A5 . D6 . A5 F5'], ['E', 'E5 G#5 B5 E6 B5 G#5 E5 .'], ['Am', 'A5 . E5 . C5 . E5 .'], ['Am', 'A4/E5 . . . . . . .']],
      E: [['F', 'F5/A5 . . . . . . .'], ['Am', 'A4/A5 . . . . . . .']]
    }, order: 'IABACBE' }
];

const RH_LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const RH_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
function rhMidi(name) { const m = /^([A-G])(#?)(\d)$/.exec(name); return 12 * (+m[3] + 1) + RH_LETTER[m[1]] + (m[2] ? 1 : 0); }
function rhFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
// 줄 = 음계 단계 % 4 → 차례로 오르내리는 멜로디는 옆 줄로 흐릅니다
function rhLane(name) { const m = /^([A-G])#?(\d)$/.exec(name); return (RH_STEP[m[1]] + (+m[2]) * 7) % 4; }
function rhChord(sym) {   // 'Am' → 근음·3음·5음 (미디 번호, 4옥타브)
  const m = /^([A-G]#?)(m?)$/.exec(sym), root = RH_LETTER[m[1][0]] + (m[1][1] ? 1 : 0);
  return [root, root + (m[2] ? 3 : 4), root + 7];
}

// 곡 데이터 → 노트 목록 · 마디 목록
function rhBuild(song) {
  const beat = 60000 / song.bpm, step = beat / 2, bars = [], notes = [];
  for (const sec of song.order) for (const bar of song.sections[sec]) bars.push(bar);
  bars.forEach((bar, bi) => {
    const toks = bar[1].split(/\s+/);
    toks.forEach((tok, si) => {
      if (tok === '.') return;
      const t = (bi * 8 + si) * step, used = [];
      tok.split('/').forEach(nm => {
        let lane = rhLane(nm);
        while (used.indexOf(lane) >= 0) lane = (lane + 1) % RH_LANES;   // 화음이 같은 줄이면 옆 줄로
        used.push(lane);
        notes.push({ t, lane, f: rhFreq(rhMidi(nm)), j: 0 });            // j: 0 아직 · 1 완벽 · 2 좋음 · 3 놓침
      });
    });
  });
  return { beat, step, bars, notes, length: bars.length * 8 * step };
}

class RhythmGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.cols = RH_COLS; this.rows = RH_ROWS;
    this.score = 0; this.gameOver = false;
    this.state = 'menu';            // menu → play → done
    this.combo = 0; this.maxCombo = 0; this.perfect = 0; this.good = 0; this.miss = 0;
    this.accuracy = 100; this.grade = '-'; this.songName = '';
    this.lastTime = 0; this.now = 0; this._prevNow = 0; this._tickReal = 0;
    this.song = null; this.chart = null; this.songStart = 0; this.nextNote = 0; this.schedIdx = 0;
    this.lanePress = [0, 0, 0, 0]; this.laneBeam = [0, 0, 0, 0];
    this.pops = []; this.parts = []; this.menuT = 0; this._sd = false;
    // 키보드 D F J K — 리스너는 페이지 전체에 딱 하나만 (게임을 새로 만들면 새 게임으로 넘겨줌)
    if (typeof window !== 'undefined') {
      window.__rhythmActive = this;
      if (!window.__rhythmKeyBound) {
        window.__rhythmKeyBound = true;
        window.addEventListener('keydown', e => {
          const g = window.__rhythmActive; if (!g || g.gameOver || e.repeat || performance.now() - (g._tickWall || 0) > 600) return;
          const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
          const lane = RH_KEYS[(e.key || '').toLowerCase()];
          if (lane != null) g.press(lane);
        });
      }
    }
  }

  // ── 시간 ── 톡이 프레임 사이에 들어오면 마지막 프레임 뒤로 흐른 시간만큼 보정 (최대 2프레임)
  _tapNow() {
    let extra = 0;
    if (typeof performance !== 'undefined' && this._tickReal) extra = Math.max(0, Math.min(34, performance.now() - this._tickReal));
    return this.now + extra;
  }
  get songTime() { return this.now - this.songStart; }

  // ── 조작 ──
  tapAt(x, y) {
    if (this.gameOver) return;
    if (this.state === 'menu') { for (let i = 0; i < 3; i++) { const r = this._cardRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.start(i); return; } } return; }
    if (y < this.rows / 2) return;                              // 위쪽 절반은 무시 (실수 방지)
    this.press(Math.max(0, Math.min(RH_LANES - 1, Math.floor(x / (this.cols / RH_LANES)))));
  }
  move(dir) { this.press(dir < 0 ? 0 : 3); }
  up() { this.press(2); }
  set softDropping(v) { if (v && !this._sd) this.press(1); this._sd = !!v; }   // ↓ 누르는 순간만
  get softDropping() { return this._sd; }
  rotate() {} softDrop() {} down() {}
  hardDrop() { if (this.state === 'menu') this.start(this._sel || 0); }

  press(lane) {
    if (this.gameOver) return;
    if (this.state === 'menu') { if (lane < 3) this.start(lane); return; }
    if (this.state !== 'play') return;
    const st = this._tapNow() - this.songStart, notes = this.chart.notes;
    this.lanePress[lane] = 1;
    // 이 줄에서 아직 판정 안 된 노트 중 가장 가까운 것
    let best = -1, bd = 1e9;
    for (let i = this.nextNote; i < notes.length; i++) {
      const n = notes[i]; if (n.t - st > RH_GOOD) break;
      if (n.j || n.lane !== lane) continue;
      const d = Math.abs(n.t - st); if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || bd > RH_GOOD) return;
    const n = notes[best], perfect = bd <= RH_PERFECT;
    n.j = perfect ? 1 : 2;
    if (perfect) this.perfect++; else this.good++;
    this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.score += Math.round((perfect ? 100 : 50) * (1 + Math.min(this.combo, 100) / 100));
    this._judgeText(perfect ? '완벽' : '좋음', perfect ? '#7DF9FF' : '#9BE564');
    this.laneBeam[lane] = 1;
    this._burst(lane, perfect ? 14 : 8);
    if (window.Sound && window.Sound.note) window.Sound.note(n.f, 0.32, 'triangle', perfect ? 0.3 : 0.24, 0);   // 멜로디 음
    this._updateAcc();
  }

  start(i) {
    this.song = RH_SONGS[i]; this.songName = this.song.name; this._sel = i;
    this.chart = rhBuild(this.song);
    this.chart.notes.forEach(n => { n.j = 0; });
    this.state = 'play';
    this.songStart = this.now + this.chart.beat * 4 + 300;     // 4박 예비박
    this.nextNote = 0; this.schedIdx = 0; this.countIdx = 0;
    this.pattern = RH_PATTERNS[this.song.id];
    this.total = this.chart.notes.length;
    if (window.Sound && window.Sound.start) window.Sound.start();
  }

  _updateAcc() {
    const judged = this.perfect + this.good + this.miss;
    this.accuracy = judged ? Math.round((this.perfect + this.good * 0.6) / judged * 1000) / 10 : 100;
  }
  _finalGrade() {
    const acc = this.total ? (this.perfect + this.good * 0.6) / this.total * 100 : 0;
    this.accuracy = Math.round(acc * 10) / 10;
    this.grade = acc >= 95 ? 'S' : acc >= 85 ? 'A' : acc >= 70 ? 'B' : 'C';
  }
  _judgeText(txt, color) { this.pops.push({ txt, color, t: 0 }); if (this.pops.length > 3) this.pops.shift(); }
  _burst(lane, n) {
    const cx = (lane + 0.5) * (this.cols / RH_LANES), c = RH_LANE_COLORS[lane];
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 0.05 + Math.random() * 0.12;
      this.parts.push({ x: cx + (Math.random() - 0.5) * 0.8, y: RH_JUDGE_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.006, l: 1, c: i % 3 ? c : '#FFFFFF' }); }
  }

  // ── 반주 예약 (앞으로 0.12초 안의 박을 미리 window.Sound.note 로 · delay 로 정확한 자리) ──
  _schedule(st) {
    if (!window.Sound || !window.Sound.note) return;
    const ch = this.chart, step = ch.step, ahead = st + 120;
    // 예비박: 하이햇 네 번
    while (this.countIdx < 4) {
      const t = -ch.beat * (4 - this.countIdx); if (t > ahead) break;
      if (st - t < 200) window.Sound.note(this.countIdx === 0 ? 1760 : 1320, 0.05, 'square', 0.05, Math.max(0, (t - st) / 1000));
      this.countIdx++;
    }
    const totalSteps = ch.bars.length * 8;
    while (this.schedIdx < totalSteps) {
      const t = this.schedIdx * step; if (t > ahead) break;
      const late = st - t;
      if (late < 200) {                                   // 탭 전환 등으로 많이 늦은 박은 건너뜀
        const bar = ch.bars[Math.floor(this.schedIdx / 8)], codes = this.pattern[this.schedIdx % 8], d = Math.max(0, (t - st) / 1000);
        const tri = rhChord(bar[0]), root = tri[0];
        for (const c of codes) {
          if (c === 'B') window.Sound.note(rhFreq(36 + root), step / 1000 * 0.9, 'triangle', 0.32, d);
          else if (c === 'b') window.Sound.note(rhFreq(36 + root + 7), step / 1000 * 0.9, 'triangle', 0.28, d);
          else if (c === 'K') window.Sound.note(58, 0.12, 'sine', 0.5, d);
          else if (c === 'S') window.Sound.note(190, 0.07, 'square', 0.1, d);
          else if (c === 'H') window.Sound.note(5200, 0.025, 'square', 0.035, d);
          else if (c === 'C') for (const m of tri) window.Sound.note(rhFreq(60 + m), step / 1000 * 1.6, 'sine', 0.07, d);
        }
      }
      this.schedIdx++;
    }
  }

  tick(now) {
    this._tickWall = performance.now();
    const gap = this._prevNow ? now - this._prevNow : 0; this._prevNow = now;
    const { dt, f } = FX.frame(this, now);
    if (typeof performance !== 'undefined') this._tickReal = performance.now();
    if (this.gameOver) { this.draw(); return; }
    this.menuT += dt;
    if (this.state === 'play') {
      if (gap > 250) this.songStart += gap - 16.7;                 // 탭을 잠깐 떠났다 오면 그만큼 멈춘 셈
      const st = now - this.songStart, notes = this.chart.notes;
      this._schedule(st);
      // 놓침 판정
      for (let i = this.nextNote; i < notes.length; i++) {
        const n = notes[i]; if (n.t > st - RH_GOOD) break;
        if (!n.j) { n.j = 3; this.miss++; this.combo = 0; this._judgeText('놓침', '#FF6B8B'); this._updateAcc(); }
      }
      while (this.nextNote < notes.length && notes[this.nextNote].j) this.nextNote++;
      // 곡 끝
      if (st > this.chart.length + 600 && this.nextNote >= notes.length) {
        this._finalGrade(); this.state = 'done'; this.gameOver = true;
        if (window.Sound && window.Sound.finish) window.Sound.finish();
      }
    }
    for (let i = 0; i < RH_LANES; i++) { this.lanePress[i] = Math.max(0, this.lanePress[i] - 0.12 * f); this.laneBeam[i] = Math.max(0, this.laneBeam[i] - 0.06 * f); }
    for (const p of this.pops) p.t += dt / 600;
    while (this.pops.length && this.pops[0].t >= 1) this.pops.shift();
    if (this.parts.length) this.parts = FX.stepParts(this.parts, f, 0.035);
    this.draw();
  }

  // ── 미니보드 ──
  getSnapshot() {
    const g = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    for (let c = 0; c < this.cols; c++) g[RH_JUDGE_Y][c] = 21;
    if (this.state === 'menu') { for (let i = 0; i < 3; i++) { const r = Math.round(this._cardRect(i).y + 1); for (let c = 1; c < 7; c++) g[r][c] = [24, 25, 26][i]; } return g; }
    if (!this.chart) return g;
    const st = this.now - this.songStart, ap = this.song.approach, notes = this.chart.notes;
    for (let i = this.nextNote; i < notes.length; i++) {
      const n = notes[i]; if (n.t - st > ap * 1.05) break; if (n.j) continue;
      const r = Math.floor(RH_JUDGE_Y - (n.t - st) / ap * RH_JUDGE_Y);
      if (r >= 0 && r < this.rows) { g[r][n.lane * 2] = RH_LANE_CELLS[n.lane]; g[r][n.lane * 2 + 1] = RH_LANE_CELLS[n.lane]; }
    }
    return g;
  }

  _cardRect(i) { return { x: 0.8, y: 4.3 + i * 2.9, w: this.cols - 1.6, h: 2.4 }; }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.cols * cs, H = this.rows * cs;
    const st = this.state === 'menu' ? this.menuT : this.now - this.songStart;
    const beat = this.chart ? this.chart.beat : 652;
    const ph = ((st % beat) + beat) % beat / beat, pulse = Math.pow(1 - ph, 3);   // 박자 맥동 (박마다 1 → 0)
    // 무대 배경
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07041A'); bg.addColorStop(0.6, '#140A33'); bg.addColorStop(1, '#1E0B3D');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const acc = this.song ? this.song.color : '#B15DFF';
    const rg = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * (0.75 + pulse * 0.08));
    rg.addColorStop(0, this._rgba(acc, 0.12 + pulse * 0.16)); rg.addColorStop(1, this._rgba(acc, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    if (this.state === 'menu') { this._drawMenu(ctx, cs, W, H, pulse); return; }

    const lw = W / RH_LANES, jy = RH_JUDGE_Y * cs;
    // 레인: 은은한 네온 기둥 + 경계선
    for (let i = 0; i < RH_LANES; i++) {
      const c = RH_LANE_COLORS[i], x = i * lw;
      const lg = ctx.createLinearGradient(0, 0, 0, jy); lg.addColorStop(0, this._rgba(c, 0)); lg.addColorStop(1, this._rgba(c, 0.10 + this.lanePress[i] * 0.18));
      ctx.fillStyle = lg; ctx.fillRect(x + 2, 0, lw - 4, jy);
      if (this.laneBeam[i] > 0) {           // 맞힌 줄에 빛 기둥
        const b = this.laneBeam[i], bgr = ctx.createLinearGradient(0, jy - H * 0.75, 0, jy);
        bgr.addColorStop(0, this._rgba(c, 0)); bgr.addColorStop(1, this._rgba(c, 0.55 * b));
        ctx.fillStyle = bgr; ctx.fillRect(x + lw * (0.5 - 0.42 * b), jy - H * 0.75, lw * 0.84 * b, H * 0.75);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.35 * b).toFixed(3) + ')'; ctx.fillRect(x + lw * 0.47, jy - H * 0.6 * b, lw * 0.06, H * 0.6 * b);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 1; i < RH_LANES; i++) ctx.fillRect(Math.round(i * lw) - 1, 0, 2, H);
    // 박자 줄 (마디선은 진하게)
    if (this.chart) {
      const ap = this.song.approach, b0 = Math.ceil(st / beat);
      for (let k = b0; k * beat - st < ap * 1.05; k++) {
        const y = jy - (k * beat - st) / ap * jy; if (y < 0) break;
        ctx.fillStyle = k % 4 === 0 ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y, W, k % 4 === 0 ? 2 : 1);
      }
    }
    // 판정선 (박에 맞춰 반짝)
    const glow = 0.45 + pulse * 0.4;
    const jg = ctx.createLinearGradient(0, jy - cs * 0.6, 0, jy + cs * 0.6);
    jg.addColorStop(0, 'rgba(255,255,255,0)'); jg.addColorStop(0.5, 'rgba(200,220,255,' + (glow * 0.45).toFixed(3) + ')'); jg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = jg; ctx.fillRect(0, jy - cs * 0.6, W, cs * 1.2);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, jy - 1.5, W, 3);
    // 누르는 자리 (판정선 아래 받침)
    for (let i = 0; i < RH_LANES; i++) {
      const c = RH_LANE_COLORS[i], x = i * lw + lw * 0.1, y = jy + cs * 0.35, w = lw * 0.8, h = cs * 1.2, p = this.lanePress[i];
      const kg = ctx.createLinearGradient(0, y, 0, y + h); kg.addColorStop(0, this._rgba(c, 0.25 + p * 0.6)); kg.addColorStop(1, this._rgba(c, 0.06 + p * 0.3));
      ctx.fillStyle = kg; FX.rr(ctx, x, y, w, h, cs * 0.25); ctx.fill();
      ctx.strokeStyle = this._rgba(c, 0.55 + p * 0.45); ctx.lineWidth = 1.5; ctx.stroke();
      FX.text(ctx, ['D', 'F', 'J', 'K'][i], x + w / 2, y + h * 0.62, { size: cs * 0.42, weight: 800, color: 'rgba(255,255,255,' + (0.45 + p * 0.5).toFixed(2) + ')', align: 'center' });
    }
    // 노트
    if (this.chart) {
      const ap = this.song.approach, notes = this.chart.notes, nh = cs * 0.5;
      for (let i = this.nextNote; i < notes.length; i++) {
        const n = notes[i], dtn = n.t - st; if (dtn > ap * 1.05) break; if (n.j) continue;
        const y = jy - dtn / ap * jy, x = n.lane * lw + lw * 0.08, w = lw * 0.84, c = RH_LANE_COLORS[n.lane];
        ctx.fillStyle = this._rgba(c, 0.28); FX.rr(ctx, x - 3, y - nh / 2 - 3, w + 6, nh + 6, cs * 0.24); ctx.fill();   // 바깥 빛
        const ng = ctx.createLinearGradient(0, y - nh / 2, 0, y + nh / 2); ng.addColorStop(0, FX.tint(c, 0.55)); ng.addColorStop(0.5, c); ng.addColorStop(1, FX.tint(c, -0.35));
        ctx.fillStyle = ng; FX.rr(ctx, x, y - nh / 2, w, nh, cs * 0.18); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; FX.rr(ctx, x + w * 0.12, y - nh / 2 + 2, w * 0.76, nh * 0.22, nh * 0.1); ctx.fill();
      }
    }
    FX.drawParts(ctx, this.parts, cs, Math.max(3, cs * 0.12));
    // 콤보 (크게)
    if (this.combo >= 3) {
      const k = 1 + pulse * 0.06;
      FX.text(ctx, String(this.combo), W / 2, H * 0.36, { size: cs * 1.5 * k, weight: 900, color: 'rgba(255,255,255,0.9)', align: 'center', stroke: 'rgba(40,10,80,0.8)', strokeW: cs * 0.14 });
      FX.text(ctx, 'COMBO', W / 2, H * 0.36 + cs * 0.65, { size: cs * 0.42, weight: 800, color: this._rgba(acc, 0.95), align: 'center' });
    }
    // 판정 글자
    const lp = this.pops[this.pops.length - 1];
    if (lp) { const k = FX.ease.outBack(Math.min(1, lp.t * 5)), al = 1 - Math.max(0, (lp.t - 0.6) / 0.4);
      ctx.globalAlpha = Math.max(0, al);
      FX.text(ctx, lp.txt, W / 2, jy - cs * 2.2 - lp.t * cs * 0.6, { size: cs * 0.85 * (0.6 + 0.4 * k), weight: 900, color: lp.color, align: 'center', stroke: 'rgba(0,0,0,0.65)', strokeW: cs * 0.12 });
      ctx.globalAlpha = 1; }
    // 위 HUD: 곡 이름 · 점수 · 정확도 · 진행 막대
    ctx.fillStyle = 'rgba(5,3,18,0.55)'; ctx.fillRect(0, 0, W, cs * 1.25);
    FX.text(ctx, this.songName, cs * 0.3, cs * 0.55, { size: cs * 0.36, weight: 700, color: 'rgba(255,255,255,0.75)' });
    FX.text(ctx, this.score.toLocaleString(), W - cs * 0.3, cs * 0.62, { size: cs * 0.55, weight: 900, color: '#FFFFFF', align: 'right' });
    FX.text(ctx, this.accuracy.toFixed(1) + '%', cs * 0.3, cs * 1.0, { size: cs * 0.32, weight: 700, color: this._rgba(acc, 1) });
    if (this.chart) { const pr = Math.max(0, Math.min(1, st / this.chart.length));
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, cs * 1.25 - 3, W, 3); ctx.fillStyle = acc; ctx.fillRect(0, cs * 1.25 - 3, W * pr, 3); }
    // 예비박 숫자 + 조작 안내 (처음 3초쯤)
    if (st < 0) { const left = Math.ceil(-st / beat);
      if (left <= 4) FX.text(ctx, String(left), W / 2, H * 0.32, { size: cs * 2 * (0.8 + pulse * 0.25), weight: 900, color: '#FFFFFF', align: 'center', stroke: this._rgba(acc, 0.8), strokeW: cs * 0.12 }); }
    if (st < 2500) { ctx.globalAlpha = st < 1500 ? 1 : 1 - (st - 1500) / 1000;
      FX.glass(ctx, cs * 0.5, H * 0.47, W - cs, cs * 1.9, cs * 0.3, this._rgba(acc, 0.8));
      FX.text(ctx, '노트가 하얀 선에 닿을 때 그 줄을 톡!', W / 2, H * 0.47 + cs * 0.8, { size: cs * 0.38, weight: 800, color: '#FFFFFF', align: 'center' });
      FX.text(ctx, '키보드 D F J K  또는  ← ↓ ↑ →', W / 2, H * 0.47 + cs * 1.4, { size: cs * 0.32, weight: 600, color: 'rgba(255,255,255,0.75)', align: 'center' });
      ctx.globalAlpha = 1; }
    if (this.gameOver) this._drawResult(ctx, cs, W, H);
  }

  _drawMenu(ctx, cs, W, H, pulse) {
    FX.text(ctx, '리듬 터치', W / 2, cs * 1.9, { size: cs * 1.05, weight: 900, color: '#FFFFFF', align: 'center', stroke: 'rgba(177,93,255,0.6)', strokeW: cs * 0.12 });
    // 작은 이퀄라이저 장식 (박에 맞춰 출렁)
    for (let i = 0; i < 12; i++) { const h = cs * (0.25 + 0.6 * Math.abs(Math.sin(i * 1.7 + this.menuT / 260)) * (0.6 + pulse * 0.4)), x = W / 2 - cs * 2.4 + i * cs * 0.42;
      ctx.fillStyle = RH_LANE_COLORS[i % 4]; FX.rr(ctx, x, cs * 3.1 - h, cs * 0.26, h, cs * 0.08); ctx.fill(); }
    FX.text(ctx, '곡을 골라 톡 누르세요', W / 2, cs * 3.75, { size: cs * 0.4, weight: 700, color: 'rgba(255,255,255,0.8)', align: 'center' });
    const keys = ['D / ←', 'F / ↓', 'J / ↑'];
    RH_SONGS.forEach((s, i) => {
      const r = this._cardRect(i), x = r.x * cs, y = r.y * cs, w = r.w * cs, h = r.h * cs;
      const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, this._rgba(s.color, 0.35)); g.addColorStop(1, 'rgba(20,10,50,0.85)');
      ctx.fillStyle = g; FX.rr(ctx, x, y, w, h, cs * 0.35); ctx.fill();
      ctx.strokeStyle = this._rgba(s.color, 0.9); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = s.color; FX.rr(ctx, x + cs * 0.3, y + cs * 0.35, cs * 0.18, h - cs * 0.7, cs * 0.09); ctx.fill();
      FX.text(ctx, s.name, x + cs * 0.75, y + cs * 1.0, { size: cs * 0.55, weight: 900, color: '#FFFFFF' });
      FX.text(ctx, s.level + ' · BPM ' + s.bpm + ' · ' + this._secs(s) + '초', x + cs * 0.75, y + cs * 1.65, { size: cs * 0.32, weight: 700, color: this._rgba(s.color, 1) });
      // 난이도 별 (도형)
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k <= i ? s.color : 'rgba(255,255,255,0.15)'; this._star(ctx, x + w - cs * (1.75 - k * 0.5), y + cs * 0.75, cs * 0.2); }
      FX.text(ctx, keys[i], x + w - cs * 0.3, y + cs * 1.85, { size: cs * 0.28, weight: 700, color: 'rgba(255,255,255,0.5)', align: 'right' });
    });
  }
  _secs(s) { if (!s._len) { s._len = Math.round(rhBuild(s).length / 1000); } return s._len; }
  _star(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  _drawResult(ctx, cs, W, H) {
    ctx.fillStyle = 'rgba(8,5,20,0.72)'; ctx.fillRect(0, 0, W, H);
    const acc = this.song ? this.song.color : '#B15DFF';
    FX.glass(ctx, cs * 0.6, H * 0.16, W - cs * 1.2, H * 0.66, cs * 0.45, this._rgba(acc, 0.9));
    FX.text(ctx, '곡 완료!', W / 2, H * 0.16 + cs * 1.1, { size: cs * 0.6, weight: 900, color: '#FFFFFF', align: 'center' });
    FX.text(ctx, this.songName, W / 2, H * 0.16 + cs * 1.65, { size: cs * 0.36, weight: 700, color: this._rgba(acc, 1), align: 'center' });
    const gc = { S: '#FFD166', A: '#06D6A0', B: '#4CC9F0', C: '#EF8FB0' }[this.grade] || '#FFFFFF';
    FX.text(ctx, this.grade, W / 2, H * 0.16 + cs * 4.0, { size: cs * 2.4, weight: 900, color: gc, align: 'center', stroke: 'rgba(0,0,0,0.5)', strokeW: cs * 0.15 });
    const rows = [['점수', this.score.toLocaleString()], ['최대 콤보', String(this.maxCombo)], ['정확도', this.accuracy.toFixed(1) + '%'],
                  ['완벽 / 좋음 / 놓침', this.perfect + ' / ' + this.good + ' / ' + this.miss]];
    rows.forEach((r, i) => { const y = H * 0.16 + cs * (5.0 + i * 0.75);
      FX.text(ctx, r[0], cs * 1.1, y, { size: cs * 0.34, weight: 600, color: 'rgba(255,255,255,0.7)' });
      FX.text(ctx, r[1], W - cs * 1.1, y, { size: cs * 0.4, weight: 800, color: '#FFFFFF', align: 'right' }); });
  }

  _rgba(hex, a) {
    const c = this._rgbCache || (this._rgbCache = {});
    let v = c[hex]; if (!v) { const h = hex.replace('#', ''); v = c[hex] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)].join(','); }
    return 'rgba(' + v + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  }
}
if (typeof window !== 'undefined') window.RhythmGame = RhythmGame;
