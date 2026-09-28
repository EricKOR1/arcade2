// 울산 환경 수사대 3D — 추리 롤플레잉 (어려움)
//   울산을 본뜬 3D 지도를 돌아다니며 직접 조사한 사실로 오염물질 · 범인 시설 · 정확한 배출 지점 · 배출 시각을 밝힙니다
//   사건·증거 계산은 ulsan-case.js (진실 하나에서 모든 증거가 일관되게)
//   조작: 조이스틱(또는 WASD) 이동 · 🔍 버튼(또는 E·스페이스) 조사/대화 · ⤴ 버튼(또는 스페이스 — 가까이 조사할 것이 없을 때) 점프 · 위 버튼 수첩·지도·보고서
class UlsanRpgGame {
  constructor(canvas, opts) {
    this.opts = opts || {}; this.glCanvas = canvas; this.host = canvas.parentElement; this.isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
    this.touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); this.noPace = /[?&]fps=full/.test(location.search);   // 절전 대상: 손가락으로 쓰는 기기(폰·태블릿) · ?fps=full 이면 절전 끔
    this.seed = this.opts.seed || Date.now(); this.set = ucSettings(this.opts.trackId);   // 교사 설정: 난이도 · 사건 수 · 사건당 시간
    this.caseNo = 1; this.caseTotal = this.set.cases; this.results = []; this.draft = {};
    this.startReal = Date.now() + Math.max(0, this.opts.countdown || 0) * 1000; this.caseStartReal = this.startReal; this.warned = {};
    this.C = this.makeCase(1); this.rnd = ucRng(this.seed + 99);
    this.nowH = this.C.startH; this.score = 0; this.gameOver = false; this.lastTime = 0; this.now = 0;
    this.px = UC_START[0]; this.pz = UC_START[1]; this.heading = Math.PI; this.mx = 0; this.my = 0; this.keys = {};
    this.samples = []; this.pending = []; this.evidence = []; this.known = {}; this.talked = {}; this.visited = {}; this.report = null; this.ui = {}; this.dest = null; this.seenEv = 1;
    this.initThree(); this.buildWorld(); this.buildPeople(); this.buildUI(); this.bindKeys(); this.resize(); if (!this.canStand(this.px, this.pz)) this.unstick();
    const saved = this.load();                                // 새로고침·다시 들어와도 이어서 (예전엔 사건 1 · 0점으로 처음부터 → 순위표 기록도 덮어씀)
    if (saved) this.restore(saved);
    else { this.addEvidence({ id: 'case', title: '📄 사건 1 개요', key: false, html: this.caseBrief() }); this.revealPoints(); this.deliverNews(true); this.showIntro(true); }
  }
  // 📰 수사 중 소식 (ucNews): 게임 속 시각이 되면 수첩으로 — 제보 · 공지 · 뉴스 (같은 제목은 한 번만)
  deliverNews(quiet) { if (typeof ucNews !== 'function' || !this.C) return; if (!quiet && this._newsH === this.nowH) return; this._newsH = this.nowH;
    const got = new Set(this.evidence.map(e => e.title)); let n = 0, last = null;
    ucNews(this.C).forEach(x => { if (x.h > this.nowH + 1e-6 || got.has(x.title)) return; this.addEvidence({ title: x.title, html: x.html, key: false }); n++; last = x; });
    if (n && !quiet) this.toast('📰 새 소식' + (n > 1 ? ' ' + n + '건' : '') + ' — ' + last.title.replace(/^\S+ /, '') + ' (📓 수첩)'); }
  revealPoints() { if (this.set.allPoints) Object.values(UC_FAC).forEach(F => F.outs.concat(F.stacks).forEach(o => { this.known[o.id] = true; })); }   // 쉬움: 배출 지점 목록을 처음부터
  // 사건 연속(교사가 1~3개): 1번 수질 · 2번 대기 · 3번 무작위 — 같은 판·같은 설정이면 반 전체가 같은 사건
  makeCase(k) { const prev = k > 1 ? this.makeCase(k - 1).fac : null; return ucMakeCase(this.seed * 3 + k * 7919, this.set.diff, k === 1 ? 'water' : k === 2 ? 'air' : null, prev); }   // 사건끼리 이어짐: 지난 사건 범인 시설은 24시간 감시 중이라 이번엔 범인이 아님 (📰 후속 뉴스)   // 예전엔 원하는 종류가 나올 때까지 다시 뽑아 물질·시설이 한쪽으로 쏠렸음
  startCase(k) {
    this.caseNo = k; this.C = this.makeCase(k); this.nowH = this.C.startH; this.samples = []; this.pending = []; this.evidence = []; this.known = {}; this.talked = {}; this.visited = {}; this.report = null; this.draft = {}; this.mini = null; this._arr = null;   // 확인한 곳 표시도 사건마다 새로
    this.caseStartReal = Date.now(); this.warned = {}; this.keys = {}; this.mx = 0; this.my = 0;
    this.px = UC_START[0]; this.pz = UC_START[1]; if (!this.canStand(this.px, this.pz)) this.unstick(); this.camera.position.set(this.px, 45, this.pz + 34); this.setDest(null); this.seenEv = 1; this._objKey = null;
    this.addEvidence({ id: 'case', title: '📄 사건 ' + k + ' 개요', key: false, html: this.caseBrief() }); this.revealPoints(); this.deliverNews(true);
    this.showIntro(false); this.save();
  }
  // ── 진행 저장 · 복원 (같은 판 · 같은 설정 · 같은 학생) ──
  get saveKeys() { const t = this.opts.trackId || ''; return ['ulsan:' + this.seed + ':' + t + ':' + (this.opts.myId || '-'), 'ulsan:' + this.seed + ':' + t + ':n:' + (this.opts.myName || '')]; }
  save() {
    if (!this.opts.seed || this._noSave) return; this._savedAt = this.now || 0; this._dirty = false;
    try { const js = JSON.stringify({ v: 4, caseNo: this.caseNo, results: this.results, startReal: this.startReal, caseStartReal: this.caseStartReal, doneAt: this.doneAt || 0, nowH: this.nowH, samples: this.samples, pending: this.pending,
        evidence: this.evidence, known: this.known, talked: this.talked, visited: this.visited, draft: this.draft, mini: this.mini || null, px: this.px, pz: this.pz, heading: this.heading, warned: this.warned, report: this.report, left: this._leftAtSubmit || 0, finished: !!this.finished, dest: this.dest, seenEv: this.seenEv, fun: this.fun || null });
      const [k1, k2] = this.saveKeys; try { sessionStorage.setItem(k1, js); if (!this._ssPruned) { this._ssPruned = true; for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k && k.indexOf('ulsan:') === 0 && k.indexOf('ulsan:' + this.seed + ':') !== 0) sessionStorage.removeItem(k); } } } catch (e) {}   // 지난 판 기록은 지움 (탭을 오래 열어 두면 쌓여 저장이 막히던 것)
      if (this.opts.myName) try { localStorage.setItem(k2, js); for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.indexOf('ulsan:') === 0 && k.indexOf('ulsan:' + this.seed + ':') !== 0) localStorage.removeItem(k); } } catch (e) {}   // 지난 판 기록은 지움
    } catch (e) {}
  }
  // 저장 형식 4 (v2026-10-20c): 배출구가 늘고 사건끼리 이어져 같은 판이라도 사건이 달라짐 — 예전 저장은 다른 사건의 증거라 버림
  load() {
    if (!this.opts.seed) return null; const [k1, k2] = this.saveKeys; let js = null;
    try { js = sessionStorage.getItem(k1); } catch (e) {} if (!js && this.opts.myName) try { js = localStorage.getItem(k2); } catch (e) {}   // 탭을 닫았다 열어도 같은 이름이면
    try { const o = js && JSON.parse(js); return o && o.v === 4 && o.caseNo >= 1 && Array.isArray(o.evidence) ? o : null; } catch (e) { return null; }
  }
  restore(o) {
    this.caseNo = Math.min(o.caseNo, this.caseTotal); this.C = this.makeCase(this.caseNo);
    ['results', 'startReal', 'caseStartReal', 'nowH', 'samples', 'pending', 'evidence', 'known', 'talked', 'visited', 'draft', 'px', 'pz', 'heading', 'warned', 'seenEv', 'mini', 'fun'].forEach(k => { if (o[k] != null) this[k] = o[k]; });
    this.doneAt = o.doneAt || undefined; this.score = this.results.reduce((a, x) => a + x.score, 0); this.dest = null; if (o.dest) this.setDest(o.dest.x, o.dest.z, o.dest.name, true, o.dest.key);
    if (!this.canStand(this.px, this.pz)) this.unstick();   // 저장된 자리가 건물 속·물 위면 (부딪힘이 생기기 전 저장)
    this.camera.position.set(this.px, 45, this.pz + 34);
    if (o.finished) { this.finished = true; this.report = o.report; this._leftAtSubmit = o.left; this.gameOver = true; return; }
    if (o.report) { this.report = o.report; this._leftAtSubmit = o.left; this.showResult(this.report); }
    else { this.toast('💾 저장된 수사를 이어서 해요 — 사건 ' + this.caseNo + '/' + this.caseTotal); if (this.pending.length) setTimeout(() => this.fastLab(), 1500); }   // 맡겨 둔 분석은 이어서 곧 결과
  }
  get casesStr() { return this.results.map(r => r.grade).join(' '); }
  get solvedCount() { return this.results.filter(r => r.fac && r.point).length; }
  get done() { return this.results.length >= this.caseTotal; }
  get elapsedSec() { return Math.max(0, Math.round(((this.doneAt || Date.now()) - this.startReal) / 1000)); }   // 출발 카운트다운 중 음수 방지
  // ── 플랫폼 인터페이스 ──
  setMove(x, y) { this.mx = x; this.my = y; }
  setBoost(on) { if (on) this.interact(); }
  // ── 점프 (v2026-10-20b): 낮은 담장·상자·화단 등(높이 UlsanRpgGame.JUMP_CLEAR 칸 이하)은 뛰어넘거나 위에 올라설 수 있음 ──
  jump() { if (this.ui.modalOpen || this.ov || this.gameOver) return; const sup = this.supportH(this.px, this.pz); if (this.jv || (this.jh || 0) > sup + 0.02) return; this.jv = UlsanRpgGame.JUMP_V; this._actT = this.now || 0; }
  resize() { const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (!this.renderer || W < 10) return;
    if (this.touch && !this.noPace && (this.qLevel == null || this.qLevel > 0)) { const pr = Math.min(window.devicePixelRatio || 1, Math.max(1.25, Math.min(1.5, Math.sqrt(0.65e6 / (W * H))))); if (Math.abs(pr - this.renderer.getPixelRatio()) > 0.01) this.renderer.setPixelRatio(pr); }   // 절전: 폰·태블릿은 그릴 점 수를 약 65만 개 안쪽으로 (배율 1.25~1.5 · 예전 1.5 고정 — 태블릿은 약 220만 개)
    this.renderer.setSize(W, H, false); if (this.composer) this.composer.setSize(W, H); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%'; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); this.vw = W; this.vh = H;
    if (this.ui.quest) { this.ui.quest.classList.toggle('compact', (H < 540 && W > H) || W < 600); this.ui.quest.classList.toggle('tiny', H < 540 && W > H); this._toastK = null; } }   // tiny(폰 가로): 다음 할 일 한 줄 + 안내 단추는 아이콘만 (조이스틱과 겹치지 않게)   // 낮은 가로 화면 · 폰 세로: 퀘스트 창을 줄여 조이스틱·3D 화면을 덜 가리게
  destroy() { this._dead = true; try { this.renderer.dispose(); this.ui.root.remove(); this.host.classList.remove('urpg-host'); removeEventListener('keydown', this._kd); removeEventListener('keyup', this._ku); removeEventListener('blur', this._blur); document.removeEventListener('visibilitychange', this._blur); } catch (e) {} }
  captureTo(g, w, h) { this.renderer.render(this.scene, this.camera); g.drawImage(this.glCanvas, 0, 0, w, h); }
  get evidenceCount() { return this.evidence.length - 1; }
  get timeLeft() { return this.caseLeftSec / 3600; }
  // 이 사건에 남은 실제 시간(초) — 보고서를 낸 뒤·끝난 뒤엔 멈춤
  get caseLeftSec() { if (this.report || this.gameOver) return this._leftAtSubmit || 0; return Math.max(0, Math.min(this.set.min * 60, this.set.min * 60 - (Date.now() - this.caseStartReal) / 1000)); }   // 출발 카운트다운 중에도 제한 시간보다 크게 보이지 않게
  getSnapshot() {                                         // 교사 화면 미니보드: 강(파랑) · 땅 · 나(초록)
    const N = 30, g = []; for (let y = 0; y < N; y++) g.push(new Array(N).fill(65));
    const G = UG.grid, put = (x, z, v) => { const gx = Math.floor((x - G.x0) / (G.w * G.cell) * N), gz = Math.floor((z - G.z0) / (G.h * G.cell) * N); if (g[gz] && g[gz][gx] != null) g[gz][gx] = v; };   // 실제 울산 지도 범위
    Object.values(UC_RIVERS).forEach(R => { const L = ucLen(R.pts); for (let s = 0; s < L; s += 6) { const p = ucAt(R.pts, s); put(p[0], p[1], 69); } });
    put(this.px, this.pz, 23); return g;
  }

  // ── 3D 준비 ──
  initThree() {
    const T = THREE;
    this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2 });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new T.Scene(); this.scene.background = new T.Color('#A9D3F0'); this.scene.fog = new T.Fog(new T.Color('#BFDDF2'), 140, 420);
    this.camera = new T.PerspectiveCamera(48, 1, 0.5, 900);
    this.hemi = new T.HemisphereLight(0xEAF4FF, 0x6F7F5A, 0.9); this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xFFF1D6, 0.75); this.sun.position.set(-40, 80, 30); this.scene.add(this.sun);
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(this.renderer, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; } else this.hq = 'low';
    if (this.hq !== 'low' && !this.hqLocked && !this.renderer.capabilities.isWebGL2) this.hq = 'low';   // 오래된 기기(WebGL1): 실사풍 셰이더가 안 될 수 있어 가벼운 화면으로 (건물이 사라지던 문제 예방)
  }
  // 지형 높이: 서쪽·북쪽·남서쪽은 산, 동쪽은 바다, 하천은 파임
  // ── 실제 울산 지도 (ulsan-geo.js 격자) ──
  cellAt(x, z) { return typeof ugCell === 'function' ? ugCell(x, z) : 'r'; }
  isSea(x, z) { return this.cellAt(x, z) === '0'; }
  walkable(x, z) { const c = this.cellAt(x, z); return c === 'u' || c === 'i' || c === 'r'; }
  // ── 설 수 있는 곳 (v2026-10-18a) ──
  //   울산 땅 · 너무 높은 산이 아님 · 물에 잠긴 해안이 아님(그려진 땅이 바다 수면 -0.3 보다 높아야 — 예전엔 칸만 봐서 물 위를 걸었음) · 건물·탱크·담장이 아님
  //   강은 발목 깊이로 걸어 건널 수 있음 (강물 시료·배출구 조사)
  canStand(x, z, feet) {
    const oh = this.obsH(x, z); if (oh > 0 && (oh > UlsanRpgGame.JUMP_CLEAR || oh > (feet || 0) + 0.02)) return false;   // feet: 땅에서 발까지 높이 (점프 중·낮은 구조물 위) — 발보다 낮은 구조물은 지나감 const c = this.cellAt(x, z); if (c !== 'u' && c !== 'i' && c !== 'r') return false;
    const h = this.meshH(x, z); if (h >= 30) return false; if (h >= -0.24) return true;
    const rn = this.riverNear(x, z); return rn.d < 1.2 || (rn.d < 5 && h > this.waterY(rn.rid, rn.s) - 0.75);   // 강물 속 · 하구의 얕은 강둑은 첨벙첨벙 건넘 (강 수면보다 0.65칸 안쪽)
  }
  // 발 높이: 화면에 그려진 땅 위 · 강 속이면 강바닥(물이 발목까지) — 바다 가장자리처럼 땅이 물보다 낮은 곳에 떠 있지 않게
  standY(x, z) { const h = this.meshH(x, z); if (h > -0.2) return h; const rn = this.riverNear(x, z); return rn.d < 5 ? Math.max(h, this.waterY(rn.rid, rn.s) - 0.45) : Math.max(h, -0.24); }
  // 그려진 땅 그물의 높이 (꼭짓점 셋 사이 — 화면과 똑같이) · 그물 간격이 2~3칸이라 groundH 와 해안·강둑에서 조금 다름
  setMeshH(geo, sx, sz) { const P = geo.attributes.position, Y = new Float32Array(P.count); for (let i = 0; i < P.count; i++) Y[i] = P.getY(i); this._mh = { y: Y, sx, sz, dx: 524 / sx, dz: 504 / sz }; }
  meshH(x, z) { const M = this._mh; if (!M) return this.groundH(x, z); const fx = (x + 262) / M.dx, fz = (z + 252) / M.dz, i = Math.max(0, Math.min(M.sx - 1, Math.floor(fx))), j = Math.max(0, Math.min(M.sz - 1, Math.floor(fz))), u = fx - i, v = fz - j, W = M.sx + 1, Y = M.y;
    const ha = Y[j * W + i], hd = Y[j * W + i + 1], hb = Y[(j + 1) * W + i], hc = Y[(j + 1) * W + i + 1];
    return u + v <= 1 ? ha + (hd - ha) * u + (hb - ha) * v : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v); }
  // 부딪힘 격자 (0.5칸 · 1048×1008): 건물·탱크·담장 자리를 캐릭터 몸 반지름(0.35칸)만큼 넓혀 칠함 → 한 칸만 보면 됨
  colGrid() { return this.col || (this.col = new Uint8Array(1048 * 1008)); }
  // 격자 값 = 구조물 꼭대기 높이 × 20 (0.05칸 단위) · 255 = 아주 높음(넘을 수 없음)
  obsH(x, z) { const C = this.col; if (!C) return 0; const i = Math.floor((x + 262) * 2), j = Math.floor((z + 252) * 2); if (i < 0 || j < 0 || i >= 1048 || j >= 1008) return 0; const v = C[j * 1048 + i]; return v >= 255 ? Infinity : v / 20; }
  // 딛고 설 높이: 넘을 수 있는 낮은 구조물 위면 그 꼭대기 · 아니면 땅(0)
  supportH(x, z) { const h = this.obsH(x, z); return h <= UlsanRpgGame.JUMP_CLEAR ? h : 0; }
  static hv(top) { return top == null || !(top < 12) ? 255 : Math.max(1, Math.min(254, Math.ceil(top * 20))); }
  blockedAt(x, z) { const C = this.col; if (!C) return false; const i = Math.floor((x + 262) * 2), j = Math.floor((z + 252) * 2); return i >= 0 && j >= 0 && i < 1048 && j < 1008 && C[j * 1048 + i] > 0; }
  colRect(x, z, w, d, a, pad, top) {                          // 돌아간 직사각형 (a: 라디안 · 실사풍 건물과 같은 방향) · top: 꼭대기 높이(모르면 넘을 수 없음)
    const C = this.colGrid(), V = UlsanRpgGame.hv(top), P = pad == null ? 0.35 : pad, hw = w / 2 + P, hd = d / 2 + P, c = Math.cos(a || 0), s = Math.sin(a || 0), ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    const i0 = Math.max(0, Math.floor((x - ex + 262) * 2)), i1 = Math.min(1047, Math.floor((x + ex + 262) * 2)), j0 = Math.max(0, Math.floor((z - ez + 252) * 2)), j1 = Math.min(1007, Math.floor((z + ez + 252) * 2));
    for (let j = j0; j <= j1; j++) { const pz = (j + 0.5) / 2 - 252 - z; for (let i = i0; i <= i1; i++) { const px = (i + 0.5) / 2 - 262 - x, u = px * c + pz * s, v = pz * c - px * s; if (u <= hw && u >= -hw && v <= hd && v >= -hd && C[j * 1048 + i] < V) C[j * 1048 + i] = V; } }
  }
  colCircle(x, z, r, pad, top) {
    const C = this.colGrid(), V = UlsanRpgGame.hv(top), R = r + (pad == null ? 0.35 : pad), R2 = R * R, i0 = Math.max(0, Math.floor((x - R + 262) * 2)), i1 = Math.min(1047, Math.floor((x + R + 262) * 2)), j0 = Math.max(0, Math.floor((z - R + 252) * 2)), j1 = Math.min(1007, Math.floor((z + R + 252) * 2));
    for (let j = j0; j <= j1; j++) { const pz = (j + 0.5) / 2 - 252 - z; for (let i = i0; i <= i1; i++) { const px = (i + 0.5) / 2 - 262 - x; if (px * px + pz * pz <= R2 && C[j * 1048 + i] < V) C[j * 1048 + i] = V; } }
  }
  colClear(x, z, r) { const C = this.colGrid(), R2 = r * r; for (let j = Math.max(0, Math.floor((z - r + 252) * 2)); j <= Math.min(1007, Math.floor((z + r + 252) * 2)); j++) for (let i = Math.max(0, Math.floor((x - r + 262) * 2)); i <= Math.min(1047, Math.floor((x + r + 262) * 2)); i++) { const px = (i + 0.5) / 2 - 262 - x, pz = (j + 0.5) / 2 - 252 - z; if (px * px + pz * pz <= R2) C[j * 1048 + i] = 0; } }
  // 조사할 곳 · 사람 · 도착 자리 (부딪힘을 넣어도 모두 닿을 수 있어야 하는 곳) — [x, z, 닿아야 하는 거리]
  keySpots() {
    const out = [[UC_START[0], UC_START[1], 2], [34, 24, 2]]; Object.keys(UC_NPC_AT).forEach(id => { const p = ucNpcAt(id); out.push([p[0], p[1], 2]); });
    Object.values(UC_FAC).forEach(F => { out.push(ucGate(F, 2, -3).concat(2), ucGate(F, 2, 4).concat(2), ucGate(F, 0).concat(5)); F.stacks.forEach(st => out.push([st.x, st.z, 5])); F.outs.forEach(o => { const R = UC_RIVERS[o.river], p = ucAt(R.pts, o.s), dir = Math.atan2(F.at[1] - p[1], F.at[0] - p[0]); out.push([p[0] + Math.cos(dir) * (R.w / 2 + 3), p[1] + Math.sin(dir) * (R.w / 2 + 3), 5]); }); });
    UC_BIO.forEach(b => out.push(ucBioAt(b).concat(4))); UC_AIR.forEach(a => out.push([a.x, a.z, 4])); out.push([UC_PLACES.lab.at[0], UC_PLACES.lab.at[1] + 3, 5]);
    return out;
  }
  buildHeights() {
    if (typeof ulsanTerrain === 'function') { const T = ulsanTerrain(); this.hgrid = T.h; this.terr = T; return; }   // 실제 산 위치 기반 지형 (ulsan-terrain.js)                                           // 2칸 격자마다 높이: 도심·공단 평지, 농촌 언덕, 서쪽 영남알프스는 높은 산 · 경계는 흐리게 이어서 절벽 없음
    const G = UG.grid, W = G.w, H = G.h, raw = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell, c = this.cellAt(x, z);
      const n = Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin(x * 0.11 + z * 0.07) * 0.5 + Math.sin(x * 0.021 - z * 0.017) * 0.8;
      let h = c === '0' ? -3 : (c === 'u' || c === 'i') ? 0.4 : 3 + n * 2.6 + Math.max(0, -60 - x) * 0.16 * (0.7 + 0.3 * n) + Math.max(0, -150 - z) * 0.1;
      raw[j * W + i] = h; }
    const R = 3; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let sum = 0, n = 0;
      for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; sum += raw[jj * W + ii]; n++; }
      out[j * W + i] = sum / n; }
    this.hgrid = out;
  }
  coastX(z) { return 999; }
  // 강까지 거리: 강마다 둘레 상자(+10칸) 밖이면 건너뜀 — 거리 10칸 안쪽 값은 그대로 (쓰는 곳은 모두 6칸 이하만 봄) · 세계 만들 때 수십만 번 불려 빨라짐
  riverBoxes() { return this._rbb || (this._rbb = Object.keys(UC_RIVERS).map(rid => { const R = UC_RIVERS[rid], m = R.w / 2 + 10, X = R.pts.map(p => p[0]), Z = R.pts.map(p => p[1]); return [rid, R, Math.min(...X) - m, Math.max(...X) + m, Math.min(...Z) - m, Math.max(...Z) + m]; })); }
  riverDist(x, z) { let d = 1e9; for (const [, R, x0, x1, z0, z1] of this.riverBoxes()) { if (x < x0 || x > x1 || z < z0 || z > z1) continue; const p = ucProject(R.pts, x, z); d = Math.min(d, p.d - R.w * 0.5); } return d; }
  riverNear(x, z) { let b = { d: 1e9, rid: null, s: 0 }; for (const [rid, R, x0, x1, z0, z1] of this.riverBoxes()) { if (x < x0 || x > x1 || z < z0 || z > z1) continue; const p = ucProject(R.pts, x, z), d = p.d - R.w * 0.5; if (d < b.d) b = { d, rid, s: p.s }; } return b; }
  waterY(rid, s) { return typeof ulsanWaterLevel === 'function' && this.terr ? ulsanWaterLevel(rid, s) : -0.25; }   // 강 수면: 상류는 높고 하구는 바다 높이
  groundH(x, z) {
    if (!this.hgrid) this.buildHeights();
    const G = UG.grid, fx = (x - G.x0) / G.cell - 0.5, fz = (z - G.z0) / G.cell - 0.5, i = Math.max(0, Math.min(G.w - 2, Math.floor(fx))), j = Math.max(0, Math.min(G.h - 2, Math.floor(fz))), a = fx - i, b = fz - j, H = this.hgrid, W = G.w;
    let h = (H[j * W + i] * (1 - a) + H[j * W + i + 1] * a) * (1 - b) + (H[(j + 1) * W + i] * (1 - a) + H[(j + 1) * W + i + 1] * a) * b;
    if (this.isSea(x, z)) return Math.min(h, -2.5);
    const rn = this.riverNear(x, z); if (rn.d < 6) h = Math.min(h, this.waterY(rn.rid, rn.s) - 0.35 + Math.max(0, rn.d) * 0.25);
    return h;
  }
  zoneOf(x, z) { const c = this.cellAt(x, z); return c === 'u' ? 'city' : c === 'i' ? 'industry' : ''; }
  // 가벼운 화질의 도시 건물 자리 [x, z, 높이, 크기] — 조사할 곳·사람 9칸 · 시설 마당 6칸 · 장소 12칸 둘레는 비움
  lowBlocks(R) {
    const apts = [], sheds = [], keys = this.keySpots(), yards = Object.values(UC_FAC).map(ucYard);
    for (let i = 0; i < 4200 && apts.length + sheds.length < 900; i++) { const x = -40 + R() * 260, z = -170 + R() * 300, zn = this.zoneOf(x, z); if (!zn || this.riverDist(x, z) < 5 || !this.walkable(x + 3, z) || !this.walkable(x - 3, z)) continue;
      if (Object.values(UC_FAC).some(F => Math.hypot(F.at[0] - x, F.at[1] - z) < 22) || Object.values(UC_PLACES).some(P => Math.hypot(P.at[0] - x, P.at[1] - z) < 12) || Math.hypot(x - 16, z + 2) < 10) continue;
      if (keys.some(k => Math.hypot(k[0] - x, k[1] - z) < 9) || yards.some(Y => x > Y[0] - 6 && x < Y[2] + 6 && z > Y[1] - 6 && z < Y[3] + 6)) continue;
      if (zn === 'city') apts.push([x, z, 3 + R() * 10, 2.4 + R() * 2.4]); else sheds.push([x, z, 2 + R() * 3, 4 + R() * 6]); }
    return { apts, sheds };
  }
  // 가벼운 화질: 모둠(장소·시설·측정소)의 상자·원통을 부딪힘 목록에 — 땅에 닿은 0.45칸 넘는 것만 (옥상·지붕 장식·꽃밭·부두 바닥은 지나감)
  colGroup(g, ox, oz) { g.children.forEach(m => { const P = m.geometry && m.geometry.parameters; if (!P || m.userData.walk) return; const y = m.position.y;
    if (P.width != null) { if (y - P.height / 2 < 0.6 && P.height > 0.45) this._obs.push([ox + m.position.x, oz + m.position.z, P.width, P.depth, 0, y + P.height / 2]); }
    else if (P.radiusBottom != null && y - P.height / 2 < 0.6 && P.height > 0.45) this._obs.push([ox + m.position.x, oz + m.position.z, Math.max(P.radiusTop, P.radiusBottom), y + P.height / 2]); }); }
  // 실사풍 세계 자료로 부딪힘: 건물 상자 · 원통(탱크·굴뚝·공정탑·수조) · 구형 탱크 · 비닐하우스 · 크레인 다리 · 광석 더미
  //   땅에 닿은(바닥 0.6칸 아래) 0.5칸 넘는 것만 — 꽃밭·부두 바닥·옥상 설비·높이 걸린 배관은 지나감 · 주차된 차·나무·가로등도 지나감
  colWorld() {
    const W = UWORLD, B = W.b;
    for (let i = 0; i < B.length; i += 9) { const t = B[i], h = B[i + 5], y0 = B[i + 8], b0 = (t === 7 || t === 3) && y0 ? y0 : 0; if (b0 >= 0.6 || h < 0.5) continue; this.colRect(B[i + 1], B[i + 2], B[i + 3], B[i + 4], B[i + 6] * Math.PI / 180, null, b0 + h); }
    for (let i = 0; i < W.cyl.length; i += 6) this.colCircle(W.cyl[i], W.cyl[i + 1], W.cyl[i + 2], null, W.cyl[i + 3]);
    for (let i = 0; i < W.sph.length; i += 3) this.colCircle(W.sph[i], W.sph[i + 1], W.sph[i + 2] * 0.95);
    for (let i = 0; i < W.gh.length; i += 4) this.colRect(W.gh[i], W.gh[i + 1], W.gh[i + 2], 1.24, W.gh[i + 3] * Math.PI / 180);
    for (let i = 0; i < W.cranes.length; i += 5) { const x = W.cranes[i], z = W.cranes[i + 1], span = W.cranes[i + 2], a = W.cranes[i + 3] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); [-1, 1].forEach(sd => this.colRect(x + c * sd * span / 2, z + s * sd * span / 2, 0.9, 1.6, a)); }
    ((W.site || {}).pile || []).forEach(p => this.colCircle(p[0], p[1], p[2] * 0.85, null, p[3]));
  }
  // 부딪힘 격자 만들기 (세계를 다 그린 뒤 한 번)
  buildCollision() {
    this.col = null; this.colGrid(); if (this.real) this.colWorld();
    (this._obs || []).forEach(o => { if (o.length <= 4) this.colCircle(o[0], o[1], o[2], null, o[3]); else this.colRect(o[0], o[1], o[2], o[3], o[4] || 0, null, o[5]); }); this._obs = null;   // [x,z,r,(높이)] 원 · [x,z,w,d,각,(높이)] 상자
  }
  buildWorld() {
    const T = THREE, S = this.scene; this._obs = [];
    this.real = this.hq !== 'low' && typeof this.realInit === 'function' && typeof UWORLD !== 'undefined' && !!T.Sky;   // 실사풍 화면 (보통·고화질)
    if (this.real) { this.realInit(); this.realTerrain(); this.realWater(); } else {
    // 땅 (정점 색: 풀 · 숲 · 바위 · 모래 · 도시 · 공단)
    const geo = new T.PlaneGeometry(524, 504, 175, 168); geo.rotateX(-Math.PI / 2);   // 실제 울산 범위 (경도 128.97~129.47 · 위도 35.33~35.72)
    const pos = geo.attributes.position, cols = [], c = new T.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), h = this.groundH(x, z); pos.setY(i, h);
      const cc = this.cellAt(x, z);
      if (cc === '0') c.set(h > -1.2 ? '#D8C79A' : '#C9B98C'); else if (cc === '1') c.set(h > 12 ? '#7E8A74' : '#8FA383'); else if (h > 22) c.set('#8A8F7E'); else if (h > 9) c.set('#3F7A43');
      else if (cc === 'u') c.set('#9EA3AA'); else if (cc === 'i') c.set('#A89F8C'); else c.set(h > 4 ? '#5E9A4C' : '#7DB35A');
      c.offsetHSL(0, 0, (Math.sin(x * 0.3) * Math.cos(z * 0.27)) * 0.025); if (this.hq !== 'low') c.convertSRGBToLinear(); cols.push(c.r, c.g, c.b); }   // 색 보정 모드면 정점 색도 선형으로(안 하면 하얗게 바램)
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals(); this.setMeshH(geo, 175, 168);
    const gm = new T.MeshLambertMaterial({ vertexColors: true }); gm.userData.lin = true; const ground = new T.Mesh(geo, gm); S.add(ground); this.ground = ground;
    // 바다: 잔물결 무늬가 천천히 움직임
    const seaTex = this.hq === 'low' ? null : this.waveTex(false); if (seaTex) seaTex.repeat.set(60, 60);   // 가벼운 모드는 무늬 없이 (화면 대부분이라 느린 기기에서 부담)
    const sea = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshLambertMaterial(seaTex ? { color: '#FFFFFF', map: seaTex } : { color: '#2F7FB8' })); sea.rotation.x = -Math.PI / 2; sea.position.set(320, this.terr ? -0.3 : -0.9, 30); S.add(sea); this.sea = sea; this.seaTex = seaTex; }
    // 하천: 물 띠(하류 쪽으로 흐르는 물결 무늬 — 흐름 방향이 보임) + 1km 거리표(추리에 필요)
    this.waterMats = [];
    Object.keys(UC_RIVERS).forEach(rid => { const R = UC_RIVERS[rid], L = ucLen(R.pts), vs = [], uv = [], idx = []; let k = 0;
      for (let s = 0; s <= L; s += 2) { const a = ucAt(R.pts, s), b = ucAt(R.pts, Math.min(L, s + 1)), dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d;
        const wy = this.waterY(rid, s) - 0.1; vs.push(a[0] + nx * R.w / 2, wy, a[1] + nz * R.w / 2, a[0] - nx * R.w / 2, wy, a[1] - nz * R.w / 2); uv.push(0, s / 7, 1, s / 7); if (k) idx.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, (k - 1) * 2 + 1, k * 2, k * 2 + 1); k++; }
      if (!this.real) { const tex = this.waveTex(true), wm = new T.MeshLambertMaterial({ color: '#FFFFFF', map: tex }); this.waterMats.push({ tex, sp: R.speed });
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vs, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); S.add(new T.Mesh(g, wm)); }
      for (let km = 1; km * UC_KM < L - 4; km++) { const p = ucAt(R.pts, km * UC_KM); (this._posts = this._posts || []).push([p[0] + R.w * 0.7 + 1, p[1], '#F5F5F5']); if (km % 2 === 0) this.label(R.name + ' ' + km + 'km', p[0] + R.w * 0.7 + 1, 4.2, p[1], 0.55, '#1B2A44', '#FFFFFF'); }   // 기둥은 1km마다(한 번에 그림) · 숫자는 2km마다
      const m = ucAt(R.pts, L * 0.5); this.label(R.name, m[0], 7, m[1], 1.1, '#FFFFFF', 'rgba(30,90,150,0.85)'); });
    // 다리 (태화강)
    if (this.real) { this.realCity(); this.realTrees(); } else {
    [-30, 10, 45, 80].forEach(x => { const p = ucProject(UC_RIVERS.taehwa.pts, x, 6), q = ucAt(UC_RIVERS.taehwa.pts, p.s); const b = new T.Mesh(new T.BoxGeometry(4, 0.6, UC_RIVERS.taehwa.w + 6), new T.MeshLambertMaterial({ color: '#C9CDD4' })); b.position.set(q[0], this.waterY('taehwa', p.s) + 0.75, q[1]); S.add(b); });
    // 도시 · 공단 건물 (인스턴스 두 번) — 조사할 곳·사람·시설 마당 둘레는 비움 (부딪힘이 생겨 길을 막지 않게)
    const { apts, sheds } = this.lowBlocks(ucRng(this.seed + 199)), R = ucRng(this.seed + 299); this._lowBlk = { apts, sheds };   // 따로 뽑음 (예전: 분석값 흔들림과 같은 난수를 써서 화질마다 분석값이 달랐음)
    apts.forEach(b => this._obs.push([b[0], b[1], b[3], b[3], 0, b[2]])); sheds.forEach(b => this._obs.push([b[0], b[1], b[3], b[3] * 0.7, 0, b[2]]));
    // 아파트 창문 무늬 (층마다 창 · 몇 개는 불 켜짐)
    const wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; const wg = wc.getContext('2d'); wg.fillStyle = '#EDEAE2'; wg.fillRect(0, 0, 64, 128);
    const ec = document.createElement('canvas'); ec.width = 64; ec.height = 128; const eg = ec.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, 64, 128);   // 밤에 빛나는 창 (불 켜진 창만)
    for (let y = 6; y < 128; y += 12) for (let x = 5; x < 64; x += 15) { const lit = Math.random() < 0.12, night = lit || Math.random() < 0.3; wg.fillStyle = lit ? '#FFE9A8' : '#7C93AE'; wg.fillRect(x, y, 9, 6); if (night) { eg.fillStyle = lit ? '#FFE2A0' : '#E8C98A'; eg.fillRect(x, y, 9, 6); } }
    const winTex = new T.CanvasTexture(wc); winTex.wrapS = winTex.wrapT = T.RepeatWrapping; const winEm = new T.CanvasTexture(ec); winEm.wrapS = winEm.wrapT = T.RepeatWrapping;
    const inst = (list, color, fn, map) => { const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial(map ? { map, emissive: '#000000' } : { color }), list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
      list.forEach((b, i) => { fn(b, sc); m4.compose(new T.Vector3(b[0], this.groundH(b[0], b[1]) + sc.y / 2, b[1]), q, sc); im.setMatrixAt(i, m4); }); S.add(im); return im; };
    this.aptMat = inst(apts, '#E8E4DA', (b, sc) => sc.set(b[3], b[2], b[3]), winTex).material; this.winEm = winEm; inst(sheds, '#9FA8B5', (b, sc) => sc.set(b[3], b[2], b[3] * 0.7));   // 밤 창문 불빛은 어두워질 때만 붙임 (낮엔 계산 안 함) · 공단 창고
    // 나무 (산 · 공원) 
    const trees = []; for (let i = 0; i < 5000 && trees.length < 1600; i++) { const x = -262 + R() * 524, z = -252 + R() * 504, h = this.groundH(x, z), c = this.cellAt(x, z); if (h < 1.5 || c === 'u' || c === 'i' || c === '0' || this.riverDist(x, z) < 4) continue; trees.push([x, z, h]); }
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.25, 0.35, 1.6, 5), new T.MeshLambertMaterial({ color: '#6B4A2B' }), trees.length), crown = new T.InstancedMesh(new T.ConeGeometry(1.5, 3.4, 6), new T.MeshLambertMaterial({ color: '#2F6B3A' }), trees.length), m4 = new T.Matrix4();
    trees.forEach((t, i) => { const s = 0.8 + R() * 0.8; m4.makeScale(s, s, s).setPosition(t[0], t[2] + 0.8 * s, t[1]); trunk.setMatrixAt(i, m4); m4.makeScale(s, s, s).setPosition(t[0], t[2] + 2.8 * s, t[1]); crown.setMatrixAt(i, m4); });
    S.add(trunk, crown); }
    // 실제 행정구역 이름: 구·군(크게) · 행정동(작게)
    Object.keys(UG.gus).forEach(gu => { const [x, z] = UG.gus[gu]; this.label(gu, x, 16, z, 2.2, '#FFFFFF', 'rgba(27,27,47,0.55)'); });
    // 행정동 이름은 3D 에서 뺌 (v2026-10-19a · 작은 이름표가 많아 장소 이름을 가렸음) — 지금 동은 미니맵 아래 · 지도에
    // 장소 건물
    this.inter = [];
    const place = (key, build, npcs) => { const P = UC_PLACES[key], g = this.real ? new T.Group() : build(P); g.position.set(P.at[0], this.groundH(P.at[0], P.at[1]), P.at[1]); S.add(g); if (!this.real) this.colGroup(g, P.at[0], P.at[1]); };   // 이름은 화면 위 장소 이름표(placeTags — 건물에 가리지 않고 거리까지)   // 실사풍: 장소 건물은 realSites 가 도시와 함께 그림
    const box = (w, h, d, col, x, y, z, g, walk) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); if (walk) m.userData.walk = true; g.add(m); return m; };
    place('lab', P => { const g = new T.Group(); box(12, 5, 8, '#F2F4F7', 0, 2.5, 0, g); box(12.4, 0.6, 8.4, '#2A6FB0', 0, 5.2, 0, g); box(3, 2.4, 0.3, '#9DD3F5', 0, 1.6, 4.1, g); return g; });
    place('weather', P => { const g = new T.Group(); box(6, 6, 6, '#E9ECF2', 0, 3, 0, g); const d = new T.Mesh(new T.SphereGeometry(2, 14, 10), new T.MeshLambertMaterial({ color: '#FFFFFF' })); d.position.y = 7.6; g.add(d); box(0.2, 5, 0.2, '#8A93A6', 3.5, 8, 0, g); return g; });
    place('clinic', P => { const g = new T.Group(); box(10, 4.5, 7, '#FFFFFF', 0, 2.25, 0, g); box(2.2, 0.6, 0.2, '#E63946', 0, 3.6, 3.6, g); box(0.6, 2.2, 0.2, '#E63946', 0, 3.6, 3.62, g); return g; });
    place('riverOffice', P => { const g = new T.Group(); box(5, 3, 4, '#FFB347', 0, 1.5, 0, g); return g; });
    place('garden', P => { const g = new T.Group(); for (let i = 0; i < 14; i++) box(3, 0.4, 3, ['#FF6BD6', '#FFD166', '#9B5DE5', '#F15BB5'][i % 4], (i % 7) * 4 - 12, 0.2, Math.floor(i / 7) * 5 - 6, g); return g; });
    place('port', P => { const g = new T.Group(); for (let i = 0; i < 3; i++) { box(1, 12, 1, '#E63946', i * 7 - 7, 6, 0, g); box(8, 1, 1, '#E63946', i * 7 - 4, 12, 0, g); } for (let i = 0; i < 10; i++) box(5, 2.4, 2.4, ['#1D7FA6', '#E63946', '#FFD166', '#2A9D5C'][i % 4], (i % 5) * 5.5 - 10, 1.2 + Math.floor(i / 5) * 2.4, -5, g); return g; });   // 컨테이너는 부두 북쪽 (예전 남쪽 줄은 어민 자리를 덮었음)
    place('onsanHarbor', P => { const g = new T.Group(); for (let i = 0; i < 4; i++) box(2, 1.2, 6, '#FFFFFF', 5 + i * 3.4, 0.3, -6, g, true); box(7, 1.5, 3, '#5B8DD6', -8.9, 0.75, -1.9, g); return g; });   // 고깃배는 바다 위 · 위판장은 실사풍과 같은 자리 (예전엔 제련소 마당 안에 겹쳤음)
    place('mouth', P => { const g = new T.Group(); box(10, 0.6, 3, '#8B5A2B', 0, 0.3, 0, g, true); box(2, 1, 5, '#FFFFFF', 3, 0.5, 3, g, true); return g; });   // 선착장·배: 밟고 지나감
    // 시설 (공장 · 처리장): 건물 · 탱크 · 굴뚝(연기) · 배출구(관) · 이름판
    this.smokes = [];
    Object.keys(UC_FAC).forEach(fid => { const F = UC_FAC[fid], g = new T.Group(), [fx, fz] = F.at, y0 = this.groundH(fx, fz), Y = ucYard(F);
      const isPlant = fid === 'F6' || fid === 'F8';
      if (!this.real) {   // 실사풍: 공장 모습은 realSites 가 (탱크·공정탑·처리조 …)
        // 가벼운 화질: 공장동·창고·탱크를 울타리 안에 배치 (정문 앞 7칸 · 굴뚝 둘레 2.5칸은 비움) — 예전엔 마당 밖 강가·길까지 삐져나왔음
        const [a0, b0, a1, b1] = F.yard, [ga, gb] = F.gate, used = [], stk = F.stacks.map(st => [st.x - fx, st.z - fz]), grid = [];
        const fits = (cx, cz, hw, hd) => { if (cx - hw < a0 + 1.2 || cx + hw > a1 - 1.2 || cz - hd < b0 + 1.2 || cz + hd > b1 - 1.2) return false; const gap = (px, pz) => Math.hypot(Math.max(0, Math.abs(px - cx) - hw), Math.max(0, Math.abs(pz - cz) - hd));
          return gap(ga, gb) > 7 && stk.every(([sx, sz]) => gap(sx, sz) > 2.5) && used.every(u => Math.abs(u[0] - cx) > u[2] + hw + 1.6 || Math.abs(u[1] - cz) > u[3] + hd + 1.6); };
        for (let cz = b0 + 3; cz <= b1 - 3; cz += 1.5) for (let cx = a0 + 3; cx <= a1 - 3; cx += 1.5) grid.push([cx, cz]);
        const put = (w, d, list) => { for (const [cx, cz] of list) if (fits(cx, cz, w / 2, d / 2)) { used.push([cx, cz, w / 2, d / 2]); return [cx, cz]; } return null; };
        const H1 = 4 + (fid.charCodeAt(1) % 3) * 2, w1 = Math.min(16, (a1 - a0) * 0.5), d1 = Math.min(9, (b1 - b0) * 0.36), m1 = put(w1, d1, grid), m2 = put(8, 7, grid.slice().reverse());
        if (m1) box(w1, H1, d1, isPlant ? '#C9D6CF' : '#B8C0CC', m1[0], H1 / 2, m1[1], g); if (m2) box(8, 3, 7, '#9AA3B0', m2[0], 1.5, m2[1], g);
        const tr = isPlant ? 2.6 : 2.2; let nt = 0; for (const p of grid) { if (nt >= (isPlant ? 4 : 3)) break; if (!fits(p[0], p[1], tr, tr)) continue; used.push([p[0], p[1], tr, tr]); nt++;
          const tk = new T.Mesh(new T.CylinderGeometry(tr, tr, isPlant ? 1.5 : 5, 16), new T.MeshLambertMaterial({ color: isPlant ? '#6FA8C7' : '#F2F2F2' })); tk.position.set(p[0], isPlant ? 0.75 : 2.5, p[1]); g.add(tk); }
        ucFence(F).forEach(([a, b, c, d]) => box(Math.max(0.3, c - a), 1.2, Math.max(0.3, d - b), '#6B7280', (a + c) / 2, 0.6, (b + d) / 2, g));   // 울타리 (강·바다를 피한 마당 · 정문 자리는 비움)
        this.colGroup(g, fx, fz); }
      g.position.set(fx, y0, fz); S.add(g);
      F.stacks.forEach(st => { const sy = this.groundH(st.x, st.z), sh = new T.Group();
        const cc = document.createElement('canvas'); cc.width = 16; cc.height = 64; const cg = cc.getContext('2d'); for (let y = 0; y < 64; y += 16) { cg.fillStyle = (y / 16) % 2 ? '#FFFFFF' : '#E63946'; cg.fillRect(0, y, 16, 16); }
        const inWorld = this.real && typeof UWORLD !== 'undefined' && (() => { const c = UWORLD.cyl; for (let i = 0; i < c.length; i += 6) if (Math.hypot(c[i] - st.x, c[i + 1] - st.z) < 1.5) return true; return false; })();   // 실사풍 세계 자료에 이미 있는 굴뚝
        if (!inWorld) { const stack = new T.Mesh(new T.CylinderGeometry(0.7, 1, 16, 12), new T.MeshLambertMaterial({ map: new T.CanvasTexture(cc) })); stack.position.y = 8; sh.add(stack); sh.position.set(st.x, sy, st.z); S.add(sh); this._obs.push([st.x, st.z, 1]); }   // 실사풍: 세계 자료의 굴뚝은 realSites 가 · 새로 늘린 굴뚝(지붕 위·마당)은 여기서 (빨강·흰 띠 원통)
        this.smokes.push({ x: st.x, y: sy + 16.5, z: st.z, id: st.id, parts: [] });
        const lamp = new T.Mesh(new T.SphereGeometry(0.55, 8, 6), new T.MeshBasicMaterial({ color: '#FF3B3B' })); lamp.position.set(st.x, sy + 16.4, st.z); lamp.visible = false; lamp.userData.noShadow = true; S.add(lamp); (this.lamps = this.lamps || []).push(lamp);   // 밤: 굴뚝 꼭대기 항공 경고등
        this.inter.push({ x: st.x, z: st.z, r: 6, kind: 'point', id: st.id, fac: fid, label: st.label + ' 살펴보기' }); });
      F.outs.forEach(o => { const R = UC_RIVERS[o.river], p = ucAt(R.pts, o.s), dir = Math.atan2(fz - p[1], fx - p[0]), bank = [p[0] + Math.cos(dir) * (R.w / 2 + 3), p[1] + Math.sin(dir) * (R.w / 2 + 3)];
        const pipe = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 6, 10), new T.MeshLambertMaterial({ color: '#5A6272' })); pipe.rotation.z = Math.PI / 2; pipe.rotation.y = -dir;
        pipe.position.set(p[0] + Math.cos(dir) * (R.w / 2 + 1), this.waterY(o.river, o.s) + 0.3, p[1] + Math.sin(dir) * (R.w / 2 + 1)); S.add(pipe);   // 물높이에 맞춤 (예전 0.1: 상류 방류구는 땅속에 묻혔음)
        this.post(bank[0], bank[1], '#FFD166');
        this.inter.push({ x: bank[0], z: bank[1], r: 6, kind: 'point', id: o.id, fac: fid, label: o.label + ' 살펴보기' }); });
      const gt = ucGate(F); this.inter.push({ x: gt[0], z: gt[1], r: 7, kind: 'facility', fac: fid, label: F.name + ' 방문' }); });   // 정문 (시설마다 방향이 다를 수 있음)
    // 측정소: 물벼룩 바이오센서(파란 상자) · 대기·악취 센서(기둥)
    UC_BIO.forEach(b => { const [x, z] = ucBioAt(b), g = new T.Group(); box(1.6, 2, 1.6, '#1D7FA6', 0, 1, 0, g); box(0.1, 2.5, 0.1, '#DDDDDD', 0.5, 3, 0, g);   // 강 옆 둑 위 (물길에 수직)
      g.position.set(x, this.groundH(x, z), z); S.add(g); this.colGroup(g, x, z); this.inter.push({ x, z, r: 5, kind: 'bio', st: b, label: b.name + ' 기록 보기' }); });
    UC_AIR.forEach(a => { const g = new T.Group(); box(0.2, 5, 0.2, '#8A93A6', 0, 2.5, 0, g); box(1.2, 1, 0.8, '#F2F4F7', 0, 4.2, 0, g); box(1.6, 0.08, 1, '#23395B', 0, 5.2, 0, g);
      g.position.set(a.x, this.groundH(a.x, a.z), a.z); S.add(g); this.colGroup(g, a.x, a.z); this.inter.push({ x: a.x, z: a.z, r: 5, kind: 'air', st: a, label: a.name + ' 기록 보기' }); });
    this.flushPosts(); this.buildCollision();
    // 연구원 분석 창구
    this.inter.push({ x: UC_PLACES.lab.at[0], z: UC_PLACES.lab.at[1] + 3, r: 6, kind: 'lab', label: '시료 분석 의뢰' });   // 연구원 정문 앞 (예전 +6은 강물 위)
    if (window.ThreeQuality && this.hq !== 'low') ThreeQuality.apply(this, this.real ? { half: this.hq === 'high' ? 62 : 48, far: 460, tone: 'aces', exposure: 1.0, sun: 1.6, hemi: 0.5 } : { half: 46, far: 320, tone: 'none', sun: 0.72, hemi: 0.72 });   // 실사풍: ACES 색 보정 · 넓은 그림자 / 예전: 원래 색 그대로 + 그림자
    this.baseSun = this.sun.intensity; this.baseHemi = this.hemi.intensity; this.baseSunOff = (this.sunOffset || this.sun.position).clone(); this.setDayTime(32);
  }
  post(x, z, col) { (this._posts = this._posts || []).push([x, z, col]); }
  flushPosts() {                                             // 거리표·배출구 기둥을 인스턴스 한 번으로 (그리기 횟수 절약)
    const T = THREE, list = this._posts || []; if (!list.length) return; const im = new T.InstancedMesh(new T.BoxGeometry(0.35, 2.2, 0.35), new T.MeshLambertMaterial({ color: 0xffffff }), list.length), m4 = new T.Matrix4(), c = new T.Color();
    list.forEach((p, i) => { m4.makeTranslation(p[0], this.groundH(p[0], p[1]) + 1.1, p[1]); im.setMatrixAt(i, m4); c.set(p[2]); if (this.hq !== 'low') c.convertSRGBToLinear(); im.setColorAt(i, c); }); this.scene.add(im); this._posts = [];
  }
  label(text, x, y, z, s, fg, bg, range) {
    const T = THREE, c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '800 34px Pretendard, sans-serif'; const w = Math.ceil(g.measureText(text).width) + 30;
    c.width = w; c.height = 52; g.font = '800 34px Pretendard, sans-serif'; const rr = (a, b, cw, ch, r) => { g.beginPath(); if (g.roundRect) g.roundRect(a, b, cw, ch, r); else g.rect(a, b, cw, ch); };
    g.fillStyle = bg; rr(1, 1, w - 2, 50, 13); g.fill(); const sh = g.createLinearGradient(0, 1, 0, 51); sh.addColorStop(0, 'rgba(255,255,255,.2)'); sh.addColorStop(0.48, 'rgba(255,255,255,.03)'); sh.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = sh; g.fill();   // 위는 밝게 · 아래는 어둡게 (유리판)
    if (s >= 0.9) { g.strokeStyle = 'rgba(255,228,168,.8)'; g.lineWidth = 2; rr(2, 2, w - 4, 48, 12); g.stroke(); }   // 큰 이름표: 금빛 테
    g.fillStyle = fg; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 4; g.shadowOffsetY = 1; g.fillText(text, 15, 27);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false })); sp.scale.set(w / 52 * 1.7 * s, 1.7 * s, 1); sp.position.set(x, this.groundH(x, z) + y, z); sp.userData.noShadow = true; this.scene.add(sp);
    (this.labels = this.labels || []).push({ sp, always: s >= 1.5, range: range || (s >= 1 ? 190 : 110) }); return sp;   // 구·군 이름(큰 것)은 항상 · 나머지는 가까울 때만
  }

  // 아직 안 만난 사람 머리 위 금색 느낌표 (멀리서도 보이게 · 3D)
  questMark(x, y, z) {
    const T = THREE; if (!this._qmTex) { const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d'), gl = g.createRadialGradient(32, 42, 4, 32, 42, 32); gl.addColorStop(0, 'rgba(255,214,102,.75)'); gl.addColorStop(1, 'rgba(255,214,102,0)'); g.fillStyle = gl; g.fillRect(0, 0, 64, 96);
      g.beginPath(); g.moveTo(32, 6); g.lineTo(52, 40); g.lineTo(32, 74); g.lineTo(12, 40); g.closePath(); const gr = g.createLinearGradient(0, 6, 0, 74); gr.addColorStop(0, '#FFF6D0'); gr.addColorStop(0.5, '#F5C451'); gr.addColorStop(1, '#B8862F'); g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#3A2600'; g.stroke();
      g.fillStyle = '#2A1C00'; g.font = '900 34px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 42); this._qmTex = new T.CanvasTexture(c); if (this.hq !== 'low') this._qmTex.encoding = T.sRGBEncoding; }
    const sp = new T.Sprite(new T.SpriteMaterial({ map: this._qmTex, depthWrite: false, transparent: true })); sp.scale.set(1.35, 2.0, 1); sp.position.set(x, y, z); sp.userData.noShadow = true; this.scene.add(sp); return sp;
  }
  // ── 사람 ──
  // 사람: 둥근 몸통(허리 잘록 · 어깨 둥글게) · 목 · 머리·머리카락·눈 · 팔(어깨에서 흔듦) · 다리(엉덩이에서 흔듦) · 신발 · 코트·조끼·모자
  //   부위마다 한 덩어리(정점 색)로 합쳐 사람 하나 = 5번 그리기 · 재질은 모두 같이 씀
  person(o) {
    const T = THREE, g = new T.Group(), linC = this.hq !== 'low', parts = { body: [], armL: [], armR: [], legL: [], legR: [] };
    const put = (key, geo, col, x, y, z, sx, sy, sz) => { if (sx) geo.scale(sx, sy, sz); geo.translate(x || 0, y || 0, z || 0); const c = new T.Color(col); if (linC) c.convertSRGBToLinear(); parts[key].push([geo, c]); };
    const lathe = (pts, seg) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg || 16);
    const capsule = (r, len) => { const pts = []; for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i / 5 * Math.PI / 2; pts.push([Math.max(0.001, Math.cos(a) * r), Math.sin(a) * r]); } for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI / 2; pts.push([Math.max(0.001, Math.cos(a) * r), len + Math.sin(a) * r]); } const q = lathe(pts, 10); q.rotateX(Math.PI); return q; };   // 어깨·엉덩이(0)에서 아래로
    const shirt = o.shirt || '#3FA9F5', top = o.coat || shirt, pants = o.pants || '#2B3A55', skin = o.skin || '#F2C9A0', hair = o.hair || '#2B1E16';
    put('body', lathe([[0.001, 0.84], [0.19, 0.86], [0.22, 0.98], [0.2, 1.16], [0.235, 1.36], [0.25, 1.49], [0.2, 1.6], [0.1, 1.66], [0.001, 1.67]]), top, 0, 0, 0, 1, 1, 0.66);
    if (o.coat) put('body', lathe([[0.001, 0.6], [0.25, 0.62], [0.26, 0.9], [0.245, 1.18], [0.265, 1.42], [0.265, 1.51], [0.2, 1.61], [0.001, 1.64]]), o.coat, 0, 0, 0, 1, 1, 0.7);   // 코트: 엉덩이 아래까지
    if (o.vest) put('body', lathe([[0.205, 0.95], [0.25, 1.0], [0.255, 1.25], [0.27, 1.45], [0.215, 1.55], [0.12, 1.58]]), o.vest, 0, 0, 0, 1, 1, 0.72);
    put('body', new T.CylinderGeometry(0.07, 0.08, 0.14, 10), skin, 0, 1.71, 0);
    put('body', new T.SphereGeometry(0.235, 18, 14), skin, 0, 1.93, 0, 0.95, 1.05, 1);
    put('body', new T.SphereGeometry(0.25, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.94, -0.025);
    [-1, 1].forEach(sd => put('body', new T.SphereGeometry(0.028, 6, 5), '#161616', sd * 0.08, 1.95, 0.212));
    if (o.hat === 'cap') { put('body', new T.SphereGeometry(0.258, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), o.hatCol || '#1D7FA6', 0, 2.0, 0, 1, 0.72, 1); put('body', new T.CylinderGeometry(0.2, 0.2, 0.025, 14, 1, false, -Math.PI / 2, Math.PI), o.hatCol || '#1D7FA6', 0, 2.0, 0.13, 1.05, 1, 1.15); }
    if (o.hat === 'helmet') put('body', new T.SphereGeometry(0.28, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), o.hatCol || '#FFFFFF', 0, 1.99, 0, 1, 0.86, 1.05);
    if (o.hat === 'rain') put('body', new T.ConeGeometry(0.42, 0.3, 16), o.hatCol || '#FFD166', 0, 2.2, 0);
    ['armL', 'armR'].forEach(k => { put(k, capsule(0.068, 0.6), top); put(k, new T.SphereGeometry(0.072, 8, 6), skin, 0, -0.72, 0.01); });
    ['legL', 'legR'].forEach(k => { put(k, capsule(0.095, 0.72), pants); put(k, new T.SphereGeometry(1, 10, 6), '#26262A', 0, -0.83, 0.05, 0.105, 0.065, 0.19); });
    const mat = this._personMat || (this._personMat = this.real ? new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 }) : new T.MeshLambertMaterial({ vertexColors: true })); mat.userData.lin = true;
    const mesh = key => { const pos = [], nor = [], col = [], idx = []; let off = 0;
      parts[key].forEach(([geo, c]) => { const P = geo.attributes.position, N = geo.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
        (geo.index ? Array.from(geo.index.array) : [...Array(P.count).keys()]).forEach(k => idx.push(k + off)); off += P.count; geo.dispose(); });
      const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); bg.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); bg.setIndex(idx); return new T.Mesh(bg, mat); };
    g.add(mesh('body'));
    const limb = (key, x, y, rz) => { const pv = new T.Group(); pv.position.set(x, y, 0); pv.rotation.z = rz || 0; pv.add(mesh(key)); g.add(pv); return pv; };
    const armL = limb('armL', -0.3, 1.5, -0.07), armR = limb('armR', 0.3, 1.5, 0.07), legL = limb('legL', -0.11, 0.88), legR = limb('legR', 0.11, 0.88);
    g.userData = { legL, legR, armL, armR }; this.scene.add(g); return g;
  }
  buildPeople() {
    this.player = this.person({ shirt: '#FFFFFF', vest: '#1FBF6A', pants: '#2B3A55', hat: 'cap', hatCol: '#12925A' });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 24), new THREE.MeshBasicMaterial({ color: 0x1FBF6A, transparent: true, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.userData.noShadow = true; this.player.add(ring); this.meRing = ring;
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 32), new THREE.MeshBasicMaterial({ color: 0x36E08F, transparent: true, opacity: 0.6, depthWrite: false })); wave.rotation.x = -Math.PI / 2; wave.position.y = 0.06; wave.userData.noShadow = true; this.player.add(wave); this.meWave = wave;   // 발밑에 퍼지는 물결 (내 캐릭터가 어디 있는지)
    this.npcs = [];
    const npc = (id, name, emoji, at, look) => { const g = this.person(look), [x, z] = at, y = this.standY(x, z); g.position.set(x, y, z); g.rotation.y = Math.PI;
      const mark = this.questMark(x, y + 3.4, z); this.npcs.push({ id, name, emoji, x, z, g, mark, y0: y }); this.inter.push({ x, z, r: 4.5, kind: 'npc', id, label: ucJ(name, '과', '와') + ' 이야기' }); };
    const P = ucNpcAt;   // 장소 사람들 자리 (ulsan-case.js — 물가에서 한 발 물러남)
    npc('researcher', '연구원 박연구사', '🧪', P('researcher'), { coat: '#FFFFFF', shirt: '#9DD3F5', hair: '#3B2A20' });
    npc('forecaster', '기상대 최예보관', '🌬️', P('forecaster'), { shirt: '#23395B', pants: '#1B1B2F', hair: '#1B1B1B' });
    npc('doctor', '보건소 윤의사', '🩺', P('doctor'), { coat: '#FFFFFF', shirt: '#B3E5FC', hair: '#1B1B1B' });
    npc('resident', '산책하던 주민 이씨', '🚶', P('resident'), { shirt: '#F28FB5', pants: '#5A6272', hair: '#8B5A2B' });
    npc('riverman', '하천관리원 정씨', '🦺', P('riverman'), { shirt: '#FF9F1C', vest: '#FF9F1C', hat: 'helmet', hatCol: '#FFD166' });
    npc('fisherT', '태화강 하구 어민 김씨', '🎣', P('fisherT'), { coat: '#FFD166', hat: 'rain' });
    npc('fisherO', '온산 어촌계 한씨', '🎣', P('fisherO'), { coat: '#FFD166', hat: 'rain', skin: '#D9A77A' });
    npc('fisherP', '울산항 어민 배씨', '🎣', P('fisherP'), { coat: '#9DD3F5', hat: 'rain', hatCol: '#FFFFFF', skin: '#E0B08A' });
    npc('activist', '환경단체 활동가 오씨', '📢', [34, 24], { shirt: '#2A9D5C', vest: '#7DF58F', hair: '#1B1B1B' });
    Object.keys(UC_FAC).forEach(fid => { const F = UC_FAC[fid];
      if (this.set.lie) npc('mgr-' + fid, F.name.split(' (')[0] + ' 환경팀장', '👔', ucGate(F, 2, -3), { shirt: '#FFFFFF', coat: '#3A3F55', hat: 'helmet', hatCol: '#FFFFFF' });   // 정문 밖 두 사람 — 환경팀장은 '어려움'에만 (늘 '고장'이라 둘러대는 사람 · 쉬움·보통은 경비원만 — 사람이 너무 많아 찾기 복잡했음)
      npc('guard-' + fid, F.name.split(' (')[0] + ' 경비원', '💂', ucGate(F, 2, 4), { shirt: '#23395B', hat: 'cap', hatCol: '#1B1B2F' }); });
    if (window.ThreeQuality && this.hq && this.hq !== 'low') { ThreeQuality.prep(this, this.player); this.npcs.forEach(n => ThreeQuality.prep(this, n.g)); }
  }

  // ── 매 프레임 ──
  bindKeys() {
    this._kd = e => { if (e.repeat && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); return; } if (this.ui.modalOpen) { this.modalKey(e); return; } if (this.ov && (e.code === 'Escape' || e.code === 'KeyM')) { if (this.replay) this.stopReplay(); else this.exitOverview(); return; } if (this.ov) { this.keys[e.code] = true; if (e.code === 'Equal' || e.code === 'NumpadAdd') this.ovZoom(0.8); if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.ovZoom(1.25); return; } this.keys[e.code] = true; if (e.code === 'KeyE' || (e.code === 'Space' && this.near)) { e.preventDefault(); this.interact(); } else if (e.code === 'Space') { e.preventDefault(); this.jump(); } if (e.code === 'KeyV') this.cycleCam(); };
    this._ku = e => { this.keys[e.code] = false; if (this.mg && this.mg.key) this.mg.key(e, false); }; addEventListener('keydown', this._kd); addEventListener('keyup', this._ku);
    this._blur = () => { this.keys = {}; this.mx = 0; this.my = 0; if (this.mg && this.mg.release) try { this.mg.release(); } catch (e) {} this.save(); }; addEventListener('blur', this._blur); document.addEventListener('visibilitychange', this._blur);   // 손 뗌이 전달되지 않아 계속 걷던 문제
  }
  // 창이 열려 있을 때 키보드: 대화는 E·스페이스·엔터로 넘김 · Esc 는 닫기/그만두기
  modalKey(e) {
    if (this.mg) { if (e.code === 'Escape') { e.preventDefault(); this.closeDialog(); return; } if (this.mg.key) this.mg.key(e, true); return; }   // 미니게임: Space·E·Enter 누르기/떼기
    const box = this.ui.dlg, btns = [...box.querySelectorAll('.u-opts button')]; if (!btns.length) return;
    if (box.classList.contains('talk') && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); const bd = box.querySelector('.u-body'); if (bd && !bd.classList.contains('shown') && performance.now() - (this._talkT || 0) < 1000) { bd.classList.add('shown'); return; } btns[0].click(); return; }   // 글이 나타나는 중이면 먼저 다 보이게
    if (e.code === 'Escape') { const q = btns.find(b => /^(그만두기|취소|닫기|알겠어요)/.test(b.textContent)) || btns.find(b => b.classList.contains('ghost') && !b.classList.contains('lockbtn')); if (q) { e.preventDefault(); q.click(); } }
  }
  // ── 절전 (v2026-10-19d) — 폰이 뜨거워지던 원인: 3D 를 쉬지 않고 초당 60장(120Hz 폰은 120장) 새로 그림 · 창에 가려져도 계속 그림 ──
  //   폰·태블릿: 움직일 때 초당 30장 · 가만히 있으면 20장 · 창을 열면 12장 · 화면을 다 덮는 창(전체 지도·수첩 등)이면 3D 를 쉼(초당 5번 시계·분석만)
  //   PC: 그대로 (다 덮는 창일 때만 3D 쉼) · 모습·조작은 같음
  paceIv(now) {
    if (this.mg || this.gameOver || this.replay || this.noPace) return 0; const U = this.ui;
    if (U.modalOpen && this._cover) return 200;
    if (!this.touch) return 0;
    if ((now || this.now || 0) - (this._actT || 0) < 700) return 1000 / 30;
    return U.modalOpen ? 1000 / 12 : 50;
  }
  tick(now) {
    if (this._dead) return;   // 끝낸 게임(교사가 대기실로 · ← 뒤로)은 더 그리지 않음
    const iv = this.lastTime ? this.paceIv(now) : 0; if (iv && now - this.lastTime < iv - 4) return;   // 절전: 이번 화면 차례는 건너뜀 (지난 시간은 다음 장에 한꺼번에)
    this._paceIv = iv; this._drawnAt = now;
    const dt = this.lastTime ? Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000)) : 0.016; this.lastTime = now; this.now = now;   // 느린 기기(초당 10프레임)에서도 같은 속도
    if (this.gameOver) { if (this.replay) { this.replay.objs.forEach(o => this.scene.remove(o)); this.replay = null; this.ui.root.classList.remove('rp-on'); this.ui.rp.classList.add('hidden'); } if (this.ov) this.exitOverview(); this.updateHud(); return this.draw(); }
    let mx = this.mx, my = this.my; if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1; if (this.keys.KeyD || this.keys.ArrowRight) mx += 1; if (this.keys.KeyW || this.keys.ArrowUp) my -= 1; if (this.keys.KeyS || this.keys.ArrowDown) my += 1;
    const m = Math.hypot(mx, my); let moving = false;
    if (m > 0.1 && !this.ui.modalOpen && !this.ov) { const k = Math.min(1, m), dist = 16 * k * dt, dx = mx / m, dz = my / m, n = Math.max(1, Math.ceil(dist / 0.3)), st = dist / n;
      if (!this.canStand(this.px, this.pz, this.jh)) { this.unstick(); this.jh = 0; this.jv = 0; }   // 건물 속 · 물 위에 놓였으면 가장 가까운 설 수 있는 곳으로
      // 0.3칸씩 나눠 움직임 (얇은 담장을 뚫지 않게) · 막히면 벽을 따라 미끄러짐 (비스듬히 20°·40°·60° — 정면으로 부딪히면 멈춤)
      let moved = 0; const FAN = UlsanRpgGame.FAN;
      for (let q = 0; q < n; q++) { let ok = false;
        for (let f = 0; f < FAN.length; f++) { const [ca, sa, sp] = FAN[f], ux = (dx * ca - dz * sa) * st * sp, uz = (dx * sa + dz * ca) * st * sp; if (this.canStand(this.px + ux, this.pz + uz, this.jh)) { this.px += ux; this.pz += uz; moved += st * sp; ok = true; break; } }
        if (!ok) break; }
      if (moved > 0.001) { this.spend(moved * 0.2 / 60); moving = true; }   // 조사 차량: 1칸(90 m)에 0.2분
      this.heading = Math.atan2(mx, my); }
    // 점프·낙하: 발 높이 jh 가 딛고 설 높이(땅 0 · 낮은 구조물 꼭대기)보다 높으면 중력으로 내려옴 (정확한 포물선 — 느린 기기에서도 같은 높이)
    { const sup = this.supportH(this.px, this.pz); this.jh = this.jh || 0; this.jv = this.jv || 0;
      if (this.jv > 0 || this.jh > sup + 0.001) { const G = UlsanRpgGame.JUMP_G; this.jh += this.jv * dt - 0.5 * G * dt * dt; this.jv -= G * dt; if (this.jh <= sup) { this.jh = sup; this.jv = 0; } }
      else { this.jh = sup; this.jv = 0; } }
    const air = this.jh - this.supportH(this.px, this.pz), y = this.standY(this.px, this.pz) + this.jh; this.player.position.set(this.px, y, this.pz); this.player.rotation.y = this.heading;
    if (this.meWave) { const ph = (now / 1400) % 1; this.meWave.scale.setScalar(1 + ph * 2.6); this.meWave.material.opacity = 0.7 * (1 - ph);
      const rn = now - (this._wadeT || 0) > 250 ? (this._wadeT = now, this._wade = this.riverNear(this.px, this.pz)) : this._wade, wy = rn && rn.d < 0.2 ? this.waterY(rn.rid, rn.s) - 0.1 - y + 0.03 : 0.06;   // 강을 건널 땐 물결이 물 위에 퍼짐
      this.meWave.position.y = Math.max(0.06, wy) - air; this.meRing.position.y = Math.max(0.05, wy - 0.01) - air; }
    const u = this.player.userData, sw = air > 0.05 ? 0 : moving ? Math.sin(now / 90) * 0.7 : 0; u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
    if (air > 0.05) { u.legL.rotation.x = -0.55; u.legR.rotation.x = 0.35; u.armL.rotation.x = u.armR.rotation.x = -0.9; }   // 공중: 다리를 모으고 팔을 올림
    this.npcs.forEach(n => { n.g.position.y = (n.y0 != null ? n.y0 : (n.y0 = this.standY(n.x, n.z))) + Math.abs(Math.sin(now / 600 + n.x)) * 0.04; const dd = Math.hypot(n.x - this.px, n.z - this.pz), v = !!(!this.ov && !this.talked[n.id] && dd < 150 && (dd >= 46 || this.ui.modalOpen) && this.camera.position.distanceTo(n.mark.position) > 8); if (n.mark.visible !== v) n.mark.visible = v;
      if (v) n.mark.position.y = n.y0 + 3.4 + Math.sin(now / 320 + n.x) * 0.18; });   // 아직 안 만난 사람: 멀리서는 3D 금색 느낌표(통통) · 가까우면 이름표(HTML)에 느낌표
    // 연기
    // (예전: 매 프레임 새 입자·새 재질을 만들어 화면이 부드러울수록 수백 개로 늘어 태블릿이 크게 느려짐)
    this.stepSmoke(dt);
    // 분석 결과 도착
    this.pending = this.pending.filter(p => { if (this.nowH >= p.readyH) { this.deliver(p); return false; } return true; });
    if (!this.report) this.deliverNews();   // 📰 시각이 된 소식
    // 실제 시간 제한: 3분·1분 전 알림 → 0이면 작성 중인 보고서를 자동 제출
    if (!this.report) { const left = this.caseLeftSec;
      if (left <= 180 && !this.warned.m3) { this.warned.m3 = true; this.toast('⏰ 3분 남았어요! 보고서를 채워 두세요 (시간이 되면 자동 제출)'); }
      if (left <= 60 && !this.warned.m1) { this.warned.m1 = true; this.toast('⏰ 1분 남았어요! 지금까지 고른 답으로 곧 자동 제출돼요'); }
      if (left <= 0) this.autoSubmit(); }
    // 카메라: 북쪽이 위 · 비스듬히 내려다봄
    this.stepWater(dt, now); if (this.real) this.realFrame(dt, now);
    if (this.ov) { this._actT = now; if (this.replay) this.stepReplay(dt); this.stepOverview(dt, now); this.stepBeacon(now); if (window.ThreeQuality) ThreeQuality.frame(this, this.px, 0, this.pz, now); this.cullLabels(); this.near = null; this.updateHud(); this.draw(); if (now - (this._savedAt || 0) > 4000) this.save(); return; }
    const cam = this.camera, F = this.ui.modalOpen && this.focus, tx = F ? F.x : this.px, tz = F ? F.z : this.pz, ty = y, kf = a => 1 - Math.pow(1 - a, dt * 60);   // kf: 초당 60장 기준 비율 → 장수와 상관없이 같은 빠르기
    this.camK += (this.camKT - this.camK) * Math.min(1, dt * 4); const V = this.camView();   // 시점: 멀리(지도처럼) · 중간 · 가까이(지평선까지)
    this._camT = this._camT || new THREE.Vector3(); this._look = this._look || new THREE.Vector3(tx, ty + 1, tz - 4);
    const cb = F ? 11 : V.back, cy = Math.max(ty + (F ? 9 : V.h), this.groundH(tx, tz + cb) + 1.6);   // 카메라가 언덕 속으로 들어가지 않게
    const c0x = cam.position.x, c0y = cam.position.y, c0z = cam.position.z; this._lookT = this._lookT || new THREE.Vector3();
    cam.position.lerp(this._camT.set(tx, cy, tz + cb), kf(F ? 0.08 : 0.12)); this._look.lerp(this._lookT.set(tx, ty + (F ? 1.6 : V.ly), tz - (F ? 0 : V.ahead)), kf(F ? 0.1 : 0.3)); cam.lookAt(this._look);
    if (moving || m > 0.1 || Math.abs(cam.position.x - c0x) + Math.abs(cam.position.y - c0y) + Math.abs(cam.position.z - c0z) > 0.01 || Math.abs(this.camKT - this.camK) > 0.004) this._actT = now;   // 움직이는 중 = 부드럽게(초당 30장)
    this.stepBeacon(now); if (now - (this._dayT || 0) > 500) { this._dayT = now; this.setDayTime(this.nowH); }   // 게임 속 시각에 맞춘 낮·밤
    if ((this._dirty && now - (this._savedAt || 0) > 800) || now - (this._savedAt || 0) > 4000) this.save();   // 진행 저장 (4초마다 · 바뀌면 곧바로)
    if (window.ThreeQuality) ThreeQuality.frame(this, this.px, 0, this.pz - V.ahead * 0.7, now);   // 그림자 범위를 보이는 쪽으로
    this.cullLabels(); this.near = this.nearest(); this.updateHud();
    if (this.near && this.near.kind === 'river' && !this.tipFish && this.startFishing && !this.ui.modalOpen) { this.tipFish = true; this.toast('🎣 강가에서 🔍 조사 → 낚시로 물고기 건강도 볼 수 있어요'); }   // 처음 강가에 왔을 때 한 번
    if (this.mg) this.mgFrame(now); else if (!(this.ui.modalOpen && this._cover)) this.draw();   // 미니게임 중 · 화면을 거의 다 덮는 창(전체 지도·수첩 등)이 열려 있으면 3D 를 다시 그리지 않음 (가벼움)
  }
  draw() {
    // 절전: 그림자 지도는 움직일 때만 매번 새로 · 가만히 있으면 0.2초에 한 번 (예전: 아무것도 안 움직여도 매 화면 도시 전체를 한 번 더 그렸음)
    const SM = this.renderer && this.renderer.shadowMap; if (SM && SM.enabled) { const t = this.now || performance.now(); if (SM.autoUpdate) SM.autoUpdate = false;
      if (!this._shT || this._shDirty || t - (this._actT || 0) < 700 || t - this._shT > 200 || t < this._shT) { SM.needsUpdate = true; this._shT = t; this._shDirty = false; } }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }   // 고화질 실사풍: 빛 번짐·색감 후처리
  // 화면이 버벅이면 플랫폼이 한 단계씩 낮춤 (2 최고 · 1 · 0 최저) — 실사풍: 후처리 → 나무 범위 → 그림자·구름 그림자 순으로 덜어냄
  setQuality(q) { q = Math.max(0, Math.min(2, q | 0)); const was = this.qLevel; this.qLevel = q; if (q === 0 && was !== 0 && this.renderer) { this.renderer.setPixelRatio(1); this.resize(); } if (!this.real) return;
    if (q < 2 && this.realPostOff) this.realPostOff(); else if (q >= 2 && this.realPost) this.realPost();
    this._treeK = q >= 2 ? 1 : q === 1 ? 0.78 : 0.55; this._treeC = null; if (this.realU) this.realU.uCloud.value = q === 0 ? 0 : 0.65;
    if (this.clouds) this.clouds.visible = q > 0;   // 가장 가볍게: 구름 그림자 판도 그리지 않음
    if (q === 0 && was !== 0 && this.renderer.shadowMap.enabled) { this.renderer.shadowMap.enabled = false; this.sun.castShadow = false; this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); } }
  // 시점 세 가지 (0 가까이 · 0.5 중간 · 1 멀리) — [높이, 뒤로, 앞쪽 바라보는 거리, 바라보는 높이] 사이를 부드럽게
  camView() { const P = [[5.5, 12, 18, 2.4], [13, 20, 14, 2], [40, 34, 4, 1]], k = Math.max(0, Math.min(2, this.camK * 2)), i = Math.min(1, Math.floor(k)), t = k - i, A = P[i], B = P[i + 1], f = j => A[j] + (B[j] - A[j]) * t;
    return { h: f(0), back: f(1), ahead: f(2), ly: f(3) }; }
  setCamView(k, quiet) { this.camKT = Math.max(0, Math.min(1, k)); try { localStorage.setItem('ulsanCamView', String(this.camKT)); } catch (e) {}
    const nm = this.camKT > 0.75 ? '멀리' : this.camKT > 0.25 ? '중간' : '가까이'; if (this.ui.camBtn) this.ui.camBtn.querySelector('small').textContent = nm;
    if (!quiet) this.toast('🎥 시점: ' + nm + (nm === '가까이' ? ' — 지평선까지 보여요' : nm === '멀리' ? ' — 지도처럼 넓게' : '')); }
  cycleCam() { this.setCamView(this.camKT > 0.75 ? 0.5 : this.camKT > 0.25 ? 0 : 1); }
  stepSmoke(dt) {
    const T = THREE, real = this.real, life = real ? 5.5 : 4; if (!this.smokePool) { this.smokePool = [];
      if (real) { const tex = this.smokeTex(); for (let i = 0; i < 48; i++) { const m = new T.Sprite(new T.SpriteMaterial({ map: tex, color: 0xdddddd, transparent: true, opacity: 0, depthWrite: false, rotation: Math.random() * 6.28 })); m.visible = false; m.userData.noShadow = true; this.scene.add(m); this.smokePool.push({ m, t: 99, r: (Math.random() - 0.5) * 0.5 }); } }   // 실사풍: 부드러운 연기 뭉게 (둥근 공 대신)
      else { const geo = new T.SphereGeometry(1, 8, 6); for (let i = 0; i < 36; i++) { const m = new T.Mesh(geo, new T.MeshLambertMaterial({ color: '#E6E6E6', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.userData.noShadow = true; this.scene.add(m); this.smokePool.push({ m, t: 9 }); } }
      this.smokeAcc = 0; }
    const w = this.C.wind[this.C.wind.length - 1], near = this.smokes.filter(s => Math.hypot(s.x - this.px, s.z - this.pz) < 150);
    this.smokeAcc += dt * near.length * (real ? 2.6 : 2.2);                       // 가까운 굴뚝 하나당 1초에 2~3개
    while (this.smokeAcc >= 1 && near.length) { this.smokeAcc -= 1; const s = near[Math.floor(Math.random() * near.length)], q = this.smokePool.reduce((a, b) => (b.t > a.t ? b : a));   // 가장 오래된 입자 재사용
      q.t = 0; q.m.visible = true; q.m.position.set(s.x + (Math.random() - 0.5) * 0.3, s.y, s.z + (Math.random() - 0.5) * 0.3); }
    if (!near.length) this.smokeAcc = 0;
    const shade = 0.3 + 0.62 * (1 - (this._night || 0));   // 밤엔 어두운 연기
    this.smokePool.forEach(q => { if (q.t > life) { if (q.m.visible) q.m.visible = false; return; } q.t += dt; const p = q.m.position;
      if (real) { const f = q.t / life; p.x += Math.cos(w.dir) * dt * 2.0 * (0.4 + f); p.z += Math.sin(w.dir) * dt * 2.0 * (0.4 + f); p.y += dt * 1.5 * (1 - f * 0.6); const sc = 1.3 + q.t * 1.7; q.m.scale.set(sc, sc, 1);
        q.m.material.opacity = Math.min(1, q.t * 2.5) * (1 - f) * 0.5; q.m.material.rotation += q.r * dt; q.m.material.color.setScalar(shade); }
      else { p.x += Math.cos(w.dir) * dt * 2.2; p.z += Math.sin(w.dir) * dt * 2.2; p.y += dt * 1.6; q.m.scale.setScalar(1 + q.t * 1.2); q.m.material.opacity = Math.max(0, 0.6 - q.t * 0.15); } });
  }
  smokeTex() {                                                  // 연기 뭉게 무늬: 겹친 둥근 번짐 몇 개 (가장자리는 투명)
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), R = ucRng(99);
    for (let i = 0; i < 9; i++) { const x = 64 + (R() - 0.5) * 40, y = 64 + (R() - 0.5) * 40, r = 22 + R() * 18, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.42)'); gr.addColorStop(0.6, 'rgba(245,245,245,0.18)'); gr.addColorStop(1, 'rgba(240,240,240,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  // 이름표: 멀리 있는 작은 이름표는 숨김 (0.4초마다) — 그리기 횟수 줄임
  cullLabels() { if (!this.labels) return; const t = this.now || 0; if (t - (this._cullT || 0) < 400) return; this._cullT = t;
    if (!this.ov) { const ks = +(0.6 + 0.4 * Math.max(0, Math.min(1, this.camK == null ? 1 : this.camK))).toFixed(2); if (ks !== this._lks) { this._lks = ks; this.labels.forEach(l => { if (!l.base) l.base = l.sp.scale.clone(); l.sp.scale.copy(l.base).multiplyScalar(ks); }); } } else this._lks = null;   // 낮은 시점일수록 이름표를 작게 (가까워 크게 보이므로)
    const cp = this.camera.position; this.labels.forEach(l => { if (l.always) return; const v = this.ov ? l.range >= 190 : Math.hypot(l.sp.position.x - this.px, l.sp.position.z - this.pz) < l.range && cp.distanceTo(l.sp.position) > 17; if (l.sp.visible !== v) l.sp.visible = v; });   // 3D 전경: 시설·장소 이름 모두 · 카메라 바로 앞 이름표는 숨김 (낮은 시점에서 화면을 가림)
    // 내 캐릭터를 가리는 큰 이름표(시설·장소·구)는 흐리게 — 예전엔 제련소 이름판이 캐릭터를 덮었음
    const me = !this.ov && this.player ? this.toScreen(this.px, this.player.position.y + 1.1, this.pz) : null;
    this.labels.forEach(l => { if (l.range < 190 && !l.always) return; let o = 1; if (me && me.on && l.sp.visible) { const P = l.sp.position, a = this.toScreen(P.x - l.sp.scale.x / 2, P.y - l.sp.scale.y / 2, P.z), b = this.toScreen(P.x + l.sp.scale.x / 2, P.y + l.sp.scale.y / 2, P.z);
      if (a.front && me.x > a.x - 14 && me.x < b.x + 14 && me.y > b.y - 24 && me.y < a.y + 30) o = 0.2; } if (l.sp.material.opacity !== o) { l.sp.material.opacity = o; l.sp.material.transparent = true; } }); }
  // 가장 가까운 설 수 있는 곳 (좁은 틈 말고 사방이 트인 곳) — 건물 속·물 위에 놓였을 때
  nearestLand(x, z) { for (let r = 0.5; r <= 40; r += 0.5) { const n = Math.max(8, Math.round(r * 6)); for (let a = 0; a < n; a++) { const px = x + Math.cos(a / n * 6.283) * r, pz = z + Math.sin(a / n * 6.283) * r; if (this.canStand(px, pz) && this.roomy(px, pz)) return [px, pz]; } } return null; }
  roomy(x, z) { let k = 0; for (const [a, b] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) if (this.canStand(x + a, z + b)) k++; return k >= 3; }
  unstick() { const e = this.nearestLand(this.px, this.pz); if (e) { this.px = e[0]; this.pz = e[1]; } else { this.px = UC_START[0]; this.pz = UC_START[1]; } }
  // 빠른 이동 도착 자리: 그 사람(정문) 둘레 2.5~7칸 중 곧게 걸어갈 수 있는 곳 — a0 쪽(기본: 남쪽 = 카메라 쪽) 먼저
  //   예전엔 사람 뒤 2.5칸에 내려 바다 위나 담장 너머에 떨어질 수 있었음 (온산항 어촌계: 물 위에 떠서 못 움직임)
  arriveNear(x, z, a0) {
    const base = a0 == null ? Math.PI / 2 : a0;
    for (const dry of [true, false])   // 마른 땅 먼저 (강둑 얕은 물은 그다음)
      for (let r = 2.5; r <= 7; r += 0.75) for (let k = 0; k < 16; k++) { const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!this.canStand(px, pz) || !this.roomy(px, pz) || (dry && this.meshH(px, pz) < 0.05)) continue; let ok = true; for (let t = 0.3; t < r - 1.2; t += 0.3) { const f = t / r; if (!this.canStand(px + (x - px) * f, pz + (z - pz) * f)) { ok = false; break; } } if (ok) return [px, pz]; }
    return this.nearestLand(x, z) || [x, z];
  }
  spend(h) { this.nowH = Math.max(this.nowH, Math.min(this.C.startH + 20, this.nowH + h)); }   // 게임 안 시계는 분석 대기용 — 제한은 실제 시간(사건당 N분)
  nearest(px, pz) { if (px == null) { px = this.px; pz = this.pz; }
    let best = null, bd = 1e9, fac = null; this.inter.forEach(o => { const d = Math.hypot(o.x - px, o.z - pz); if (d < o.r && o.kind === 'facility' && (!fac || d < fac[1])) fac = [o, d]; if (d < o.r && d < bd) { bd = d; best = o; } });
    if (fac && best && best.kind === 'npc' && /^(guard|mgr)-/.test(best.id)) best = fac[0];   // 정문 앞: 시설 메뉴가 먼저 (경비원·환경팀장 이야기도 그 안에 · v2026-10-19a — 예전엔 🚙로 도착하면 경비원 대화만 떠서 서류를 못 찾았음)
    if (!best) { let rb = null; Object.keys(UC_RIVERS).forEach(rid => { const R = UC_RIVERS[rid], p = ucProject(R.pts, px, pz); if (p.d < R.w / 2 + 5 && (!rb || p.d < rb.d)) rb = { rid, s: p.s, d: p.d }; });
      if (rb) best = { kind: 'river', river: rb.rid, s: rb.s, label: UC_RIVERS[rb.rid].name + ' ' + (rb.s / UC_KM).toFixed(1) + 'km 지점 조사' }; }
    return best;
  }

  // ── 조사 ──
  interact() {
    if (this.ui.modalOpen || this.report || this.ov) return; const o = this.near; if (!o) { this.toast('가까이에 조사할 것이 없어요'); return; }
    if (o.kind === 'npc') return this.talk(o.id);
    if (o.kind === 'river') return this.riverMenu(o);
    if (o.kind === 'bio') return this.readBio(o.st);
    if (o.kind === 'air') return this.readAir(o.st);
    if (o.kind === 'lab') return this.labMenu();
    if (o.kind === 'point') return this.inspectPoint(o);
    if (o.kind === 'facility') return this.visitFacility(o.fac);
  }
  hm(h) { const d = ['어제 ', '오늘 ', '내일 '][Math.min(2, Math.floor(h / 24))], hh = Math.floor(h % 24), mm = Math.floor((h % 1) * 60); return d + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
  riverMenu(o) {
    const where = UC_RIVERS[o.river].name + ' ' + (o.s / UC_KM).toFixed(1) + 'km', strong = this.set.ratio === 'strong';
    this.dialog('🧪', '강가 조사 — ' + where, '무엇을 할까요? <span class="dim">(시료 가방 ' + this.samples.length + '/6)</span>', [
      ['💧 물 시료 뜨기 (10분) — 🔬 연구원에 맡기면 무슨 물질인지 알려 줘요', () => this.takeSample('water', o, where)],
      ['🧪 현장 측정 (15분) — 물속 산소 · 흐린 정도 · 냄새를 바로 재요', () => { this.spend(0.25); const k = ucFieldKit(this.C, o.river, o.s, this.nowH, this.rnd);
        const row = (nm, val, usual, bad, verdict) => '<tr' + (strong && bad ? ' class="hotrow"' : '') + '><th>' + nm + '</th><td><b>' + val + '</b></td><td class="dim">평소 ' + usual + '</td>' + (strong ? '<td>' + (bad ? '<b class="no">' + verdict + '</b>' : '보통') + '</td>' : '') + '</tr>';   // 쉬움·보통: 보통/부족 판정까지 · 어려움: 숫자만
        const html = '<table>' + row('물속 산소', k.DO.toFixed(1) + ' mg/L', '8~9', k.DO < 6.5, '부족 ⚠') + row('흐린 정도(탁도)', k.turb.toFixed(0), '5 안팎', k.turb > 9, '흐림 ⚠') + row('산성도(pH)', k.pH.toFixed(1), '7.4~7.8', k.pH < 7.1 || k.pH > 8.1, k.pH < 7.1 ? '산성 쪽 ⚠' : '염기성 쪽 ⚠') + row('물 온도', k.temp.toFixed(1) + ' ℃', '17~18', false, '') + '</table>' +
          '<p>👀 ' + (k.notes.length ? k.notes.join(' · ') : '눈에 띄는 것 없음') + '</p><p class="dim">현장 측정은 물이 <b>이상한지</b>만 알려 줘요. 무슨 물질인지는 💧 물 시료를 🔬 연구원에 맡겨 확인하세요.</p>';
        this.addEvidence({ title: '🧪 현장 측정 · ' + where + ' (' + this.hm(this.nowH) + ')', html, key: false, geo: { river: o.river, s: o.s } }); this.closeDialog(); this.toast('현장 측정 결과를 수첩에 적었어요'); }],
      ['🧬 환경DNA 시료 뜨기 (15분) — 물고기가 몇 종 사는지 (연구원 분석)', () => this.takeSample('edna', o, where)]].concat(this.startFishing ? [['🎣 낚시 조사 (20분) — 물고기가 아픈지 · 죽은 물고기로 시각 단서 (미니게임)', () => { this.closeDialog(); this.startFishing(o, where); }]] : []).concat(this.startFlow ? [['🛶 종이배 띄우기 (10분) — 강물이 흐르는 빠르기 재기 (미니게임)', () => { this.closeDialog(); this.startFlow(o, where); }]] : []).concat([
      ['그만두기', () => this.closeDialog()]]));
  }
  takeSample(kind, o, where) {
    if (this.samples.length >= 6) { this.toast('시료 가방이 가득 찼어요. 연구원에 먼저 맡기세요'); return; }
    this.spend(kind === 'edna' ? 0.25 : 0.17); this.samples.push({ kind, river: o.river, s: o.s, x: this.px, z: this.pz, takenH: this.nowH, label: (kind === 'edna' ? '🧬 eDNA ' : '💧 물 ') + where + ' · ' + this.hm(this.nowH) });
    this.closeDialog(); this.toast('시료를 챙겼어요 (' + this.samples.length + '/6) — 보건환경연구원에 분석을 맡기세요');
  }
  // ── 미니게임 열쇠 (v2026-10-19b) ──
  //   ① 연구원 분석은 그 사건에서 ⚗️ 시약 실험(물) · 검지관(공기)을 한 번 해야 맡길 수 있음
  //   ② 시설 서류는 증거가 있어야: 물 = 🔬 물벼룩 독성 지도에서 독성이 시작되는 배출구의 시설 · 공기 = 🧭 바람길 후보 시설
  needReagent(kind) { if (!this.reagentMenu || kind === 'edna') return false; const re = kind === 'air' ? /^⚗️ 검지관/ : /^⚗️ 시약 실험/; return !this.evidence.some(e => re.test(e.title)); }
  toxTests(river) { const M = this.mini || {}; return (M.dtests || []).filter(d => d.river === river); }
  // 🔬 독성 지도에서 배출구 o 가 '독성이 시작되는 곳'인가: 바로 아래(다음 후보 배출구 전까지)가 독함(20% 이상) + 바로 위(앞 후보 배출구 뒤부터)가 깨끗함(10% 아래)
  toxBracket(o, cands) { const T = this.toxTests(o.river), i = cands.findIndex(c => c.id === o.id), lo = i > 0 ? cands[i - 1].s : -1e9, hi = i < cands.length - 1 ? cands[i + 1].s : 1e9;
    return { below: T.some(d => d.s > o.s && d.s <= hi && d.pct >= 20), above: T.some(d => d.s < o.s && d.s > lo && d.pct < 10) }; }
  warrantFacs() {
    const C = this.C, P = UC_POL[C.pol], out = new Set(); if (!this.startDaphnia) { Object.keys(UC_FAC).forEach(k => out.add(k)); return out; }   // 미니게임 파일이 없으면 잠그지 않음
    if (P.path === 'water') { const pt = ucPoint(C.point), cands = ucCandOuts(C.pol, pt.river), b = this.toxBracket(pt, cands); if (b.below && b.above) out.add(C.fac); }
    else { const M = this.mini || {}; (M.windC || []).forEach(k => out.add(k));
      if (out.size && !out.has(C.fac) && [...out].every(k => this.evidence.some(e => e.title === '🗂 ' + UC_FAC[k].name + ' 서류'))) Object.keys(UC_FAC).forEach(k => { if (UC_FAC[k].can.indexOf(C.pol) >= 0 && UC_FAC[k].stacks.length) out.add(k); }); }   // 바람길 후보 서류에 맞는 기록이 없으면 (드묾) 그 물질을 쓰는 굴뚝 시설 모두 — 막다른 길이 없게
    return out;
  }
  // 연구원 분석: 시료마다 한 번에 전체 항목 (v2026-10-19a · 예전엔 항목 6가지를 직접 골라야 해서 어떤 걸 골라야 할지 몰랐음)
  labMenu() {
    if (!this.samples.length) { this.dialog('🔬', '울산보건환경연구원', '들고 온 시료가 없어요.<br>💧 강가에서 <b>물 시료</b>를 뜨거나, 💨 대기센서에서 <b>공기 시료</b>를 받아 오세요.', [['알겠어요', () => this.closeDialog()]]); return; }
    const hrs = h => h < 1 ? Math.round(h * 60) + '분' : (h % 1 ? h.toFixed(1) : h) + '시간', what = s => s.kind === 'edna' ? '물고기 종 수 (환경DNA)' : s.kind === 'air' ? '공기 속 물질 3가지 — 벤젠 · 톨루엔 · 황화수소' : '물속 물질 5가지 — 페놀 · 카드뮴 · 암모니아 · 기름 · 유기물';
    const lock = s => this.needReagent(s.kind), anyLock = this.samples.some(lock), kindTx = s => s.kind === 'air' ? '⚗️ 검지관' : '⚗️ 시약 실험';
    const D = this.draft || {}, polSet = !(D.pol === '' || D.pol == null), pre = s => !(polSet && s.kind === 'water' && !s.dtest);   // ① 을 고른 뒤엔 물벼룩 시험용으로 떠 온 물은 미리 고르지 않음 (예전: 한꺼번에 맡겨져 독성 지도 시료가 사라졌음)
    // (v2026-10-19c) 짧은 안내 → 시료 목록 → 작은 설명 순서 · 미니게임 설명은 여기에 (아래 단추는 짧게) — 예전엔 긴 안내와 세로로 쌓인 단추 4개 사이에 시료 목록이 가려졌음
    const body = (anyLock ? '<p class="lock">🔒 먼저 <b>⚗️ ' + (this.samples.some(s => lock(s) && s.kind === 'air') && !this.samples.some(s => lock(s) && s.kind !== 'air') ? '검지관 실험' : '시약 실험') + '</b>(미니게임)을 한 번 해요 — 그다음 분석을 맡길 수 있어요</p>' : '') +
      '<p class="lab-h">맡길 시료 <small>(' + this.samples.length + '개 · 하나에 20분)</small></p><div class="lab-list">' +
      this.samples.map((s, i) => '<label class="sample' + (lock(s) ? ' locked' : '') + '"><input type="checkbox" data-i="' + i + '"' + (lock(s) ? ' disabled' : pre(s) ? ' checked' : '') + '><span><b>' + s.label + '</b><small>' + (lock(s) ? '🔒 먼저 ' + kindTx(s) : what(s)) + '</small></span></label>').join('') + '</div>' +
      '<p class="dim lab-n">결과는 <b>' + hrs(this.set.labH) + ' 뒤</b>' + (this.samples.some(s => s.kind === 'edna') ? ' (환경DNA ' + hrs(this.set.ednaH) + ')' : '') + ' 📓 수첩으로 와요 · 기다리기 싫으면 <b>⏳ 기다리기</b>' + (this.daphniaMenu ? ' · 🔬 <b>물벼룩 시험</b> = 물이 얼마나 독한지 (🗺 독성 지도)' : '') + '</p>';
    const reag = this.reagentMenu ? [['⚗️ 시약 실험 (15분) — 색으로 물질 짐작 (미니게임)' + (anyLock ? ' · 먼저 해요' : ''), () => this.reagentMenu()]] : [], daph = this.daphniaMenu ? [['🔬 물벼룩 시험 (15분) — 물이 얼마나 독한지 (미니게임)', () => this.daphniaMenu()]] : [];
    this.dialog('🔬', '울산보건환경연구원 — 시료 분석', body, (anyLock ? reag : []).concat([['📨 분석 맡기기', () => {
      const idx = [...this.ui.dlg.querySelectorAll('input[data-i]:checked')].map(b => +b.dataset.i); if (!idx.length) { this.toast(anyLock ? '🔒 먼저 ⚗️ 시약 실험을 해요' : '시료를 하나 이상 고르세요'); return; }
      this.spend(idx.length * 0.33);   // 맡기는 시간(시료당 20분)을 먼저 — 그 뒤부터 분석 시간을 셈
      idx.forEach(i => { const s = this.samples[i], pn = s.kind === 'edna' ? 'edna' : s.kind === 'air' ? 'air' : 'water'; this.pending.push({ sample: s, panels: [pn], readyH: this.nowH + (pn === 'edna' ? this.set.ednaH : this.set.labH) }); });
      this.samples = this.samples.filter((s, i) => idx.indexOf(i) < 0); this.closeDialog(); this.fastLab(); }]]).concat(daph).concat(anyLock ? [] : reag).concat([['취소', () => this.closeDialog()]]), true);
    if (anyLock) { const b = this.ui.dlg.querySelector('.u-opts button'); if (b) b.className = 'primary'; }
  }
  // 💨 빠른 진행 (v2026-10-19b): 맡긴 분석은 잠깐 '분석 중' 뒤 바로 결과 (게임 속 시계만 그만큼 흐름) — 예전엔 ⏳ 기다리기를 따로 눌러야 했음
  fastLab() { const hrs = this.set.labH; this.toast('🔬 분석 중… (게임 속 ' + (hrs < 1 ? Math.round(hrs * 60) + '분' : hrs + '시간') + ')'); clearTimeout(this._flT);
    this._flT = setTimeout(() => { if (!this.pending.length || this.gameOver) return; this.nowH = Math.max(this.nowH, ...this.pending.map(p => p.readyH)) + 0.001; }, 1100); }
  deliver(p) {
    const s = p.sample, C = this.C, P = UC_POL[C.pol], pt = ucPoint(C.point), strong = this.set.ratio === 'strong';
    if (p.panels[0] === 'edna') { const e = ucEdna(C, s.river, s.s, s.takenH), few = e.now < e.usual * 0.6;
      this.addEvidence({ title: '🧬 환경DNA 결과 · ' + s.label.replace(/^🧬 eDNA /, ''), html: '<p>물속에서 찾은 물고기: <b>' + e.now + '종</b> (평소 이 구간 ' + e.usual + '종)' + (strong ? (few ? ' <b class="no">⚠ 크게 줄었어요</b>' : ' — 평소와 비슷해요') : '') + '</p><p class="dim">물고기 종 수가 크게 줄었다면 독한 물이 그곳을 지나갔다는 뜻이에요.</p>', key: few });
      this.toast('🧬 환경DNA 결과가 도착했어요'); return; }
    const rows = [], polsOf = { organic: ['phenol', 'benzene'], metal: ['cadmium'], nutrient: ['ammonia'], oil: ['oil'], bod: ['bod'], air: UC_AIR_POLS, water: UC_WATER_POLS };   // 예전 저장의 항목 이름도 그대로 받음
    let key = false;
    p.panels.forEach(pn => (polsOf[pn] || []).forEach(pid => { const Q = UC_POL[pid];
      const v = s.kind === 'air' ? (s.airPeak ? s.airPeak[pid] : Q.base) : (Q.path === 'water' ? ucWaterConc(C, pid, s.river, s.s, s.takenH) : Q.base);
      const val = v * (0.93 + this.rnd() * 0.14), ratio = val / Q.base, air = Q.path === 'air';
      const over = !air && val > Q.limit && this.set.ratio !== 'none';   // 물: 법 기준(한도)을 넘었는가 — 허가된 평소 배출은 기준 안이라, 기준을 넘은 물질이 사건 물질
      const big = air ? ratio >= 5 : over, rtx = '평소의 ' + (ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)) + '배';
      const verdict = this.set.ratio === 'none' ? '' : strong ? (big ? '<b class="no">⚠ ' + (air ? '아주 높음' : '기준 초과') + '</b><small>' + rtx + '</small>' : ratio >= 2 ? '조금 높음<small>' + rtx + '</small>' : '보통') : (over ? '<b class="no">기준 초과</b> ' : '') + '<span class="dim">' + rtx + '</span>';   // 쉬움·보통: 판정 글자 · 어려움: 몇 배인지만
      rows.push('<tr' + (strong && big ? ' class="hotrow"' : '') + (big ? ' data-big="1"' : '') + '><th>' + Q.name + '<small>' + Q.desc + '</small></th><td><b>' + (val < 0.01 ? val.toFixed(4) : val < 1 ? val.toFixed(3) : val.toFixed(1)) + '</b> ' + Q.unit + '</td><td class="dim">평소 ' + Q.base + (air ? '' : '<br>기준 ' + Q.limit) + '</td>' + (verdict ? '<td>' + verdict + '</td>' : '') + '</tr>');
      if (pid === C.pol && val > Q.base * 3) { if (s.kind === 'air') key = true; else { const d = ucDownstream(pt.river, pt.s, s.river, s.s); if (d >= 0 && d < 140) key = true; } }
      if (pid === C.pol && s.kind !== 'air' && P.path === 'water' && val <= Q.limit && s.river === pt.river && s.s < pt.s && pt.s - s.s < 70) key = true;   // 바로 위(상류)가 깨끗함 = 위치를 좁히는 증거
    }));
    this.addEvidence({ title: '📊 분석 결과 · ' + s.label.replace(/^(💧 물 |🌫 공기 )/, ''), sk: s.kind, html: '<table class="u-lab">' + rows.join('') + '</table>' + (s.kind === 'air' ? '<p class="dim">평소보다 <b>크게</b> 높은 물질이 ① 답일 가능성이 커요. 냄새 · 아픈 사람들의 증상도 함께 보세요.</p>' : '<p class="dim"><b>기준</b> = 법으로 정한 한도예요. 공장이 평소 조금씩 내보내는 물은 기준 안이라, <b>기준을 넘은</b> 물질이 ① 답일 가능성이 커요.</p>'), key });
    this.toast('📊 분석 결과가 도착했어요 — 📓 수첩을 보세요');
  }
  readBio(st) {
    this.spend(0.17); const log = ucBioLog(this.C, st, this.nowH), pt = ucPoint(this.C.point), d = pt.kind === 'water' ? ucDownstream(pt.river, pt.s, st.river, st.s) : -1;
    const html = '<p class="dim">물벼룩이 얼마나 활발히 헤엄치는지(%) 1시간마다 잰 기록이에요. 독한 물이 지나가면 뚝 떨어져요 — <b class="no">빨간 막대</b> = 70% 아래. (이 센서: ' + UC_RIVERS[st.river].name + ' ' + (st.s / UC_KM).toFixed(1) + 'km 지점)</p>' + this.bars(log.map(r => ({ l: (r.h % 24) + '시', v: r.act, bad: r.act < 70 })), 100, '물벼룩 활동량 (%) · 평소 90 안팎');
    this.addEvidence({ title: '🦐 ' + st.name + ' 기록', html, key: d >= 0 && log.some(r => r.act < 70) }); this.visited[st.id] = true;
    this.dialog('🦐', st.name + ' 기록', html, [['수첩에 적었어요', () => this.closeDialog()]]);
  }
  readAir(st) {
    this.dialog('💨', st.name, '밤사이 냄새 기록을 볼까요, 공기 시료(캔)를 받아 갈까요?', [
      ['📈 기록 보기 (10분) — 몇 시에 냄새가 치솟았나', () => { this.spend(0.17); const log = ucAirLog(this.C, st, this.nowH), P = UC_POL[this.C.pol];
        const html = '<p class="dim">1시간마다 잰 냄새 물질 기록이에요. <b class="no">빨간 막대</b> = 평소보다 크게 치솟은 시각.</p>' + this.bars(log.map(r => ({ l: (r.h % 24) + '시', v: r.voc, bad: r.voc > 8 })), null, '휘발성 냄새 (벤젠·톨루엔) · 평소 1~4') + this.bars(log.map(r => ({ l: (r.h % 24) + '시', v: r.h2s, bad: r.h2s > 5 })), null, '달걀 썩는 냄새 (황화수소) · 평소 0~1');
        const spike = log.some(r => r.voc > 8 || r.h2s > 5); this.addEvidence({ title: '💨 ' + st.name + ' 기록', html, key: P.path === 'air' && spike }); this.visited[st.id] = true; this.closeDialog(); this.toast(spike ? '📈 냄새가 치솟은 시각이 있어요 — 수첩에 적었어요' : '센서 기록을 수첩에 옮겼어요 (치솟은 시각 없음)'); }],
      ['🌫 공기 시료 받기 (10분) — 🔬 연구원에 맡기면 무슨 물질인지 알려 줘요 (밤사이 가장 진했던 때 모은 공기)', () => { if (this.samples.length >= 6) { this.toast('시료 가방이 가득 찼어요'); return; } this.spend(0.17);
        const peak = {}; UC_AIR_POLS.forEach(p => { let mx = 0; for (let h = 18; h <= 32; h++) mx = Math.max(mx, ucAirConc(this.C, p, st.x, st.z, h + 0.5)); peak[p] = mx; });
        this.samples.push({ kind: 'air', airPeak: peak, x: st.x, z: st.z, takenH: this.nowH, label: '🌫 공기 ' + st.name }); this.closeDialog(); this.toast('공기 시료를 챙겼어요 (' + this.samples.length + '/6) — 🔬 연구원에 맡기세요'); }],
      ['그만두기', () => this.closeDialog()]]);
  }
  inspectPoint(o) {
    const pt = ucPoint(o.id); this.spend(0.17); this.known[o.id] = true; this.visited['pt:' + o.id] = true;
    const F = UC_FAC[o.fac], water = pt.kind === 'water', where = ucPlaceText(pt);
    const obs = (water ? '이 관은 <b>' + ucOutType(pt).n + '</b> — ' + ucOutType(pt).use + '. ' : '') + (water ? '지금은 물이 조금씩 흘러나와요. 눈으로는 오염됐는지 알 수 없어요 — <b>바로 아래 물</b>과 <b>바로 위 물</b>을 떠서 🔬 연구원에서 물벼룩 독성 시험을 해 보세요. (아래는 독하고 위는 깨끗하면 → 여기서 시작!)' : '지금 굴뚝 연기는 옅은 흰색이에요. 밤사이 일은 🏭 정문 서류와 💨 대기센서 기록으로 확인하세요.');   // 예전엔 범인 배출구만 냄새·기름막이 보여 눈으로 보기 하나로 ③이 풀렸음
    this.addEvidence({ title: '📍 배출 지점 확인 · ' + o.id + ' (' + F.name + ' ' + pt.label + ')', html: '<p>위치: <b>' + where + '</b></p><p>' + obs + '</p>', key: false });
    if (water) { const R = UC_RIVERS[pt.river], s2 = Math.min(ucLen(R.pts) - 1, pt.s + 1.5), s1 = Math.max(1, pt.s - 1.5), km = s => R.name + ' ' + (s / UC_KM).toFixed(1) + 'km', has = re => this.samples.some(x => x.label.indexOf(o.id + ' ' + re) >= 0);
      this.dialog('📍', o.id + ' ' + pt.label + ' · ' + where, '<p>보고서 ③ 후보에 올렸어요.</p><p>' + obs + '</p>', [['💧 바로 아래 물 뜨기 (10분)' + (has('바로 아래') ? ' — 가방에 있음' : ''), () => this.takeSample('water', { river: pt.river, s: s2 }, km(s2) + ' (' + o.id + ' 바로 아래)')], ['💧 바로 위 물 뜨기 (10분)' + (has('바로 위') ? ' — 가방에 있음' : ''), () => this.takeSample('water', { river: pt.river, s: s1 }, km(s1) + ' (' + o.id + ' 바로 위)')], ['알겠어요', () => this.closeDialog()]]); }
    else this.toast(ucJ(o.id, '을', '를') + ' 보고서 후보에 올렸어요');
  }
  visitFacility(fid) {
    const F = UC_FAC[fid], water = UC_POL[this.C.pol].path === 'water', open = this.warrantFacs().has(fid);
    F.outs.concat(F.stacks).forEach(o => { this.known[o.id] = true; });   // 배출구·굴뚝 위치는 정문 안내판에 (지도에 ◆)
    const pos = F.outs.concat(F.stacks).map(o => '<li>◆ <b>' + o.id + '</b> ' + o.label + ' — ' + ucPlaceText(Object.assign({ kind: o.kind || 'air', fac: fid }, o)) + (o.kind === 'water' ? ' <small class="dim">' + ucOutType(o).use + '</small>' : '') + '</li>').join('');
    const lock = water ? '🔬 <b>물벼룩 독성 지도</b>에서 이 시설 배출구부터 독성이 시작된다는 걸 보여 주세요 (배출구 바로 아래 물은 독하고, 바로 위 물은 깨끗해야 해요)' : '🧭 <b>바람길</b>(기상대 예보관)로 냄새가 이 시설 쪽에서 왔다는 걸 보여 주세요';
    this.dialog('🏭', F.name, '<p>쓰는 물질: <b>' + F.can.map(p => UC_POL[p].name).join(' · ') + '</b></p>' + (pos ? '<ul class="u-pos">' + pos + '</ul>' : '') +
      (open ? '<p>🔓 증거가 있어서 <b>서류</b>(어젯밤 시간별 기록)를 볼 수 있어요.</p>' : '<p class="lock">🔒 서류(어젯밤 기록)는 증거가 있어야 보여 드려요 — ' + lock + '</p>'), [
      open ? ['🗂 서류 보기 (30분) — 배출 지점 · 어젯밤 기록', () => { this.spend(0.5); const r = ucFacilityRecord(this.C, fid); r.rows.forEach(row => { this.known[row.id] = true; }); this.visited[fid] = true;
        const html = '<p>쓰는 물질: <b>' + r.uses.join(' · ') + '</b></p>' + r.rows.map(row => row.meter === false ? '<p><b>' + row.id + ' ' + row.label + '</b> · ' + row.pos + ' <span class="dim">— 자동측정기 없음 (' + row.note + ')</span></p><div class="rec"><span class="dim">기록 없음 — 측정 대상이 아닌 관</span></div>'
          : '<p><b>' + row.id + ' ' + row.label + '</b> · ' + row.pos + ' <span class="dim">— ' + (row.kind === 'water' ? '시간마다 내보낸 물의 양(㎥)' : '굴뚝 자동측정') + '</span></p><div class="rec">' + row.rec.map(x => '<span class="' + (/—|장애/.test(x.v) ? 'bad' : '') + '">' + (x.h % 24) + '시 ' + x.v + '</span>').join('') + '</div>').join('') +
          '<p class="dim"><b class="no">빈 칸</b>(— · 통신 장애) = 그 시간 기록이 없어요. 몰래 내보냈을 수도, 계측기가 고장 났을 수도 있어요 (📰 구청 공지도 확인). ' + (water ? '자동측정기가 없는 관은 몰래 내보내도 빈 칸이 생기지 않아요 — 🔬 독성 지도와 ⏪ 시간 계산으로 확인해요. ' : '') + (this.set.diff === 'easy' ? '' : ' ' + (water ? '오염이 시작된 곳 · 시각' : '냄새가 처음 난 시각 · 바람 방향') + '과 맞는지 다른 증거와 맞춰 보세요.') + '</p>';
        this.addEvidence({ title: '🗂 ' + F.name + ' 서류', html, key: fid === this.C.fac }); this.closeDialog(); this.toast(r.rows.some(row => row.rec.some(x => /—|장애/.test(x.v))) ? '🗂 밤에 기록이 빈 시간이 있어요 — 수첩에 적었어요' : '서류 내용을 수첩에 적었어요 (빈 기록 없음)'); }]
      : ['🔒 서류 보기 — 증거가 필요해요', () => this.toast(water ? '🔒 🔬 물벼룩 독성 지도로 오염이 시작된 배출구를 먼저 찾아요' : '🔒 🧭 기상대에서 바람길을 먼저 그려요')],
      ['💂 경비원 이야기 (12분) — 어젯밤 들은 소리', () => { this.closeDialog(); this.talk('guard-' + fid); }]].concat(this.npcs.some(n => n.id === 'mgr-' + fid) ? [['👔 환경팀장 이야기 (12분) — 시설의 설명', () => { this.closeDialog(); this.talk('mgr-' + fid); }]] : []).concat([
      ['그만두기', () => this.closeDialog()]]));
    if (!open) { const b = this.ui.dlg.querySelector('.u-opts button'); if (b) b.classList.add('ghost', 'lockbtn'); }
  }
  talk(id) {
    const n = this.npcs.find(q => q.id === id), C = this.C, P = UC_POL[C.pol]; this.spend(0.2); this.talked[id] = true;
    let text = '', key = false;
    if (id === 'researcher') text = '"강물은 위(상류)에서 아래(하류)로만 흘러요. 오염된 곳 바로 위가 깨끗하다면, 오염이 시작된 곳은 그 사이에 있어요. 물이나 공기 시료를 가져오면 무슨 물질인지 분석해 드릴게요. 결과표에 평소값과 기준도 함께 적어 드려요."';
    else if (id === 'forecaster') { text = '"어젯밤 바람 기록이에요. 화살표는 바람이 <b>불어 간</b> 쪽이에요. 냄새는 바람을 타고 가니까, 냄새가 난 곳에서 화살표 <b>반대쪽</b>으로 가면 냄새가 출발한 곳이 나와요."' + this.windTable(); key = P.path === 'air'; }
    else if (id === 'riverman') { const rc = P.path === 'water' ? ucReportClue(C) : null; key = !!rc;
      text = (rc ? '"오늘 아침 ' + (rc.mouth ? '6시 40분' : '6시 50분') + '쯤 하천 CCTV 순찰 화면에서 <b>' + UC_RIVERS[rc.river].name + '</b>' + (this.set.diff === 'hard' ? ' 어딘가' : ' ' + (rc.dongs[0] || '') + ' 쪽') + '에 흰 거품이 떠내려가는 게 보였어요. 다른 강 화면은 멀쩡했고요." ' : '') + '"강마다 물이 흐르는 빠르기가 달라요. 한 시간에 태화강 ' + UC_RIVERS.taehwa.speed + 'km, 동천 ' + UC_RIVERS.dongcheon.speed + 'km, 여천천 ' + UC_RIVERS.yeocheon.speed + 'km, 외황강 ' + UC_RIVERS.oehwang.speed + 'km, 회야강 ' + UC_RIVERS.hoeya.speed + 'km씩 흘러요. 강가의 km 표지판으로 거리를 재서 <b>거리 ÷ 빠르기</b>를 하면, 오염된 물이 몇 시간 전에 출발했는지 알 수 있어요."'; }
    else if (/^fisher/.test(id)) { const mine = { fisherT: ['taehwa', 'dongcheon'], fisherO: ['oehwang', 'hoeya'], fisherP: ['yeocheon'] }[id], pt = ucPoint(C.point), hit = P.path === 'water' && mine.indexOf(pt.river) >= 0;   // 여천천은 울산항 어민 (예전엔 여천천 사건에 어민 증언이 없었음)
      text = hit ? ucTestimony(C, 'fisher', this.nowH) : (P.path === 'water' ? '"이쪽 바다는 밤새 멀쩡했어요. 다른 강 쪽에서 무슨 일이 있었다던데…"' : ucTestimony(C, 'fisher'));
      key = hit && ucMouthArrive(C).h <= this.nowH; }
    else if (id === 'resident') { text = ucTestimony(C, 'resident'); key = P.path === 'air'; }
    else if (id === 'doctor') { text = ucTestimony(C, 'doctor'); key = !!P.sym;
      if (P.path === 'water') { const rc = ucReportClue(C), dg = rc.dongs.join('·') || rc.gu; text = text.replace(/"$/, ' ') + (P.sym ? '다들 아침에 <b>' + dg + '</b> 강 산책로에 다녀왔대요."' : '그런데 아침에 <b>' + dg + '</b> 강 산책로에서 죽은 물고기를 만진 아이 부모님이 걱정돼서 전화했어요."'); key = true; } }   // 신고 동네 단서 (어려움은 제보에 동네가 없어 여기서)
    else if (id === 'activist') text = ucTestimony(C, 'activist');                   // 함정: 틀린 소문
    else if (id.indexOf('guard-') === 0) { const fid = id.slice(6); text = ucGuardLine(C, fid); key = fid === C.fac; }
    else if (id.indexOf('mgr-') === 0) text = ucManagerLine(C, id.slice(4));
    this.addEvidence({ title: n.emoji + ' ' + n.name + '의 말', html: '<p>' + text + '</p>', key });
    n.g.rotation.y = Math.atan2(this.px - n.x, this.pz - n.z); this.heading = Math.atan2(n.x - this.px, n.z - this.pz);   // 서로 마주 봄
    this.dialog(n.emoji, n.name, text, [['수첩에 적었어요 ▸', () => this.closeDialog()]].concat(this.talkExtra ? this.talkExtra(id) : []), false, 'talk'); this.focus = { x: (n.x + this.px) / 2, z: (n.z + this.pz) / 2 };   // 대화: 카메라가 두 사람 쪽으로 다가감 · 하천관리원·예보관은 미니게임 단추도
  }
  windTable() {
    const arrow = d => { const a = ((d * 180 / Math.PI) % 360 + 360) % 360; return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][Math.round(a / 45) % 8]; };
    return '<div class="rec">' + this.C.wind.filter(w => w.h <= 32).map(w => '<span>' + (w.h % 24) + '시 <b style="font-size:16px">' + arrow(w.dir) + '</b> ' + w.spd.toFixed(1) + 'm/s</span>').join('') + '</div><p class="dim">↑ = 북쪽으로 불어 감 · → = 동쪽으로 불어 감</p>';
  }
  bars(rows, max, unit) {
    const mx = max || Math.max(5, ...rows.map(r => r.v)); return '<div class="bars">' + rows.map(r => '<div class="bar' + (r.bad ? ' bad' : '') + '"><i style="height:' + Math.max(3, r.v / mx * 100) + '%"></i><em>' + r.v + '</em><span>' + r.l + '</span></div>').join('') + '</div><p class="dim">' + unit + '</p>';
  }
  // ── 사건 제목 · 신고 위치 (쉬움·보통: 강 + km · 어려움: 강 이름만) ──
  caseTitle() {
    const P = UC_POL[this.C.pol];
    if (P.path === 'water') { const rc = ucReportClue(this.C); return (this.set.diff === 'easy' ? UC_RIVERS[rc.river].name : rc.gu) + ' 물고기 떼죽음'; }
    const h = ucAirHits(this.C)[0]; return (h ? h.area : '울산') + ' 한밤 악취 민원';
  }
  reportWhere() {
    const P = UC_POL[this.C.pol], d = this.set.diff;
    if (P.path === 'water') { const rc = ucReportClue(this.C), dg = rc.dongs.join('·') || rc.gu;   // (v2026-10-20c) 강 km 는 알려 주지 않음 — 제보·증언으로 추리
      return d === 'easy' ? '<b>' + UC_RIVERS[rc.river].name + ' ' + dg + ' 부근</b>' : d === 'normal' ? '<b>' + dg + '</b> 부근의 한 하천' : '<b>' + rc.gu + '</b>의 한 하천'; }
    const hs = ucAirHits(this.C); if (!hs.length) return '울산 곳곳';
    return d === 'hard' ? '<b>' + hs[0].area + '</b> 등' : '<b>' + hs.slice(0, d === 'easy' ? 4 : 2).map(h => h.area).join('·') + ' 일대</b>';
  }
  // 사건 개요 (수첩 맨 위) — 짧게: 무슨 일 · 밝힐 네 가지 · 푸는 순서 (v2026-10-19a · 예전엔 도구 목록까지 길게 적혀 읽기 어려웠음)
  caseBrief() {
    const P = UC_POL[this.C.pol], water = P.path === 'water', g = this.set.guide;
    const lead = water ? '오늘 아침 7시, ' + this.reportWhere() + '에서 물고기가 떼죽음을 당했다는 신고가 들어왔어요.' : '어젯밤, ' + this.reportWhere() + '에서 심한 냄새와 두통 민원이 잇따랐어요.';
    const steps = water ? [(this.set.diff === 'easy' ? '📍 <b>신고 지점</b> 강가에서 🔍 조사 → 💧 <b>물 시료</b>를 떠요' : '🕵 <b>신고 지점 추리</b>: 📱 제보(어느 동네?) + 🏞 하천관리소 · 🎣 어민 · 🩺 보건소 · 🦐 바이오센서(어느 강?) → 그 강가에서 💧 <b>물 시료</b>'), '🔬 <b>연구원</b>에서 ⚗️ <b>시약 실험</b>(미니게임) → 분석 맡기기 → <b>기준을 넘은 물질</b> → ①', '▼ 그 물질을 쓰는 시설의 <b>배출구 바로 아래 물</b>(맨 위 배출구는 바로 위 물도)을 떠서 🔬 <b>물벼룩 독성 시험</b>(미니게임) → 🗺 독성 지도에서 독성이 <b>시작되는</b> 배출구 → ② ③', '🔓 독성 지도가 증거! 그 시설 🗂 <b>서류</b> · 💂 경비원 · ⏪ 시간 되감기(거리 ÷ 빠르기)로 배출 시각 → ④ <span class="dim">(자동측정기는 폐수 방류구에만 있어 다른 관은 기록이 안 남아요)</span>']
      : ['💨 민원 동네의 <b>대기센서 기록</b>을 봐요 → 냄새가 <b>치솟은 시각</b>', '🌫 그 센서에서 <b>공기 시료</b> → 🔬 연구원에서 ⚗️ <b>검지관 실험</b>(미니게임) → 분석 맡기기 → ①', '💨 냄새 센서를 한 곳 더 본 뒤 🌤 <b>기상대</b>에서 🧭 <b>바람길</b>(미니게임) → 냄새가 온 쪽 <b>후보 시설</b> → ②', '🔓 바람길이 증거! 후보 시설 🗂 <b>서류</b> · 💂 경비원 · 🛸 드론으로 냄새가 난 무렵 연기를 뿜은 <b>굴뚝</b> → ③ ④ <span class="dim">(작은 굴뚝은 자동측정 기록이 없어요)</span>'];
    return '<p class="b-lead">📢 ' + lead + '</p>' +
      '<p>🕵 환경 조사관이 되어 <b>' + this.set.min + '분 안에</b> 네 가지를 밝혀 📝 보고서를 내세요. 시간이 다 되면 그때까지 고른 답으로 자동 제출돼요.</p>' +
      '<div class="b-goal"><span>① 무슨 물질?</span><span>② 어느 시설?</span><span>③ 어느 ' + (water ? '배출구' : '굴뚝') + '?</span><span>④ 언제?</span></div>' +
      (g === 'none' ? '' : '<div class="guide"><b>🧭 이렇게 풀어요</b> <span class="dim">— 🎮 미니게임 2개가 열쇠예요</span>' + (g === 'full' ? '<ol>' + steps.map(t => '<li>' + t + '</li>').join('') + '</ol>' : '<p>물은 위(상류)에서 아래(하류)로만 흐르고, 냄새는 바람을 따라가요. 조사 하나로는 못 정해요 — 물질 · 장소 · 시각이 모두 맞는 곳을 찾으세요.</p>') + '</div>') +
      '<p>📰 수사하는 동안 <b>새 소식</b>(제보 · 공지 · 뉴스)이 수첩으로 들어와요. 소식이 말하는 <b>원인</b>과 측정으로 본 <b>결과</b>를 이어 보세요 — 소식만으로는 증거가 아니에요.</p>' +
      '<p class="dim">💡 왼쪽 위 <b>다음 할 일</b>의 📍 길 안내 · 🚙 바로 가기로 갈 곳을 찾을 수 있어요. 🗺 지도의 <b>📋 장소 목록</b>에는 어디서 무엇을 알 수 있는지 적혀 있어요.' + (this.set.rumor ? ' 떠도는 소문은 맞을 수도 틀릴 수도 있어요.' : '') + (this.set.lie ? ' 시설 사람들의 말은 범인이든 아니든 비슷하게 들려요 — 측정값과 시각을 믿으세요.' : '') + '</p>';
  }
  // 안내 목적지 (다음 할 일 · 장소 목록 공통): { name, at: 목적지 표시 자리, key, arrive(바로 가기 도착 자리 — 처음 누를 때 계산) }
  hintPlace(key) { const id = Object.keys(UC_NPC_AT).find(k => UC_NPC_AT[k][0] === key); return { name: UC_PLACES[key].name, at: id ? ucNpcAt(id) : UC_PLACES[key].at, key: 'p:' + key }; }
  hintFac(fid) { const F = UC_FAC[fid]; return { name: ucFacShort(F) + ' 정문', at: ucGate(F, 1), key: 'f:' + fid }; }
  hintSensor(st) { return { name: st.name, at: st.x != null ? [st.x, st.z] : ucBioAt(st), key: 's:' + st.id }; }
  hintReport() { if (this._rpc && this._rpc.C === this.C) return this._rpc.v; const r = ucReportSpot(this.C), p = ucAt(UC_RIVERS[r.river].pts, r.s); this._rpc = { C: this.C, v: { name: '신고 지점 · ' + UC_RIVERS[r.river].name + ' ' + (r.s / UC_KM).toFixed(1) + 'km', at: p, key: 'r' + this.caseNo } }; return this._rpc.v; }
  hintUpReport() { const r = ucReportSpot(this.C), pt = ucPoint(this.C.point), R = UC_RIVERS[r.river]; let s = r.s - 1.5 * UC_KM;
    if (pt.kind === 'water' && pt.river === r.river) s = Math.max(s, pt.s + 0.4 * UC_KM); if (s >= r.s - 0.2 * UC_KM) return this.hintReport();
    return { name: '신고 지점 조금 위 · ' + R.name + ' ' + (s / UC_KM).toFixed(1) + 'km', at: ucAt(R.pts, s), key: 'u' + this.caseNo }; }
  hintPoint(id) { const pt = ucPoint(id), o = (this.inter || []).find(q => q.kind === 'point' && q.id === id), p = o ? [o.x, o.z] : pt.kind === 'water' ? ucAt(UC_RIVERS[pt.river].pts, pt.s) : [pt.x, pt.z]; return { name: id + ' ' + pt.label, at: p, key: 'o:' + id }; }   // 배출구 기둥(강둑) 자리 — 도착하면 🔍 가 '살펴보기'
  arriveFor(T) { const c = this._arr = this._arr || {}; if (c[T.key]) return c[T.key]; const k = T.key.split(':'), D = this.travelDests();
    let at = null; if (/^r\d/.test(T.key)) { const r = ucReportSpot(this.C); at = this.arriveRiver(r.river, r.s); } else if (k[0] === 'p') { const d = D.find(x => x[0] === UC_PLACES[k[1]].name); at = d && d[1]; } else if (k[0] === 'f') { const d = D.find(x => x[0] === ucFacShort(k[1])); at = d && d[1]; }
    if (!at && /^[so]:/.test(T.key)) at = this.arriveFacing(T);   // 센서 · 배출구: 도착하면 🔍 가 바로 그것 (옆 사람·정문과 겹치지 않는 자리)
    return (c[T.key] = at || this.arriveNear(T.at[0], T.at[1])); }
  arriveFacing(T) { const k = T.key.split(':'), want = o => o && (k[0] === 'o' ? o.kind === 'point' && o.id === k[1] : (o.kind === 'bio' || o.kind === 'air') && o.st && o.st.id === k[1]);
    for (let r = 1.5; r <= 4.5; r += 0.75) for (let a = 0; a < 16; a++) { const an = Math.PI / 2 + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * Math.PI / 8, x = T.at[0] + Math.cos(an) * r, z = T.at[1] + Math.sin(an) * r;
      if (this.canStand(x, z) && this.roomy(x, z) && this.meshH(x, z) >= -0.24 && want(this.nearest(x, z))) return [x, z]; }
    return null; }
  // 강가 도착 자리: 신고 지점 근처 강둑 중 🔍 이 '강 조사'가 되는 곳 (사람·센서 대화 범위 밖 · 사방이 트인 곳) — 예전 도착 자리는 근처 사람과 겹쳐 '대화'만 뜰 때가 있었음
  arriveRiver(rid, s0) { const R = UC_RIVERS[rid], L = ucLen(R.pts);
    for (let k = 0; k < 40; k++) { const s = Math.max(1, Math.min(L - 1, s0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.5)), a = ucAt(R.pts, s), b = ucAt(R.pts, Math.min(L, s + 1)), dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d;
      for (const sg of [1, -1]) for (const off of [R.w / 2 + 1.5, R.w / 2 + 2.5, R.w / 2 + 3.5]) { const x = a[0] + nx * sg * off, z = a[1] + nz * sg * off;
        if (!this.canStand(x, z) || !this.roomy(x, z) || this.meshH(x, z) < -0.24 || this.inter.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.5)) continue; return [x, z]; } }
    const p = ucAt(R.pts, s0); return this.arriveNear(p[0], p[1]); }
  travelCost(at) { return Math.hypot(at[0] - this.px, at[1] - this.pz) * 0.15 / 60; }   // 조사 차량: 1칸(90 m)에 0.15분
  travelTo(nm, at) { const c = this.travelCost(at); this.px = at[0]; this.pz = at[1]; this.spend(c); this.camera.position.set(this.px, 30, this.pz + 22); if (this.ui.modalOpen) this.closeDialog(); this.toast('🚙 ' + nm + '에 도착했어요 (' + Math.max(1, Math.round(c * 60)) + '분)'); if (this.dest && Math.hypot(this.dest.x - at[0], this.dest.z - at[1]) < 30) this.setDest(null); this._dirty = true; this._objKey = null; }
  // 퀘스트 창의 '다음 할 일' (쉬움·보통: 자세히 · 어려움: 짧게) — 지금까지 한 일에 맞춰 바뀜 · to = 갈 곳(📍 길 안내 · 🚙 바로 가기) 또는 보고서
  nextHint() {
    if (this.set.guide === 'none' || this.report) return null;
    const C = this.C, P = UC_POL[C.pol], D = this.draft || {}, water = P.path === 'water', ev = this.evidence, has = re => ev.some(e => re.test(e.title)), lab = has(/^📊/), set = k => !(D[k] === '' || D[k] == null), hard = this.set.diff === 'hard', REP = { rep: true };
    const LAB = this.hintPlace('lab'), M = this.mini || {}, strong = this.set.ratio === 'strong', mine = e => /^📊/.test(e.title) && (!e.sk || e.sk === (water ? 'water' : 'air'));
    const labs = ev.filter(mine), hot = labs.some(e => /hotrow|기준 초과|data-big="1"/.test(e.html)), open1 = !set('pol') && (strong ? !hot : !labs.length);   // ① 을 아직 못 찾음 (이 사건 종류의 분석 기준)
    // ① 물질: 시료 → ⚗️ 시약 실험(미니게임) → 연구원 분석
    if (open1 && this.pending.length) return { t: '⏳ 분석 중이에요 — 위의 <b>⏳ 기다리기</b>를 누르거나 다른 조사를 하세요' };
    const bag = this.samples.filter(x => x.kind === (water ? 'water' : 'air'));
    if (open1 && bag.length) return this.needReagent(water ? 'water' : 'air') ? { t: '⚗️ 연구원에서 먼저 <b>' + (water ? '시약 실험' : '검지관 실험') + '</b>(미니게임)을 해요 — 색으로 어떤 물질인지 짐작 → 그다음 분석 맡기기', to: LAB } : { t: '🔬 시료를 <b>보건환경연구원</b>에 분석 맡기세요', to: LAB };
    const tries = labs.length, weak = strong && !hot && !set('pol') && tries >= 2;   // 두 번 분석해도 기준을 넘은 게 없으면 — 가장 높은 물질로 넘어감
    const hs = water ? [] : ucAirHits(C), spk = water ? [] : UC_AIR.filter(st => ev.some(e => e.title === '💨 ' + st.name + ' 기록' && e.key));
    if (weak) return { t: '🔎 기준을 넘은 물질이 안 보여요 — 오염된 물이 흘러가 옅어졌을 수 있어요. 분석 결과에서 평소보다 <b>가장 많이 높은</b> 물질을 <b>보고서 ①</b>에 골라요', to: REP };
    const easy = this.set.diff === 'easy';
    if (water) { if (!labs.length) { if (easy) return { t: '💧 <b>신고 지점</b> 강가에서 🔍 조사 → <b>물 시료</b>를 떠요', to: this.hintReport() };
        if (!this.talked.riverman && !this.samples.some(x => x.kind === 'water')) return { t: '🕵 신고 지점은 알려 주지 않았어요 — 📱 <b>제보</b>(수첩)에서 <b>동네</b>를 보고, 🏞 <b>하천관리소</b>에서 아침 CCTV 순찰 이야기로 <b>어느 강</b>인지 알아내요', to: hard ? null : this.hintPlace('riverOffice') };
        return { t: '🗺 지도에서 제보의 <b>동네</b>를 지나는 그 <b>강</b>을 찾아 강가에서 🔍 → 💧 <b>물 시료</b> <span class="dim">(동네가 안 보이면 🩺 보건소 · 🎣 어민 이야기도)</span>', to: null }; }
      if (strong && !hot && !set('pol')) return { t: '🔎 아직 기준을 넘은 물질이 없어요 — 뜬 곳보다 <b>조금 위쪽</b>(상류) 강가에서 다시 떠 보세요 · 오염이 시작된 곳에 가까울수록 진해요 (다른 강이었을 수도 있어요)', to: easy ? this.hintUpReport() : null }; }
    else { if (!spk.length && !labs.length) return { t: '💨 민원 동네의 <b>대기센서 기록</b>을 보세요 — 냄새가 <b>치솟은</b> 센서 찾기', to: hard || !hs.length ? null : this.hintSensor(hs[0].st) };
      if (!labs.length) return { t: '🌫 ' + spk[0].name + '에서 <b>공기 시료</b>를 받아 오세요', to: this.hintSensor(spk[0]) };
      if (strong && !hot && !set('pol')) return { t: '🔎 이 공기 시료엔 크게 높은 물질이 없어요 — 냄새가 <b>치솟은</b> 센서에서 다시 받아 보세요', to: spk.length ? this.hintSensor(spk[0]) : hs.length && !hard ? this.hintSensor(hs[0].st) : null }; }
    if (!set('pol')) return { t: '📝 분석 결과에서 ' + (water ? '<b>기준을 넘은</b>' : '평소보다 <b>크게 높은</b>') + ' 물질을 <b>보고서 ①</b>에 고르세요', to: REP };
    // ② 시설: 서류를 볼 증거 — 물 = 🔬 독성 지도 · 공기 = 🧭 바람길 (미니게임)
    const W = this.warrantFacs(), doc = k => ev.find(e => e.title === '🗂 ' + UC_FAC[k].name + ' 서류'), dist = k => Math.hypot(UC_FAC[k].at[0] - this.px, UC_FAC[k].at[1] - this.pz);
    if (!W.size) {
      if (water) { const rr = ucReportSpot(C).river, cands = ucCandOuts(D.pol, rr);
        if (!cands.length) return { t: '🤔 ' + ucJ(UC_POL[D.pol].name, '을', '를') + ' 쓰는 시설의 배출구가 ' + UC_RIVERS[rr].name + '에 없어요 — <b>보고서 ①</b> 물질이 맞는지 다시 봐요', to: REP };
        if (hard) return { t: '🗺 🔬 <b>물벼룩 독성 지도</b>로 독성이 <b>시작되는</b> 배출구를 찾아요 (배출구 바로 위·아래 물)', to: null };
        const T = this.toxTests(rr), near = (sd, o) => sd === 'below' ? (x => x > o.s && x <= o.s + 6) : (x => x < o.s && x >= o.s - 6);
        const tested = (sd, o) => T.some(d => near(sd, o)(d.s)), inBag = (sd, o) => this.samples.some(x => x.kind === 'water' && x.river === rr && near(sd, o)(x.s));
        const need = [['above', cands[0]]].concat(cands.map(o => ['below', o])), todo = need.filter(([sd, o]) => !tested(sd, o) && !inBag(sd, o)), list = cands.map(o => '▼' + o.id).join(' · ');
        if (todo.length) { const [sd, o] = todo[0]; return { t: '🗺 <b>독성 지도</b> 만들기: 후보 배출구(' + list + ')마다 <b>바로 아래 물</b> + 맨 위 배출구는 <b>바로 위 물</b>도 떠 와요 → 지금 <b>▼' + o.id + ' 바로 ' + (sd === 'below' ? '아래' : '위') + '</b>', to: this.hintPoint(o.id) }; }
        if (this.samples.some(x => x.kind === 'water' && !x.dtest)) return { t: '🔬 떠 온 물로 <b>물벼룩 독성 시험</b>(미니게임)을 해요 — 위쪽 시료부터 · 독한 물(빨강) 바로 위가 깨끗하면(초록) 그 사이 배출구가 범인', to: LAB };
        return { t: '🤔 독성이 시작되는 곳을 아직 못 찾았어요 — 독했던 곳의 <b>바로 위 물</b>을 한 번 더 떠서 시험해 보세요 (① 물질이 맞는지도)', to: REP }; }
      if (spk.length < 2) { const nx = hs.find(h => spk.indexOf(h.st) < 0); return { t: '💨 냄새가 치솟은 <b>센서 기록</b>을 한 곳 더 봐요 — 바람길은 선이 두 개 있어야 모여요', to: nx && !hard ? this.hintSensor(nx.st) : null }; }
      if (hard) return { t: '🧭 기상대에서 <b>바람길</b>(미니게임)을 그려 냄새가 온 쪽 시설을 찾아요', to: null };
      return { t: '🧭 <b>기상대</b> 예보관에게 가서 <b>바람길 거꾸로 그리기</b>(미니게임) — 냄새가 온 쪽 시설을 찾아요', to: this.hintPlace('weather') }; }
    if (!set('fac')) { const todo = [...W].filter(k => !doc(k)).sort((a, b) => (b === C.fac && water) - (a === C.fac && water) || dist(a) - dist(b)), gap = [...W].filter(k => doc(k) && /class="bad"/.test(doc(k).html));
      if (todo.length) return { t: '🔓 증거가 생겼어요! <b>' + todo.map(ucFacShort).join(' · ') + '</b> 정문에서 🗂 <b>서류</b>를 보고 <b>보고서 ②</b>', to: hard ? null : this.hintFac(todo[0]) };
      if (gap.length > 1) return { t: '🤔 기록이 끊긴 굴뚝이 여럿이에요 (하나는 계측기 고장) — 냄새가 <b>처음 치솟은 시각</b>과 끊긴 시각이 맞는 곳이 범인 → <b>보고서 ②</b>', to: REP };
      return { t: water ? '🏭 🗺 독성 지도가 가리킨 배출구의 <b>시설</b>을 <b>보고서 ②</b>에 고르세요' : '🏭 서류에서 밤에 <b>기록이 빈</b> 시설을 <b>보고서 ②</b>에 고르세요', to: REP }; }
    if (!set('point')) return { t: water ? '📍 🗺 독성 지도에서 <b>바로 위는 깨끗하고 바로 아래부터 독한</b> ▼배출구를 <b>보고서 ③</b>에 — 한 시설에 관이 여러 개예요' : '📍 어느 굴뚝? → <b>보고서 ③</b>: 🗂 서류의 빈 기록(큰 굴뚝만 자동측정) · 💂 경비원이 본 연기 · 🛸 드론 열화상을 맞춰 보세요 — 작은 굴뚝은 기록이 안 남아요', to: REP };
    if (!set('slot')) return { t: water ? '⏱ 배출 시각 → <b>보고서 ④</b>: 🗂 서류(폐수 방류구만 기록) · 💂 경비원이 들은 소리 · ⏪ <b>시간 되감기</b>(도착 기록에서 거리 ÷ 빠르기)를 맞춰 보세요' : '⏱ 배출 시각 → <b>보고서 ④</b>: 💨 냄새가 <b>처음 치솟은 시각</b> · 💂 경비원이 본 시각 · 🗂 기록이 빈 시각(있다면)을 맞춰 보세요', to: REP };
    if (!(D.ev || []).length) return { t: '🔑 답을 고른 <b>이유가 된 증거</b>를 3개까지 골라요', to: REP };
    return { t: '✅ 준비 끝! <b>📝 보고서</b>를 제출하세요', to: REP };
  }

  // ── 화면: 퀘스트 창 · 원형 미니맵 · 아이콘 버튼 · 떠 있는 안내 · 목적지 · 대화/메뉴/패널 ──
  buildUI() {
    const root = document.createElement('div'); root.className = 'urpg-ui' + (this.hq === 'low' ? ' urpg-low' : '') + (this.touch ? ' urpg-touch' : ''); this.host.appendChild(root); this.ui.root = root;   // 가벼운 화질: 화면 전체를 덮는 효과(가장자리 그늘 · 흐림)는 끔
    root.innerHTML = '<div class="u-ov hidden"><div class="u-ovbar"><b>🛰 3D 전경</b><span>끌기: 둘러보기 · 두 손가락/휠: 확대 · 누르기: 목적지</span><button data-ov="out">－</button><button data-ov="in">＋</button><button data-ov="me">🎯 나</button><button data-ov="back" class="primary">돌아가기</button></div></div><div class="u-me"><b></b><span></span></div><div class="u-rplab"></div>' +
      '<div class="u-rp hidden"><div class="rp-top"><b>🎬 사건 재현</b><span class="rp-clock"></span></div><div class="rp-bar"><i></i></div><div class="rp-log"></div><div class="rp-btns"><button data-rp="play">⏸</button><button data-rp="speed">1×</button><button data-rp="restart">⟲</button><button data-rp="close" class="primary">결과로 돌아가기</button></div></div>' +
      '<div class="u-quest"><div class="uq-head"><i class="uq-badge"></i><b class="uq-title"></b><button class="uq-more" aria-label="할 일 자세히">📋<span> 자세히</span></button><button class="uq-fold" aria-label="접기">▾</button></div>' +
      '<div class="u-clock"><b><i class="c-no"></i><i class="c-sep"> · </i><i class="c-t"></i></b><em class="c-bar"><i></i></em><span></span></div>' +
      '<div class="uq-obj"></div><div class="uq-hint"></div></div>' +
      '<div class="u-side"><div class="u-mapbox"><div class="u-mini"><canvas width="320" height="320"></canvas><i class="u-north">N</i><i class="mm-d mm-e">E</i><i class="mm-d mm-s">S</i><i class="mm-d mm-w">W</i>' +
      '<button class="mm-z mm-in" data-mz="-1" aria-label="지도 확대">＋</button><button class="mm-z mm-out" data-mz="1" aria-label="지도 축소">－</button></div><div class="u-locbar"><i class="u-loc"></i></div></div><div class="u-btns">' +
      '<button data-a="wait" class="u-wait hidden"><span>⏳</span><small>기다리기</small></button><button data-a="note"><span>📓</span><small>수첩</small><em>0</em></button><button data-a="map"><span>🗺</span><small>지도</small></button><button data-a="rep"><span>📝</span><small>보고서</small></button><button data-a="cam" class="u-cam"><span>🎥</span><small>중간</small></button></div></div>' +
      '<div class="u-tags"></div><div class="u-plates"></div><div class="u-pin"><b>📍</b><span></span></div><div class="u-edge"><i>➤</i><span></span></div><div class="u-prompt"></div><div class="u-toast"></div><div class="u-intro"></div><div class="u-modal hidden"><div class="u-box"></div></div>';
    this.host.classList.add('urpg-host');   // 조이스틱 · 🔍 버튼도 같은 금색 테마로 (style.css)
    const act = a => { if (this.ui.modalOpen || this.gameOver || this.replay) return; if (this.ov) this.exitOverview(); if (a === 'note') this.openNote(); if (a === 'map') this.openMap(); if (a === 'rep') this.openReport(); if (a === 'wait') this.waitResults(); if (a === 'cam') this.cycleCam(); if (a === 'quest') this.openQuest(); };
    root.querySelectorAll('.u-btns button').forEach(b => b.addEventListener('click', () => act(b.dataset.a)));
    root.querySelector('.u-mapbox').addEventListener('click', e => { if (this._mmPinch || performance.now() - (this._mmUsed || -1e9) < 500 || e.target.closest('.mm-z')) return; act('map'); }); root.querySelector('.u-quest').addEventListener('click', e => { if (e.target.closest('.uq-fold, .uq-go, .uq-meta button')) return; act('quest'); });   // 퀘스트 창 어디든 누르면 📋 할 일 자세히 (예전: 목표 칩만 · 보고서로)
    this.bindMini(root.querySelector('.u-mini'));
    root.querySelectorAll('.mm-z').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); this.setMiniZoom(+b.dataset.mz); }));   // 미니맵 확대·축소 (지도 창은 안 열림)
    try { const r = +localStorage.getItem('ulsanMiniR'); if (r >= 20 && r <= 120) this.miniR = r; } catch (e) {}
    root.querySelector('.uq-fold').addEventListener('click', e => { e.stopPropagation(); root.querySelector('.u-quest').classList.toggle('folded'); });
    root.querySelector('.uq-hint').addEventListener('click', e => { const b = e.target.closest('[data-hg]'); if (!b) return; e.stopPropagation(); this.hintGo(b.dataset.hg); });   // 다음 할 일의 안내 단추
    const q = s => root.querySelector(s);
    Object.assign(this.ui, { quest: q('.u-quest'), qBadge: q('.uq-badge'), qTitle: q('.uq-title'), qObj: q('.uq-obj'), qHint: q('.uq-hint'), wait: q('.u-wait'), clock: q('.u-clock b'), cNo: q('.c-no'), cT: q('.c-t'), cBar: q('.c-bar i'), left: q('.u-clock span'),
      prompt: q('.u-prompt'), toast: q('.u-toast'), tags: q('.u-tags'), intro: q('.u-intro'), pin: q('.u-pin'), plates: q('.u-plates'), edge: q('.u-edge'), mini: q('.u-mini canvas'), loc: q('.u-loc'), ov: q('.u-ov'), me: q('.u-me'), rp: q('.u-rp'), rpClock: q('.rp-clock'), rpBar: q('.rp-bar i'), rpLog: q('.rp-log'), rpPlay: q('[data-rp=play]'), rpLab: q('.u-rplab'), modal: q('.u-modal'), dlg: q('.u-box'), noteBtn: q('[data-a=note]'), noteN: q('[data-a=note] em'), camBtn: q('[data-a=cam]') });
    let k0 = this.real ? 0.5 : 1; try { const v = localStorage.getItem('ulsanCamView'); if (v != null && v !== '' && isFinite(+v)) k0 = +v; } catch (e) {} this.camK = this.camKT = Math.max(0, Math.min(1, k0)); this.setCamView(this.camKT, true);   // 시점 기억 (실사풍 기본: 중간)
    const h = document.getElementById('fhint'); if (h) h.classList.add('fade');   // 조작 안내는 사건 시작 카드에 함께
    this.bindOverview();
    root.querySelectorAll('[data-rp]').forEach(b => b.addEventListener('click', () => { const r = this.replay, a = b.dataset.rp; if (!r) return;
      if (a === 'play') { if (r.t >= r.end) this.replayRestart(); else { r.play = !r.play; b.textContent = r.play ? '⏸' : '▶'; } }
      if (a === 'speed') { r.speed = r.speed === 1 ? 2 : r.speed === 2 ? 4 : 1; b.textContent = r.speed + '×'; } if (a === 'restart') this.replayRestart(); if (a === 'close') this.stopReplay(); }));
  }
  // 사건 시작 카드 (조작을 막지 않음 · 4초)
  showIntro(first) {
    const el = this.ui.intro; if (!el) return;
    el.innerHTML = '<small>사건 ' + this.caseNo + ' / ' + this.caseTotal + ' · ' + this.set.name + '</small><b>' + this.caseTitle() + '</b><p>제한 시간 <b>' + this.set.min + '분</b> · ' + (this.set.guide !== 'none' ? '왼쪽 위 <b>다음 할 일</b>을 따라가요' : '📓 수첩에 사건 개요') + '</p>' + (first ? '<em>조이스틱(WASD) 이동 · 🔍 버튼(E) 조사·대화 · 🗺 지도</em>' : '');
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(this._it); this._it = setTimeout(() => el.classList.remove('on'), 4200);
  }
  updateHud() {
    const U = this.ui; if (!U.clock) return; const left = Math.ceil(this.caseLeftSec), mm = Math.floor(left / 60), ss = left % 60;
    const no = '사건 ' + this.caseNo + '/' + this.caseTotal, tt = '⏱ ' + mm + ':' + String(ss).padStart(2, '0'), sub = '🕗 ' + this.hm(this.nowH) + ' · 시료 ' + this.samples.length + '/6' + (this.pending.length ? ' · 분석 중 ' + this.pending.length : '');
    if (U.cNo.textContent !== no) { U.cNo.textContent = no; U.qBadge.textContent = no; U.qTitle.textContent = this.caseTitle(); }
    if (U.cT.textContent !== tt) { U.cT.textContent = tt; U.cBar.style.width = Math.max(0, Math.min(100, this.caseLeftSec / (this.set.min * 60) * 100)).toFixed(1) + '%'; }
    if (U.left.textContent !== sub) U.left.textContent = sub;
    const warn = left <= 180 && !this.report, danger = left <= 60 && !this.report;
    U.clock.parentNode.classList.toggle('warn', warn); U.clock.parentNode.classList.toggle('danger', danger); U.quest.classList.toggle('danger', danger);
    U.wait.classList.toggle('hidden', !this.pending.length);
    const nN = String(this.evidenceCount); if (U.noteN.textContent !== nN) U.noteN.textContent = nN; U.noteBtn.classList.toggle('new', this.evidence.length > (this.seenEv || 1));
    this.placePrompt(); this.placeDest(); this.placePlates(); this.placeTags();
    const t = this.now || 0; if (t - (this._miniT || 0) > 66) { this._miniT = t; this.drawMini(); }   // 미니맵은 부드럽게 (내 위치 물결)
    if (t - (this._locT || 0) > 500) { this._locT = t; this._loc = this.whereAmI(); if (U.loc.textContent !== this._loc.short) U.loc.textContent = this._loc.short; }
    if (t - (this._hudT || 0) < 200) return; this._hudT = t;   // 아래는 0.2초마다
    this.renderObj(); this.updateAct(); this.layoutToast();
  }
  // 알림 띠 자리: 넓은 화면은 퀘스트 창과 미니맵 사이 · 좁으면 퀘스트 창 아래 (겹치지 않게)
  layoutToast() {
    const el = this.ui.toast, root = this.ui.root.getBoundingClientRect(), q = this.ui.quest.getBoundingClientRect(), sd = this.ui.root.querySelector('.u-side').getBoundingClientRect();
    const qr = q.right - root.left, sl = sd.left - root.left, W = root.width; let a, b, top;
    this._avoid = ['aboost', 'ajump', 'fjoy'].map(id => { const e = document.getElementById(id); if (!e || e.style.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width ? [r.left - root.left, r.top - root.top, r.right - root.left, r.bottom - root.top] : null; }).filter(Boolean);   // 조작 버튼 자리 (목적지 화살표가 피함)
    this._hudR = [q].concat(['.u-btns', '.u-mapbox'].map(k => this.ui.root.querySelector(k).getBoundingClientRect())).map(r => [r.left - root.left, r.top - root.top, r.right - root.left, r.bottom - root.top]).concat(this._avoid);   // 장소 이름표가 피할 곳: 퀘스트 창 · 메뉴 단추 · 미니맵 · 조작 단추 (오른쪽 위 묶음 전체 네모는 빈 곳까지 막았음)
    const th = el.classList.contains('on') ? Math.max(36, el.offsetHeight) : 36;   // 알림 띠 높이 (두 줄일 수 있음)
    this._feedTop = (sl - qr - 24 >= 380 ? 12 : q.bottom - root.top + 8) + th + 8; this._feedL = sl - qr - 24 >= 380 ? [qr + 12, sl - 12] : [8, W - 8];   // 반 친구 소식 띠 자리 (알림 띠 바로 아래)
    const fb = this.ui.feed; if (fb && fb.children.length && fb.style.top !== this._feedTop + 'px') fb.style.top = this._feedTop + 'px';
    this._safeTop = Math.round(q.bottom - root.top + 40); this._safeTop2 = Math.round(Math.max(q.bottom, sd.bottom) - root.top + 30);   // 떠 있는 안내 · 목적지 화살표의 윗선
    if (sl - qr - 24 >= 380) { a = qr + 12; b = sl - 12; top = 12; } else { top = q.bottom - root.top + 8; a = 8; b = (sd.bottom - root.top > top ? sl : W) - 8; }
    const k = a.toFixed(0) + ',' + b.toFixed(0) + ',' + top.toFixed(0); if (k === this._toastK) return; this._toastK = k;
    el.style.left = ((a + b) / 2).toFixed(0) + 'px'; el.style.top = top.toFixed(0) + 'px'; el.style.maxWidth = Math.max(160, b - a).toFixed(0) + 'px';
  }
  // 퀘스트 목표: 보고서에 고른 답(초안)이 바로 보임 · 누르면 보고서 · 다음 할 일 + 📍 길 안내 · 🚙 바로 가기 (v2026-10-19a)
  renderObj() {
    const D = this.draft || {}, v = (k, f) => (D[k] === '' || D[k] == null) ? '' : f(D[k]);
    const items = [['물질', v('pol', x => UC_POL[x].name)], ['시설', v('fac', x => ucFacShort(x))], ['지점', v('point', x => x)], ['시각', v('slot', x => UC_SLOTS[x])], ['증거', (D.ev || []).length ? (D.ev || []).length + '/3' : '']];
    const H = this.nextHint(), hint = H ? H.t : '', T = H && H.to, on = T && !T.rep && this.dest && this.dest.key === T.key, key = JSON.stringify(items) + hint + (T ? T.key || 'rep' : '') + on + !!this.report;
    this._hintT = T || null; if (key === this._objKey) return; this._objKey = key;
    this.ui.qObj.innerHTML = items.map(([l, x]) => '<span class="' + (x ? 'done' : '') + '"><i></i>' + l + (x ? ' <b>' + x + '</b>' : ' <u>?</u>') + '</span>').join('');
    const btns = !T ? '' : T.rep ? '<span class="uq-go"><button data-hg="rep" aria-label="보고서 열기">📝<span> 보고서 열기</span></button></span>' : '<span class="uq-go"><button data-hg="dest" aria-label="길 안내" class="' + (on ? 'on' : '') + '">📍<span>' + (on ? ' 안내 중' : ' 길 안내') + '</span></button><button data-hg="go" aria-label="바로 가기">🚙<span> 바로 가기</span></button></span>';
    this.ui.qHint.innerHTML = this.report ? '🏁 보고서 제출 완료' : hint ? '<small>다음 할 일<em class="uq-mr">📋<span> 자세히</span> ›</em></small><span class="uq-t">' + hint + '</span>' + btns : ''; this.ui.qHint.classList.toggle('hidden', !this.ui.qHint.innerHTML);
    if (this._lastHint != null && this._lastHint !== hint && hint) { const el = this.ui.qHint; el.classList.remove('upd'); void el.offsetWidth; el.classList.add('upd'); } this._lastHint = hint;   // 다음 할 일이 바뀌면 반짝 (퀘스트 갱신)
  }
  // 다음 할 일 단추: 📍 길 안내(목적지 표시 · 다시 누르면 끔) · 🚙 바로 가기(게임 속 시간만 듦) · 📝 보고서
  hintGo(a) {
    if (this.ui.modalOpen || this.gameOver || this.replay || this.report) return; if (this.ov) this.exitOverview(); const T = this._hintT; if (!T) return;
    if (a === 'rep' || T.rep) { this.openReport(); return; }
    if (a === 'dest') { if (this.dest && this.dest.key === T.key) { this.setDest(null); this.toast('📍 길 안내를 껐어요'); } else this.setDest(T.at[0], T.at[1], T.name, false, T.key); }
    if (a === 'go') this.travelTo(T.name, this.arriveFor(T));
    this._objKey = null;
  }
  // 📋 할 일 자세히 (퀘스트 창을 누르면 · v2026-10-19c): 지금 할 일 전체 글 + 갈 곳 · 수사 순서(한 것 ✓ · 지금 ▶) · 보고서 답 · 모은 것
  //   폰에서는 퀘스트 창이 좁아 다음 할 일이 한두 줄로 잘리고 보고서 답 칸도 숨겨져, 무엇을 해야 하는지 끝까지 읽을 수 없었음
  questSteps() {
    const C = this.C, water = UC_POL[C.pol].path === 'water', D = this.draft || {}, set = k => !(D[k] === '' || D[k] == null), ev = this.evidence, has = re => ev.some(e => re.test(e.title));
    const hard = this.set.diff === 'hard', W = this.warrantFacs(), lab = has(/^📊/), rep = !!this.report, all4 = set('pol') && set('fac') && set('point') && set('slot');
    const spot = water ? (this.set.diff === 'easy' ? this.hintReport().name.replace(/^신고 지점 · /, '') : '제보·증언으로 추리한 곳') : '';
    const S = water ? [
      ['💧', '물 시료 뜨기', '신고 지점 <b>' + spot + '</b> 강가에서 🔍 조사 → 💧 물 뜨기', this.samples.some(x => x.kind === 'water') || lab],
      ['⚗️', '무슨 물질? → ①', '🔬 보건환경연구원에서 ⚗️ <b>시약 실험</b>(미니게임) → 분석 맡기기 → <b>기준을 넘은 물질</b>을 보고서 ①에', set('pol')],
      ['🦐', '어디서 시작됐나?', '그 물질을 쓰는 시설의 <b>배출구 바로 아래 물</b>(맨 위 배출구는 바로 위 물도)을 떠서 🔬 <b>물벼룩 독성 시험</b>(미니게임) → 독성이 <b>시작되는</b> 배출구', W.size > 0],
      ['🗂', '누가 · 언제? → ② ③ ④', '🔓 독성 지도가 가리킨 ▼배출구와 시설 → 🗂 서류 · 💂 경비원 · ⏪ 시간 되감기로 <b>배출 시각</b>을 보고서에', all4]]
    : [
      ['💨', '냄새 난 곳 찾기', '민원 동네의 <b>대기센서 기록</b> → 냄새가 <b>치솟은</b> 센서와 시각', ev.some(e => /^💨 /.test(e.title) && e.key) || lab],
      ['⚗️', '무슨 물질? → ①', '그 센서에서 🌫 <b>공기 시료</b> → 🔬 연구원에서 ⚗️ <b>검지관 실험</b>(미니게임) → 분석 → 크게 높은 물질을 보고서 ①에', set('pol')],
      ['🧭', '어디서 왔나?', '냄새 센서를 <b>한 곳 더</b> 본 뒤 🌤 기상대에서 🧭 <b>바람길</b>(미니게임) → 냄새가 온 쪽 <b>후보 시설</b>', W.size > 0],
      ['🗂', '누가 · 언제? → ② ③ ④', '🔓 후보 시설 🗂 <b>서류</b> · 💂 경비원 · 🛸 드론 → 냄새가 난 무렵 <b>연기를 뿜은 굴뚝</b>과 시각을 보고서에', all4]];
    S.push(['📝', '보고서 제출', '<b>이유가 된 증거</b>를 3개까지 고르고 📝 제출', rep]);
    return S.map(([ic, t, d, done]) => ({ ic, t, d, done: !!done || rep }));
  }
  openQuest() {
    if (this.ui.modalOpen || this.gameOver || this.replay) return; if (this.ov) this.exitOverview();
    const D = this.draft || {}, v = k => (D[k] === '' || D[k] == null) ? '' : D[k], water = UC_POL[this.C.pol].path === 'water', H = this.nextHint(), T = H && H.to;
    const km = d => { const x = d * 0.09; return x >= 1 ? x.toFixed(1) + 'km' : Math.round(x * 10) * 100 + 'm'; };
    const steps = this.questSteps(), cur = steps.findIndex(s => !s.done), left = Math.ceil(this.caseLeftSec), on = T && !T.rep && this.dest && this.dest.key === T.key;
    const go = !T ? '' : T.rep ? '<button data-qg="rep" class="q-rep">📝 보고서 열기</button>' : '<button data-qg="dest" class="' + (on ? 'on' : '') + '">📍 ' + (on ? '길 안내 끄기' : '길 안내') + '</button><button data-qg="go" class="q-go">🚙 바로 가기 <small>' + Math.max(1, Math.round(this.travelCost(T.at) * 60)) + '분</small></button>';
    const now = this.report ? '<div class="q-now"><b>🏁 보고서를 냈어요</b><p>결과 화면에서 점수와 해설을 확인하세요.</p></div>'
      : H ? '<div class="q-now"><small>🎯 지금 할 일</small><p>' + H.t + '</p>' + (T && !T.rep ? '<div class="q-to">📍 <b>' + T.name + '</b> · 여기서 ' + km(Math.hypot(T.at[0] - this.px, T.at[1] - this.pz)) + '</div>' : '') + (go ? '<div class="q-bt">' + go + '</div>' : '') + '</div>'
      : '<div class="q-now"><small>🎯 지금 할 일</small><p>아래 수사 순서를 보고 스스로 찾아보세요. 📓 수첩의 사건 개요에 단서가 있어요.</p></div>';
    const list = '<ol class="q-steps">' + steps.map((s, i) => '<li class="' + (s.done ? 'done' : i === cur ? 'cur' : '') + '"><i>' + (s.done ? '✓' : i === cur ? '▶' : i + 1) + '</i><div><b>' + s.ic + ' ' + s.t + '</b><span>' + s.d + '</span></div></li>').join('') + '</ol>';
    const ans = [['①', '물질', v('pol') && UC_POL[v('pol')].name], ['②', '시설', v('fac') && ucFacShort(v('fac'))], ['③', water ? '배출구' : '굴뚝', v('point')], ['④', '시각', v('slot') !== '' && UC_SLOTS[v('slot')]], ['🔑', '증거', (D.ev || []).length ? (D.ev || []).length + ' / 3' : '']];
    const M = this.mini || {}, kit = !this.needReagent(water ? 'water' : 'air'), m2 = water ? (M.dtests || []).length : (M.windC || []).length;
    const got = '<div class="q-got"><span>🧪 시료 <b>' + this.samples.length + '/6</b>' + (this.pending.length ? ' · ⏳ 분석 중 ' + this.pending.length : '') + '</span><span>📓 증거 <b>' + this.evidenceCount + '</b>건</span><span class="' + (kit ? 'ok' : '') + '">⚗️ ' + (water ? '시약 실험' : '검지관') + ' ' + (kit ? '✓' : '—') + '</span><span class="' + (m2 ? 'ok' : '') + '">' + (water ? '🔬 독성 시험 ' + (m2 ? m2 + '번' : '—') : '🧭 바람길 ' + (m2 ? '✓' : '—')) + '</span></div>';
    const body = '<div class="q-grid"><div class="q-top"><span>⏱ 남은 시간 <b>' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + '</b></span><span>🕗 게임 속 ' + this.hm(this.nowH) + '</span><span>' + this.set.name + '</span></div>' + now.replace('q-now', 'q-now q-sec') +
      '<div class="q-sec q-st"><h4>🧭 수사 순서 <small>' + steps.filter(s => s.done).length + ' / ' + steps.length + ' 끝</small></h4>' + list + '</div>' +
      '<div class="q-sec q-an"><h4>📝 보고서 답 <small>누르면 보고서</small></h4><div class="q-ans">' + ans.map(([n, l, x]) => '<button data-qg="rep" class="' + (x ? 'ok' : '') + '"><i>' + n + '</i><small>' + l + '</small><b>' + (x || '아직') + '</b></button>').join('') + '</div></div>' +
      '<div class="q-sec q-go"><h4>🎒 모은 것</h4>' + got + '</div></div>';
    this.dialog('📋', '사건 ' + this.caseNo + ' · ' + this.caseTitle(), body, [['📓 수첩', () => { this.closeDialog(); this.openNote(); }], ['닫기', () => this.closeDialog()]], true);
    this.ui.dlg.classList.add('quest');
    this.ui.dlg.querySelectorAll('[data-qg]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.qg; this.closeDialog(); if (a === 'rep') this.openReport(); else { this._hintT = T; this.hintGo(a); } }));
  }
  // 오른쪽 아래 🔍 버튼: 가까운 것에 맞춰 아이콘·글자가 바뀜
  updateAct() {
    const b = this.actBtn && this.actBtn.isConnected ? this.actBtn : (this.actBtn = document.getElementById('aboost')); if (!b) return;
    const k = this.near ? this.near.kind : '', M = { npc: ['💬', '대화'], river: ['🧪', '조사'], bio: ['📈', '기록'], air: ['📈', '기록'], lab: ['🔬', '분석'], point: ['📍', '확인'], facility: ['🏭', '방문'], '': ['🔍', '조사'] }[k] || ['🔍', '조사'];
    if (b.dataset.k !== k) { b.dataset.k = k; b.innerHTML = M[0] + '<small>' + M[1] + '</small>'; b.classList.toggle('u-near', !!k); }
  }
  // 화면 좌표로 (3D → 2D)
  toScreen(x, y, z) { const v = (this._pv = this._pv || new THREE.Vector3()).set(x, y, z).project(this.camera); return { x: (v.x + 1) / 2 * (this.vw || 800), y: (1 - v.y) / 2 * (this.vh || 600), front: v.z < 1, on: v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.9 }; }
  // 이름표: 가까운 사람(46칸 안 · 화면 앞) 머리 위 <역할> 이름 · 아직 안 만났으면 금색 ! · 나(초록) — 안내가 뜬 대상은 숨김(겹치지 않게)
  //   v2026-10-19b: 창·단추·조사 안내와 겹치지 않게 · 서로 겹치면 먼 사람을 뺌 (이야기를 들은 사람부터) → 놓인 자리는 장소 이름표가 피함
  placePlates() {
    const box = this.ui.plates; if (!box) return; const pool = this._plates = this._plates || [], show = [], near = this.near, placed = (this._hudR || []).concat(this._promptR ? [this._promptR] : []), mine = [];
    if (!this.ui.modalOpen && !this.ov && !this.gameOver) { this.npcs.forEach(n => { const d = Math.hypot(n.x - this.px, n.z - this.pz); if (d < 46 && !(near && near.kind === 'npc' && near.id === n.id)) show.push([d, n]); });
      show.sort((a, b) => (!!this.talked[a[1].id]) - (!!this.talked[b[1].id]) || a[0] - b[0]); show.length = Math.min(show.length, 6);   // 안 만난 사람 먼저
      if (!near) show.unshift([0, null]); }   // 나 (조사 안내가 떠 있을 땐 뺌 — 안내와 겹치지 않게)
    let k = 0;
    show.forEach(([d, n]) => { const p = n ? this.toScreen(n.x, (n.y0 || 0) + 2.7, n.z) : this.toScreen(this.px, this.player.position.y + 2.7, this.pz); if (!p.on) return;
      const id = n ? n.id : '@me', met = !n || !!this.talked[n.id], W0 = (this._plW || {})[id + met] || 96, H0 = met ? 32 : 54, r = [p.x - W0 / 2, p.y - H0, p.x + W0 / 2, p.y];
      if (placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) return; placed.push(r); mine.push(r);
      let el = pool[k]; if (!el) { el = document.createElement('div'); el.className = 'u-plate'; el.innerHTML = '<i>!</i><small></small><b></b>'; box.appendChild(el); pool[k] = el; } k++;
      if (el.dataset.id !== id) { el.dataset.id = id; if (n) { const parts = n.name.split(' '), nm = parts.pop(); el.children[1].textContent = parts.join(' ') || '주민'; el.children[2].textContent = nm; } else { el.children[1].textContent = '환경 조사관'; el.children[2].textContent = this.opts.myName || '나'; } el.classList.toggle('me', !n); }
      el.classList.toggle('met', met); el.classList.toggle('far', d > 30); if (el.style.display) el.style.display = ''; el.style.left = p.x.toFixed(0) + 'px'; el.style.top = p.y.toFixed(0) + 'px';
      const pw = this._plW = this._plW || {}; if (!pw[id + met]) { const w = el.offsetWidth; if (w) pw[id + met] = w + 8; } });
    for (; k < pool.length; k++) if (pool[k].style.display !== 'none') pool[k].style.display = 'none';
    this._plateR = mine;
  }
  // 장소 이름표 (화면 위): 조사 장소 · 시설 · 센서 이름 + 거리 — 겹치면 먼 것을 뺌 · 목적지·지금 갈 곳은 금빛 · 확인한 곳은 작고 흐리게 ✓ (센서는 숨김)
  //   v2026-10-19b: 센서 이름도 3D 글자판 대신 여기로 · 사람 이름표 · 조사 안내 · 창·단추와 겹치지 않게
  placeTags() {
    const box = this.ui.tags; if (!box) return;
    if (!this._tagL) { const PI = UlsanRpgGame.PLACE_ICON; this._tagL = [];
      Object.keys(UC_PLACES).forEach(k => { const P = UC_PLACES[k]; this._tagL.push({ kind: 'place', pk: k, key: 'p:' + k, name: P.name, icon: PI[k] || '🏛', x: P.at[0], z: P.at[1], y: 9, range: 170 }); });
      Object.keys(UC_FAC).forEach(fid => { const F = UC_FAC[fid], Y = ucYard(F), ty = /\(([^)]+)\)/.exec(F.name); this._tagL.push({ kind: 'fac', pk: fid, key: 'f:' + fid, name: ucFacShort(F), sub: ty ? ty[1] : '', icon: '🏭', x: (Y[0] + Y[2]) / 2, z: (Y[1] + Y[3]) / 2, y: 17, range: 170 }); });
      UC_BIO.forEach(b => { const q = ucBioAt(b); this._tagL.push({ kind: 'bio', pk: b.id, key: 's:' + b.id, name: b.name.replace(/ 바이오센서$/, ''), sub: '물벼룩 센서', icon: '🦐', x: q[0], z: q[1], y: 4.5, range: 70 }); });
      UC_AIR.forEach(a => this._tagL.push({ kind: 'air', pk: a.id, key: 's:' + a.id, name: a.name.replace(/ (대기측정소|악취센서)$/, ''), sub: /악취/.test(a.name) ? '악취 센서' : '대기 센서', icon: '💨', x: a.x, z: a.z, y: 6.5, range: 70 }));
      this._tagL.forEach(t => { t.gy = this.groundH(t.x, t.z) + t.y; const el = document.createElement('div'); el.className = 'u-tag k-' + t.kind; el.innerHTML = '<i>' + t.icon + '</i><b>' + t.name + '</b>' + (t.sub ? '<small>' + t.sub + '</small>' : '') + '<em></em>'; el.style.display = 'none'; box.appendChild(el); t.el = el; }); }
    const W = this.vw || 800, off = this.ui.modalOpen || this.gameOver || (this.replay && !this.ov), cap = this.ov ? 16 : W < 600 ? 5 : 8, show = [], placed = (this._hudR || []).concat(this._plateR || [], this._promptR ? [this._promptR] : []);   // 퀘스트 창 · 미니맵 · 조작 단추 · 사람 이름표 · 조사 안내 자리엔 안 띄움
    const me = !this.ov && this.player ? this.toScreen(this.px, this.player.position.y + 1.2, this.pz) : null, T = this._hintT, gk = T && !T.rep ? T.key : null, dk = this.dest && this.dest.key;
    const near = this.near, nearKey = near && (near.kind === 'bio' || near.kind === 'air') ? 's:' + near.st.id : near && near.kind === 'facility' ? 'f:' + near.fac : null;
    this._tagL.forEach(t => { t.d = Math.hypot(t.x - this.px, t.z - this.pz); t.v = false; t.chk = this.poiChecked({ kind: t.kind, key: t.pk }); t.goal = t.key === gk || t.key === dk;
      if (off || t.key === nearKey || (!this.ov && (t.d > t.range || t.d < 9))) return; if ((t.kind === 'bio' || t.kind === 'air') && (t.chk || this.ov) && !t.goal) return;   // 확인한 센서는 숨김 · 조사 안내가 뜬 대상도 (겹치지 않게)
      t.p = this.toScreen(t.x, t.gy, t.z); if (t.p.on && t.p.y > 40) show.push(t); });   // 바로 앞(9칸 안)은 사람 이름표가 있어 뺌
    show.sort((a, b) => b.goal - a.goal || a.chk - b.chk || (a.kind === 'bio' || a.kind === 'air') - (b.kind === 'bio' || b.kind === 'air') || a.d - b.d);
    let n = 0; show.forEach(t => { if (n >= cap) return; const w = t.w || 150, h = t.chk ? 24 : 30, x0 = t.p.x - w / 2, y0 = t.p.y - h - 8; if (placed.some(r => x0 < r[2] && x0 + w > r[0] && y0 < r[3] && y0 + h > r[1])) return; placed.push([x0, y0, x0 + w, y0 + h]); t.v = true; n++; });
    this._tagL.forEach(t => { const el = t.el; if (!t.v) { if (el.style.display !== 'none') el.style.display = 'none'; return; } if (el.style.display) el.style.display = '';
      el.style.transform = 'translate(' + t.p.x.toFixed(0) + 'px,' + t.p.y.toFixed(0) + 'px) translate(-50%,-100%)'; if (!t.w) t.w = el.offsetWidth + 8;
      const km = t.d * 0.09, txt = (t.chk ? '✓ ' : '') + (km >= 1 ? km.toFixed(1) + 'km' : Math.round(km * 10) * 100 + 'm'); if (t.dt !== txt) { t.dt = txt; el.lastChild.textContent = txt; }
      const far = t.d > 90 || t.chk, dim = !!(me && me.on && Math.abs(me.x - t.p.x) < t.w / 2 + 10 && me.y > t.p.y - 40 && me.y < t.p.y + 40);   // 내 캐릭터를 가리면 흐리게
      if (t._f !== far) { t._f = far; el.classList.toggle('far', far); t.w = 0; } if (t._d !== t.goal) { t._d = t.goal; el.classList.toggle('dest', t.goal); } if (t._m !== dim) { t._m = dim; el.classList.toggle('dim', dim); } if (t._c !== t.chk) { t._c = t.chk; el.classList.toggle('done', t.chk); } });
  }
  placePrompt() {
    const el = this.ui.prompt, o = this.near, txt = o && !this.ui.modalOpen && !this.ov ? o.label : '';
    if (el.dataset.t !== txt) { el.dataset.t = txt; el.innerHTML = txt ? '<b>' + (this.isTouch ? '🔍' : 'E') + '</b>' + txt : ''; el.classList.toggle('on', !!txt); this._promptW = txt ? el.offsetWidth : 0; }
    if (!txt) { this._promptR = null; return; } const x = o.x != null ? o.x : this.px, z = o.z != null ? o.z : this.pz, p = this.toScreen(x, this.groundH(x, z) + (o.kind === 'npc' ? 3.4 : 3), z);
    const px = Math.max(90, Math.min((this.vw || 800) - 90, p.x)), py = Math.max(this._safeTop || 150, Math.min((this.vh || 600) - 30, p.y));   // 퀘스트 창 아래로
    el.style.left = px.toFixed(0) + 'px'; el.style.top = py.toFixed(0) + 'px';
    const w = (this._promptW || 220) / 2 + 6; this._promptR = [px - w, py - 26, px + w, py + 26];   // 조사 안내 자리 (이름표들이 피함)
  }
  // ── 목적지: 3D 빛기둥 + 화면 끝 화살표(거리) ──
  setDest(x, z, name, quiet, key) {
    if (x == null) { this.dest = null; if (this.beacon) this.beacon.visible = false; this._objKey = null; return; }
    this.dest = { x, z, name, key: key || name }; this._objKey = null; if (!this.beacon) { const T = THREE, g = new T.Group();
      const col = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 80, 16, 1, true), new T.MeshBasicMaterial({ color: 0xFFD166, transparent: true, opacity: 0.32, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); col.position.y = 40;
      const ring = new T.Mesh(new T.RingGeometry(2.2, 3, 32), new T.MeshBasicMaterial({ color: 0xFFD166, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3;
      [col, ring].forEach(m => { m.userData.noShadow = true; g.add(m); }); this.beacon = g; this.scene.add(g); }
    this.beacon.visible = true; this.beacon.position.set(x, this.groundH(x, z), z); if (!quiet) this.toast('📍 목적지 표시: ' + name);
  }
  stepBeacon(now) {
    if (!this.dest || !this.beacon) return; const k = 0.5 + 0.5 * Math.sin(now / 280); this.beacon.children[0].material.opacity = 0.18 + 0.2 * k; this.beacon.children[1].scale.setScalar(1 + 0.25 * k);
    if (Math.hypot(this.dest.x - this.px, this.dest.z - this.pz) < 8) { this.toast('📍 도착: ' + this.dest.name); this.setDest(null); }
  }
  placeDest() {
    const pin = this.ui.pin, edge = this.ui.edge, D = this.dest;
    if (!D || this.ui.modalOpen) { pin.classList.remove('on'); edge.classList.remove('on'); return; }
    if (this.ov) edge.classList.remove('on');
    const dist = Math.hypot(D.x - this.px, D.z - this.pz) * 0.09, dt = dist >= 1 ? dist.toFixed(1) + 'km' : Math.round(dist * 100) * 10 + 'm', lab = D.name + ' · ' + dt;
    const p = this.toScreen(D.x, this.groundH(D.x, D.z) + 6, D.z), W = this.vw || 800, H = this.vh || 600;
    if (p.on || this.ov) { if (!p.on) { pin.classList.remove('on'); return; } pin.classList.add('on'); edge.classList.remove('on'); pin.style.left = p.x.toFixed(0) + 'px'; pin.style.top = p.y.toFixed(0) + 'px'; if (pin.lastChild.textContent !== lab) pin.lastChild.textContent = lab; return; }
    pin.classList.remove('on'); edge.classList.add('on');
    let dx = p.x - W / 2, dy = p.y - H / 2; if (!p.front) { dx = -dx; dy = -dy; } const a = Math.atan2(dy, dx), mx = W / 2 - 70, my = H / 2 - 90, k = Math.min(mx / Math.abs(Math.cos(a) || 1e-6), my / Math.abs(Math.sin(a) || 1e-6));
    if (edge.lastChild.textContent !== lab) { edge.lastChild.textContent = lab; this._edgeWH = null; } if (!this._edgeWH) this._edgeWH = [edge.offsetWidth || 160, edge.offsetHeight || 50];   // 글이 바뀔 때만 크기를 잼
    const hw = this._edgeWH[0] / 2 + 6, top = this._safeTop2 || 120;   // 글자가 화면 밖 · 위쪽 창에 걸리지 않게
    let ex = Math.max(hw, Math.min(W - hw, W / 2 + Math.cos(a) * k)), ey = Math.max(top, Math.min(H - 150, H / 2 + 20 + Math.sin(a) * k)); const hh = this._edgeWH[1] / 2 + 4;
    (this._avoid || []).forEach(r => { if (ex + hw > r[0] && ex - hw < r[2] && ey + hh > r[1] && ey - hh < r[3]) ex = r[0] > W / 2 ? r[0] - hw : r[2] + hw; });   // 조사 버튼·조이스틱과 겹치면 옆으로
    edge.style.left = ex.toFixed(0) + 'px'; edge.style.top = ey.toFixed(0) + 'px'; edge.firstChild.style.transform = 'rotate(' + a.toFixed(2) + 'rad)';
  }
  // ── 지도 그림 (미니맵 · 큰 지도 · 드론/바람길 미니게임 공통 · v2026-10-18a) ──
  //   바탕(한 번만 · 2px/칸): 땅 덮개 색(숲·논밭·풀밭·도시·공단·모래) + 산 그림자(북서쪽 빛) + 울산 밖은 어둡게 + 동 경계
  //   그 위(보이는 곳만 매번): 도로 · 공터 · 건물 · 탱크 · 강 · 시설 마당 → 장소·시설·센서·사람 아이콘과 이름 · 목적지 · 나
  mapBase() {
    if (this._mapBase) return this._mapBase;
    const G = UG.grid, K = 2, W = 524 * K, H = 504 * K, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const cw = G.w, ch = G.h, sm = document.createElement('canvas'); sm.width = cw; sm.height = ch; const sg = sm.getContext('2d'), im = sg.createImageData(cw, ch), D = im.data;
    let lc = null; try { if (typeof UWORLD !== 'undefined' && UWORLD.lc) { const b = atob(UWORLD.lc); lc = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) lc[i] = b.charCodeAt(i); } } catch (e) { lc = null; }
    // 땅 덮개 색: 0 바다 1 활엽수 2 침엽수 3 논 4 밭 5 풀밭 6 도심 7 공단 8 모래 9 바위 10 억새 11 강변 12 비닐하우스 13 마을
    const PAL = [[22, 62, 94], [60, 104, 58], [45, 86, 50], [122, 150, 84], [140, 150, 92], [104, 150, 84], [128, 133, 142], [146, 136, 116], [206, 188, 140], [122, 120, 110], [168, 156, 106], [166, 162, 140], [184, 192, 174], [138, 134, 120]], CELL = { u: 6, i: 7, r: 5, '1': 1 };
    if (!this.hgrid) this.buildHeights(); const Hh = this.hgrid;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const k = j * cw + i, cell = this.cellAt(G.x0 + (i + 0.5) * G.cell, G.z0 + (j + 0.5) * G.cell);
      let v = cell === '0' ? 0 : lc ? lc[k] : CELL[cell]; if (cell !== '0' && !v) v = 5; const P = PAL[v] || PAL[5], h = Hh[k];
      const hx = Hh[j * cw + Math.min(cw - 1, i + 1)] - Hh[j * cw + Math.max(0, i - 1)], hz = Hh[Math.min(ch - 1, j + 1) * cw + i] - Hh[Math.max(0, j - 1) * cw + i];
      let sh = cell === '0' ? 1.08 - Math.min(0.4, Math.max(0, -h - 0.8) * 0.09) : Math.max(0.6, Math.min(1.24, 1 + (hx + hz) * 0.075));   // 바다는 깊을수록 어둡게
      if (cell === '1') sh *= 0.5;   // 울산 밖
      D[k * 4] = P[0] * sh; D[k * 4 + 1] = P[1] * sh; D[k * 4 + 2] = P[2] * sh; D[k * 4 + 3] = 255; }
    sg.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, W, H);
    const tx = x => (x + 262) * K, tz = z => (z + 252) * K; g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; UG.dongs.forEach(d => d.rings.forEach(r => { g.beginPath(); r.forEach((p, i) => i ? g.lineTo(tx(p[0]), tz(p[1])) : g.moveTo(tx(p[0]), tz(p[1]))); g.closePath(); g.stroke(); }));
    return (this._mapBase = { c, K, tx, tz });
  }
  // 드론·바람길 미니게임 바탕: 땅 + 선을 합친 그림 (처음 쓸 때 한 번 · 예전 이름 그대로)
  mapImg() { if (this._mapImgC) return this._mapImgC; const B = this.mapBase(), c = document.createElement('canvas'); c.width = B.c.width; c.height = B.c.height; const g = c.getContext('2d'); g.drawImage(B.c, 0, 0); this.mapVectors(g, B.tx, B.tz, B.K, null); return (this._mapImgC = c); }
  // 선 그림: 보이는 곳(box = [x0, z0, x1, z1])만 · s = 1칸의 화면 크기(px)
  mapVectors(g, tx, tz, s, box) {
    const W = typeof UWORLD !== 'undefined' ? UWORLD : null, inB = (x, z, m) => !box || (x > box[0] - m && x < box[2] + m && z > box[1] - m && z < box[3] + m);
    const poly = (pts, close) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(tx(p[0]), tz(p[1])) : g.moveTo(tx(p[0]), tz(p[1]))); if (close) g.closePath(); };
    const rect = (x, z, w, d, a) => { const c = Math.cos(a), sn = Math.sin(a); g.beginPath(); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], i) => { const X = tx(x + (c * u * w - sn * v * d) / 2), Y = tz(z + (sn * u * w + c * v * d) / 2); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    if (this.real && W) {
      const LOT = ['rgba(52,56,62,.55)', 'rgba(170,110,80,.5)', 'rgba(96,150,80,.45)', 'rgba(220,222,214,.18)', 'rgba(170,150,110,.35)', 'rgba(160,150,128,.3)'];
      for (let i = 0; i < W.lots.length; i += 6) { if (!inB(W.lots[i], W.lots[i + 1], 12)) continue; rect(W.lots[i], W.lots[i + 1], W.lots[i + 2], W.lots[i + 3], W.lots[i + 4] * Math.PI / 180); g.fillStyle = LOT[W.lots[i + 5]] || LOT[3]; g.fill(); }
      const RW = [0.55, 1.15, 0.95, 0.8], RC = ['rgba(236,238,242,.62)', '#F4E3A6', '#EDE4C4', '#E4D29C'];   // 골목 · 간선(노랑) · 강변로 · 지방도
      [0, 3, 2, 1].forEach(cls => { g.strokeStyle = cls ? 'rgba(20,24,32,.55)' : 'rgba(20,24,32,.35)'; g.lineWidth = Math.max(1.4, RW[cls] * s + 1.6);
        W.roads.forEach(r => { if (r[0] !== cls || (box && !r.some((v, i) => i % 2 === 1 && inB(v, r[i + 1], 30)))) return; g.beginPath(); for (let i = 1; i < r.length; i += 2) { const X = tx(r[i]), Y = tz(r[i + 1]); i === 1 ? g.moveTo(X, Y) : g.lineTo(X, Y); } g.stroke(); });   // 테두리(어두운 선)
        g.strokeStyle = RC[cls]; g.lineWidth = Math.max(0.8, RW[cls] * s);
        W.roads.forEach(r => { if (r[0] !== cls || (box && !r.some((v, i) => i % 2 === 1 && inB(v, r[i + 1], 30)))) return; g.beginPath(); for (let i = 1; i < r.length; i += 2) { const X = tx(r[i]), Y = tz(r[i + 1]); i === 1 ? g.moveTo(X, Y) : g.lineTo(X, Y); } g.stroke(); }); });
    }
    // 건물 · 탱크 (흰 회색 · 아래 그림자)
    const bld = [], B = this.real && W ? W.b : null;
    if (B) for (let i = 0; i < B.length; i += 9) { const t = B[i], h = B[i + 5], y0 = B[i + 8]; if ((((t === 7 || t === 3) && y0 >= 0.6) || h < 0.5) || !inB(B[i + 1], B[i + 2], 8)) continue; bld.push([B[i + 1], B[i + 2], B[i + 3], B[i + 4], B[i + 6] * Math.PI / 180, h]); }
    else if (this._lowBlk) { this._lowBlk.apts.forEach(b => { if (inB(b[0], b[1], 6)) bld.push([b[0], b[1], b[3], b[3], 0, b[2]]); }); this._lowBlk.sheds.forEach(b => { if (inB(b[0], b[1], 8)) bld.push([b[0], b[1], b[3], b[3] * 0.7, 0, b[2]]); }); }
    if (B) { const sh = Math.max(0.6, s * 0.35); g.fillStyle = 'rgba(0,0,0,.28)'; bld.forEach(b => { rect(b[0] + sh / s, b[1] + sh / s, b[2], b[3], b[4]); g.fill(); });
      bld.forEach(b => { rect(b[0], b[1], b[2], b[3], b[4]); g.fillStyle = b[5] > 5 ? '#F1F2F4' : '#D9DCE0'; g.fill(); }); }
    else { g.fillStyle = 'rgba(214,218,226,.42)'; bld.forEach(b => { rect(b[0], b[1], b[2], b[3], b[4]); g.fill(); }); }   // 가벼운 화질: 흩어진 건물이 많아 옅게
    if (this.real && W) { g.fillStyle = '#E9EBEE'; for (let i = 0; i < W.cyl.length; i += 6) { if (!inB(W.cyl[i], W.cyl[i + 1], 4)) continue; g.beginPath(); g.arc(tx(W.cyl[i]), tz(W.cyl[i + 1]), Math.max(1, W.cyl[i + 2] * s), 0, 7); g.fill(); } }
    // 강: 짙은 테두리 + 밝은 물
    Object.values(UC_RIVERS).forEach(R => { poly(R.pts); g.strokeStyle = '#1E5F8F'; g.lineWidth = Math.max(2.5, R.w * s * 1.12); g.stroke(); poly(R.pts); g.strokeStyle = '#4FB0EA'; g.lineWidth = Math.max(1.5, R.w * s * 0.82); g.stroke(); poly(R.pts); g.strokeStyle = 'rgba(190,232,255,.55)'; g.lineWidth = Math.max(0.6, R.w * s * 0.18); g.stroke(); });
    // 시설 마당: 붉은 테두리
    Object.values(UC_FAC).forEach(F => { const Y = ucYard(F); g.fillStyle = 'rgba(214,69,65,.14)'; g.fillRect(tx(Y[0]), tz(Y[1]), (Y[2] - Y[0]) * s, (Y[3] - Y[1]) * s); g.strokeStyle = 'rgba(255,128,112,.9)'; g.lineWidth = Math.max(1.2, s * 0.35); g.setLineDash([Math.max(3, s * 1.4), Math.max(2, s * 0.8)]); g.strokeRect(tx(Y[0]), tz(Y[1]), (Y[2] - Y[0]) * s, (Y[3] - Y[1]) * s); g.setLineDash([]); });
    g.restore();
  }
  // 지도에 올리는 것 (종류 · 이름 · 자리 · 아이콘 · 중요도) — 미니맵 · 큰 지도 · 눌러서 목적지
  mapPois() {
    if (!this._poiS) { const PI = UlsanRpgGame.PLACE_ICON, S = [];
      Object.keys(UC_PLACES).forEach(k => { const P = UC_PLACES[k]; S.push({ kind: 'place', key: k, name: P.name, short: UlsanRpgGame.PLACE_MINI[k] || P.name, x: P.at[0], z: P.at[1], icon: PI[k] || '🏛', pri: 3 }); });   // 미니맵엔 짧은 이름 (연구원 · 보건소 …)
      Object.keys(UC_FAC).forEach(fid => { const F = UC_FAC[fid], Y = ucYard(F), nm = F.name.split(' (')[0]; S.push({ kind: 'fac', key: fid, name: nm, short: nm, x: (Y[0] + Y[2]) / 2, z: (Y[1] + Y[3]) / 2, icon: '🏭', pri: 4 }); });
      UC_BIO.forEach(b => { const p = ucBioAt(b); S.push({ kind: 'bio', key: b.id, name: b.name, short: b.name.replace(/ 바이오센서$/, ''), x: p[0], z: p[1], icon: '🦐', pri: 1 }); });
      UC_AIR.forEach(a => S.push({ kind: 'air', key: a.id, name: a.name, short: a.name.replace(/ (대기측정소|악취센서)$/, ''), x: a.x, z: a.z, icon: '💨', pri: 1 }));
      this.npcs.forEach(n => S.push({ kind: 'npc', key: n.id, name: n.name, short: n.name.split(' ').pop(), x: n.x, z: n.z, icon: n.emoji, pri: 2, staff: /^(mgr|guard)-/.test(n.id) }));
      this._poiS = S; }
    const rp = this.set.diff === 'easy' && UC_POL[this.C.pol].path === 'water' ? this.hintReport() : null;   // (v2026-10-20c) 보통·어려움은 신고 지점을 지도에 찍지 않음 — 제보·증언으로 추리   // 쉬움·보통: 신고 지점 ✖ (예전엔 쉬움만 큰 지도에)
    return this._poiS.concat(Object.keys(this.known).map(id => { const pt = ucPoint(id), p = pt.kind === 'water' ? ucAt(UC_RIVERS[pt.river].pts, pt.s) : [pt.x, pt.z]; return { kind: 'point', key: id, name: id + ' ' + pt.label, short: id, x: p[0], z: p[1], icon: '', pri: 2 }; }))
      .concat(rp ? [{ kind: 'report', key: 'report', name: rp.name, short: '신고 지점', x: rp.at[0], z: rp.at[1], icon: '✖', pri: 5 }] : []);
  }
  // 둥근 배지 아이콘 (한 번 그려 두고 다시 씀) — 바탕 그라데이션 · 테두리 · 가운데 그림
  mapIcon(emoji, bg, ring, s, dark) {
    s = Math.max(8, Math.round(s / 2) * 2); const key = emoji + '|' + bg + '|' + ring + '|' + s, C = this._icons = this._icons || {}; if (C[key]) return C[key];
    const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'), r = s / 2 - 2, [b0, b1] = bg.split(',');
    g.beginPath(); g.arc(s / 2, s / 2 + 1.5, r, 0, 7); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill();
    const gr = g.createRadialGradient(s * 0.38, s * 0.32, r * 0.1, s / 2, s / 2, r); gr.addColorStop(0, b0); gr.addColorStop(1, b1);
    g.beginPath(); g.arc(s / 2, s / 2, r, 0, 7); g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(1.5, s * 0.075); g.strokeStyle = ring; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (dark) { g.font = '900 ' + Math.round(s * 0.62) + 'px Pretendard, sans-serif'; g.fillStyle = dark; g.fillText(emoji, s / 2, s / 2 + s * 0.04); }
    else { g.font = Math.round(s * 0.5) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillText(emoji, s / 2, s / 2 + s * 0.04); }
    return (C[key] = c);
  }
  // ── 확인한 곳 · 중요도 · 겹치지 않게 놓기 (v2026-10-19b · 미니맵 · 큰 지도 공통) ──
  //   확인한 곳(이야기 들은 장소 · 서류 본 시설 · 기록 본 센서 · 살펴본 배출구)은 작고 흐리게 ✓ — 남은 중요한 곳이 눈에 띄게
  poiKey(p) { return p.kind === 'place' ? 'p:' + p.key : p.kind === 'fac' ? 'f:' + p.key : p.kind === 'bio' || p.kind === 'air' ? 's:' + p.key : p.kind === 'point' ? 'o:' + p.key : p.kind === 'report' ? 'r' + this.caseNo : 'n:' + p.key; }
  poiChecked(p) { if (p.kind === 'place') { const I = (UlsanRpgGame.PLACE_INFO[p.key] || [])[0]; return !!(I && this.talked[I]); } if (p.kind === 'fac') return this.evidence.some(e => e.title === '🗂 ' + UC_FAC[p.key].name + ' 서류');
    if (p.kind === 'bio' || p.kind === 'air') return !!this.visited[p.key]; if (p.kind === 'npc') return !!this.talked[p.key]; if (p.kind === 'point') return !!this.visited['pt:' + p.key]; return false; }
  poiGoal(p) { const T = this._hintT; return !!(T && !T.rep && T.key === this.poiKey(p)) || !!(this.dest && this.dest.key === this.poiKey(p)); }
  // pois → 화면 자리: 중요한 것부터 놓고, 겹치면 둘레 8방향으로 비켜 놓고 가는 선으로 제자리 표시 · 자리가 없으면 덜 중요한 것은 작은 점
  layoutPois(pois, sx, sz, u, reserved) {
    const out = [], circ = [];
    pois.forEach(p => { p._chk = this.poiChecked(p); p._goal = this.poiGoal(p); p._pr = (p._goal ? 10 : 0) + (p.kind === 'report' ? 6 : p.kind === 'fac' ? 4 : p.kind === 'place' ? 3 : p.kind === 'npc' ? (p.staff ? 1.2 : 2.5) : p.kind === 'point' ? 2 : 1.5) - (p._chk ? 2 : 0); });
    pois.slice().sort((a, b) => b._pr - a._pr).forEach(p => {
      const X = sx(p.x), Y = sz(p.z), r = (p.kind === 'point' ? 8 : p.kind === 'bio' || p.kind === 'air' ? 8.5 : p.kind === 'fac' ? 11.5 : 10.5) * u * (p._chk ? 0.72 : 1);
      const free = (x, y) => !circ.some(c => Math.hypot(c[0] - x, c[1] - y) < c[2] + r + 1.5 * u) && !(reserved || []).some(q => x + r > q[0] && x - r < q[2] && y + r > q[1] && y - r < q[3]);
      let at = free(X, Y) ? [X, Y] : null;
      for (const k of [2.1, 3.2]) for (let i = 0; i < 8 && !at; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, x = X + Math.cos(a) * r * k, y = Y + Math.sin(a) * r * k; if (free(x, y)) at = [x, y]; }
      if (!at && p._pr >= 3) at = [X, Y];   // 중요한 곳은 겹쳐도 그림
      if (at) { circ.push([at[0], at[1], r]); out.push({ p, X: at[0], Y: at[1], ox: X, oy: Y, r, moved: Math.hypot(at[0] - X, at[1] - Y) > 1 }); }
      else out.push({ p, X, Y, ox: X, oy: Y, r: 2.6 * u, dot: true });
    });
    return out;
  }
  // 놓은 아이콘 그리기: 제자리 선 → 작은 점 → 아이콘(덜 중요한 것 먼저 · 중요한 것이 위) · '지금 갈 곳'은 금빛 고리
  drawLayout(g, L, u, t) {
    g.save(); g.lineWidth = 1.4 * u; g.strokeStyle = 'rgba(255,246,218,.75)'; L.forEach(a => { if (!a.moved) return; g.beginPath(); g.moveTo(a.ox, a.oy); g.lineTo(a.X, a.Y); g.stroke(); g.beginPath(); g.arc(a.ox, a.oy, 2.2 * u, 0, 7); g.fillStyle = '#FFF6DA'; g.fill(); }); g.restore();
    L.filter(a => a.dot).forEach(a => { g.beginPath(); g.arc(a.X, a.Y, a.r, 0, 7); g.fillStyle = a.p._chk ? 'rgba(174,182,198,.8)' : a.p.kind === 'bio' ? '#27A9E1' : a.p.kind === 'air' ? '#C9D0DD' : a.p.kind === 'point' ? '#FFD166' : '#FFE9A8'; g.fill(); g.lineWidth = 1 * u; g.strokeStyle = 'rgba(8,12,20,.8)'; g.stroke(); });
    L.filter(a => !a.dot).slice().reverse().forEach(a => { if (a.p._goal && t != null) { const k = 0.5 + 0.5 * Math.sin(t * 5); g.beginPath(); g.arc(a.X, a.Y, a.r + (4 + 4 * k) * u, 0, 7); g.strokeStyle = 'rgba(255,209,102,' + (0.95 - 0.5 * k).toFixed(2) + ')'; g.lineWidth = 3 * u; g.stroke(); }
      this.drawPoi(g, a.p, a.X, a.Y, u * (a.p._chk ? 0.72 : 1), a.p._chk); });
  }
  // 아이콘 하나 그리기 (X, Y: 화면 자리 · u: 크기 배율) — 사람은 아직 안 만났으면 금색 '!' · 만났으면 작게 · chk: 확인한 곳(흐리게 + ✓)
  drawPoi(g, p, X, Y, u, chk) {
    if (chk && p.kind !== 'npc') { g.save(); g.globalAlpha = 0.62; const r = this.drawPoi(g, p, X, Y, u, false); g.restore(); const b = 5.5 * u / 0.72, bx = X + r * 0.72, by = Y - r * 0.72; g.beginPath(); g.arc(bx, by, b, 0, 7); g.fillStyle = '#1FBF6A'; g.fill(); g.lineWidth = 1.2 * u; g.strokeStyle = '#0B3B22'; g.stroke();
      g.fillStyle = '#fff'; g.font = '900 ' + Math.round(b * 1.5) + 'px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✓', bx, by + b * 0.08); return r; }
    const S = Math.round(20 * u) * 2, st = {
      fac: ['#E0605A,#7A1D1A', '#FFD9A8'], place: ['#3F86C8,#143E6E', '#F5C451'], bio: ['#27A9E1,#0B4F75', '#DDF4FF'], air: ['#9AA3B5,#3B4252', '#EEF1F7'], npc: ['#FFE9A8,#D99A2B', '#5A3C00'] }[p.kind];
    if (p.kind === 'report') { const ic = this.mapIcon('✖', '#FF7B7B,#A51D2D', '#FFE3E3', S, '#FFFFFF'); g.drawImage(ic, X - S / 4, Y - S / 4, S / 2, S / 2); return S / 4; }
    if (p.kind === 'point') { const r = 7 * u; g.save(); g.translate(X, Y); g.rotate(Math.PI / 4); g.fillStyle = '#FFD166'; g.strokeStyle = '#3A2A00'; g.lineWidth = 2 * u; g.fillRect(-r / 1.4, -r / 1.4, r * 1.42, r * 1.42); g.strokeRect(-r / 1.4, -r / 1.4, r * 1.42, r * 1.42); g.restore(); return r; }
    if (p.kind === 'npc') { if (this.talked[p.key]) { const ic = this.mapIcon(p.icon, '#5A6475,#262C36', '#AEB6C6', Math.round(S * 0.7)); g.drawImage(ic, X - ic.width / 4, Y - ic.width / 4, ic.width / 2, ic.width / 2); return ic.width / 4; }
      const ic = this.mapIcon('!', st[0], st[1], S, '#3A2600'), bob = Math.sin((this.now || 0) / 260 + p.x) * 1.5 * u; g.drawImage(ic, X - S / 4, Y - S / 4 + bob, S / 2, S / 2); return S / 4; }   // 퀘스트 표시처럼 통통
    const sc = p.kind === 'bio' || p.kind === 'air' ? 0.78 : p.kind === 'fac' ? 1.08 : 1, s2 = Math.round(S * sc), ic = this.mapIcon(p.icon, st[0], st[1], s2); g.drawImage(ic, X - s2 / 4, Y - s2 / 4, s2 / 2, s2 / 2); return s2 / 4;
  }
  // 이름표 (겹치면 건너뜀) — placed: 이미 놓인 네모들
  //   pill: 둥근 바탕 + 테두리 색 (장소·시설 이름 — 지도 무늬 위에서도 또렷하게 · v2026-10-19a)
  mapLabel(g, text, X, Y, fs, col, placed, bold, pill) {
    g.font = (bold || pill ? 900 : 800) + ' ' + fs + 'px Pretendard, sans-serif'; const tw = g.measureText(text).width, px = pill ? fs * 0.55 : 0, w = tw + px * 2, h = fs * (pill ? 1.55 : 1.1), x0 = X - w / 2, y0 = Y - h / 2;
    if (placed && placed.some(r => x0 < r[2] && x0 + w > r[0] && y0 < r[3] && y0 + h > r[1])) return false; if (placed) placed.push([x0 - 3, y0 - 2, x0 + w + 3, y0 + h + 2]);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (pill) { g.beginPath(); if (g.roundRect) g.roundRect(x0, y0, w, h, h / 2); else g.rect(x0, y0, w, h); g.fillStyle = 'rgba(9,13,22,.84)'; g.fill(); g.lineWidth = Math.max(1.2, fs * 0.1); g.strokeStyle = pill; g.stroke(); g.fillStyle = col; g.fillText(text, X, Y + fs * 0.04); return true; }
    g.lineWidth = Math.max(3, fs * 0.28); g.strokeStyle = 'rgba(8,12,20,.88)'; g.strokeText(text, X, Y); g.fillStyle = col; g.fillText(text, X, Y); return true;
  }
  // 아이콘 둘레에 이름표: 아래 → 위 → 오른쪽 → 왼쪽 → 비스듬히 (빈 곳에) — 촘촘한 도심에서도 이름이 빠지지 않게
  mapLabelAround(g, text, X, Y, r, fs, col, placed, bold, pill) {
    g.font = (bold || pill ? 900 : 800) + ' ' + fs + 'px Pretendard, sans-serif'; const w = g.measureText(text).width + (pill ? fs * 1.1 : 0), h = fs * (pill ? 1.55 : 1.1), gap = 3 * fs / 13;
    for (const [dx, dy] of [[0, r + gap + h / 2], [0, -(r + gap + h / 2)], [r + gap + w / 2, 0], [-(r + gap + w / 2), 0], [r * 0.7 + w / 2, r * 0.7 + h / 2], [-(r * 0.7 + w / 2), r * 0.7 + h / 2], [r * 0.7 + w / 2, -(r * 0.7 + h / 2)], [-(r * 0.7 + w / 2), -(r * 0.7 + h / 2)]])
      if (this.mapLabel(g, text, X + dx, Y + dy, fs, col, placed, bold, pill)) return true;
    return false;
  }
  // 지금 위치: 행정동 · 구 (실제 경계로 판정) · 강가면 강 이름과 km
  whereAmI() {
    const x = this.px, z = this.pz, inRing = r => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const hit = d => d && d.rings.some(inRing); let d = hit(this._lastDong) ? this._lastDong : UG.dongs.find(hit); this._lastDong = d || null;
    let river = null; Object.keys(UC_RIVERS).forEach(rid => { const R = UC_RIVERS[rid], p = ucProject(R.pts, x, z); if (p.d < R.w / 2 + 9 && (!river || p.d < river.d)) river = { name: R.name, km: p.s / UC_KM, d: p.d }; });
    return { dong: d ? d.n : '', gu: d ? d.gu : '', river, short: d ? d.n : (river ? river.name : '울산'), text: (d ? d.gu + ' ' + d.n : '울산') + (river ? ' · ' + river.name + ' ' + river.km.toFixed(1) + 'km 부근' : '') };
  }
  // 화면에 보이는 땅의 범위 (미니맵의 '지금 보는 곳')
  viewQuad() {
    const T = THREE, rc = this._rc = this._rc || new T.Raycaster(), pl = new T.Plane(new T.Vector3(0, 1, 0), -this.groundH(this.px, this.pz)), out = [], v = new T.Vector3();
    for (const [a, b] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) { rc.setFromCamera({ x: a, y: b }, this.camera); if (!rc.ray.intersectPlane(pl, v)) return null; out.push([v.x, v.z]); }
    return out;
  }
  // ── 원형 미니맵 (북쪽 위 · 두 손가락/휠/＋－ 로 확대·축소 · v2026-10-19a: 예전엔 3단계 단추만) ──
  drawMini() {
    const cv = this.ui.mini; if (!cv || !cv.isConnected) return; const css = cv.clientWidth || 150, want = Math.max(160, Math.round(css * Math.min(2, window.devicePixelRatio || 1))); if (cv.width !== want) cv.width = cv.height = want;
    const g = cv.getContext('2d'), W = cv.width, R = this.miniR || 44, k = W / (2 * R), B = this.mapBase(), t = (this.now || 0) / 1000, u = W / css * Math.max(0.82, Math.min(1.12, css / 170));   // u: 화면 1px 크기 (미니맵이 작으면 아이콘도 조금 작게)
    g.save(); g.clearRect(0, 0, W, W); g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, 7); g.clip(); g.fillStyle = '#163B57'; g.fillRect(0, 0, W, W);
    // 바탕 + 선(도로·건물·강)은 둘레를 넉넉히 한 번 그려 두고 잘라 씀 — 벗어나거나, 확대가 1.5배 넘게 바뀌거나, 손을 뗀 뒤 배율이 다르면 다시 그림 (두 손가락으로 벌리는 동안엔 그린 것을 늘려 씀)
    let M = this._mmC; const pin = !!this._mmPinch;
    if (!M || M.W !== W || Math.abs(this.px - M.cx) > M.E - R || Math.abs(this.pz - M.cz) > M.E - R || (!pin && M.R !== R) || R / M.R > 1.5 || R / M.R < 0.62) {
      const E = R * 1.6, kc = W / (2 * R), CS = Math.round(2 * E * kc); M = this._mmC = M && M.c.width === CS ? M : { c: document.createElement('canvas') }; M.c.width = M.c.height = CS; Object.assign(M, { R, W, cx: this.px, cz: this.pz, E, kc });
      const q = M.c.getContext('2d'), X0 = this.px - E, Z0 = this.pz - E; q.fillStyle = '#163B57'; q.fillRect(0, 0, CS, CS); q.imageSmoothingEnabled = true; q.drawImage(B.c, (X0 + 262) * B.K, (Z0 + 252) * B.K, 2 * E * B.K, 2 * E * B.K, 0, 0, CS, CS);
      this.mapVectors(q, x => (x - X0) * kc, z => (z - Z0) * kc, kc, [X0, Z0, X0 + 2 * E, Z0 + 2 * E]); }
    g.imageSmoothingEnabled = true; g.drawImage(M.c, (this.px - R - (M.cx - M.E)) * M.kc, (this.pz - R - (M.cz - M.E)) * M.kc, 2 * R * M.kc, 2 * R * M.kc, 0, 0, W, W);
    const sx = x => W / 2 + (x - this.px) * k, sz = z => W / 2 + (z - this.pz) * k, inR = (x, z, m) => Math.hypot(x - this.px, z - this.pz) < R * (m || 0.94);
    // 지금 화면에 보이는 곳 (부드러운 빛)
    if (!this._vq || t - (this._vqT || 0) > 0.25) { this._vq = this.viewQuad(); this._vqT = t; }
    if (this._vq) { g.beginPath(); this._vq.forEach((p, i) => { const X = sx(p[0]), Y = sz(p[1]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fillStyle = 'rgba(255,240,200,.1)'; g.fill(); g.strokeStyle = 'rgba(255,240,200,.42)'; g.lineWidth = 1.2 * u; g.stroke(); }
    // 아이콘 (덜 중요한 것 먼저) · 이름표: 장소·시설·신고 지점은 늘 (가까운 순) · 확대하면 사람·센서 이름도 — 둥근 바탕으로 또렷하게
    // 아이콘: 겹치지 않게 (layoutPois) · 확인한 센서·사람은 넓게 볼 때 숨김 · 이름표도 아이콘·나·축척 막대를 가리지 않게
    const near = R <= 32, uu = u * (R > 70 ? 0.85 : 1), pois = this.mapPois().filter(p => inR(p.x, p.z) && !(p.kind === 'npc' && p.staff && R > 30 && !this.poiGoal(p)) && !((p.kind === 'npc' || p.kind === 'bio' || p.kind === 'air' || p.kind === 'point') && R > 50 && this.poiChecked(p) && !this.poiGoal(p)));
    const keep = [[W / 2 - 13 * u, W / 2 - 13 * u, W / 2 + 13 * u, W / 2 + 13 * u], [W * 0.3, W * 0.8 - 16 * u, W * 0.7, W * 0.8 + 5 * u]], L = this.layoutPois(pois, sx, sz, uu, keep);   // 나 · 축척 막대 자리는 비움
    this.drawLayout(g, L, uu, t); const placed = keep.concat(L.filter(a => !a.dot).map(a => [a.X - a.r, a.Y - a.r, a.X + a.r, a.Y + a.r]));
    const COL = { fac: ['#FFE1D8', 'rgba(255,128,112,.95)'], place: ['#FFF6DA', 'rgba(245,196,81,.95)'], report: ['#FFE3E3', 'rgba(255,92,108,.95)'], npc: ['#FFF3D1', 'rgba(255,214,102,.8)'], bio: ['#DDF4FF', 'rgba(79,176,234,.8)'], air: ['#EEF1F7', 'rgba(170,180,200,.8)'], point: ['#FFE08A', 'rgba(255,209,102,.8)'] };
    L.filter(a => !a.dot && (a.p.pri >= 3 || (near && a.p.kind !== 'point')) && (!a.p._chk || near || a.p._goal)).sort((a, b) => b.p._goal - a.p._goal || (b.p.pri >= 3) - (a.p.pri >= 3) || Math.hypot(a.p.x - this.px, a.p.z - this.pz) - Math.hypot(b.p.x - this.px, b.p.z - this.pz)).slice(0, near ? 10 : 7)
      .forEach(a => { const c = COL[a.p.kind] || COL.place; this.mapLabelAround(g, a.p.short, a.X, a.Y, a.r, Math.round((a.p.pri >= 3 ? 11.5 : 10.5) * u), a.p._chk ? '#AEB6C6' : c[0], placed, true, a.p._goal ? 'rgba(255,209,102,1)' : c[1]); });
    // 목적지: 안에 있으면 핀 · 밖이면 테두리에 화살표 + 거리
    if (this.dest) { const Dd = this.dest, d = Math.hypot(Dd.x - this.px, Dd.z - this.pz);
      if (inR(Dd.x, Dd.z, 0.9)) { const X = sx(Dd.x), Y = sz(Dd.z) - 4 * u + Math.sin(t * 4) * 2 * u; g.font = Math.round(22 * u) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('📍', X, Y + 12 * u); }
      else { const a = Math.atan2(Dd.z - this.pz, Dd.x - this.px), r = W / 2 - 12 * u, X = W / 2 + Math.cos(a) * r, Y = W / 2 + Math.sin(a) * r; g.save(); g.translate(X, Y); g.rotate(a); g.beginPath(); g.moveTo(10 * u, 0); g.lineTo(-6 * u, -8 * u); g.lineTo(-3 * u, 0); g.lineTo(-6 * u, 8 * u); g.closePath(); g.fillStyle = '#FFD166'; g.strokeStyle = '#3A2600'; g.lineWidth = 2 * u; g.fill(); g.stroke(); g.restore();
        const km = d * 0.09, lab = km >= 1 ? km.toFixed(1) + 'km' : Math.round(km * 100) * 10 + 'm'; this.mapLabel(g, lab, W / 2 + Math.cos(a) * (r - 20 * u), W / 2 + Math.sin(a) * (r - 20 * u), Math.round(10.5 * u), '#FFE08A', null, true); } }
    this.drawMe(g, W / 2, W / 2, 0.82 * u, t);
    // 축척 막대 (아래쪽 · 확대하면 짧은 거리)
    const sc = [100, 200, 500, 1000, 2000, 5000].find(m => m / 90 * k >= W * 0.16) || 5000, bw = sc / 90 * k, by = W * 0.8; g.strokeStyle = 'rgba(8,12,20,.85)'; g.lineWidth = 5 * u; g.lineCap = 'round'; g.beginPath(); g.moveTo(W / 2 - bw / 2, by); g.lineTo(W / 2 + bw / 2, by); g.stroke(); g.strokeStyle = '#FFF6DA'; g.lineWidth = 2 * u; g.stroke();
    this.mapLabel(g, sc >= 1000 ? sc / 1000 + 'km' : sc + 'm', W / 2, by - 8 * u, Math.round(9.5 * u), '#FFF6DA', null, true);
    const vg = g.createRadialGradient(W / 2, W / 2, W * 0.34, W / 2, W / 2, W / 2); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, W);   // 가장자리 살짝 어둡게 (테 안쪽 그늘)
    g.restore();
  }
  // 확대 정도 = 미니맵 반지름(칸) 20~120 · 작을수록 크게 보임
  setMiniR(r, save) { const v = Math.max(20, Math.min(120, r)); if (Math.abs(v - (this.miniR || 44)) < 0.01) return; this.miniR = v; this._miniT = 0; if (save) this.saveMiniR(); }
  saveMiniR() { try { localStorage.setItem('ulsanMiniR', String(Math.round(this.miniR || 44))); } catch (e) {} }
  setMiniZoom(dir) { this.setMiniR((this.miniR || 44) * (dir < 0 ? 1 / 1.45 : 1.45), true); }
  // 미니맵 손가락 조작: 두 손가락 벌리기/오므리기 = 확대/축소 · 마우스 휠 · 한 손가락으로 누르기 = 큰 지도 (벌린 뒤엔 지도가 열리지 않게)
  bindMini(el) {
    const pts = new Map(); let pin = null;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; pts.set(e.pointerId, [e.clientX, e.clientY]); try { el.setPointerCapture(e.pointerId); } catch (er) {}
      if (pts.size === 2) { pin = { d0: dist(), R0: this.miniR || 44 }; this._mmPinch = true; this._mmUsed = performance.now(); } });
    el.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pin && pts.size >= 2) { this.setMiniR(pin.R0 * pin.d0 / dist()); this._mmUsed = performance.now(); e.preventDefault(); } });
    const up = e => { if (!pts.delete(e.pointerId)) return; if (pin && pts.size < 2) { pin = null; this._mmPinch = false; this._miniT = 0; this.saveMiniR(); this._mmUsed = performance.now(); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('touchstart', e => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });   // 브라우저 화면 확대가 먼저 일어나지 않게
    el.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); this.setMiniR((this.miniR || 44) * Math.exp(Math.max(-1, Math.min(1, e.deltaY / 240)) * 0.35)); this._mmUsed = performance.now(); clearTimeout(this._mmWT); this._mmWT = setTimeout(() => this.saveMiniR(), 400); }, { passive: false });
  }
  // 나: 퍼지는 초록 물결 + 흰 테두리 화살표(가는 방향) — 미니맵 · 큰 지도 공통
  drawMe(g, X, Y, s, t) {
    const ph = (t % 1.6) / 1.6;
    g.beginPath(); g.arc(X, Y, (11 + ph * 22) * s, 0, 7); g.strokeStyle = 'rgba(54,224,143,' + (0.85 * (1 - ph)).toFixed(2) + ')'; g.lineWidth = 3 * s; g.stroke();
    const gl = g.createRadialGradient(X, Y, 2 * s, X, Y, 16 * s); gl.addColorStop(0, 'rgba(54,224,143,.55)'); gl.addColorStop(1, 'rgba(54,224,143,0)'); g.fillStyle = gl; g.beginPath(); g.arc(X, Y, 16 * s, 0, 7); g.fill();
    g.save(); g.translate(X, Y); g.rotate(Math.atan2(Math.cos(this.heading), Math.sin(this.heading)) + Math.PI / 2); g.scale(s, s);
    g.beginPath(); g.moveTo(0, -15); g.lineTo(10.5, 10); g.lineTo(0, 4.5); g.lineTo(-10.5, 10); g.closePath(); g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#36E08F'; g.fill(); g.strokeStyle = '#08331D'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  // 맡긴 분석 결과가 나올 때까지 게임 속 시간을 넘김
  waitResults() {
    if (!this.pending.length) { this.toast('기다릴 분석이 없어요'); return; }
    const next = Math.min(...this.pending.map(p => p.readyH)), mins = Math.max(1, Math.round((next - this.nowH) * 60));
    this.nowH = Math.max(this.nowH, next + 0.001); this.toast('⏳ ' + mins + '분 기다렸어요 — 결과를 수첩에 적었어요');   // 한도 없이 (예전: 게임 속 한도에 걸리면 결과가 영영 안 옴)
  }
  toast(t) { const el = this.ui.toast; if (!el) return; el.textContent = t; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 2800);
    const dl = this.ui.dlg, inDlg = this.ui.modalOpen && dl && !/\b(map|game)\b/.test(dl.className); el.classList.toggle('over', !!this.ui.modalOpen && !inDlg); if (inDlg) this.dlgNote(t); }   // 창이 열려 있으면: 보통 창 = 창 안 단추 위에 · 전체 지도·미니게임 = 창 위에 띄움 (예전엔 알림이 창 뒤에 숨었음)
  dlgNote(t) { const box = this.ui.dlg.querySelector(':scope > .u-opts'); if (!box) return; let n = box.querySelector(':scope > .u-dnote'); if (!n) { n = document.createElement('div'); n.className = 'u-dnote'; box.prepend(n); }
    n.textContent = t; n.classList.remove('on'); void n.offsetWidth; n.classList.add('on'); clearTimeout(this._dnT); this._dnT = setTimeout(() => { if (n.isConnected) n.remove(); }, 3600); }
  // 창 종류: talk(아래 대화창 · 초상화) · sheet(아래 선택지) · panel(큰 창: 수첩·지도·보고서·결과)
  dialog(emoji, title, body, opts, wide, kind) {
    kind = kind || (wide ? 'panel' : 'sheet'); if (this.mg && kind !== 'game') this.mgEnd(); if (kind === 'talk') this._talkT = performance.now();
    this.ui.modalOpen = true; this.mx = 0; this.my = 0; this.keys = {}; this.ui.modal.className = 'u-modal m-' + kind; this.ui.dlg.className = 'u-box ' + kind + (wide ? ' wide' : '');
    this.ui.dlg.innerHTML = (kind === 'talk' ? '<div class="t-por"><span>' + emoji + '</span></div><h3>' + title + '</h3>' : '<h3><span>' + emoji + '</span>' + title + '</h3>') + '<div class="u-body">' + body + '</div><div class="u-opts"></div>';
    const box = this.ui.dlg.querySelector('.u-opts'), quit = /^(그만두기|취소|닫기|알겠어요)/;
    opts.forEach(([label, fn]) => { const b = document.createElement('button'), m = /^(.*?)\s*(?:\((\d+분)\))?\s*(?:—\s*(.*))?$/.exec(label);
      if (m && (m[2] || m[3]) && (kind === 'sheet' || kind === 'panel')) b.innerHTML = '<b>' + m[1] + '</b>' + (m[2] ? '<i class="chip">🕗 ' + m[2] + '</i>' : '') + (m[3] ? '<small>' + m[3] + '</small>' : ''); else b.textContent = label;   // 걸리는 시간은 칩으로 · 설명은 작은 글씨 (큰 창 단추도 — 예전엔 긴 글 한 줄이라 단추가 세로로 길게 쌓여 설명·목록을 가렸음)
      if (quit.test(label)) b.className = 'ghost'; b.addEventListener('click', fn); box.appendChild(b); });
    // 창 오른쪽 위 ✕ (그만두기·닫기 단추와 같음 — 그런 단추가 없는 창엔 없음)
    const q = [...box.querySelectorAll('button')].find(b => quit.test(b.textContent)), h = this.ui.dlg.querySelector('h3');
    if (q && h && kind !== 'talk') { const x = document.createElement('button'); x.className = 'u-x'; x.setAttribute('aria-label', '닫기'); x.textContent = '✕'; x.addEventListener('click', e => { e.stopPropagation(); q.click(); }); h.appendChild(x); }
    if (kind === 'talk') { const bd = this.ui.dlg.querySelector('.u-body'); bd.addEventListener('click', () => bd.classList.add('shown')); this.ui.dlg.querySelector('.t-por').addEventListener('click', () => bd.classList.add('shown')); }   // 글이 나타나는 중에 누르면 바로 다 보임
    this.ui.dlg.scrollTop = 0;
    const R = this.ui.root.getBoundingClientRect(), B = this.ui.dlg.getBoundingClientRect(); this._cover = kind === 'map' || kind === 'game' || B.width * B.height > 0.72 * R.width * R.height; this._actT = this.now || 0;   // 절전: 뒤의 3D 가 거의 안 보이면 그리지 않음
  }
  closeDialog() { if (this.mg) this.mgEnd(); this.ui.modalOpen = false; this._cover = false; this._actT = this.now || 0; this.focus = null; this.ui.modal.className = 'u-modal hidden'; this._dirty = true; }
  // 다시 볼 수 있는 기록(센서 · 서류 · 배출구 확인 · 사람의 말)은 같은 제목이면 새로 쌓지 않고 최신 내용으로 바꿔 맨 뒤(새 것)로 — 예전엔 같은 증언이 여러 개 쌓여 결정적 증거 점수를 부풀릴 수 있었음
  //   미니게임 결과처럼 매번 다른 실험은 따로 쌓되 제목에 (2)·(3)을 붙여 구별
  addEvidence(e) { e.at = this.nowH; this._dirty = true; const same = x => x.title === e.title && x.id !== 'case', i = e.id === 'case' ? -1 : this.evidence.findIndex(same);
    if (i >= 0 && (/^(🦐|💨|🗂|📍)/.test(e.title) || /의 말$/.test(e.title))) { e.id = this.evidence[i].id; this.evidence.splice(i, 1); this.evidence.push(e); this.seenEv = Math.min(this.seenEv, this.evidence.length - 1); return; }
    if (i >= 0) { const base = e.title; let k = 2; while (this.evidence.some(x => x.title === base + ' (' + k + ')')) k++; e.title = base + ' (' + k + ')'; }
    e.id = e.id || ('e' + this.evidence.length); this.evidence.push(e); const nb = this.ui.noteBtn; if (nb && e.id !== 'case') { nb.classList.remove('got'); void nb.offsetWidth; nb.classList.add('got'); } }   // 새 증거: 수첩 단추가 톡 튐
  evCat(e) { const t = e.title; return e.id === 'case' ? 'case' : /의 말$/.test(t) ? 'talk' : /^(📊|🧬|🔬|⚗)/.test(t) ? 'lab' : /^(🦐|💨|🛸|🧭)/.test(t) ? 'sensor' : /^(🧪|🗂|📍|🎣|🛶|⏪|🚓)/.test(t) ? 'field' : 'talk'; }
  openNote() {
    this.seenEv = this.evidence.length;
    const tabs = [['all', '전체'], ['lab', '📊 분석'], ['sensor', '📈 센서'], ['talk', '💬 증언·소식'], ['field', '🗂 현장·서류']], cnt = c => this.evidence.filter(e => this.evCat(e) === c).length;
    const list = this.evidence.slice().reverse().map(e => '<details data-cat="' + this.evCat(e) + '"' + (e.id === 'case' && this.evidence.length < 3 ? ' open' : '') + '><summary>' + e.title + '<small>' + (e.id === 'case' ? '' : this.hm(e.at)) + '</small></summary><div>' + e.html + '</div></details>').join('');
    this.dialog('📓', '수사 수첩 (' + this.evidenceCount + '건)', '<div class="u-tabs">' + tabs.map(([k, l], i) => '<button data-tab="' + k + '" class="' + (i ? '' : 'on') + '">' + l + (i ? ' <em>' + cnt(k) + '</em>' : '') + '</button>').join('') + '</div><div class="u-notes">' + (list || '아직 기록이 없어요') + '</div>', [['닫기', () => this.closeDialog()]], true);
    const dl = this.ui.dlg; dl.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.tab; dl.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      dl.querySelectorAll('.u-notes details').forEach(d => { d.style.display = k === 'all' || d.dataset.cat === k || d.dataset.cat === 'case' ? '' : 'none'; }); }));
  }
  // 빠른 이동 도착 자리 (한 번 계산해 둠): 장소 = 그곳 사람 앞(곧게 걸어갈 수 있는 자리) · 시설 = 정문 바깥
  travelDests() {
    if (this._dests) return this._dests; const byPlace = {}; Object.keys(UC_NPC_AT).forEach(id => { byPlace[UC_NPC_AT[id][0]] = ucNpcAt(id); });
    return (this._dests = Object.keys(UC_PLACES).map(k => { const p = byPlace[k] || UC_PLACES[k].at; return [UC_PLACES[k].name, this.arriveNear(p[0], p[1])]; })
      .concat(Object.values(UC_FAC).map(F => { const g = ucGate(F, 2); return [F.name.split(' (')[0], this.arriveNear(g[0], g[1], Math.atan2(F.gate[3], F.gate[2]))]; })));
  }
  // 목적지로 쓸 자리: 시설 = 정문 앞 · 장소 = 그곳 사람 · 나머지 = 그 자리
  poiDest(p) { if (p.kind === 'fac') return ucGate(UC_FAC[p.key], 1); if (p.kind === 'place') { const id = Object.keys(UC_NPC_AT).find(k => UC_NPC_AT[k][0] === p.key); return id ? ucNpcAt(id) : [p.x, p.z]; } return [p.x, p.z]; }
  mapSpots() { return this.mapPois().filter(p => !(p.kind === 'npc' && p.staff)).map(p => { const T = this.poiTarget(p); return [T.name, T.at[0], T.at[1], T.key]; }); }   // 3D 전경에서 눌러 목적지
  // 지도·목록에서 고른 것 → 안내 목적지 (hintPlace 등과 같은 모양)
  poiTarget(p) { if (p.kind === 'place') return this.hintPlace(p.key); if (p.kind === 'fac') return this.hintFac(p.key); if (p.kind === 'point') return this.hintPoint(p.key); if (p.kind === 'report') return this.hintReport();
    if (p.kind === 'bio') return this.hintSensor(UC_BIO.find(b => b.id === p.key)); if (p.kind === 'air') return this.hintSensor(UC_AIR.find(a => a.id === p.key)); return { name: p.name, at: [p.x, p.z], key: 'n:' + p.key }; }
  // 📋 장소 목록: 어디서 무엇을 알 수 있는지 · 📍 길 안내 · 🚙 바로 가기 (v2026-10-19a — 예전엔 지도 아이콘을 하나씩 눌러 봐야 알았음)
  placeList() {
    const km = d => { const v = d * 0.09; return v >= 1 ? v.toFixed(1) + 'km' : Math.round(v * 10) * 100 + 'm'; }, T = {}, water = UC_POL[this.C.pol].path === 'water';
    const row = (t, ic, cls, title, sub, done) => { T[t.key] = t; const on = this.dest && this.dest.key === t.key, d = Math.hypot(t.at[0] - this.px, t.at[1] - this.pz);
      return '<div class="gl-row' + (done ? ' done' : '') + '"><i class="gl-ic k-' + cls + '">' + ic + '</i><div class="gl-tx"><b>' + title + (done ? ' <u>✓</u>' : '') + '</b><small>' + sub + '</small></div><div class="gl-bt"><button data-gd="' + t.key + '" class="' + (on ? 'on' : '') + '" aria-label="길 안내">📍<span>' + (on ? '안내 중' : km(d)) + '</span></button><button data-gg="' + t.key + '" aria-label="바로 가기">🚙<span>' + Math.max(1, Math.round(this.travelCost(t.at) * 60)) + '분</span></button></div></div>'; };
    const H = this.nextHint(), goal = H && H.to && !H.to.rep ? '<p class="gl-h">🧭 지금 갈 곳</p>' + row(H.to, '➤', 'goal', H.to.name, H.t.replace(/<[^>]+>/g, ''), false) : '';
    const rp = this.set.diff === 'easy' && water && !(H && H.to && H.to.key === this.hintReport().key) ? row(this.hintReport(), '✖', 'report', this.hintReport().name, '물고기 떼죽음이 신고된 강가 — 여기서 💧 물 시료를 떠요', false) : '';
    const places = Object.keys(UC_PLACES).map(k => { const I = UlsanRpgGame.PLACE_INFO[k] || [], n = this.npcs.find(q => q.id === I[0]);
      return row(this.hintPlace(k), UlsanRpgGame.PLACE_ICON[k] || '🏛', 'place', UC_PLACES[k].name, (n ? n.emoji + ' ' + n.name + ' — ' : '') + (I[1] || ''), I[0] && this.talked[I[0]]); }).join('');
    const facs = Object.keys(UC_FAC).map(fid => { const F = UC_FAC[fid], ty = /\(([^)]+)\)/.exec(F.name), pts = F.outs.concat(F.stacks).filter(o => this.known[o.id]);
      return row(this.hintFac(fid), '🏭', 'fac', ucFacShort(F) + (ty ? ' <em>' + ty[1] + '</em>' : ''), '쓰는 물질: ' + F.can.map(q => UC_POL[q].name).join(' · ') + ' · 정문: 🗂 서류 · 💂 경비원' + (pts.length ? '<span class="gl-pts">' + pts.map(o => '<button data-gp="' + o.id + '">◆ ' + o.id + ' ' + o.label + '</button>').join('') + '</span>' : ''), this.evidence.some(e => e.title === '🗂 ' + F.name + ' 서류')); }).join('');
    const bio = UC_BIO.map(b => row(this.hintSensor(b), '🦐', 'bio', b.name, UC_RIVERS[b.river].name + ' ' + (b.s / UC_KM).toFixed(1) + 'km · 강물이 독해진 시각 (물벼룩 기록)', this.visited[b.id])).join('');
    const air = UC_AIR.map(a => row(this.hintSensor(a), '💨', 'air', a.name, '냄새가 치솟은 시각 · 🌫 공기 시료', this.visited[a.id])).join('');
    const act = this.npcs.find(q => q.id === 'activist'), others = act ? row({ name: act.name, at: [act.x, act.z], key: 'n:activist' }, act.emoji, 'npc', act.name, '떠도는 소문 (맞을 수도 틀릴 수도 있어요 — 증거는 아니에요)', this.talked.activist) : '';
    this._glT = T;
    return goal + (rp ? '<p class="gl-h">📄 신고 지점</p>' + rp : '') + '<p class="gl-h">🏛 조사 장소 · 사람 <small>이야기를 들으면 ✓</small></p>' + places + others +
      '<p class="gl-h">🏭 시설 <small>정문에서 서류를 보면 ✓ · 배출구 위치가 ◆로 생겨요</small></p>' + facs +
      '<details class="gl-d"' + (water ? ' open' : '') + '><summary>🦐 물벼룩 바이오센서 ' + UC_BIO.length + '곳 <small>강물 사건</small></summary>' + bio + '</details>' +
      '<details class="gl-d"' + (water ? '' : ' open') + '><summary>💨 대기·냄새 센서 ' + UC_AIR.length + '곳 <small>냄새 사건</small></summary>' + air + '</details>';
  }
  // 큰 지도 (v2026-10-19b · 화면 가득): 🗺 지도(끌기 · 두 손가락/휠 확대 · 아이콘을 눌러 목적지 · 바로 가기) · 📋 장소 목록
  //   강 이름은 물길을 따라 여러 번 · 장소·시설 이름은 둥근 이름표 · 아이콘끼리 겹치지 않게 비켜 놓고 제자리 선 · 확인한 곳은 흐리게 ✓ · 지금 갈 곳은 금빛 고리
  openMap(tab) {
    const L = this.whereAmI(), km = d => { const v = d * 0.09; return v >= 1 ? v.toFixed(1) + 'km' : Math.round(v * 100) * 10 + 'm'; };
    const F = this._mapF = this._mapF || { fac: true, place: true, sensor: true, npc: true, point: true }, KIND = { fac: '시설', place: '조사 장소', bio: '물벼룩 바이오센서', air: '대기·냄새 센서', npc: '사람', point: '배출 지점', report: '신고 지점' };
    tab = tab || this._mapTab || 'map'; this._mapTab = tab;
    const water = UC_POL[this.C.pol].path === 'water', rep = this.set.diff !== 'hard' && water;
    this.dialog('🗺', '울산 지도', '<div class="u-mtabs"><button data-mt="map">🗺 지도</button><button data-mt="list">📋 장소 목록</button></div>' +
      '<div class="u-mpane" data-p="map"><div class="u-mapwrap"><canvas class="u-map"></canvas></div>' +
      '<div class="u-mtl"><div class="u-here">📍 <b>' + L.text + '</b></div><div class="u-mapbar"><span class="u-seg"><button data-z="1">전체</button><button data-z="2.5">내 주변</button><button data-z="5">크게</button></span><button data-me="1">🎯 나</button><button data-3d="1" class="ov">🛰 3D</button></div>' +
      '<div class="u-mapf">' + [['fac', '🏭 시설'], ['place', '🏛 장소'], ['sensor', '📈 센서'], ['npc', '❗ 사람'], ['point', '◆ 배출']].map(([k, l]) => '<button data-f="' + k + '" class="' + (F[k] ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
      '<button class="u-lgbtn" data-lg="1">범례 ▾</button><div class="u-legend hidden"><span><i class="lg fac">🏭</i>시설</span><span><i class="lg place">🏛</i>조사 장소</span>' + (rep ? '<span><i class="lg rep">✖</i>신고 지점</span>' : '') + '<span><i class="lg bio">🦐</i>바이오센서</span><span><i class="lg air">💨</i>대기센서</span><span><i class="lg npc">!</i>안 만난 사람</span><span><i class="lg pt"></i>배출 지점</span><span><i class="lg me"></i>나</span><span><i class="lg ck">✓</i>확인한 곳 (흐리게)</span><span><i class="lg goal"></i>지금 갈 곳</span><span class="dim">끌기 · 두 손가락/휠 확대 · 아이콘 누르기 = 목적지 · 강의 흰 점 = 1km</span></div>' +
      '<div class="u-mapsel hidden"></div></div>' +
      '<div class="u-mpane u-glist" data-p="list"></div>', [['닫기', () => this.closeDialog()]], true, 'map');
    const dl = this.ui.dlg, cv = dl.querySelector('.u-map'), g = cv.getContext('2d'), sel = dl.querySelector('.u-mapsel'), gl = dl.querySelector('.u-glist'); dl.querySelector('.u-body').classList.add('mapbody');
    const layer = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1) * (this.hq === 'low' ? 0.8 : 1);
    let CW = 0, CH = 0, s0 = 1, lay = [];
    const V = this.mapView = { z: 2.5, cx: this.px, cz: this.pz }, sc = () => s0 * V.z;
    const clampV = () => { V.z = Math.max(1, Math.min(8, V.z)); const hx = Math.min(262, CW / 2 / sc()) * 0.3, hz = Math.min(252, CH / 2 / sc()) * 0.3; V.cx = Math.max(-262 + hx, Math.min(262 - hx, V.cx)); V.cz = Math.max(-252 + hz, Math.min(252 - hz, V.cz)); };   // 가운데는 지도 안 어디든 (넓은 화면에서도 나를 가운데에 · 끌어서 옮기기)
    const tx = x => (x - V.cx) * sc() + CW / 2, tz = z => (z - V.cz) * sc() + CH / 2, fx = X => (X - CW / 2) / sc() + V.cx, fz = Y => (Y - CH / 2) / sc() + V.cz;
    const fit = () => { const w = Math.max(50, cv.clientWidth), h = Math.max(50, cv.clientHeight), W2 = Math.round(w * dpr), H2 = Math.round(h * dpr); if (W2 === CW && H2 === CH) return false; CW = cv.width = layer.width = W2; CH = cv.height = layer.height = H2; s0 = Math.min(CW / 524, CH / 504); return true; };
    const show = p => p.kind === 'bio' || p.kind === 'air' ? F.sensor : p.kind === 'report' ? true : F[p.kind] !== false;
    const LC = { fac: ['#FFE1D8', 'rgba(255,128,112,.95)'], place: ['#FFF6DA', 'rgba(245,196,81,.95)'], report: ['#FFE3E3', 'rgba(255,92,108,.95)'] };
    // 강 이름: 물길을 따라 화면에서 약 300px 마다 · 물길 방향으로 기울여 (거꾸로 서지 않게)
    const riverNames = (q, placed, u) => Object.values(UC_RIVERS).forEach(R => { const Lr = ucLen(R.pts), step = 300 * u / sc(), fs = Math.round(14 * u); let next = Math.min(Lr * 0.3, step * 0.5);
      for (let d = next; d < Lr - 2; d += Math.max(step, 6)) { const a = ucAt(R.pts, d), b = ucAt(R.pts, Math.min(Lr, d + 2)), X = tx(a[0]), Y = tz(a[1]); if (X < 0 || Y < 0 || X > CW || Y > CH) continue;
        let an = Math.atan2(tz(b[1]) - Y, tx(b[0]) - X); if (an > Math.PI / 2) an -= Math.PI; if (an < -Math.PI / 2) an += Math.PI;
        q.font = '900 ' + fs + 'px Pretendard, sans-serif'; const w = q.measureText(R.name).width, bx = [X - w / 2 - 4, Y - fs, X + w / 2 + 4, Y + fs]; if (placed.some(r => bx[0] < r[2] && bx[2] > r[0] && bx[1] < r[3] && bx[3] > r[1])) continue; placed.push(bx);
        q.save(); q.translate(X, Y); q.rotate(an); q.textAlign = 'center'; q.textBaseline = 'middle'; q.lineJoin = 'round'; q.lineWidth = Math.max(3, fs * 0.3); q.strokeStyle = 'rgba(6,30,52,.92)'; q.strokeText(R.name, 0, 0); q.fillStyle = '#BFE9FF'; q.fillText(R.name, 0, 0); q.restore(); } });
    const drawLayer = () => { this._mapAct = performance.now(); const q = layer.getContext('2d'), s = sc(), B = this.mapBase(), u = dpr, box = [fx(0), fz(0), fx(CW), fz(CH)];
      q.clearRect(0, 0, CW, CH); q.fillStyle = '#163B57'; q.fillRect(0, 0, CW, CH); q.imageSmoothingEnabled = true; q.drawImage(B.c, tx(-262), tz(-252), 524 * s, 504 * s);
      this.mapVectors(q, tx, tz, s, box);
      if (L.dong && this._lastDong) { q.fillStyle = 'rgba(54,224,143,.12)'; q.strokeStyle = 'rgba(54,224,143,.9)'; q.lineWidth = 2 * u; this._lastDong.rings.forEach(r => { q.beginPath(); r.forEach((p, i) => i ? q.lineTo(tx(p[0]), tz(p[1])) : q.moveTo(tx(p[0]), tz(p[1]))); q.closePath(); q.fill(); q.stroke(); }); }   // 내가 있는 동은 초록으로
      const rivK = []; Object.values(UC_RIVERS).forEach(R => { const Lr = ucLen(R.pts); for (let k = 1; k * UC_KM < Lr; k++) { const p = ucAt(R.pts, k * UC_KM); q.beginPath(); q.arc(tx(p[0]), tz(p[1]), Math.max(1.6 * u, 0.25 * s), 0, 7); q.fillStyle = '#F4FBFF'; q.fill(); rivK.push([k, p]); } });   // 1km 점
      const pois = this.mapPois().filter(p => show(p) && tx(p.x) > -30 && tz(p.z) > -30 && tx(p.x) < CW + 30 && tz(p.z) < CH + 30 && !(p.kind === 'npc' && p.staff && V.z < 4 && !this.poiGoal(p)));
      const me = [tx(this.px) - 16 * u, tz(this.pz) - 16 * u, tx(this.px) + 16 * u, tz(this.pz) + 16 * u], uu = u * Math.max(0.9, Math.min(1.25, 0.85 + V.z * 0.06));
      lay = this.layoutPois(pois, tx, tz, uu, [me]); this.drawLayout(q, lay, uu, null);
      const placed = [me].concat(lay.filter(a => !a.dot).map(a => [a.X - a.r, a.Y - a.r, a.X + a.r, a.Y + a.r]));
      // 이름표: 신고 지점 · 시설 · 장소 (둥근 바탕 · 확인한 곳은 흐리게) → 강 이름 → 사람·센서·배출 지점 → 구 → 동 (겹치면 덜 중요한 것을 뺌)
      lay.filter(a => !a.dot && LC[a.p.kind]).sort((a, b) => b.p._pr - a.p._pr).forEach(a => { const c = LC[a.p.kind], fs = Math.round(13.5 * uu); this.mapLabelAround(q, V.z < 1.8 && a.p.kind === 'place' ? a.p.short : a.p.name, a.X, a.Y, a.r, fs, a.p._chk ? '#B9C0CE' : c[0], placed, true, a.p._goal ? 'rgba(255,209,102,1)' : a.p._chk ? 'rgba(150,158,176,.7)' : c[1]); });
      riverNames(q, placed, u);
      if (V.z >= 2) lay.filter(a => !a.dot && !LC[a.p.kind] && (!a.p._chk || V.z >= 4)).sort((a, b) => b.p._pr - a.p._pr).forEach(a => { const fs = Math.round(11 * uu); this.mapLabelAround(q, V.z >= 4 ? a.p.name : a.p.short, a.X, a.Y, a.r, fs, a.p._chk ? '#AEB6C6' : a.p.kind === 'point' ? '#FFE08A' : a.p.kind === 'npc' ? '#FFF3D1' : '#DDE6F2', placed); });
      if (V.z < 3.5) Object.keys(UG.gus).forEach(gu => { const [x, z] = UG.gus[gu]; this.mapLabel(q, gu, tx(x), tz(z), Math.round(20 * u), 'rgba(255,246,218,.8)', placed, true); });
      if (V.z >= 2) UG.dongs.forEach(d => { if (d.t === 'r' && d.gu === '울주군' && V.z < 4) return; this.mapLabel(q, d.n, tx(d.c[0]), tz(d.c[1]), Math.round(10.5 * u), 'rgba(220,228,240,.72)', placed); });
      if (V.z >= 4) rivK.forEach(([k, p]) => this.mapLabel(q, k + 'km', tx(p[0]) + 12 * u, tz(p[1]) - 9 * u, Math.round(10 * u), '#DDF4FF', placed)); };
    // 매 프레임: 바탕 + 지금 갈 곳 고리 + 목적지 + 나 — 내가 화면 밖이면 가장자리에 화살표
    const frame = () => { if (!cv.isConnected || !this.ui.modalOpen || this._dead) { if (this._mapPt && !cv.isConnected) this._mapPt = null; return; } requestAnimationFrame(frame);   // 창을 닫으면 멈춤 (예전: 닫은 뒤에도 숨은 지도를 다른 창을 열 때까지 초당 60번 그렸음)
      if (this._mapTab !== 'map') return; const pn = performance.now(); if (this.touch && pn - (this._mapFT || 0) < (pn - (this._mapAct || 0) < 1000 ? 29 : 62)) return; this._mapFT = pn; if (fit()) { clampV(); drawLayer(); } g.drawImage(layer, 0, 0); const t = performance.now() / 1000, K = dpr;
      lay.forEach(a => { if (!a.p._goal || a.dot) return; const k = 0.5 + 0.5 * Math.sin(t * 5); g.beginPath(); g.arc(a.X, a.Y, a.r + (5 + 5 * k) * K, 0, 7); g.strokeStyle = 'rgba(255,209,102,' + (0.95 - 0.5 * k).toFixed(2) + ')'; g.lineWidth = 3.5 * K; g.stroke(); });
      if (this.dest) { const X = tx(this.dest.x), Y = tz(this.dest.z) + Math.sin(t * 4) * 3 * K; g.font = Math.round(28 * K) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('📍', X, Y); }
      const X = tx(this.px), Y = tz(this.pz), S = 1.25 * K;
      if (X > 6 && X < CW - 6 && Y > 6 && Y < CH - 6) { this.drawMe(g, X, Y, S, t);
        const lab = '나', fs = Math.round(12 * K); g.font = '900 ' + fs + 'px Pretendard, sans-serif'; const w = g.measureText(lab).width + fs * 1.2, bh = fs * 1.7, bx = X - w / 2, by = Y - 22 * S - bh;
        g.fillStyle = 'rgba(8,51,29,.92)'; g.beginPath(); g.roundRect ? g.roundRect(bx, by, w, bh, bh / 2) : g.rect(bx, by, w, bh); g.fill(); g.strokeStyle = '#36E08F'; g.lineWidth = 2 * K; g.stroke(); g.fillStyle = '#EAFBF2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, X, by + bh / 2 + 1); }
      else { const a = Math.atan2(Y - CH / 2, X - CW / 2), ex = Math.max(26 * K, Math.min(CW - 26 * K, X)), ey = Math.max(26 * K, Math.min(CH - 26 * K, Y)); g.save(); g.translate(ex, ey); g.rotate(a); g.scale(K, K); g.fillStyle = '#36E08F'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(20, 0); g.lineTo(-13, -14); g.lineTo(-13, 14); g.closePath(); g.stroke(); g.fill(); g.restore(); } };
    const redraw = () => { fit(); clampV(); drawLayer(); dl.querySelectorAll('[data-z]').forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.z - V.z) < 0.01)); };
    // 탭: 지도 ↔ 장소 목록 (목록은 열 때마다 새로 — 거리 · ✓ 가 최신)
    const showTab = k => { this._mapTab = k; dl.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === k)); dl.querySelectorAll('.u-mpane').forEach(p => p.classList.toggle('hidden', p.dataset.p !== k)); if (k === 'list') gl.innerHTML = this.placeList(); else requestAnimationFrame(() => redraw()); };
    dl.querySelectorAll('[data-mt]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.mt)));
    gl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const T = this._glT || {};
      if (b.dataset.gd && T[b.dataset.gd]) { const t = T[b.dataset.gd]; if (this.dest && this.dest.key === t.key) { this.setDest(null); this.toast('📍 길 안내를 껐어요'); } else this.setDest(t.at[0], t.at[1], t.name, false, t.key); gl.innerHTML = this.placeList(); }
      if (b.dataset.gg && T[b.dataset.gg]) { const t = T[b.dataset.gg]; this.travelTo(t.name, this.arriveFor(t)); }
      if (b.dataset.gp) { const t = this.hintPoint(b.dataset.gp); this.setDest(t.at[0], t.at[1], t.name, false, t.key); gl.innerHTML = this.placeList(); } });
    showTab(tab); requestAnimationFrame(frame);
    this._mapPt = key => { const a = lay.find(q => this.poiKey(q.p) === key), r = cv.getBoundingClientRect(); return a ? [r.left + a.X / CW * r.width, r.top + a.Y / CH * r.height] : null; };   // 검사용: 아이콘이 놓인 화면 자리
    dl.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => { V.z = +b.dataset.z; V.cx = V.z <= 1 ? 0 : this.px; V.cz = V.z <= 1 ? 0 : this.pz; redraw(); }));   // 전체 = 울산 한가운데
    dl.querySelector('[data-me]').addEventListener('click', () => { if (V.z < 2.5) V.z = 2.5; V.cx = this.px; V.cz = this.pz; redraw(); });
    dl.querySelector('[data-3d]').addEventListener('click', () => { this.closeDialog(); this.enterOverview(); });
    dl.querySelector('[data-lg]').addEventListener('click', e => { const lg = dl.querySelector('.u-legend'); lg.classList.toggle('hidden'); e.currentTarget.textContent = lg.classList.contains('hidden') ? '범례 ▾' : '범례 ▴'; });
    dl.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { F[b.dataset.f] = !F[b.dataset.f]; b.classList.toggle('on', F[b.dataset.f]); redraw(); }));
    // 고른 곳 카드: 아이콘 · 이름 · 종류 · 거리 · 확인 여부 · 🚙 바로 가기
    const pick = p => { if (!p) { sel.classList.add('hidden'); return; } const T = this.poiTarget(p), ic = p.kind === 'point' ? '◆' : p.icon;
      sel.innerHTML = '<i class="k-' + p.kind + '">' + ic + '</i><div><b>' + p.name + '</b><small>' + KIND[p.kind] + ' · ' + km(Math.hypot(T.at[0] - this.px, T.at[1] - this.pz)) + (this.poiChecked(p) ? ' · ✓ 확인함' : '') + (this.dest && this.dest.key === T.key ? ' · 📍 길 안내 중' : '') + '</small></div><button data-go>🚙 바로 가기 <em>' + Math.max(1, Math.round(this.travelCost(T.at) * 60)) + '분</em></button><button data-x aria-label="닫기">✕</button>';
      sel.classList.remove('hidden'); sel.querySelector('[data-go]').addEventListener('click', () => this.travelTo(T.name, this.arriveFor(T))); sel.querySelector('[data-x]').addEventListener('click', () => sel.classList.add('hidden')); };
    // 끌기 = 이동 · 두 손가락 = 확대/축소 · 짧게 누르기 = 목적지 (놓인 아이콘 자리로 판정 — 비켜 놓은 아이콘도 눌림)
    let drag = null, pin = null; const ptrs = new Map(), pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CW, (e.clientY - r.top) / r.height * CH]; };
    const two = () => { const [a2, b2] = [...ptrs.values()]; return [Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) || 1, (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]; };
    const zoomAt = (z, X, Y) => { const wx = fx(X), wz = fz(Y); V.z = z; clampV(); V.cx = wx - (X - CW / 2) / sc(); V.cz = wz - (Y - CH / 2) / sc(); redraw(); };
    cv.addEventListener('pointerdown', e => { const P2 = pt(e); ptrs.set(e.pointerId, P2); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      if (ptrs.size === 2) { const [d, mx, my] = two(); pin = { d0: d, z0: V.z, wx: fx(mx), wz: fz(my) }; drag = null; } else if (ptrs.size === 1) drag = { X: P2[0], Y: P2[1], cx: V.cx, cz: V.cz, moved: false }; });
    cv.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; const P2 = pt(e); ptrs.set(e.pointerId, P2); e.preventDefault();
      if (pin && ptrs.size >= 2) { const [d, mx, my] = two(); V.z = pin.z0 * d / pin.d0; clampV(); V.cx = pin.wx - (mx - CW / 2) / sc(); V.cz = pin.wz - (my - CH / 2) / sc(); redraw(); return; }
      if (!drag) return; const [X, Y] = P2; if (Math.hypot(X - drag.X, Y - drag.Y) > 12 * dpr) drag.moved = true; if (drag.moved) { V.cx = drag.cx - (X - drag.X) / sc(); V.cz = drag.cz - (Y - drag.Y) / sc(); clampV(); drawLayer(); } });
    const up = e => { if (!ptrs.delete(e.pointerId)) return; if (pin) { if (ptrs.size < 2) { pin = null; drag = null; } return; } const d = drag; drag = null; if (!d || d.moved || e.type !== 'pointerup') return; const [X, Y] = pt(e);
      let best = null, bd = 26 * dpr; lay.forEach(a => { const q2 = Math.hypot(a.X - X, a.Y - Y) - (a.dot ? 0 : a.r * 0.5); if (q2 < bd) { bd = q2; best = a.p; } });
      if (!best) { this.toast('장소·시설·센서 아이콘을 눌러 주세요'); pick(null); return; }
      const T = this.poiTarget(best); if (this.dest && this.dest.key === T.key) { this.setDest(null); this.toast('📍 목적지를 지웠어요'); } else this.setDest(T.at[0], T.at[1], T.name, false, T.key); pick(best); drawLayer(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const [X, Y] = pt(e); zoomAt(V.z * Math.exp(-Math.max(-1, Math.min(1, e.deltaY / 240)) * 0.3), X, Y); }, { passive: false });
  }
  // ── 🛰 3D 전경: 카메라가 하늘로 올라가 울산 전체를 내려다봄 (끌어서 둘러보기 · 확대/축소 · 눌러서 목적지) ──
  enterOverview(o) {
    if (this.ov || this.gameOver) return; const T = THREE; o = o || {};
    this.ov = { cx: o.cx != null ? o.cx : this.px, cz: o.cz != null ? o.cz : this.pz, h: o.h || 190, fog: [this.scene.fog.near, this.scene.fog.far], dens: this.scene.fog.density, far: this.camera.far };
    if (this.scene.fog.isFogExp2) this.scene.fog.density = this.fogBase * 0.4;   // 실사풍: 하늘에선 안개를 옅게
    this.scene.fog.near = 2500; this.scene.fog.far = 4000; this.camera.far = 3000; this.camera.updateProjectionMatrix(); this.mx = 0; this.my = 0; this.keys = {};
    if (!this.meBeacon) { const g = new T.Group(), col = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 140, 16, 1, true), new T.MeshBasicMaterial({ color: 0x36E08F, transparent: true, opacity: 0.45, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); col.position.y = 70;
      const ring = new T.Mesh(new T.RingGeometry(3, 4.4, 40), new T.MeshBasicMaterial({ color: 0x36E08F, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4;
      [col, ring].forEach(m => { m.userData.noShadow = true; g.add(m); }); this.meBeacon = g; this.scene.add(g); }
    this.meBeacon.visible = true; this.npcs.forEach(n => { n.g.visible = false; });   // 하늘에선 사람은 너무 작아 숨김 (그리기 횟수 절약)
    const ctl = document.getElementById('fps-ctl'); if (ctl) ctl.style.visibility = 'hidden';   // 조이스틱·조사 버튼은 잠시 숨김
    const ov = this.ui.ov; ov.classList.remove('hidden'); this.ui.root.classList.add('ov-on'); this._cullT = 0; if (!o.quiet) this.toast('🛰 3D 전경 — 끌어서 둘러보고, 누르면 목적지를 표시해요');
  }
  exitOverview() {
    if (!this.ov) return; const o = this.ov; this.ov = null; this.scene.fog.near = o.fog[0]; this.scene.fog.far = o.fog[1]; if (o.dens != null) this.scene.fog.density = o.dens; this.camera.far = o.far; this.camera.updateProjectionMatrix();
    if (this.meBeacon) this.meBeacon.visible = false; if (this.beacon) this.beacon.scale.set(1, 1, 1); this.npcs.forEach(n => { n.g.visible = true; }); (this.labels || []).forEach(l => { if (l.base) l.sp.scale.copy(l.base); });
    const ctl = document.getElementById('fps-ctl'); if (ctl) ctl.style.visibility = ''; this.ui.ov.classList.add('hidden'); this.ui.root.classList.remove('ov-on'); this.ui.me.classList.remove('on'); this._cullT = 0;
    this.camera.position.set(this.px, this.groundH(this.px, this.pz) + 60, this.pz + 50);
  }
  stepOverview(dt, now) {
    const o = this.ov, cam = this.camera; let kx = 0, kz = 0; if (this.keys.KeyA || this.keys.ArrowLeft) kx -= 1; if (this.keys.KeyD || this.keys.ArrowRight) kx += 1; if (this.keys.KeyW || this.keys.ArrowUp) kz -= 1; if (this.keys.KeyS || this.keys.ArrowDown) kz += 1;
    o.cx += kx * o.h * 0.9 * dt; o.cz += kz * o.h * 0.9 * dt; o.cx = Math.max(-240, Math.min(240, o.cx)); o.cz = Math.max(-230, Math.min(230, o.cz));
    this._ovT = this._ovT || new THREE.Vector3(); cam.position.lerp(this._ovT.set(o.cx, o.h, o.cz + o.h * 0.62), 1 - Math.pow(0.86, dt * 60)); this._look = this._look || new THREE.Vector3(); this._lookT = this._lookT || new THREE.Vector3(); this._look.lerp(this._lookT.set(o.cx, 0, o.cz - o.h * 0.05), 1 - Math.pow(0.8, dt * 60)); cam.lookAt(this._look);
    const s = Math.max(1, o.h / 60), k = 0.5 + 0.5 * Math.sin(now / 300); this.meBeacon.position.set(this.px, this.groundH(this.px, this.pz), this.pz); this.meBeacon.scale.set(s, 1 + o.h / 200, s); this.meBeacon.children[1].scale.setScalar(1 + 0.3 * k);
    if (this.beacon && this.dest) this.beacon.scale.set(s * 0.8, 1 + o.h / 200, s * 0.8);
    // 이름표를 높이에 맞게 키움 (멀리서도 읽히게) · 시설·장소·구 이름만
    const m = Math.min(3, Math.max(1, o.h / 90)); if (Math.abs(m - (o.m || 0)) > 0.05) { o.m = m; (this.labels || []).forEach(l => { if (l.range < 190) return; if (!l.base) l.base = l.sp.scale.clone(); l.sp.scale.copy(l.base).multiplyScalar(l.always ? Math.min(2.2, m * 0.8) : m); }); }
    const p = this.toScreen(this.px, this.groundH(this.px, this.pz) + 8, this.pz), me = this.ui.me;   // '나' 이름표
    if (this.replay) { me.classList.remove('on'); this.meBeacon.visible = false; } else if (p.on) { this.meBeacon.visible = true; me.classList.add('on'); me.style.left = p.x.toFixed(0) + 'px'; me.style.top = p.y.toFixed(0) + 'px'; const lab = '나 · ' + ((this._loc && this._loc.short) || ''); if (me.lastChild.textContent !== lab) me.lastChild.textContent = lab; } else me.classList.remove('on');
  }
  // ── 물결 무늬 (강: 하류 쪽을 가리키는 물결 · 바다: 잔물결) ──
  waveTex(river) {
    const T = THREE, c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, river ? '#2F7DB3' : '#2A78B3'); gr.addColorStop(0.5, river ? '#4FA3D8' : '#3587C2'); gr.addColorStop(1, river ? '#2F7DB3' : '#2A78B3'); g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
    g.strokeStyle = 'rgba(255,255,255,.26)'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { const y0 = i * 19 + (i % 2) * 6; g.beginPath(); for (let x = 0; x <= 64; x += 4) { const y = y0 + Math.sin(x / 64 * Math.PI * 2 + i) * 3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    if (river) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.lineCap = 'round'; [40, 104].forEach(y => { g.beginPath(); g.moveTo(20, y + 8); g.lineTo(32, y - 4); g.lineTo(44, y + 8); g.stroke(); }); }   // ^ = 하류 쪽
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (this.hq !== 'low') t.encoding = T.sRGBEncoding; return t;
  }
  stepWater(dt, now) {
    const k = this.replay ? 0.35 + this.replay.speed * 0.25 : 0.3;
    (this.waterMats || []).forEach(w => { w.tex.offset.y -= w.sp * k * dt; }); if (this.seaTex) { this.seaTex.offset.x += 0.012 * dt; this.seaTex.offset.y += 0.006 * dt; }
    if (this.lamps) { const on = (this._night || 0) > 0.3 && (now % 1400) < 700; if (this.lamps[0] && this.lamps[0].visible !== on) this.lamps.forEach(l => { l.visible = on; }); }
  }
  // ── 낮과 밤: 게임 속 시각에 따라 하늘 · 해 · 안개 · 창문 불빛 ──
  setDayTime(h) { this._shDirty = true;
    const hour = ((h % 24) + 24) % 24, key = Math.round(hour * 30); if (key === this._dayKey) return; this._dayKey = key;
    if (this.real) return this.realDay(hour);
    const N = ['#0E1830', '#16223A', 0.16, '#9DB4FF', 0.45, '#7C8FB8', 1], K = [[0, ...N], [5, '#27325A', '#35416A', 0.22, '#A9B8FF', 0.5, '#8C9CC4', 0.85], [6.5, '#F2B58A', '#E8C3A6', 0.55, '#FFB27A', 0.72, '#E6D2C2', 0.25], [8, '#A9D3F0', '#BFDDF2', 1, '#FFF1D6', 1, '#EAF4FF', 0],
      [16, '#A9D3F0', '#BFDDF2', 1, '#FFE9C8', 1, '#EAF4FF', 0], [18, '#F0A070', '#E6B592', 0.62, '#FF9A5C', 0.78, '#F2D2BE', 0.35], [19.5, '#3A3D6C', '#4A4B78', 0.28, '#9A96FF', 0.55, '#8E93C8', 0.85], [21, ...N], [24, ...N]];
    let i = 0; while (i < K.length - 2 && hour >= K[i + 1][0]) i++; const A = K[i], B = K[i + 1], t = Math.max(0, Math.min(1, (hour - A[0]) / (B[0] - A[0]))), T = THREE;
    const col = (a, b) => { const c = new T.Color(a).lerp(new T.Color(b), t); if (this.hq !== 'low') c.convertSRGBToLinear(); return c; }, num = j => A[j] + (B[j] - A[j]) * t;
    if (this.scene.background && this.scene.background.isColor) this.scene.background.copy(col(A[1], B[1])); if (this.scene.fog) this.scene.fog.color.copy(col(A[2], B[2]));
    this.sun.intensity = this.baseSun * num(3); this.sun.color.copy(col(A[4], B[4])); this.hemi.intensity = this.baseHemi * num(5); this.hemi.color.copy(col(A[6], B[6]));
    this._night = num(7);
    if (this.aptMat) { const want = this._night > 0.05, M = this.aptMat; if (!!M.emissiveMap !== want) { M.emissiveMap = want ? this.winEm : null; M.emissive.set(want ? '#FFFFFF' : '#000000'); if (want && this.hq !== 'low') this.winEm.encoding = T.sRGBEncoding; M.needsUpdate = true; } M.emissiveIntensity = this._night * 0.95; }
    const ang = (hour - 13) / 12 * Math.PI * 0.6, o = this.baseSunOff, off = new T.Vector3(o.x * Math.cos(ang) - o.z * Math.sin(ang), o.y, o.x * Math.sin(ang) + o.z * Math.cos(ang));   // 해가 동쪽에서 서쪽으로
    if (this.sunOffset) this.sunOffset.copy(off); else this.sun.position.copy(off);
  }
  // ── 🎬 사건 재현: 보고서를 낸 뒤, 실제로 오염이 어떻게 퍼졌는지 하늘에서 빠르게 돌려 봄 ──
  startReplay() {
    if (!this.report || this.replay || this.gameOver) return; const C = this.C, P = UC_POL[C.pol], pt = ucPoint(C.point), F = UC_FAC[C.fac], T = THREE, water = P.path === 'water';
    this.closeDialog(); const r = this.replay = { water, speed: 1, play: true, objs: [], log: [] };
    const lin = c => { const x = new T.Color(c); if (this.hq !== 'low') x.convertSRGBToLinear(); return x; }, add = o => { o.userData.noShadow = true; this.scene.add(o); r.objs.push(o); return o; };
    const ring = (x, z, col) => { const m = add(new T.Mesh(new T.RingGeometry(3, 4.2, 28), new T.MeshBasicMaterial({ color: lin(col), transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide }))); m.rotation.x = -Math.PI / 2; m.position.set(x, this.groundH(x, z) + 0.6, z); return m; };
    let cx, cz, h;
    if (water) {
      const path = []; let river = pt.river, s0 = pt.s;
      for (let hop = 0; hop < 2 && river; hop++) { const R = UC_RIVERS[river], L = ucLen(R.pts); for (let s = s0; s <= L; s += 1.3) { const p = ucAt(R.pts, s); path.push({ river, s, x: p[0], z: p[1], w: R.w }); }
        if (R.joins) { const j = R.joins[0]; s0 = ucProject(UC_RIVERS[j].pts, ...R.pts[R.pts.length - 1]).s; river = j; } else river = null; }
      const xs = path.map(p => p.x), zs = path.map(p => p.z); cx = (Math.min(...xs) + Math.max(...xs)) / 2; cz = (Math.min(...zs) + Math.max(...zs)) / 2; h = Math.max(110, Math.min(380, Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * 1.3) * 1.05));
      const geo = new T.CircleGeometry(1, 18); geo.rotateX(-Math.PI / 2);
      r.dye = add(new T.InstancedMesh(geo, new T.MeshBasicMaterial({ transparent: true, opacity: 0.88, depthWrite: false }), path.length)); r.dye.frustumCulled = false; r.path = path;
      r.sensors = UC_BIO.filter(b => ucDownstream(pt.river, pt.s, b.river, b.s) >= 0).map(b => { const R = UC_RIVERS[b.river], p = ucAt(R.pts, b.s); return { name: '🦐 ' + b.name, river: b.river, s: b.s, m: ring(p[0], p[1], '#9AA3B5') }; });
      const last = path[path.length - 1]; r.sensors.push({ name: '🎣 하구(바다와 만나는 곳)', river: last.river, s: last.s - 2, m: ring(last.x, last.z, '#9AA3B5') });
      r.t = Math.max(18, Math.floor(C.t0) - 1); r.end = Math.min(46, Math.max(ucMouthArrive(C).h + 1.5, C.t0 + 6));
    } else {
      cx = pt.x; cz = pt.z + 10; h = 190; r.t = Math.max(18, Math.floor(C.t0) - 1); r.end = Math.min(36, C.t0 + C.dur + 3);
      const pc = { benzene: '#FF8C3A', toluene: '#C77DFF', h2s: '#D8F05A' }[C.pol] || '#FF8C3A';
      r.puff = add(new T.InstancedMesh(new T.SphereGeometry(1, 10, 8), new T.MeshBasicMaterial({ color: lin(pc), transparent: true, opacity: 0.5, depthWrite: false }), 240)); r.puff.frustumCulled = false; r.parts = []; r.emit = 0;
      r.sensors = UC_AIR.map(a => ({ name: '💨 ' + a.name, x: a.x, z: a.z, m: ring(a.x, a.z, '#9AA3B5') }));
      const ar = new T.Group(), am = new T.MeshBasicMaterial({ color: lin('#FFFFFF') }), sh = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 14, 10), am), hd = new T.Mesh(new T.ConeGeometry(2.6, 6, 12), am);   // 바람 화살표
      sh.rotation.z = -Math.PI / 2; sh.position.x = 7; hd.rotation.z = -Math.PI / 2; hd.position.x = 17; ar.add(sh, hd); ar.position.set(pt.x, this.groundH(pt.x, pt.z) + 26, pt.z); r.arrow = add(ar);
    }
    const bx = pt.kind === 'water' ? ucAt(UC_RIVERS[pt.river].pts, pt.s) : [pt.x, pt.z]; r.src = { x: bx[0], z: bx[1] };
    const bc = add(new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 120, 16, 1, true), new T.MeshBasicMaterial({ color: lin('#FF4D5E'), transparent: true, opacity: 0.4, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }))); bc.position.set(bx[0], this.groundH(bx[0], bx[1]) + 60, bx[1]); r.srcBeam = bc;
    r.start = r.t; r.srcName = '🏭 ' + F.name.split(' (')[0] + ' ' + pt.label;
    this.enterOverview({ quiet: true, cx, cz, h }); this.ui.root.classList.add('rp-on'); this.ui.rp.classList.remove('hidden'); this.ui.rpLab.classList.add('on');
    this.ui.rpLog.innerHTML = '<span>' + (water ? '💧 ' + ucJ(P.name, '이', '가') + ' 강을 따라 하류로 퍼지는 모습 · 진할수록 빨강·보라' : '💨 ' + ucJ(P.name, '이', '가') + ' 바람을 타고 퍼지는 모습 · 화살표 = 그 시각 바람') + '</span>';
  }
  replayEvent(txt) { const r = this.replay; r.log.push(txt); this.ui.rpLog.innerHTML = r.log.slice(-2).map(x => '<span>' + x + '</span>').join(''); }
  stepReplay(dt) {
    const r = this.replay, C = r.C = r.C || Object.assign({}, this.C, { decoys: [] }), P = UC_POL[C.pol], T = THREE;   /* 범인 배출만 보여 줌 */ const dg = r.play ? Math.min(0.2, dt) * 1.1 * r.speed : 0; r.t = Math.min(r.end, r.t + dg); if (r.t >= r.end && r.play) { r.play = false; this.ui.rpPlay.textContent = '⟲ 다시'; }
    this.setDayTime(r.t);
    const tA = r.lastT != null && r.lastT <= r.t ? r.lastT : r.t, sub = f => { const n = Math.max(1, Math.min(400, Math.ceil((r.t - tA) / 0.04))); for (let k = 1; k <= n; k++) f(tA + (r.t - tA) * k / n); };   // 센서 확인은 지난 장면~지금 사이를 잘게 (느린 기기·빠른 재생에서 건너뛰지 않게)
    if (!r.began && r.t >= C.t0) { r.began = true; this.replayEvent('💥 ' + ucHm(C.t0).replace(/쯤$/, '') + ' ' + r.srcName + '에서 ' + P.name + ' 배출 시작'); }
    if (r.began && !r.stopped && r.t >= C.t0 + C.dur) { r.stopped = true; this.replayEvent('⏹ ' + ucHm(C.t0 + C.dur).replace(/쯤$/, '') + ' 배출 멈춤 (약 ' + C.dur.toFixed(1) + '시간)'); }
    const m4 = this._m4 = this._m4 || new T.Matrix4(), col = this._rc2 = this._rc2 || new T.Color(), cA = new T.Color('#FFE14D'), cB = new T.Color('#FF3B3B'), cC = new T.Color('#8E2DE2');
    if (this.hq !== 'low') [cA, cB, cC].forEach(c => c.convertSRGBToLinear());
    if (r.water) {
      r.path.forEach((p, i) => { const c = ucWaterConc(C, C.pol, p.river, p.s, r.t), k = Math.max(0, Math.min(1, (c - P.base) / (P.peak * 0.55))), sc = k > 0.012 ? p.w * 0.5 * (0.6 + 0.5 * k) : 0.0001;
        m4.makeScale(sc, 1, sc).setPosition(p.x, -0.12, p.z); r.dye.setMatrixAt(i, m4); if (k < 0.5) col.copy(cA).lerp(cB, k * 2); else col.copy(cB).lerp(cC, (k - 0.5) * 2); r.dye.setColorAt(i, col); });
      r.dye.instanceMatrix.needsUpdate = true; if (r.dye.instanceColor) r.dye.instanceColor.needsUpdate = true;
      sub(tt => r.sensors.forEach(s => { if (s.hit) return; const c = ucWaterConc(C, C.pol, s.river, s.s, tt); if (c > P.base * 3) { s.hit = true; s.m.material.color.copy(cB); this.replayEvent(s.name + ' — ' + ucHm(tt).replace(/쯤$/, '') + ' 도착'); } }));
    } else {
      const w = C.wind[Math.max(0, Math.min(C.wind.length - 1, Math.floor(r.t) - 18))], pt = ucPoint(C.point), on = r.t >= C.t0 && r.t <= C.t0 + C.dur, v = 16 + w.spd * 9;
      r.arrow.rotation.y = -w.dir; r.arrow.scale.setScalar(0.6 + w.spd * 0.22);
      if (on) { r.emit += dg * 70; while (r.emit >= 1) { r.emit -= 1; if (r.parts.length < 240) r.parts.push({ x: pt.x, z: pt.z, y: this.groundH(pt.x, pt.z) + 16, age: 0, j: (Math.random() - 0.5) }); } }
      r.parts.forEach(q => { q.age += dg; const ww = C.wind[Math.max(0, Math.min(C.wind.length - 1, Math.floor(r.t) - 18))]; q.x += (Math.cos(ww.dir) * v - Math.sin(ww.dir) * q.j * 6) * dg; q.z += (Math.sin(ww.dir) * v + Math.cos(ww.dir) * q.j * 6) * dg; q.y += dg * 3; });
      r.parts = r.parts.filter(q => q.age < 3.6);
      for (let i = 0; i < 240; i++) { const q = r.parts[i], sc = q ? (2 + q.age * 6) * (q.age > 2.8 ? (3.6 - q.age) / 0.8 : 1) : 0.0001; m4.makeScale(sc, sc * 0.6, sc).setPosition(q ? q.x : 0, q ? q.y : -50, q ? q.z : 0); r.puff.setMatrixAt(i, m4); }
      r.puff.instanceMatrix.needsUpdate = true;
      sub(tt => r.sensors.forEach(s => { if (s.hit) return; if (ucAirConc(C, C.pol, s.x, s.z, tt) > P.base * 5) { s.hit = true; s.m.material.color.copy(cB); this.replayEvent(s.name + ' — ' + ucHm(tt).replace(/쯤$/, '') + ' 냄새 기준 넘음'); } }));
    }
    r.lastT = r.t; r.sensors.forEach(s => { if (s.hit) s.m.scale.setScalar(1 + 0.25 * Math.sin((this.now || 0) / 180)); }); r.srcBeam.material.opacity = r.began && !r.stopped ? 0.35 + 0.25 * Math.sin((this.now || 0) / 150) : 0.22;
    const U = this.ui, clk = ucHm(r.t).replace(/쯤$/, ''); if (U.rpClock.textContent !== clk) U.rpClock.textContent = clk; U.rpBar.style.width = ((r.t - r.start) / (r.end - r.start) * 100).toFixed(1) + '%';
    const p = this.toScreen(r.src.x, this.groundH(r.src.x, r.src.z) + 10, r.src.z); U.rpLab.style.display = p.on ? '' : 'none'; if (p.on) { U.rpLab.style.left = p.x.toFixed(0) + 'px'; U.rpLab.style.top = p.y.toFixed(0) + 'px'; if (U.rpLab.textContent !== r.srcName) U.rpLab.textContent = r.srcName; }
  }
  replayRestart() { const r = this.replay; if (!r) return; r.t = r.start; r.play = true; r.began = r.stopped = false; r.log = []; if (r.parts) r.parts = []; r.sensors.forEach(s => { s.hit = false; s.m.scale.setScalar(1); s.m.material.color.set('#9AA3B5'); if (this.hq !== 'low') s.m.material.color.convertSRGBToLinear(); }); this.ui.rpPlay.textContent = '⏸'; this.ui.rpLog.innerHTML = ''; }
  stopReplay() {
    const r = this.replay; if (!r) return; r.objs.forEach(o => { this.scene.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }); this.replay = null;
    this.ui.root.classList.remove('rp-on'); this.ui.rp.classList.add('hidden'); this.ui.rpLab.classList.remove('on'); this.exitOverview(); this._dayKey = null; this.setDayTime(this.nowH);
    if (this.report && !this.gameOver) this.showResult(this.report);
  }
  ovZoom(f) { if (!this.ov) return; this.ov.h = Math.max(70, Math.min(420, this.ov.h * f)); }
  bindOverview() {
    const ov = this.ui.ov; let drag = null, pin = null; const pts = new Map();
    ov.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; pts.set(e.pointerId, [e.clientX, e.clientY]); try { ov.setPointerCapture(e.pointerId); } catch (er) {}
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pin = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), h: this.ov.h }; drag = null; } else drag = { x: e.clientX, y: e.clientY, cx: this.ov.cx, cz: this.ov.cz, moved: false }; });
    ov.addEventListener('pointermove', e => { if (!this.ov || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pin && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); this.ov.h = Math.max(70, Math.min(420, pin.h * pin.d / Math.max(20, d))); return; }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved) { const k = this.ov.h * 2 * Math.tan(this.camera.fov * Math.PI / 360) / (this.vh || 600) * 1.15; this.ov.cx = drag.cx - dx * k; this.ov.cz = drag.cz - dy * k * 1.3; } });
    const up = e => { const d = drag; pts.delete(e.pointerId); if (pts.size < 2) pin = null; drag = null; if (!d || d.moved || !this.ov) return;
      const r = this.glCanvas.getBoundingClientRect(), rc = this._rc = this._rc || new THREE.Raycaster(); rc.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, this.camera);
      const hit = rc.intersectObject(this.ground)[0]; if (!hit) return; let best = null, bd = Math.max(14, this.ov.h * 0.09);
      this.mapSpots().forEach(s => { const q = Math.hypot(s[1] - hit.point.x, s[2] - hit.point.z); if (q < bd) { bd = q; best = s; } });
      if (!best) { this.toast('장소·시설·센서 가까이를 눌러 주세요'); return; } if (this.dest && (this.dest.key === best[3] || this.dest.name === best[0])) { this.setDest(null); this.toast('📍 목적지를 지웠어요'); } else this.setDest(best[1], best[2], best[0], false, best[3]); };
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', e => { pts.delete(e.pointerId); drag = null; pin = null; });
    ov.addEventListener('wheel', e => { e.preventDefault(); this.ovZoom(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
    ov.querySelectorAll('[data-ov]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.ov; if (a === 'in') this.ovZoom(0.75); if (a === 'out') this.ovZoom(1.33); if (a === 'me') { this.ov.cx = this.px; this.ov.cz = this.pz; } if (a === 'back') this.exitOverview(); }));
  }
  openReport() {
    if (this.report || this.gameOver) return;
    const opt = list => '<option value="">— 고르세요 —</option>' + list.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('');
    const ev = this.evidence.filter(e => e.id !== 'case'), D = this.draft, water = UC_POL[this.C.pol].path === 'water', g = this.set.guide;
    const tips = g === 'none' ? {} : water
      ? { '①': '⚗️ 시약 실험으로 짐작 → 📊 분석 결과에서 기준을 넘은 물질', '②': '🔬 독성 지도에서 독성이 시작되는 배출구의 시설 — 소문만으로는 못 정해요', '③': '독성 지도: 바로 아래는 독하고 바로 위는 깨끗한 ▼배출구', '④': '⏪ 시간 되감기(거리 ÷ 빠르기) · 💂 경비원이 들은 소리 · 🗂 서류의 빈 기록(폐수 방류구만)이 맞는 시각' }
      : { '①': '⚗️ 검지관으로 짐작 → 📊 공기 시료 분석에서 평소보다 크게 높은 물질', '②': '🧭 바람길 후보 중 ① 물질을 쓰고, 냄새가 난 무렵 연기를 뿜은 굴뚝이 있는 시설 — 소문만으로는 못 정해요', '③': '서류의 빈 기록(큰 굴뚝만) · 💂 경비원이 본 연기 · 🛸 드론 열화상이 가리키는 굴뚝', '④': '냄새가 처음 치솟은 시각 · 경비원이 본 시각' };
    const row = (n, t, sel) => '<label class="f-row"><i>' + n + '</i><span>' + t + '</span>' + sel + '</label>' + (tips[n] ? '<p class="f-tip">💡 ' + tips[n] + '</p>' : '');
    const polOpts = Object.keys(UC_POL).filter(k => UC_POL[k].path === (water ? 'water' : 'air')).concat(Object.keys(UC_POL).filter(k => UC_POL[k].path !== (water ? 'water' : 'air')));   // 이번 사건 종류(물·공기) 물질을 먼저
    const body = '<p class="dim">보고서는 한 번만 낼 수 있어요. 고른 답은 저장돼서 창을 닫았다 열어도 그대로예요. 시간이 다 되면 지금 고른 답으로 자동 제출돼요.</p>' +
      row('①', '오염물질', '<select data-k="pol">' + opt(polOpts.map(k => [k, UC_POL[k].name + ' — ' + UC_POL[k].desc])) + '</select>') +
      row('②', '시설', '<select data-k="fac">' + opt(Object.keys(UC_FAC).map(k => [k, UC_FAC[k].name])) + '</select>') +
      row('③', water ? '배출구' : '배출 지점', '<select data-k="point"></select>') +
      row('④', '배출 시간대', '<select data-k="slot">' + opt(UC_SLOTS.map((t, i) => [i, t])) + '</select>') +
      '<p class="f-ev"><b>⑤ 답을 고른 이유가 된 증거 (최대 3개)</b> <span class="dim u-evn"></span></p><div class="u-evs">' + (ev.length ? ev.map(e => '<label><input type="checkbox" data-ev="' + e.id + '"' + ((D.ev || []).indexOf(e.id) >= 0 ? ' checked' : '') + '> ' + e.title + '</label>').join('') : '<p class="dim">아직 증거가 없어요</p>') + '</div>';
    let sure = 0;
    this.dialog('📝', '수사 보고서', body, [['제출하기', () => { this.saveDraft(); const D2 = this.draft || {}, blank = ['pol', 'fac', 'point', 'slot'].filter(k => D2[k] === '' || D2[k] == null).length;
      if (blank && Date.now() - sure > 6000) { sure = Date.now(); this.toast('아직 빈 칸이 ' + blank + '개 있어요 — 그래도 내려면 제출하기를 한 번 더 누르세요'); const b = this.ui.dlg.querySelector('.u-opts button'); if (b) b.textContent = '빈 칸이 있어도 제출하기'; return; }   // 보고서는 한 번만 낼 수 있어서
      this.submit(this.draftReport()); }], ['닫기 (답은 저장돼요)', () => { this.saveDraft(); this.closeDialog(); }]], true);
    const dl = this.ui.dlg, q = k => dl.querySelector('[data-k=' + k + ']'); dl.querySelector('.u-opts button').className = 'primary';
    // ③ 배출 지점: ②에서 고른 시설의 배출구·굴뚝만 (시설을 안 골랐으면 모두 · 시설 이름과 함께) — 고르면 ②도 그 시설로 (v2026-10-19a · 예전엔 서류로 확인한 곳만 골랐고 ②·③을 따로 맞춰야 했음)
    const fillPts = keep => { const f = q('fac').value, cur = keep != null ? keep : q('point').value, list = [];
      Object.keys(UC_FAC).forEach(k => { if (f && k !== f) return; const F = UC_FAC[k]; F.outs.concat(F.stacks).forEach(o => list.push([o.id, o.id + ' · ' + (f ? '' : ucFacShort(F) + ' ') + o.label + (this.known[o.id] ? '' : ' (아직 확인 안 함)')])); });
      q('point').innerHTML = opt(list); if (list.some(x => x[0] === cur)) q('point').value = cur; };
    ['pol', 'fac', 'slot'].forEach(k => { const el = q(k); if (D[k] != null && [...el.options].some(o => o.value === String(D[k]))) el.value = String(D[k]); });
    fillPts(D.point || '');
    const mark = () => ['pol', 'fac', 'point', 'slot'].forEach(k => q(k).closest('.f-row').classList.toggle('set', q(k).value !== ''));
    q('fac').addEventListener('change', () => { fillPts(); mark(); this.saveDraft(); });
    q('point').addEventListener('change', () => { const pt = q('point').value && ucPoint(q('point').value); if (pt && q('fac').value !== pt.fac) { q('fac').value = pt.fac; fillPts(pt.id); } mark(); this.saveDraft(); });
    ['pol', 'slot'].forEach(k => q(k).addEventListener('change', () => { mark(); this.saveDraft(); })); mark();
    const evn = dl.querySelector('.u-evn'), cnt = () => { const n = dl.querySelectorAll('[data-ev]:checked').length; evn.textContent = n + '/3 골랐어요'; return n; }; cnt();
    dl.querySelectorAll('[data-ev]').forEach(b => b.addEventListener('change', () => { if (cnt() > 3) { b.checked = false; cnt(); this.toast('증거는 3개까지 고를 수 있어요'); } this.saveDraft(); }));
  }
  // 보고서 창에 고른 값을 저장 (창이 열려 있을 때만 읽음)
  saveDraft() {
    const dl = this.ui.dlg; if (!this.ui.modalOpen || !dl.querySelector('[data-k=pol]')) return;
    const v = k => dl.querySelector('[data-k=' + k + ']').value;
    this.draft = { pol: v('pol'), fac: v('fac'), point: v('point'), slot: v('slot'), ev: [...dl.querySelectorAll('[data-ev]:checked')].map(b => b.dataset.ev).slice(0, 3) }; this._dirty = true;
  }
  draftReport(auto) { const D = this.draft || {}; return { pol: D.pol || '', fac: D.fac || '', point: D.point || '', slot: D.slot === '' || D.slot == null ? -1 : +D.slot, evidence: (D.ev || []).map(id => this.evidence.find(e => e.id === id)).filter(Boolean).slice(0, 3), auto: !!auto }; }
  // 시간이 다 됨: 열려 있는 창을 닫고(보고서 창이면 고른 값 저장) 그때까지의 답으로 제출
  autoSubmit() { if (this.report || this.gameOver) return; if (this.ov) this.exitOverview(); this.saveDraft(); this.closeDialog(); this.submit(this.draftReport(true)); }
  submit(rep) {
    this._leftAtSubmit = this.caseLeftSec;
    const r = ucScore(this.C, rep); r.auto = !!rep.auto; r.bonus = this.caseBonus ? this.caseBonus() : 0; r.score += r.bonus; this.report = r; this.results.push(r); this.score = this.results.reduce((a, x) => a + x.score, 0);   // ⭐ 별점 보너스 (미니게임 · 추격) — 등급은 보너스 빼고
    if (this.done) this.doneAt = Date.now();
    this.save(); this.showResult(r);
  }
  // 결과 창 (새로고침 뒤에도 다시 보여 줄 수 있게 따로)
  showResult(r) {
    const C = this.C, P = UC_POL[C.pol], pt = ucPoint(C.point), F = UC_FAC[C.fac], ox = b => b ? '<b class="ok">✓</b>' : '<b class="no">✗</b>';
    const Hh = h => ucHm(Math.floor(h * 6) / 6).replace(/쯤$/, ''), places = new Set(ucNightEvents(C).map(e => e.point)).size;
    const trap = (places > 1 ? '서류 · 경비원 · 드론이 가리킨 \'이상한 시각\'은 ' + places + '곳이었어요 (나머지는 계측기 고장) — 오염과 시각이 모두 맞는 곳은 한 곳뿐이었어요. ' : '') + (C.noRumor ? '' : '활동가가 지목한 ' + ucJ(UC_FAC[C.rumor].name, '은', '는') + (C.rumor === C.fac ? ' 이번엔 범인이 맞았지만' : ' 범인이 아니었어요 —') + ' 소문은 증거가 아니에요. ') + (C.decoys.length ? '몇몇 시설의 낮은 평소 배출(기준 안)도 섞여 있었어요 — 평소값·기준과 비교해야 해요.' : '');
    const nm = ucFacShort(F), bio = ucNightEvents(C).length > 1;
    const how = P.path === 'water' ? '① ⚗️ 시약 실험과 분석 결과에서 ' + ucJ(P.name, '이', '가') + ' 기준을 넘었어요. ②③ 그 물질을 쓰는 시설은 여럿이었지만, 🔬 독성 지도에서 ▼' + pt.id + ' 바로 위 물은 깨끗하고 바로 아래부터 독했어요 → ' + nm + '. ④ ' + nm + ' 서류에서 ' + Hh(C.t0) + ' 무렵 ' + pt.id + ' 기록이 비어 있었어요' + (bio ? ' (다른 곳의 빈 기록은 계측기 고장)' : '') + ' — 하류 물벼룩 센서 · 어민이 본 시각에서 <b>거리 ÷ 흐름 빠르기</b>를 빼도 같은 시각이 나와요.'
      : '① ⚗️ 검지관과 공기 시료 분석에서 ' + ucJ(P.name, '이', '가') + ' 평소보다 크게 높았어요. ② 🧭 바람길: 냄새가 치솟은 센서들에서 바람을 거슬러 그은 선이 ' + nm + ' 쪽으로 모였고, 그 물질을 쓰는 곳이에요. ③④ 냄새가 처음 난 ' + Hh(C.t0) + ' 무렵, 서류에서 ' + pt.id + ' 굴뚝 자동측정 기록이 끊겨 있었어요.';
    const rows = [['오염물질', r.pol, P.name, 20], ['시설', r.fac, F.name, 25], ['배출 지점', r.point, pt.id + ' ' + pt.label, 20], ['배출 시각', r.time, Hh(C.t0) + '부터 약 ' + C.dur.toFixed(1) + '시간 (' + UC_SLOTS[ucSlot(C.t0)] + ')', 15]];
    const body = (r.auto ? '<p class="autosub">⏰ 시간이 다 되어 그때까지 고른 답으로 자동 제출했어요.</p>' : '') + '<div class="u-grade g-' + r.grade + '">' + r.grade + '<small>' + r.score + '점</small></div>' +
      '<table class="u-res">' + rows.map((x, i) => '<tr style="--d:' + (0.5 + i * 0.18).toFixed(2) + 's"><th>' + x[0] + '</th><td>' + ox(x[1]) + ' ' + x[2] + '</td><td class="pt">' + (x[1] ? '+' + x[3] : '0') + '</td></tr>').join('') +
      '<tr style="--d:1.22s"><th>결정적 증거</th><td>' + r.keys + ' / 3</td><td class="pt">+' + Math.round(r.keys / 3 * 20) + '</td></tr>' + (r.bonus ? '<tr style="--d:1.4s"><th>⭐ 별점 보너스</th><td>미니게임 별 ' + r.bonus + '개</td><td class="pt">+' + r.bonus + '</td></tr>' : '') + '</table>' +
      '<p><b>이렇게 찾을 수 있었어요</b><br>' + how + '</p>' + (trap ? '<p class="dim">함정: ' + trap + '</p>' : '');
    const last = this.done;
    this.dialog('🏁', '사건 ' + this.caseNo + ' 수사 결과', body, [[last ? '🏆 최종 결과 보기' : '다음 사건으로 ▸ (' + (this.caseNo + 1) + '/' + this.caseTotal + ')', () => { this.closeDialog(); if (last) this.finalReport(); else this.startCase(this.caseNo + 1); }],
      ['🎬 사건 재현 보기 — 실제로 어떻게 퍼졌는지 하늘에서', () => this.startReplay()]], true);
    this.ui.dlg.querySelector('.u-opts button').className = 'primary';
  }
  finalReport() {
    const m = Math.floor(this.elapsedSec / 60), sec = this.elapsedSec % 60;
    const rows = this.results.map((r, i) => '<tr style="--d:' + (0.5 + i * 0.2).toFixed(2) + 's"><th>사건 ' + (i + 1) + '</th><td><b class="gr g-' + r.grade + '">' + r.grade + '</b> ' + r.score + '점 ' + (r.fac && r.point ? '✅ 오염원 확인' : '') + (r.auto ? ' ⏰' : '') + '</td></tr>').join('');
    this.dialog('🏆', '수사 완료 — 최종 결과', '<div class="u-grade g-final">' + this.score + '<small>' + (this.caseTotal * 100) + '점 만점 · 해결 ' + this.solvedCount + '/' + this.caseTotal + ' · 걸린 시간 ' + m + '분 ' + sec + '초 · ' + this.set.name + '</small></div><table class="u-res">' + rows + '</table><p class="dim">순위는 선생님 화면에서 총점 → 걸린 시간 순으로 매겨져요.</p>',
      [['마치기', () => { this.closeDialog(); this.finished = true; this.gameOver = true; this.save(); }]], true);
    this.ui.dlg.querySelector('.u-opts button').className = 'primary';
  }
}
// 장소 아이콘 · 장소 목록에 적는 '여기서 알 수 있는 것' (사람 id · 설명) — v2026-10-19a
UlsanRpgGame.PLACE_MINI = { lab: '연구원', weather: '기상대', clinic: '보건소', garden: '국가정원', riverOffice: '하천관리소', port: '울산항', onsanHarbor: '어촌계', mouth: '선착장' };
UlsanRpgGame.PLACE_ICON = { lab: '🔬', weather: '🌤️', clinic: '🏥', garden: '🌷', riverOffice: '🚩', port: '⚓', onsanHarbor: '🎣', mouth: '⛵' };
UlsanRpgGame.PLACE_INFO = {
  lab: ['researcher', '가져온 물·공기 시료를 분석해 무슨 물질인지 알려 줘요 · 🔬 물벼룩 · ⚗️ 시약 실험'],
  weather: ['forecaster', '어젯밤 시간별 바람 방향 (냄새 사건에 꼭 필요) · 🧭 바람길 그리기'],
  clinic: ['doctor', '오늘 아침 아파서 온 사람들의 증상 (물질 힌트)'],
  riverOffice: ['riverman', '강물이 흐르는 빠르기 · 🛸 밤 드론 사진 · ⏪ 시간 되감기'],
  garden: ['resident', '밤사이 냄새 · 강물 이야기'],
  mouth: ['fisherT', '태화강·동천이 바다와 만나는 곳의 물고기 소식'],
  port: ['fisherP', '여천천이 바다와 만나는 곳의 물고기 소식'],
  onsanHarbor: ['fisherO', '외황강·회야강이 바다와 만나는 곳의 물고기 소식']
};
// 벽에 막혔을 때 시도하는 방향 (가려는 쪽 · 20° · 40° · 60° 비스듬히 — 속도는 벽을 따라 나아가는 만큼)
// 점프: 사람 키 2.2칸 · 허리 높이(1.2칸) 이하 구조물까지 넘음 · 꼭대기 약 1.45칸(느린 기기도 1.2칸은 넘게 여유) · 공중 약 0.6초
UlsanRpgGame.JUMP_CLEAR = 1.2; UlsanRpgGame.JUMP_G = 32; UlsanRpgGame.JUMP_V = Math.sqrt(2 * 32 * 1.55);
UlsanRpgGame.FAN = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05].map(a => [Math.cos(a), Math.sin(a), Math.cos(a)]);
if (typeof window !== 'undefined') window.UlsanRpgGame = UlsanRpgGame;
