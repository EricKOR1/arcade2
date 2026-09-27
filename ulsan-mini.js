// 울산 환경 수사대 3D — 수사와 이어진 미니게임 (결과마다 '🔎 보고서 단서' — 어느 답을 좁히는지: ①물질 ②시설 ③배출 지점 ④배출 시각)
//   🎣 낚시 어류 조사 (강가): 물고기 증상 → ① 후보 둘 (증상은 여러 물질이 비슷해요) · 상류/하류 비교 → ③ · 떠내려가는 죽은 물고기를 건져 죽은 지 몇 시간인지 → ④
//   🔬 물벼룩 독성 시험 (연구원): 시료 독성 · 🗺 강을 따라 그린 독성 지도(▼ 알고 있는 배출구와 함께) → ③
//   🛶 종이배 흐름 속도 (강가): 2 m 를 흘러가는 시간 → 흐름 속도 (강가는 느리고 물살 가운데가 빠름) → ④ 계산에 씀
//   ⏪ 시간 되감기 (하천관리소 · 🛶 뒤): 도착 기록(바이오센서·어민·죽은 물고기)에서 오염을 강 위로 끌어 배출구에 대면 떠난 시각 → ④ ③
//   ⚗️ 시약 실험 (연구원): 물 시료 = 시약 5가지 색 비교표 · 공기 시료 = 검지관 3가지 눈금 읽기 → ① 후보 (비슷한 물질에도 반응 → 📊 연구원 분석으로 확인)
//   🛸 드론 열화상 (하천관리소): 평소 밤 사진 ↔ 어젯밤 사진 틀린 그림 찾기 (뜨거운 폐수·연기 — 범인 것인지 계측기 고장 때 흘려보낸 깨끗한 물인지는 다른 증거로) → ②③④ 후보
//   🧭 바람길 거꾸로 (기상대): 냄새 난 센서에서 그 시각 바람을 거슬러 선 긋기 → 선이 모이는 근처 굴뚝 후보 · 처음 냄새 난 시각 → ② ④ 후보
//   화면: 3D 위에 뜨는 창(캔버스) · 누르기/떼기 · 끌기로 조작(터치 · 마우스 · Space/E) · 미니게임 중엔 3D 를 멈춰 가벼움
(function () {
  if (typeof UlsanRpgGame === 'undefined') return;
  const P = UlsanRpgGame.prototype;
  const SND = k => { try { if (window.Sound && Sound[k]) Sound[k](); } catch (e) {} };
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixC = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  const wrapText = (g, text, x, y, maxW, lh) => { let line = '', yy = y; for (const ch of text) { const t = line + ch; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = ch; yy += lh; } else line = t; } if (line) g.fillText(line, x, yy); return yy + lh; };
  const H = h => ucHm(h).replace(/쯤$/, '');                                            // '오늘 새벽 3시 20분'
  const spanTxt = (a, b) => { const A = H(a), B = H(b), m = /^(어제 오전|어제 오후|어제 저녁|어젯밤|오늘 새벽|오늘 아침|오늘 오전|오늘 오후|오늘 저녁|오늘 밤|내일 새벽|내일 아침|내일) /.exec(B); return A + ' ~ ' + (m && A.indexOf(m[1]) === 0 ? B.slice(m[0].length) : B); };
  const hintBox = rows => rows.length ? '<div class="mg-hint"><b>🔎 보고서 단서</b>' + rows.map(([n, t]) => '<p><i>' + n + '</i>' + t + '</p>').join('') + '</div>' : '';
  const short = F => F.name.split(' (')[0];
  const card = (g, x, y, w, h, k) => { g.globalAlpha = k; rr(g, x, y, w, h, 16); g.fillStyle = 'rgba(16,21,31,.95)'; g.fill(); g.strokeStyle = 'rgba(245,196,81,.7)'; g.lineWidth = 2; g.stroke(); };
  const txt = (g, s, x, y, font, color, align) => { g.font = font; g.fillStyle = color; g.textAlign = align || 'center'; g.fillText(s, x, y); };
  const F9 = n => '900 ' + n + 'px Pretendard, sans-serif', F8 = n => '800 ' + n + 'px Pretendard, sans-serif', F7 = n => '700 ' + n + 'px Pretendard, sans-serif', F6 = n => '600 ' + n + 'px Pretendard, sans-serif';
  const fitF = (g, s, F, n, maxW) => { g.font = F(n); const w = g.measureText(s).width; return w <= maxW ? F(n) : F(Math.max(10, Math.floor(n * maxW / w * 10) / 10)); };   // 칸보다 길면 글자를 줄여 맞춤
  // 미니게임에서 모은 것 (저장·복원됨): 물벼룩 시험 · 잰 흐름 속도 · 죽은 물고기 · 본 드론 사진
  P.miniState = function () { const M = this.mini = this.mini || {}; M.dtests = M.dtests || []; M.speeds = M.speeds || {}; M.dead = M.dead || []; M.drone = M.drone || []; return M; };
  // 흐름 속도: 🛶 로 잰 값이 있으면 그것 · 없으면 하천관리원에게 들은 값 · 둘 다 없으면 모름
  P.riverSpeed = function (rid) { const M = this.miniState(); if (M.speeds[rid]) return { v: M.speeds[rid].kmh, src: '🛶 종이배로 잰 값' }; if (this.talked && this.talked.riverman) return { v: UC_RIVERS[rid].speed, src: '하천관리원에게 들은 값' }; return null; };
  // 사람 대화창에 붙는 미니게임 단추
  P.talkExtra = function (id) {
    if (id === 'riverman') return [['🛸 야간 드론 열화상 사진', () => this.droneMenu()], ['⏪ 시간 되감기', () => this.rewindMenu()]];
    if (id === 'forecaster') return [['🧭 바람길 거꾸로 그리기', () => this.startWind()]];
    return [];
  };

  // ── 공용 미니게임 창: 캔버스 + 안내 줄 + 큰 행동 버튼 (누르기/떼기 · 캔버스는 끌기도) ──
  P.mgOpen = function (o) {
    this.dialog(o.emoji, o.title, '<div class="mg-top"><span class="mg-sub"></span><span class="mg-cnt"></span></div><div class="mg-wrap"><canvas class="mg-cv"></canvas></div><div class="mg-tip"></div>',
      [[o.act || '시작', () => {}], ['그만두기', () => this.closeDialog()]], false, 'game');
    const box = this.ui.dlg, cv = box.querySelector('.mg-cv'), btn = box.querySelector('.u-opts button');
    btn.className = 'primary mg-act';
    const m = this.mg = Object.assign(o, { cv, g: cv.getContext('2d'), btn, subEl: box.querySelector('.mg-sub'), cntEl: box.querySelector('.mg-cnt'), tipEl: box.querySelector('.mg-tip'), held: false, last: 0, W: 0, H: 0 });
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const down = (e, p) => { if (e && e.cancelable) e.preventDefault(); if (m.held || this.mg !== m) return; m.held = true; if (m.down) m.down(p); };
    const up = p => { if (!m.held || this.mg !== m) return; m.held = false; if (m.up) m.up(p || null); };
    cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (x) {} down(e, pos(e)); });
    cv.addEventListener('pointermove', e => { if (m.held && m.move && this.mg === m) m.move(pos(e)); });
    btn.addEventListener('pointerdown', e => { try { btn.setPointerCapture(e.pointerId); } catch (x) {} down(e, null); });
    cv.addEventListener('pointerup', e => up(pos(e))); btn.addEventListener('pointerup', () => up(null));
    [cv, btn].forEach(el => { el.addEventListener('pointercancel', () => up(null)); el.addEventListener('lostpointercapture', () => up(null)); });
    m.key = (e, isDown) => { if (e.code !== 'Space' && e.code !== 'KeyE' && e.code !== 'Enter') return; e.preventDefault(); if (isDown) { if (!e.repeat) down(null, null); } else up(null); };
    m.tip = t => { if (m.tipEl.textContent !== t) m.tipEl.textContent = t; };
    m.act = t => { if (m.btn.textContent !== t) m.btn.textContent = t; };
    m.sub = t => { if (m.subEl.textContent !== t) m.subEl.textContent = t; };
    m.cnt = t => { if (m.cntEl.textContent !== t) m.cntEl.textContent = t; };
    this.draw();   // 뒤 3D 장면을 한 번 그려 둠 (미니게임 중엔 3D 를 다시 그리지 않음)
    return m;
  };
  P.mgFrame = function (now) {
    const m = this.mg; if (!m) return; const cv = m.cv, W = cv.clientWidth, H2 = cv.clientHeight; if (W < 20 || H2 < 20) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H2 * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H2 * dpr); }
    const dt = m.last ? Math.min(0.05, Math.max(0, (now - m.last) / 1000)) : 0.016; m.last = now; m.W = W; m.H = H2; m.dpr = dpr;
    m.g.setTransform(dpr, 0, 0, dpr, 0, 0); m.frame(dt, now / 1000, m.g, W, H2);
  };
  P.mgEnd = function () { const m = this.mg; if (!m) return; this.mg = null; if (m.onClose) try { m.onClose(); } catch (e) {} };

  // 물고기 그림 (머리가 오른쪽 · L = 몸길이 px) · eye: 'clear'|'cloudy'|'sunken' · bloat: 배가 부풂 · film: 몸에 끈적한 막
  function drawFish(g, x, y, L, F, o) {
    o = o || {}; const h = L * 0.27; g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); if (o.flip) g.scale(-1, 1); if (o.belly) g.scale(1, -1); if (o.bloat) g.scale(1, 1.16);
    const c1 = o.pale ? mixC(F.c1, '#A9ADA6', 0.55) : F.c1, c2 = o.pale ? mixC(F.c2, '#C9CCC4', 0.4) : F.c2;
    g.fillStyle = c1; g.beginPath(); g.moveTo(-L * 0.4, 0); g.lineTo(-L * 0.62, -h * 0.8); g.quadraticCurveTo(-L * 0.53, 0, -L * 0.62, h * 0.8); g.closePath(); g.fill();   // 꼬리
    g.globalAlpha = 0.9; g.beginPath(); g.moveTo(L * 0.06, -h * 0.9); g.lineTo(-L * 0.12, -h * 1.38); g.lineTo(-L * 0.22, -h * 0.86); g.fill();   // 등지느러미
    g.beginPath(); g.moveTo(L * 0.0, h * 0.86); g.lineTo(-L * 0.1, h * 1.22); g.lineTo(-L * 0.18, h * 0.8); g.fill(); g.globalAlpha = 1;
    const gr = g.createLinearGradient(0, -h, 0, h); gr.addColorStop(0, c1); gr.addColorStop(0.55, mixC(F.c1, F.c2, o.pale ? 0.8 : 0.62)); gr.addColorStop(1, c2); g.fillStyle = gr;
    g.beginPath(); g.moveTo(L * 0.5, h * 0.05); g.bezierCurveTo(L * 0.44, -h * 1.08, -L * 0.2, -h * 1.05, -L * 0.44, 0); g.bezierCurveTo(-L * 0.2, h * 0.98, L * 0.42, h * 1.0, L * 0.5, h * 0.05); g.fill();
    if (F.stripe) { g.strokeStyle = F.stripe; g.globalAlpha = 0.5; g.lineWidth = h * 0.16; g.lineCap = 'round'; g.beginPath(); g.moveTo(-L * 0.34, h * 0.12); g.quadraticCurveTo(0, -h * 0.02, L * 0.3, h * 0.06); g.stroke(); g.globalAlpha = 1; }
    if (F.spots) { g.fillStyle = 'rgba(60,45,30,.45)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(-L * 0.32 + i * L * 0.085, -h * 0.25 + (i % 2) * h * 0.3, h * 0.1, 0, 7); g.fill(); } }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(L * 0.05, -h * 0.45, L * 0.28, h * 0.16, -0.05, 0, 7); g.fill();   // 비늘 광택
    g.strokeStyle = o.gill || 'rgba(40,30,20,.45)'; g.lineWidth = Math.max(1.2, L * (o.gill ? 0.03 : 0.012)); g.beginPath(); g.arc(L * 0.3, h * 0.02, h * 0.62, -1.15, 1.15); g.stroke();   // 아가미
    if (F.id === 'ing') { g.strokeStyle = 'rgba(60,40,20,.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(L * 0.48, h * 0.1); g.quadraticCurveTo(L * 0.55, h * 0.4, L * 0.5, h * 0.55); g.stroke(); }   // 잉어 수염
    if (o.eye === 'cloudy' || o.eye === 'sunken') { g.fillStyle = o.eye === 'sunken' ? '#A4A69C' : '#D9DCD4'; g.beginPath(); g.arc(L * 0.38, -h * 0.2, h * (o.eye === 'sunken' ? 0.14 : 0.17), 0, 7); g.fill(); g.fillStyle = 'rgba(90,95,90,.45)'; g.beginPath(); g.arc(L * 0.39, -h * 0.2, h * 0.08, 0, 7); g.fill(); }   // 뿌연 눈
    else { g.fillStyle = '#fff'; g.beginPath(); g.arc(L * 0.38, -h * 0.2, h * 0.17, 0, 7); g.fill();
      if (o.dead && !o.eye) { g.strokeStyle = '#333'; g.lineWidth = Math.max(1.2, h * 0.07); g.beginPath(); g.moveTo(L * 0.34, -h * 0.3); g.lineTo(L * 0.42, -h * 0.1); g.moveTo(L * 0.42, -h * 0.3); g.lineTo(L * 0.34, -h * 0.1); g.stroke(); }
      else { g.fillStyle = '#121212'; g.beginPath(); g.arc(L * 0.39, -h * 0.2, h * 0.09, 0, 7); g.fill(); } }
    if (o.film) { g.fillStyle = 'rgba(120,110,80,.38)'; g.beginPath(); g.ellipse(-L * 0.02, h * 0.1, L * 0.36, h * 0.55, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(200,190,150,.35)'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-L * 0.3 + i * L * 0.2, -h * 0.2); g.quadraticCurveTo(-L * 0.2 + i * L * 0.2, h * 0.3, -L * 0.25 + i * L * 0.2, h * 0.6); g.stroke(); } }   // 끈적한 막 (기름·썩는 유기물 모두 — 무지갯빛으로 그리면 기름인 게 티 남)
    g.restore();
  }

  // ── 🎣 낚시 어류 조사 ──
  const FISH = {
    eun: { n: '은어', len: [14, 24], str: 0.55, c1: '#7B8C5A', c2: '#ECEAD8', note: '1급수 맑은 물에만 사는 물고기 — 태화강이 되살아났다는 상징이에요' },
    pira: { n: '피라미', len: [8, 14], str: 0.42, c1: '#7F97A6', c2: '#F1E6E2', stripe: '#D98A8A', note: '여울에서 떼 지어 사는 작은 물고기' },
    galg: { n: '갈겨니', len: [9, 16], str: 0.46, c1: '#566F7C', c2: '#E6E2D0', stripe: '#34444E', note: '맑고 차가운 상류에 사는 물고기' },
    bung: { n: '붕어', len: [12, 28], str: 0.6, c1: '#8A7A3E', c2: '#E4D49C', note: '더러운 물에도 잘 버티는 편 — 붕어까지 약해졌다면 오염이 심한 거예요' },
    ing: { n: '잉어', len: [30, 62], str: 0.95, c1: '#7A5A2E', c2: '#DAB87A', note: '크고 힘센 물고기 — 입가에 수염이 있어요' },
    nuchi: { n: '누치', len: [20, 40], str: 0.7, c1: '#8C8C78', c2: '#ECE8D8', note: '모래 바닥이 있는 중·하류에 살아요' },
    sung: { n: '숭어', len: [30, 58], str: 0.85, c1: '#5D7385', c2: '#E9EDF0', note: '바닷물과 민물이 섞이는 하구에 살아요 — 잘 뛰어올라요' },
    mang: { n: '망둥어', len: [8, 18], str: 0.36, c1: '#7B6A50', c2: '#D9CDB2', spots: true, note: '갯벌·하구 바닥에 사는 물고기' },
    hwang: { n: '황어', len: [25, 42], str: 0.75, c1: '#5A6955', c2: '#E8E0C8', stripe: '#D8694A', note: '봄에 바다에서 강으로 올라와 알을 낳아요' },
    yeon: { n: '연어', len: [60, 78], str: 1.0, c1: '#6B7E8D', c2: '#F3E6E2', note: '가을(10~11월)에 태어난 태화강으로 돌아와요 — 강이 깨끗하다는 증거!' }
  };
  Object.keys(FISH).forEach(k => { FISH[k].id = k; });
  const TRASH = [['비닐봉지', '🛍'], ['빈 음료수 캔', '🥫'], ['페트병', '🧴'], ['낡은 장화', '🥾']];
  // 물고기 증상 무리 — 여러 물질이 비슷한 증상을 내요 (📖 도감은 증상마다 후보 둘 · 증상 두 가지가 겹치는 물질이면 하나로) — [증상, 아가미 색, 후보 물질]
  const SG = { nerve: ['몸을 비틀며 이상하게 헤엄쳐요 (신경이 상함)', null, ['phenol', 'cadmium']], gill: ['아가미가 붉게 부어서 입을 뻐끔거려요', '#C8342C', ['ammonia', 'cadmium']],
    oxygen: ['물 위로 입을 내밀고 헐떡여요 (숨이 가빠요)', '#9A4A4A', ['bod', 'ammonia']], film: ['몸과 아가미에 끈적한 막이 끼었어요', '#3A3020', ['oil', 'bod']] };
  const SYMG = { phenol: ['nerve'], cadmium: ['nerve', 'gill'], ammonia: ['gill', 'oxygen'], bod: ['oxygen', 'film'], oil: ['film'] };   // 물질 → 나타날 수 있는 증상
  const PNAME = { phenol: '페놀', cadmium: '카드뮴', ammonia: '암모니아', bod: '유기물', oil: '기름' };
  const GUIDE = '<p class="mg-gh">📖 물고기 증상 도감 — 증상 하나로는 물질을 못 정해요</p><table class="mg-guide">' + Object.keys(SG).map(k => '<tr><th>' + SG[k][0].replace(/ \(.*\)$/, '') + '</th><td>' + SG[k][2].map(p => PNAME[p]).join(' 또는 ') + '</td></tr>').join('') + '</table><p class="dim">두 가지 증상이 함께 보이면 겹치는 물질로 좁혀져요. 냄새(🧪 현장 측정) · ⚗️ 시약 · 📊 연구원 분석으로 확인하세요.</p>';
  // 죽은 물고기 신선도 (물 온도 18℃ 기준 · 대략): [이 시간 전까지, 눈, 아가미, 몸, 말, 눈 그림, 아가미 색]
  const FRESH = [[2, '맑고 볼록해요', '선홍색', '부드럽게 휘어요', '2시간 안쪽', 'clear', '#E0303A'], [5, '맑아요', '붉은색', '조금씩 뻣뻣해져요', '2~5시간', 'clear', '#C0283A'], [9, '조금 흐려요', '검붉은색', '막대처럼 뻣뻣해요 (사후 경직)', '5~9시간', 'cloudy', '#7A2230'], [14, '뿌옇게 흐려요', '갈색', '다시 물렁해졌어요', '9~14시간', 'cloudy', '#6B4A30'], [99, '움푹 꺼지고 탁해요', '회갈색', '배가 부풀고 냄새가 나요', '14시간 넘게', 'sunken', '#6E6458']];
  function fishPool(rid, s) {
    if (rid === 'taehwa') return s < 150 ? [['eun', 35], ['pira', 35], ['galg', 20], ['bung', 10]] : s < 330 ? [['bung', 30], ['ing', 22], ['nuchi', 20], ['pira', 16], ['eun', 12]] : [['sung', 34], ['mang', 22], ['hwang', 14], ['bung', 14], ['ing', 10], ['yeon', 6]];
    if (rid === 'dongcheon') return [['bung', 42], ['pira', 28], ['ing', 20], ['mang', 10]];
    if (rid === 'yeocheon') return [['bung', 36], ['ing', 24], ['sung', 24], ['mang', 16]];
    if (rid === 'oehwang') return [['bung', 30], ['sung', 30], ['mang', 26], ['ing', 14]];
    return [['eun', 30], ['pira', 30], ['bung', 25], ['galg', 15]];   // 회야강
  }
  // 이 지점의 최근 오염 노출: 지난 8시간 중 가장 진했던 때 — (평소보다 늘어난 양 ÷ 최대 배출량)의 합 · 가장 큰 물질
  P.fishStress = function (rid, s) {
    const C = Object.assign({}, this.C, { decoys: [] }), W = { phenol: 1, cadmium: 1, ammonia: 1, bod: 1, oil: 0.8 }; let best = 0, dom = null;   // 범인 오염만 (기준 안의 평소 배출은 물고기를 해치지 않음)
    for (let h = this.nowH - 8; h <= this.nowH + 1e-6; h += 0.25) { let tot = 0, top = 0, tp = null;
      Object.keys(W).forEach(p => { const Q = UC_POL[p], v = Math.max(0, ucWaterConc(C, p, rid, s, h) - Q.base) / Q.peak * W[p]; tot += v; if (v > top) { top = v; tp = p; } });
      if (tot > best) { best = tot; dom = tp; } }
    return { S: best, dom };
  };
  // 한 번 던졌을 때 무엇이 걸릴지 (오염이 심할수록 입질이 줄고 약한 물고기가 많음)
  P.fishRoll = function (st, pool, rid, r) {
    const S = st.S, pBite = S < 0.04 ? 0.95 : S < 0.15 ? 0.85 : S < 0.35 ? 0.68 : 0.42;
    if (r() > pBite) return { kind: 'none' };
    if (r() < (rid === 'dongcheon' || rid === 'yeocheon' ? 0.14 : 0.07)) { const t = TRASH[Math.floor(r() * TRASH.length)]; return { kind: 'trash', n: t[0], icon: t[1] }; }
    const tot = pool.reduce((a, b) => a + b[1], 0); let x = r() * tot, id = pool[0][0]; for (const [k, w] of pool) { x -= w; if (x <= 0) { id = k; break; } }
    const F = FISH[id], pWeak = S < 0.04 ? 0.03 : S < 0.15 ? 0.15 + (S - 0.04) * 3 : S < 0.35 ? 0.62 : 0.9, weak = r() < pWeak, gs = weak && st.dom && SYMG[st.dom], gk = gs ? gs[Math.floor(r() * gs.length)] : null, sy = gk ? SG[gk] : ['기운이 없고 움직임이 느려요', null];
    return { kind: 'fish', id, F, len: Math.round(lerp(F.len[0], F.len[1], Math.pow(r(), 1.3)) * (weak ? 0.92 : 1)), weak, sg: gk, sym: weak ? sy[0] : '힘차게 퍼덕여요', gill: weak ? sy[1] : null, film: gk === 'film' };
  };
  P.startFishing = function (o, where) {
    if (this.mg) return; const rid = o.river, s = o.s, st = this.fishStress(rid, s), pool = fishPool(rid, s), R = this.rnd, N = 3, night = this._night || 0, dom = st.dom, S = st.S;
    const casts = [], sh = [], fl = [], rip = [], spark = [];
    for (let i = 0, n = Math.round(clamp(7 - S * 14, 1, 7)); i < n; i++) sh.push({ x: Math.random(), y: 0.38 + Math.random() * 0.42, a: Math.random() * 6.28, sp: 0.02 + Math.random() * 0.03, s: 0.7 + Math.random() * 0.6, t: Math.random() * 9 });
    for (let i = 0, n = S >= 0.35 ? 2 : S >= 0.15 ? 1 : 0; i < n; i++) fl.push({ x: 0.08 + Math.random() * 0.5, y: 0.34 + Math.random() * 0.3, sp: 0.008 + Math.random() * 0.006, F: FISH[pool[i % pool.length][0]] });
    for (let i = 0; i < 46; i++) rip.push({ x: Math.random(), y: Math.random(), l: 0.4 + Math.random() * 0.8, a: 0.1 + Math.random() * 0.22, sp: 0.004 + Math.random() * 0.01 });
    for (let i = 0; i < 26; i++) spark.push({ x: Math.random(), y: Math.random(), p: Math.random() * 6.28 });
    let ph = 'aim', t = 0, pow = 0, charging = false, out = null, res = null, biteAt = 0, winT = 0, spooks = 0, nibAt = 0, nibT = 0, splash = 0, hookT = 0, done = false, sawDead = fl.length > 0;
    const bob = { x: 0.5, y: 0.6, fx: 0, fy: 0, tx: 0.5, ty: 0.5, under: 0 }, rl = { z: 0.35, v: 0, f: 0.5, ft: 0.5, fv: 0, prog: 0.35, zh: 0.3, str: 0.5, next: 0 };
    // 죽은 물고기: 범인 물이 이 지점에 닿은 뒤 지난 시간만큼 상함 (닿은 시각 = 배출 시각 + 흐른 거리 ÷ 흐름 속도)
    const Cc = this.C, cpt = ucPoint(Cc.point); let arrH = null;
    if (UC_POL[Cc.pol].path === 'water' && cpt && cpt.kind === 'water') { const d = ucDownstream(cpt.river, cpt.s, rid, s); if (d >= 0) arrH = Cc.t0 + d / (UC_RIVERS[cpt.river].speed * UC_KM); }
    const ageNow = () => arrH != null && arrH <= this.nowH ? this.nowH - arrH : 3;
    let insp = null, back = null;
    const inspect = f => { const age = ageNow(), i = FRESH.findIndex(x => age < x[0]), fr = FRESH[i], lo = i ? FRESH[i - 1][0] : 0; insp = { F: f.F, fr, a: fr[0] < 99 ? this.nowH - fr[0] : null, b: this.nowH - lo }; back = { ph, t }; ph = 'inspect'; t = 0; SND('gem'); buzz(20); };
    const whenTxt = () => insp.a != null ? spanTxt(insp.a, insp.b) : H(insp.b) + ' 이전';
    // 물빛: 낮/밤 · 오염 (유기물 → 탁한 갈녹색 · 암모니아 → 뿌연 녹색 · 페놀 → 우윳빛 · 기름 → 무지갯빛 막)
    const tint = S > 0.04 ? '#55604A' : null, tk = tint ? clamp(S * 1.4, 0, 0.5) : 0;   // 물빛은 오염 정도만 (예전엔 물질마다 색 · 기름 무지개로 물질이 바로 보였음 — 냄새·기름막은 🧪 현장 측정에서)
    const col = c => { let x = tint ? mixC(c, tint, tk) : c; if (night > 0.2) { const A = x.startsWith('#') ? hex(x) : x.match(/\d+/g).map(Number); x = 'rgb(' + A.map(v => Math.round(v * (1 - night * 0.62))).join(',') + ')'; } return x; };
    const kmTxt = where || (UC_RIVERS[rid].name + ' ' + (s / UC_KM).toFixed(1) + 'km');
    const verdict = () => { const fishes = casts.filter(c => c.kind === 'fish'), wk = fishes.filter(c => c.weak).length; return !fishes.length && casts.filter(c => c.kind === 'none').length >= 2 ? '물고기가 거의 없어요 — 오염이 심했거나 물고기가 피한 곳일 수 있어요' : wk || sawDead ? '약한' + (sawDead ? '·죽은' : '') + ' 물고기가 보여요 — 최근 이 지점까지 독성 물질이 내려왔어요' : '물고기가 건강해요 — 지금 이 지점 물은 물고기가 살기 괜찮아요'; };
    const finish = () => {
      if (done) return; done = true; if (!casts.length && !insp) return;   // 던지기 전이라도 죽은 물고기를 살펴봤으면 기록
      const C = this.C, Q = UC_POL[C.pol], pt = ucPoint(C.point), fishes = casts.filter(c => c.kind === 'fish'), weak = fishes.filter(c => c.weak).length, healthy = fishes.length - weak, none = casts.filter(c => c.kind === 'none').length, bad = weak || sawDead || (!fishes.length && none >= 2);
      let key = false; if (Q.path === 'water' && pt && pt.kind === 'water') { const d = ucDownstream(pt.river, pt.s, rid, s); if (d >= 0 && d < 140 && (weak >= 1 || sawDead)) key = true; if (rid === pt.river && s < pt.s && pt.s - s < 70 && fishes.length >= 2 && !weak && !sawDead) key = true; }
      const li = casts.map(c => '<li>' + (c.kind === 'fish' ? '🐟 ' + c.F.n + ' ' + c.len + 'cm — ' + (c.weak ? '<b class="no">약함</b>' : '<b class="ok">건강</b>') + ' · ' + c.sym : c.kind === 'trash' ? c.icon + ' ' + c.n + ' (쓰레기)' : c.kind === 'none' ? '입질 없음' : '놓침') + '</li>').join('');
      const hints = [];
      const gk = [...new Set(fishes.filter(c => c.weak && c.sg).map(c => c.sg))], both = gk.length ? Object.keys(PNAME).filter(p => gk.every(k => SG[k][2].indexOf(p) >= 0)) : [];
      if (weak) hints.push(['①', '약한 물고기의 증상: <b>' + [...new Set(fishes.filter(c => c.weak).map(c => c.sym))].join(' / ') + '</b> → 📖 도감의 후보: <b>' + (both.length ? both.map(p => PNAME[p]).join(' 또는 ') : '여러 물질') + '</b>' + (gk.length >= 2 && both.length === 1 ? ' (두 증상이 겹치는 물질)' : ' — 냄새 · ⚗️ 시약 · 📊 연구원 분석으로 하나를 골라요')]);
      hints.push(['③', bad ? '여기까지 오염된 물이 내려왔어요 → 출발점은 이 지점보다 <b>위쪽(상류)</b>이에요. 더 위로 올라가 깨끗한 곳을 찾으면 그 사이가 출발점' : '물고기가 건강해요 → 이 강이 오염됐다면 출발점은 이 지점보다 <b>아래쪽(하류)</b>이에요']);
      if (insp) hints.push(['④', '죽은 ' + ucJ(insp.F.n, '은', '는') + ' 죽은 지 약 ' + insp.fr[4] + ' → 오염이 여기 닿은 때: <b>' + whenTxt() + '</b>. 여기서 배출구까지 거리 ÷ 흐름 속도만큼 더 거슬러 가면 배출 시각이에요 (⏪ 시간 되감기)']);
      else if (sawDead) hints.push(['④', '떠내려가던 죽은 물고기를 눌러 건져 보면 언제 죽었는지(= 오염이 닿은 때) 알 수 있어요']);
      if (insp) { const M = this.miniState(); M.dead.push({ river: rid, s, a: insp.a, b: insp.b, band: insp.fr[4], where: kmTxt }); }
      this.addEvidence({ title: '🎣 어류 조사 · ' + kmTxt + ' (' + this.hm(this.nowH) + ')', key: key || (!!insp && arrH != null), geo: { river: rid, s },
        html: (casts.length ? '<p>' + casts.length + '번 던져서: 건강 ' + healthy + ' · 약함 ' + weak + ' · 입질 없음 ' + none + '</p><ul class="mg-list">' + li + '</ul>' : '<p>던지기 전에 떠내려가던 죽은 물고기를 건져 살펴봤어요.</p>') + (insp ? '<p>⚰ 건져 본 죽은 ' + insp.F.n + ': 눈 ' + insp.fr[1] + ' · 아가미 ' + insp.fr[2] + ' · 몸 ' + insp.fr[3] + ' → <b>죽은 지 약 ' + insp.fr[4] + '</b></p>' : sawDead ? '<p>⚠ 죽은 물고기가 떠내려가는 것을 봤어요.</p>' : '') +
          '<p><b>' + verdict() + '</b></p>' + hintBox(hints) + GUIDE + '<p class="dim">물고기는 오염을 먼저 느끼는 생물 지표예요.</p>' });
      this.toast('🎣 어류 조사 결과를 수첩에 적었어요');
    };
    const nextCast = () => { ph = 'aim'; t = 0; pow = 0; charging = false; out = null; res = null; bob.under = 0; spooks = 0; };
    const endCast = r => { res = r; casts.push(r); this.spend(0.12); ph = 'result'; t = 0; if (r.kind === 'fish' || r.kind === 'trash') SND('gem'); else SND('bump'); };
    const m = this.mgOpen({ emoji: '🎣', title: '어류 조사 — ' + kmTxt, act: '🎣 던지기',
      down: p => {
        if (ph === 'inspect') { if (t > 0.3) { ph = back.ph; t = back.t; } return; }
        if (p && fl.length && ((ph === 'aim' && !charging) || (ph === 'wait' && winT <= 0))) { const f = fl.find(q => q.X != null && Math.hypot(q.X - p[0], q.Y - p[1]) < Math.max(30, q.L * 0.8)); if (f) { inspect(f); return; } }
        if (ph === 'aim') { charging = true; t = 0; }
        else if (ph === 'wait') { if (winT > 0) { ph = 'reel'; t = 0; hookT = 0.35; buzz(40); const w = out.kind === 'trash' ? 0.2 : out.F.str * (out.weak ? 0.45 : 1); Object.assign(rl, { z: 0.35, v: 0, f: 0.45, ft: 0.5, fv: 0, prog: 0.32, str: w, zh: out.kind === 'trash' ? 0.36 : 0.3 - w * 0.06, next: 0 }); SND('hitmark'); }
          else { spooks++; biteAt += 1.2; m.flash = '너무 일찍 챘어요!'; m.flashT = 1; if (spooks >= 3 && out.kind !== 'none') endCast({ kind: 'miss' }); } }
        else if (ph === 'result') { if (casts.length < N) nextCast(); else { ph = 'summary'; t = 0; } }
        else if (ph === 'summary') { finish(); this.closeDialog(); }
      },
      up: () => { if (ph === 'aim' && charging) { charging = false; ph = 'fly'; t = 0; bob.tx = 0.44 + Math.random() * 0.12; bob.ty = lerp(0.72, 0.3, pow); SND('jump'); } },
      onClose: () => finish(),
      state: () => ({ ph, winT, charging, casts: casts.map(c => c.kind + (c.weak ? '!' : '')), prog: rl.prog, f: rl.f, z: rl.z, zh: rl.zh, S, dom, dead: fl.map(f => [f.X, f.Y]), insp: insp && { band: insp.fr[4], a: insp.a, b: insp.b }, arrH, age: ageNow() }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; const top = H2 * 0.2, bot = H2 * 0.86, wy = y => lerp(top, bot, y), tipX = W * 0.66, tipY = H2 * 0.5 + (ph === 'reel' ? Math.sin(now * 18) * 3 * rl.str + 10 : 0), compact = H2 < 300;
        // 하늘 · 먼 강둑 (나무 · 갈대)
        const sk = g.createLinearGradient(0, 0, 0, top); sk.addColorStop(0, col('#9CC0DE')); sk.addColorStop(1, col('#D9E6EE')); g.fillStyle = sk; g.fillRect(0, 0, W, top);
        g.fillStyle = col('#3E5C3A'); g.beginPath(); g.moveTo(0, top); for (let x = 0; x <= W; x += 14) g.lineTo(x, top - 8 - 10 * Math.abs(Math.sin(x * 0.037) * Math.cos(x * 0.011)) - (x % 42 < 14 ? 6 : 0)); g.lineTo(W, top + 4); g.lineTo(0, top + 4); g.fill();
        // 물 (먼 곳은 하늘빛 · 가까운 곳은 깊은 청록)
        const wg = g.createLinearGradient(0, top, 0, bot); wg.addColorStop(0, col('#6F9BB0')); wg.addColorStop(0.4, col('#3F7486')); wg.addColorStop(1, col('#1D4A58')); g.fillStyle = wg; g.fillRect(0, top, W, bot - top);
        // (기름 무지개는 🧪 현장 측정 관찰로 — 낚시 화면은 물질을 드러내지 않음)
        // 물고기 그림자 (오염이 심하면 적음) · 입질이 오면 찌 쪽으로
        sh.forEach(f => { f.t += dt; const aim = (ph === 'wait' && out && out.kind === 'fish') ? 1 : 0; f.a += (Math.sin(f.t * 0.7) * 0.6) * dt; f.x += Math.cos(f.a) * f.sp * dt * (1 - aim * 0.5); f.y += Math.sin(f.a) * f.sp * dt * 0.4;
          if (aim) { f.x += (bob.x - f.x) * dt * 0.25; f.y += (bob.y + 0.05 - f.y) * dt * 0.25; } if (f.x < -0.1) f.x = 1.1; if (f.x > 1.1) f.x = -0.1; f.y = clamp(f.y, 0.32, 0.92);
          const X = f.x * W, Y = wy(f.y), sc = lerp(0.6, 1.25, f.y) * f.s * Math.min(W, 700) / 700; g.save(); g.translate(X, Y); g.rotate(f.a); g.fillStyle = 'rgba(8,20,24,.28)'; g.beginPath(); g.ellipse(0, 0, 26 * sc, 7 * sc, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-24 * sc, 0); g.lineTo(-36 * sc, -6 * sc); g.lineTo(-36 * sc, 6 * sc); g.fill(); g.restore(); });
        // 물결 · 햇빛 반짝임 · 흐름(오른쪽이 하류)
        g.lineCap = 'round'; rip.forEach(r => { r.x = (r.x + r.sp * dt) % 1.05; const Y = wy(r.y), sc = lerp(0.4, 1.3, r.y); g.strokeStyle = 'rgba(230,245,250,' + (r.a * (1 - night * 0.6)).toFixed(3) + ')'; g.lineWidth = 1 + sc; g.beginPath(); g.moveTo(r.x * W - 18 * r.l * sc, Y); g.quadraticCurveTo(r.x * W, Y - 3 * sc, r.x * W + 18 * r.l * sc, Y); g.stroke(); });
        if (night < 0.5) spark.forEach(p => { const a = Math.max(0, Math.sin(now * 3 + p.p)) * (1 - night * 2); if (a < 0.2) return; g.fillStyle = 'rgba(255,255,240,' + (a * 0.8).toFixed(2) + ')'; g.fillRect(p.x * W, wy(p.y * 0.55), 2, 2); });
        // 떠내려가는 죽은 물고기 (배를 드러냄 · 누르면 건져서 살펴봄)
        fl.forEach(f => { if (ph !== 'inspect') f.x += f.sp * dt; if (f.x > 1.12) f.x = -0.12; const X = f.x * W, Y = wy(f.y) + Math.sin(now * 1.3 + f.y * 9) * 2, L = lerp(40, 64, f.y) * Math.min(W, 700) / 700; f.X = X; f.Y = Y; f.L = L;
          g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(X, Y + 2, L * 0.62, L * 0.14, 0, 0, 7); g.stroke(); drawFish(g, X, Y, L, f.F, { belly: true, dead: true, pale: true, rot: 0.22 });
          if (!insp && (ph === 'aim' || ph === 'wait')) { g.strokeStyle = 'rgba(255,209,102,' + (0.45 + 0.35 * Math.sin(now * 5)).toFixed(2) + ')'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(X, Y, L * 0.66, 0, 7); g.stroke(); g.setLineDash([]); } });
        // 가까운 강둑 (돌 · 풀)
        const bg = g.createLinearGradient(0, bot - 6, 0, H2); bg.addColorStop(0, col('#5E6B4A')); bg.addColorStop(1, col('#3A4530')); g.fillStyle = bg; g.beginPath(); g.moveTo(0, bot + 6); for (let x = 0; x <= W; x += 18) g.lineTo(x, bot - 2 - 6 * Math.abs(Math.sin(x * 0.05))); g.lineTo(W, bot - 2); g.lineTo(W, H2); g.lineTo(0, H2); g.fill();
        g.fillStyle = col('#7C7A70'); for (let i = 0; i < 9; i++) { const x = (i * 0.123 + 0.03) * W; g.beginPath(); g.ellipse(x, bot + 10 + (i % 3) * 8, 16 + (i % 4) * 6, 7 + (i % 2) * 3, 0, 0, 7); g.fill(); }
        // 찌 위치 (날아가는 중 · 물 위)
        if (ph === 'fly') { const k = Math.min(1, t / 0.55); bob.x = lerp(tipX / W, bob.tx, k); bob.y = lerp((tipY - top) / (bot - top), bob.ty, k); if (k >= 1) { ph = 'wait'; t = 0; splash = 0.5; out = this.fishRoll(st, pool, rid, R); biteAt = out.kind === 'none' ? 1e9 : 1.4 + Math.random() * (S < 0.15 ? 2.8 : 5.2); nibAt = 0.6 + Math.random() * 1.2; winT = 0; } }
        const bx = bob.x * W, byBase = ph === 'aim' ? -99 : wy(bob.y);
        if (ph === 'wait') { if (t > nibAt && t < biteAt - 0.4) { nibT = 0.18; nibAt = t + 0.7 + Math.random() * 1.4; } nibT = Math.max(0, nibT - dt);
          if (t >= biteAt && winT === 0 && t < biteAt + 0.1) { winT = 0.9; splash = 0.6; buzz(70); SND('nom'); }
          if (winT > 0) { winT -= dt; if (winT <= 0) { winT = 0; endCast({ kind: 'miss' }); } }
          if (out && out.kind === 'none' && t > 6.5) endCast({ kind: 'none' }); }
        splash = Math.max(0, splash - dt); if (splash > 0 && ph !== 'aim' && ph !== 'inspect') { g.strokeStyle = 'rgba(255,255,255,' + (splash * 1.4).toFixed(2) + ')'; g.lineWidth = 2; g.beginPath(); g.ellipse(bx, byBase, 30 * (0.8 - splash) + 8, 8 * (0.8 - splash) + 3, 0, 0, 7); g.stroke(); }
        // 낚싯대 · 줄 · 찌
        const rodBaseX = W * 0.97, rodBaseY = H2 * 1.02, bend = ph === 'reel' ? 0.2 + rl.str * 0.25 : 0;
        g.strokeStyle = '#2A2118'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(rodBaseX, rodBaseY); g.quadraticCurveTo(lerp(rodBaseX, tipX, 0.5) + bend * 60, lerp(rodBaseY, tipY, 0.5) - bend * 10, tipX, tipY); g.stroke();
        g.strokeStyle = '#C9A15A'; g.lineWidth = 2; g.beginPath(); g.moveTo(rodBaseX - 6, rodBaseY - 8); g.lineTo(rodBaseX - 30, rodBaseY - 44); g.stroke();
        if (ph !== 'aim' && !(ph === 'inspect' && back && back.ph === 'aim')) { const under = winT > 0 || ph === 'reel' ? 1 : nibT > 0 ? 0.45 : 0, by = byBase + Math.sin(now * 2.2) * 2 + under * 7;
          g.strokeStyle = 'rgba(240,240,240,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tipX, tipY); g.quadraticCurveTo(lerp(tipX, bx, 0.5), Math.max(tipY, by) + (ph === 'reel' ? -8 : 26), bx, by - 6); g.stroke();
          if (ph !== 'reel') { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(bx, byBase + 3, 9, 3, 0, 0, 7); g.fill();
            if (under < 1) { g.fillStyle = '#F4F4F2'; g.beginPath(); g.ellipse(bx, by - 2, 5, 6, 0, 0, 7); g.fill(); g.fillStyle = '#E4442F'; g.beginPath(); g.ellipse(bx, by - 8 + under * 5, 4.5, 5.5 - under * 4, 0, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(bx - 0.8, by - 18 + under * 8, 1.6, 7); } } }
        // 느낌표 (입질)
        if (winT > 0) { g.fillStyle = '#FFD166'; g.font = '900 ' + Math.round(Math.min(W, H2) * 0.12) + 'px Pretendard, sans-serif'; g.textAlign = 'center'; g.fillText('!', bx, byBase - 30); }
        // 힘 모으기 (던지기)
        if (ph === 'aim') { if (charging) pow = 0.5 - 0.5 * Math.cos(t * 3.4); const gx = W * 0.07, gy0 = H2 * 0.3, gh = H2 * 0.46; rr(g, gx - 11, gy0 - 4, 22, gh + 8, 11); g.fillStyle = 'rgba(10,16,26,.55)'; g.fill();
          const pg2 = g.createLinearGradient(0, gy0 + gh, 0, gy0); pg2.addColorStop(0, '#7DF58F'); pg2.addColorStop(0.6, '#FFD166'); pg2.addColorStop(1, '#FF7A59'); g.fillStyle = pg2; rr(g, gx - 7, gy0 + gh * (1 - pow), 14, gh * pow, 7); g.fill();
          g.fillStyle = '#fff'; g.font = F8(12); g.textAlign = 'center'; g.fillText('힘', gx, gy0 - 10);
          const aimY = wy(lerp(0.72, 0.3, pow)); g.strokeStyle = 'rgba(255,209,102,.8)'; g.setLineDash([5, 6]); g.lineWidth = 2; g.beginPath(); g.ellipse(W * 0.5, aimY, 22, 7, 0, 0, 7); g.stroke(); g.setLineDash([]); }
        // 줄 당기기: 초록 칸(누르면 올라감) 안에 물고기를 두면 게이지가 참
        if (ph === 'reel') { hookT = Math.max(0, hookT - dt); const bxR = W - 70, by0 = H2 * 0.1, bh = H2 * 0.74;
          rl.next -= dt; if (rl.next <= 0) { rl.ft = clamp(rl.f + (Math.random() - 0.5) * (0.3 + rl.str * 0.9), 0.04, 0.96); rl.next = lerp(1.3, 0.45, rl.str) * (0.6 + Math.random() * 0.8); }
          rl.fv += (rl.ft - rl.f) * dt * (4 + rl.str * 10) - rl.fv * dt * 3; rl.f = clamp(rl.f + rl.fv * dt, 0.02, 0.98);
          rl.v += (m.held ? 2.6 : -2.2) * dt; rl.v *= Math.pow(0.35, dt); rl.z += rl.v * dt; if (rl.z < 0) { rl.z = 0; rl.v = Math.abs(rl.v) * 0.3; } if (rl.z > 1 - rl.zh) { rl.z = 1 - rl.zh; rl.v = -Math.abs(rl.v) * 0.3; }
          const inZ = rl.f >= rl.z && rl.f <= rl.z + rl.zh; rl.prog = clamp(rl.prog + (inZ ? 0.34 : -(0.16 + rl.str * 0.12)) * dt, 0, 1);
          rr(g, bxR - 4, by0 - 6, 44, bh + 12, 14); g.fillStyle = 'rgba(8,14,24,.66)'; g.fill(); g.strokeStyle = 'rgba(245,196,81,.6)'; g.lineWidth = 1.5; g.stroke();
          const zy = by0 + bh * (1 - rl.z - rl.zh); rr(g, bxR, zy, 22, bh * rl.zh, 8); g.fillStyle = inZ ? 'rgba(125,245,143,.75)' : 'rgba(125,245,143,.42)'; g.fill();
          const fy = by0 + bh * (1 - rl.f); if (out.kind === 'fish') drawFish(g, bxR + 11, fy, 26, out.F, { rot: -Math.PI / 2 + Math.sin(now * 12) * 0.25 * rl.str }); else { g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText(out.icon, bxR + 11, fy + 7); }
          g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(bxR + 28, by0, 7, bh); const pc = rl.prog > 0.66 ? '#7DF58F' : rl.prog > 0.33 ? '#FFD166' : '#FF7A59'; g.fillStyle = pc; g.fillRect(bxR + 28, by0 + bh * (1 - rl.prog), 7, bh * rl.prog);
          if (Math.random() < dt * 8) splash = Math.max(splash, 0.3);
          if (rl.prog >= 1) endCast(out); else if (rl.prog <= 0) endCast({ kind: 'escape', of: out.kind === 'fish' ? out.F.n : '무언가' }); }
        // 죽은 물고기 살펴보기: 눈 · 아가미 · 몸 → 죽은 지 몇 시간 → 오염이 닿은 때
        if (ph === 'inspect') { const fr = insp.fr, cw = Math.min(W * 0.92, 500), chh = Math.min(H2 * 0.94, 310), cx = (W - cw) / 2, cy = (H2 - chh) / 2; card(g, cx, cy, cw, chh, Math.min(1, t * 5));
          const fx = compact ? cx + cw * 0.2 : W / 2, fyy = compact ? cy + chh * 0.5 : cy + chh * 0.28, fL = compact ? Math.min(cw * 0.3, 150) : Math.min(cw * 0.5, 190);
          drawFish(g, fx, fyy, fL, insp.F, { pale: true, eye: fr[5], gill: fr[6], bloat: fr[0] >= 99, rot: fr[0] >= 5 && fr[0] <= 9 ? 0 : Math.sin(now * 1.6) * 0.05 });
          const tx = compact ? cx + cw * 0.42 : cx + 26, ty0 = compact ? cy + 30 : cy + chh * 0.5; txt(g, '죽은 ' + insp.F.n + ' 살펴보기', compact ? tx : W / 2, compact ? ty0 : cy + 26, F9(compact ? 16 : 18), '#FFF6DA', compact ? 'left' : 'center');
          [['👁 눈', fr[1]], ['🫁 아가미', fr[2]], ['🐟 몸', fr[3]]].forEach((r2, i) => { const y = (compact ? ty0 + 24 : ty0) + i * (compact ? 20 : 22); txt(g, r2[0], tx, y, F7(compact ? 13 : 14), '#AEB6C6', 'left'); txt(g, r2[1], tx + (compact ? 70 : 86), y, F7(compact ? 13 : 14), '#EEF1F7', 'left'); });
          const y2 = (compact ? ty0 + 24 : ty0) + 3 * (compact ? 20 : 22) + 6; txt(g, '→ 죽은 지 약 ' + fr[4] + ' (물 18℃ 기준)', compact ? tx : W / 2, y2, F8(compact ? 14 : 15), '#FFD166', compact ? 'left' : 'center');
          g.fillStyle = '#9FE3B0'; g.font = F7(compact ? 12.5 : 13); g.textAlign = compact ? 'left' : 'center'; wrapText(g, '오염이 이 근처에 닿은 때: ' + whenTxt(), compact ? tx : W / 2, y2 + (compact ? 20 : 22), compact ? cx + cw - tx - 14 : cw - 36, 17); g.globalAlpha = 1; }
        // 결과 카드 · 요약
        if (ph === 'result' || ph === 'summary') { const cw = Math.min(W * 0.9, 470), chh = ph === 'summary' ? Math.min(H2 * 0.92, 340) : compact ? Math.min(H2 * 0.9, 250) : Math.min(H2 * 0.62, 250), cx = (W - cw) / 2, cy = (H2 - chh) / 2, k = Math.min(1, t * 5);
          card(g, cx, cy, cw, chh, k); g.textAlign = 'center';
          if (ph === 'result') { const r = res;
            if (r.kind === 'fish') { const fx = compact ? cx + cw * 0.24 : W / 2, fyy = compact ? cy + chh * 0.46 : cy + chh * 0.3, tx = compact ? cx + cw * 0.47 : W / 2, ty = compact ? cy + chh * 0.28 : cy + chh * 0.6, al = compact ? 'left' : 'center', mw = compact ? cx + cw - tx - 14 : cw - 40;
              drawFish(g, fx, fyy, Math.min(compact ? cw * 0.36 : cw * 0.62, 90 + r.len * 3.2), r.F, { rot: Math.sin(now * 6) * (r.weak ? 0.03 : 0.08), pale: r.weak, gill: r.gill, film: r.film });
              txt(g, r.F.n + ' ' + r.len + 'cm', tx, ty, F9(20), '#FFF6DA', al); g.font = F8(15); g.fillStyle = r.weak ? '#FF9A8A' : '#7DF58F'; g.textAlign = al; const y3 = wrapText(g, (r.weak ? '약함 — ' : '건강 — ') + r.sym, tx, ty + 24, mw, 19);
              g.fillStyle = '#AEB6C6'; g.font = F6(13); wrapText(g, r.F.note, tx, y3 + 4, mw, 18); }
            else { g.font = (compact ? 44 : 56) + 'px sans-serif'; g.fillText(r.kind === 'trash' ? r.icon : r.kind === 'none' ? '🫧' : '💨', W / 2, cy + chh * 0.38); txt(g, r.kind === 'trash' ? ucJ(r.n, '을', '를') + ' 건졌어요' : r.kind === 'none' ? '입질이 없어요' : '놓쳤어요', W / 2, cy + chh * 0.62, F9(19), '#FFF6DA');
              g.fillStyle = '#AEB6C6'; g.font = F6(13); wrapText(g, r.kind === 'trash' ? '강에 버려진 쓰레기예요 — 수첩에 함께 적어 둘게요' : r.kind === 'none' ? '물고기가 거의 없는 걸까요? 오염된 물은 물고기가 피하거나 죽어요' : '입질을 놓쳤어요 — 찌가 쑥 들어갈 때 바로 누르세요', W / 2, cy + chh * 0.62 + 24, cw - 40, 18); } }
          else { const lh = compact ? 21 : 28; txt(g, '어류 조사 결과 · ' + kmTxt, W / 2, cy + (compact ? 24 : 34), F9(compact ? 16 : 19), '#FFF6DA'); let y = cy + (compact ? 48 : 68);
            g.font = F7(compact ? 13.5 : 15); g.textAlign = 'left'; casts.forEach(c => { g.fillStyle = c.kind === 'fish' ? (c.weak ? '#FF9A8A' : '#7DF58F') : '#C9D0DD'; g.fillText((c.kind === 'fish' ? '🐟 ' + c.F.n + ' ' + c.len + 'cm · ' + (c.weak ? '약함' : '건강') : c.kind === 'trash' ? c.icon + ' ' + c.n : c.kind === 'none' ? '🫧 입질 없음' : '💨 놓침'), cx + 26, y); y += lh; });
            if (insp) { g.fillStyle = '#FFD166'; g.fillText('⚰ 죽은 ' + insp.F.n + ' · 죽은 지 약 ' + insp.fr[4], cx + 26, y); y += lh; }
            const wk1 = casts.find(c => c.kind === 'fish' && c.weak); if (wk1 && !compact) { g.fillStyle = '#FFB3BA'; g.font = F7(13); y = wrapText(g, '증상: ' + wk1.sym + ' → 📖 도감', cx + 26, y, cw - 52, 18); g.font = F7(15); }
            g.textAlign = 'center'; g.fillStyle = '#FFD166'; g.font = F8(compact ? 13 : 14); y = wrapText(g, verdict(), W / 2, y + 4, cw - 40, compact ? 17 : 20);
            g.fillStyle = '#AEB6C6'; g.font = F6(12.5); wrapText(g, '📓 수첩에 🔎 보고서 단서와 📖 증상 도감이 함께 적혀요', W / 2, Math.min(y + 4, cy + chh - 16), cw - 40, 16); }
          g.globalAlpha = 1; }
        if (m.flashT > 0) { m.flashT -= dt; g.globalAlpha = clamp(m.flashT * 2, 0, 1); txt(g, m.flash, W / 2, H2 * 0.14 + 20, F9(18), '#FF9A8A'); g.globalAlpha = 1; }
        // 안내 · 버튼 글자
        const deadTip = sawDead && !insp ? ' · 떠내려가는 죽은 물고기를 누르면 건져서 살펴봐요' : '';
        m.sub(night > 0.5 ? '🌙 밤낚시 · 오른쪽이 하류' : '오른쪽이 하류'); m.cnt('던지기 ' + Math.min(N, casts.length + (ph === 'result' || ph === 'summary' ? 0 : 1)) + ' / ' + N);
        m.tip(ph === 'inspect' ? '눈 · 아가미 · 몸이 굳은 정도로 죽은 지 얼마나 됐는지 알 수 있어요' : ph === 'aim' ? (charging ? '떼면 던져요 — 멀리 던질수록 물고기가 많은 가운데로' : '누르고 있으면 힘이 모여요 · 떼면 던져요' + deadTip) : ph === 'fly' ? '휙—' : ph === 'wait' ? (winT > 0 ? '지금! 누르세요' : out && out.kind === 'none' && t > 3.5 ? '입질이 없네요… 물고기가 적은 곳일까요?' : '찌가 쑥 들어가면 바로 누르기' + (deadTip || ' (살짝 흔들릴 땐 참기)')) : ph === 'reel' ? '누르고 있으면 초록 칸이 올라가요 — 물고기를 칸 안에 두면 오른쪽 게이지가 차요' : ph === 'result' ? (casts.length < N ? '누르면 다시 던져요' : '누르면 조사 결과를 봐요') : '수첩에 적으면 증거로 쓸 수 있어요');
        m.act(ph === 'inspect' ? '계속 낚시하기' : ph === 'aim' ? (charging ? '떼서 던지기' : '🎣 던지기 (누르고 떼기)') : ph === 'fly' ? '…' : ph === 'wait' ? '챔질!' : ph === 'reel' ? '감기 (누르고 있기)' : ph === 'result' ? (casts.length < N ? '다시 던지기' : '결과 보기') : '📓 수첩에 적기');
      } });
  };

  // ── 🔬 물벼룩 독성 시험 (연구원 · 물 시료) ──
  // 시료의 독성: (평소보다 늘어난 양 ÷ 최대 배출량)의 합 → 12마리 중 움직이지 않는 수 · 기준 안의 허가된 평소 배출은 물벼룩을 멈추게 하지 않음 (예전엔 그것만으로 '독성 조금'이 나오기도 했음)
  P.sampleTox = function (sm) { const C = Object.assign({}, this.C, { decoys: [] }), W = { phenol: 1, cadmium: 1, ammonia: 1, bod: 1, oil: 0.6 }; let t = 0; Object.keys(W).forEach(p => { const Q = UC_POL[p]; t += Math.max(0, ucWaterConc(C, p, sm.river, sm.s, sm.takenH) - Q.base) / Q.peak * W[p]; }); return t; };
  // 🗺 독성 지도: 한 강의 물벼룩 시험 결과를 상류(왼쪽) → 하류(오른쪽)로 · ▼ = 알고 있는 배출구
  P.toxMap = function (rid) {
    const M = this.miniState(), T = M.dtests.filter(d => d.river === rid).sort((a, b) => a.s - b.s); if (!T.length) return '';
    const O = Object.keys(this.known).map(ucPoint).filter(p => p && p.kind === 'water' && p.river === rid), all = T.map(d => d.s).concat(O.map(o => o.s));
    let a = Math.min(...all), b = Math.max(...all); const pad = Math.max(10, (b - a) * 0.12); a -= pad; b += pad; const X = s => (14 + (s - a) / (b - a) * 292).toFixed(1);
    const colr = p => p >= 50 ? '#E63946' : p >= 20 ? '#F4A261' : '#2A9D8F';
    let svg = '<svg viewBox="0 0 320 100" class="mg-map" role="img" aria-label="독성 지도"><text x="6" y="13" class="t">' + UC_RIVERS[rid].name + ' 🗺 독성 지도 (움직이지 않는 물벼룩 %)</text><text x="6" y="96" class="t2">← 상류</text><text x="314" y="96" class="t2" text-anchor="end">하류 →</text><path d="M8 54 H312" class="rv"/>';
    O.forEach(o => { svg += '<path d="M' + X(o.s) + ' 44 l-5 -9 h10 z" class="ot"/><text x="' + X(o.s) + '" y="31" class="t3" text-anchor="middle">▼' + o.id + '</text>'; });
    T.forEach(d => { svg += '<circle cx="' + X(d.s) + '" cy="54" r="7" fill="' + colr(d.pct) + '" stroke="#0E1320" stroke-width="1.5"/><text x="' + X(d.s) + '" y="75" class="t3" text-anchor="middle">' + (d.s / UC_KM).toFixed(1) + 'km</text><text x="' + X(d.s) + '" y="86" class="t4" text-anchor="middle" fill="' + colr(d.pct) + '">' + d.pct + '%</text>'; });
    return svg + '</svg>' + (O.length ? '' : '<p class="dim">▼ 배출구는 시설 서류를 보거나 현장에서 확인하면 지도에 나타나요.</p>');
  };
  P.daphniaMenu = function () {
    const ws = this.samples.map((s, i) => [s, i]).filter(([s]) => s.kind === 'water');
    if (!ws.length) { this.dialog('🔬', '물벼룩 독성 시험', '시험할 <b>물 시료</b>가 없어요. 강에서 물 시료를 떠 오세요. (환경DNA·공기 시료는 시험할 수 없어요)', [['알겠어요', () => this.closeDialog()]]); return; }
    this.dialog('🔬', '물벼룩 독성 시험 — 시료 고르기', '물 시료에 물벼룩 12마리를 넣고 현미경으로 봐요. <b>움직이지 않는 물벼룩</b>이 많을수록 독성이 강한 물이에요. 강의 위·아래 여러 곳을 시험하면 수첩에 <b>🗺 독성 지도</b>가 그려져요. (시료는 조금만 쓰니 연구원 분석도 그대로 맡길 수 있어요)',
      ws.map(([s, i]) => [(s.dtest ? '✓ ' : '') + s.label.replace(/^💧 물 /, '💧 ') + (s.dtest ? ' (이미 시험함)' : ''), () => { if (s.dtest) { this.toast('이미 시험한 시료예요 — 수첩에 결과가 있어요'); return; } this.closeDialog(); this.startDaphnia(s); }]).concat([['그만두기', () => this.closeDialog()]]));
  };
  P.startDaphnia = function (sm) {
    if (this.mg) return; const tox = this.sampleTox(sm), N = 12, k = clamp(Math.round(N * clamp((tox - 0.03) * 2.6, 0, 0.92) + (Math.random() - 0.5) * 1.2), 0, N), LIM = 16;
    const D = []; for (let i = 0; i < N; i++) { const still = i < k, a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 0.72; D.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.9, vx: 0, vy: 0, a: Math.random() * 6.28, s: 0.85 + Math.random() * 0.3, still, hop: Math.random(), ant: 0, tag: 0, wrong: 0 }); }
    D.sort(() => Math.random() - 0.5);
    let ph = 'look', t = 0, found = 0, wrong = 0, done = false, R = 1, cx = 0, cy = 0;
    const where = sm.label.replace(/^💧 물 /, '');
    const finish = () => {
      if (done) return; done = true; if (ph !== 'end') return; sm.dtest = true; this.spend(0.25);
      const C = this.C, Q = UC_POL[C.pol], pt = ucPoint(C.point), pct = Math.round(k / N * 100), lv = pct >= 50 ? '독성 높음' : pct >= 20 ? '독성 조금' : '독성 거의 없음', M = this.miniState();
      let key = false; if (Q.path === 'water' && pt && pt.kind === 'water') { const d = ucDownstream(pt.river, pt.s, sm.river, sm.s); if (d >= 0 && d < 140 && k >= 4) key = true; if (sm.river === pt.river && sm.s < pt.s && pt.s - sm.s < 70 && k <= 1) key = true; }
      M.dtests.push({ river: sm.river, s: sm.s, pct, h: sm.takenH });
      const same = M.dtests.filter(d => d.river === sm.river).length, hints = [['③', pct >= 20 ? '이 시료를 뜬 곳까지 독성 물질이 내려왔어요 → 출발점은 여기보다 <b>위쪽(상류)</b>' : '독성이 거의 없어요 → 이 강이 오염됐다면 출발점은 여기보다 <b>아래쪽(하류)</b>']];
      hints.push(['③', same >= 2 ? '🗺 독성 지도에서 <b>깨끗한 곳(초록)과 독한 곳(빨강) 사이의 ▼배출구</b>가 출발점 후보예요' : '같은 강의 위·아래 시료도 시험하면 🗺 독성 지도로 출발점을 좁힐 수 있어요']);
      this.addEvidence({ title: '🔬 물벼룩 독성 시험 · ' + where, key, geo: { river: sm.river, s: sm.s },
        html: '<p>물벼룩 12마리 중 <b>' + k + '마리</b>가 움직이지 않음 (' + pct + '%) → <b class="' + (pct >= 20 ? 'no' : 'ok') + '">' + lv + '</b></p>' + this.toxMap(sm.river) + hintBox(hints) + '<p class="dim">대조군(깨끗한 물): 12마리 모두 움직임 · 내가 찾은 것 ' + found + '/' + k + (wrong ? ' · 잘못 누름 ' + wrong : '') + '<br>실제 급성 독성 시험은 24~48시간 동안 움직이지 않는 물벼룩의 비율을 봐요. 어떤 물질인지는 ⚗️ 시약 실험이나 📊 연구원 분석으로 확인하세요.</p>' });
      this.toast('🔬 독성 시험 결과를 수첩에 적었어요');
    };
    const m = this.mgOpen({ emoji: '🔬', title: '물벼룩 독성 시험', act: '다 찾았어요',
      down: p => {
        if (ph === 'look') { if (!p) { ph = 'end'; t = 0; return; }
          let best = null, bd = 1e9; D.forEach(d => { const dx = cx + d.x * R - p[0], dy = cy + d.y * R - p[1], dd = Math.hypot(dx, dy); if (dd < bd) { bd = dd; best = d; } });
          if (best && bd < R * (m.W < 500 ? 0.17 : 0.14)) { if (best.still) { if (!best.tag) { best.tag = 1; found++; SND('gem'); buzz(20); if (found >= k) { ph = 'end'; t = 0; } } } else { best.wrong = 0.8; wrong++; SND('bump'); } } }
        else if (ph === 'end' && t > 0.4) { finish(); this.closeDialog(); }
      },
      onClose: () => { if (ph === 'end') finish(); },
      state: () => ({ ph, k, found, wrong, pts: D.map(d => [cx + d.x * R, cy + d.y * R, d.still ? 1 : 0, d.tag]) }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; if (ph === 'look' && t >= LIM) { ph = 'end'; t = 0; }
        const room = ph === 'end' ? Math.min(165, H2 * 0.34) : 0; cx = W / 2; cy = (H2 - room) / 2; R = Math.min(W, H2 - room) * 0.46;
        g.fillStyle = '#0A0D12'; g.fillRect(0, 0, W, H2);
        // 현미경 시야: 밝은 원 · 가장자리 어둡게 · 물 속 부유물
        const fg = g.createRadialGradient(cx - R * 0.15, cy - R * 0.2, R * 0.1, cx, cy, R); fg.addColorStop(0, '#FBF6E4'); fg.addColorStop(0.7, '#E8E2C8'); fg.addColorStop(1, '#B9B39A');
        g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip(); g.fillStyle = fg; g.fillRect(cx - R, cy - R, R * 2, R * 2);
        g.fillStyle = 'rgba(120,130,90,.18)'; for (let i = 0; i < 40; i++) { const a = i * 2.39996, rr2 = Math.sqrt((i * 0.618) % 1) * R * 0.95; g.beginPath(); g.arc(cx + Math.cos(a) * rr2 + Math.sin(now * 0.3 + i) * 3, cy + Math.sin(a) * rr2, 1.5 + (i % 3), 0, 7); g.fill(); }
        // 물벼룩: 살아 있으면 폴짝폴짝(더듬이 젓기) · 멈춘 것은 비스듬히 가라앉아 가만히
        D.forEach(d => {
          if (!d.still) { d.hop -= dt; if (d.hop <= 0) { const a = d.a - Math.PI / 2 + (Math.random() - 0.5) * 1.6; d.vx += Math.cos(a) * 0.22; d.vy += Math.sin(a) * 0.22; d.hop = 0.35 + Math.random() * 0.5; d.ant = 0.25; d.a += (Math.random() - 0.5) * 0.9; }
            d.vy += 0.05 * dt; d.vx *= Math.pow(0.08, dt); d.vy *= Math.pow(0.08, dt); d.x += d.vx * dt; d.y += d.vy * dt; const rd = Math.hypot(d.x, d.y); if (rd > 0.8) { d.x *= 0.8 / rd; d.y *= 0.8 / rd; d.vx *= -0.5; d.vy *= -0.5; } d.ant = Math.max(0, d.ant - dt); }
          else { d.y = Math.min(0.78 - Math.abs(d.x) * 0.2, d.y + 0.004 * dt); }
          const X = cx + d.x * R, Y = cy + d.y * R, L = R * (W < 500 ? 0.13 : 0.11) * d.s; g.save(); g.translate(X, Y); g.rotate(d.still ? d.a * 0.3 + 1.2 : Math.sin(now * 2 + d.hop) * 0.15 + d.a * 0.1);
          g.fillStyle = d.still ? 'rgba(150,120,70,.62)' : 'rgba(170,140,80,.42)'; g.strokeStyle = d.still ? 'rgba(90,70,40,.85)' : 'rgba(110,90,50,.75)'; g.lineWidth = 1.4;
          g.beginPath(); g.ellipse(0, 0, L * 0.42, L * 0.55, 0, 0, 7); g.fill(); g.stroke();   // 몸(투명한 껍데기)
          g.beginPath(); g.moveTo(-L * 0.1, L * 0.5); g.lineTo(L * 0.05, L * 0.85); g.stroke();   // 꼬리 가시
          g.fillStyle = 'rgba(90,110,60,.55)'; g.beginPath(); g.ellipse(L * 0.02, L * 0.08, L * 0.18, L * 0.26, 0, 0, 7); g.fill();   // 창자
          g.fillStyle = '#1B1B1B'; g.beginPath(); g.arc(0, -L * 0.42, L * 0.1, 0, 7); g.fill();   // 겹눈
          const sw = d.still ? 0.1 : (d.ant > 0 ? Math.sin(now * 40) * 0.6 : 0.25); g.strokeStyle = 'rgba(100,80,45,.9)'; g.lineWidth = 1.5;
          [-1, 1].forEach(sd => { g.beginPath(); g.moveTo(sd * L * 0.12, -L * 0.3); g.quadraticCurveTo(sd * L * 0.55, -L * (0.45 + sw * 0.3), sd * L * 0.75, -L * (0.05 + sw * 0.4)); g.stroke(); });
          g.restore();
          if (d.tag) { g.strokeStyle = '#1FBF6A'; g.lineWidth = 3; g.beginPath(); g.arc(X, Y, L * 0.8, 0, 7); g.stroke(); }
          if (d.wrong > 0) { d.wrong -= dt; g.strokeStyle = 'rgba(230,57,70,' + clamp(d.wrong, 0, 1).toFixed(2) + ')'; g.lineWidth = 3; g.beginPath(); g.moveTo(X - L * 0.5, Y - L * 0.5); g.lineTo(X + L * 0.5, Y + L * 0.5); g.moveTo(X + L * 0.5, Y - L * 0.5); g.lineTo(X - L * 0.5, Y + L * 0.5); g.stroke(); }
          if (ph === 'end' && d.still && !d.tag) { g.strokeStyle = '#E63946'; g.setLineDash([4, 4]); g.lineWidth = 2.5; g.beginPath(); g.arc(X, Y, L * 0.85, 0, 7); g.stroke(); g.setLineDash([]); }
        });
        g.restore();
        const vg = g.createRadialGradient(cx, cy, R * 0.75, cx, cy, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
        g.strokeStyle = '#2A2F38'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R + 3, 0, 7); g.stroke();
        // 남은 시간 · 결과
        if (ph === 'look') { const f = 1 - t / LIM; g.strokeStyle = f > 0.3 ? '#FFD166' : '#FF7A59'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, R + 12, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.stroke(); }
        else { const pct = Math.round(k / N * 100), cw = Math.min(W * 0.84, 420), ch = 150; card(g, (W - cw) / 2, H2 - ch - 12, cw, ch, Math.min(1, t * 4));
          txt(g, '움직이지 않는 물벼룩 ' + k + ' / ' + N + ' (' + pct + '%)', W / 2, H2 - ch + 22, F9(18), '#FFF6DA');
          txt(g, pct >= 50 ? '독성 높음 — 오염된 물이에요' : pct >= 20 ? '독성 조금 — 약하게 오염됐어요' : '독성 거의 없음 — 깨끗한 편', W / 2, H2 - ch + 48, F8(16), pct >= 50 ? '#FF9A8A' : pct >= 20 ? '#FFD166' : '#7DF58F');
          txt(g, '내가 찾은 것 ' + found + ' / ' + k + (wrong ? ' · 잘못 누름 ' + wrong : '') + (k && found === k && !wrong ? ' · 완벽한 관찰! ⭐' : ''), W / 2, H2 - ch + 74, F6(13), '#AEB6C6');
          g.font = F6(13); wrapText(g, '위·아래 시료를 더 시험하면 수첩에 🗺 독성 지도가 그려져요 (빨간 점선 = 놓친 물벼룩)', W / 2, H2 - ch + 98, cw - 36, 17); g.globalAlpha = 1; }
        m.sub('시료 · ' + where); m.cnt(ph === 'look' ? '⏱ ' + Math.ceil(LIM - t) + '초 · 찾음 ' + found : '끝');
        m.tip(ph === 'look' ? '가만히 있는 물벼룩을 눌러요 (살아 있는 물벼룩은 더듬이를 저으며 폴짝 움직여요)' : '결과를 수첩에 적으면 증거로 쓸 수 있어요');
        m.act(ph === 'look' ? '다 찾았어요' : '📓 수첩에 적기');
      } });
  };

  // ── 🛶 종이배 흐름 속도 (강가) ── 2 m 구간(A→B)을 종이배가 흘러가는 시간을 재서 속도 = 거리 ÷ 시간
  //   강가 가까이는 물이 느리고 물살 가운데가 빨라요 → 멀리 띄울수록 강물 흐름 속도(오염이 떠내려가는 속도)에 가까움
  function drawBoat(g, x, y, s) { g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(2, 9, 22, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#F4F1E6'; g.strokeStyle = '#B9B2A0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-22, -2); g.lineTo(22, -2); g.lineTo(14, 8); g.lineTo(-14, 8); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(-12, -2); g.lineTo(0, -22); g.lineTo(12, -2); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(160,150,130,.8)'; g.beginPath(); g.moveTo(0, -22); g.lineTo(0, -2); g.stroke(); g.restore(); }
  P.startFlow = function (o, where) {
    if (this.mg) return; const rid = o.river, R = UC_RIVERS[rid], vT = R.speed / 3.6, N = 3, night = this._night || 0, DIST = 2, RUN = 0.45;   // 강물 흐름 m/s
    const tries = [], flows = []; for (let i = 0; i < 60; i++) flows.push({ x: Math.random(), y: Math.random(), l: 0.4 + Math.random() * 0.9 });
    let ph = 'aim', t = 0, pow = 0, charging = false, bt = null, res = null, done = false;
    const lk = f => 0.6 + 0.4 * Math.sqrt(clamp(f, 0, 1)), lname = f => f > 0.68 ? '물살 가운데' : f > 0.36 ? '중간' : '강가 가까이', col = c => night > 0.2 ? mixC(c, '#0A0F1A', night * 0.55) : c;
    const best = () => { const k = tries.filter(r => r.ok); if (!k.length) return null; const fm = Math.max(...k.map(r => r.f)), u = k.filter(r => r.f >= fm - 0.15); return u.reduce((a, r) => a + r.kmh, 0) / u.length; };
    const endTry = r => { res = r; tries.push(r); ph = 'result'; t = 0; SND(r.ok ? 'gem' : 'bump'); };
    const fbTxt = r => { const f = (e, n) => e > 0.15 ? n + ' ' + e.toFixed(1) + '초 늦게' : e < -0.15 ? n + ' ' + (-e).toFixed(1) + '초 일찍' : n + ' 정확'; return f(r.ea, '시작') + ' · ' + f(r.eb, '멈춤'); };
    const finish = () => {
      if (done) return; done = true; if (!tries.length) return; this.spend(0.17); const M = this.miniState(), b = best();
      if (b) M.speeds[rid] = { kmh: +b.toFixed(2), at: this.nowH };
      const li = tries.map((r, i) => '<tr><th>' + (i + 1) + '번</th><td>' + lname(r.f) + '</td><td>' + (r.ok ? r.tm.toFixed(1) + '초' : '—') + '</td><td>' + (r.ok ? '<b>' + r.kmh.toFixed(1) + ' km/h</b>' : r.why) + '</td></tr>').join('');
      this.addEvidence({ title: '🛶 흐름 속도 · ' + where + (b ? ' · ' + b.toFixed(1) + 'km/h' : ''), key: false,
        html: '<table><tr><th></th><th>띄운 자리</th><th>2 m 걸린 시간</th><th>흐름 속도</th></tr>' + li + '</table>' + (b ? '<p>대표 흐름 속도: <b>' + b.toFixed(1) + ' km/h</b> (물살 가운데에서 잰 값 — 강가는 물이 느려요)</p>' : '<p>제대로 잰 값이 없어요 — 다시 재 보세요.</p>') +
          '<p class="dim">속도 = 거리 ÷ 시간 → 2 m ÷ (걸린 초) = m/s → × 3.6 = km/h. 오염물은 강물과 함께 이 속도로 떠내려가요.</p>' + hintBox(b ? [['④', '배출 시각 = (오염이 도착한 시각) − (배출구에서 도착한 곳까지 거리 km) ÷ <b>' + b.toFixed(1) + ' km/h</b> → ⏪ 시간 되감기로 바로 계산해 볼 수 있어요']] : []) });
      this.toast('🛶 흐름 속도를 수첩에 적었어요');
    };
    const m = this.mgOpen({ emoji: '🛶', title: '종이배 흐름 속도 — ' + where, act: '🛶 띄우기',
      down: () => {
        if (ph === 'aim') { charging = true; t = 0; }
        else if (ph === 'drift') { if (bt.a == null) { bt.a = bt.tt; SND('hitmark'); buzz(20); }
          else if (bt.b == null && bt.tt - bt.a > 0.25) { bt.b = bt.tt; const tm = bt.b - bt.a, ca = bt.ca != null ? bt.ca : bt.tt + (0 - bt.x) / bt.v, cb = bt.cb != null ? bt.cb : bt.tt + (DIST - bt.x) / bt.v; endTry({ ok: true, f: bt.f, tm, kmh: DIST / tm * 3.6, ea: bt.a - ca, eb: bt.b - cb }); buzz(30); } }
        else if (ph === 'result') { if (tries.length < N) { ph = 'aim'; t = 0; pow = 0; bt = null; } else { ph = 'summary'; t = 0; } }
        else if (ph === 'summary') { const ok = !!best(); finish(); this.closeDialog(); if (ok) this.afterFlow(); }
      },
      up: () => { if (ph === 'aim' && charging) { charging = false; const f = 0.06 + 0.92 * pow; bt = { f, x: -RUN, v: vT * lk(f) * (0.97 + Math.random() * 0.06), tt: 0, a: null, b: null, ca: null, cb: null, wob: Math.random() * 6 }; ph = 'drift'; t = 0; SND('jump'); } },
      onClose: () => finish(),
      state: () => ({ ph, charging, n: tries.length, bt: bt && { x: bt.x, a: bt.a, b: bt.b, f: bt.f, v: bt.v, ca: bt.ca, cb: bt.cb, tt: bt.tt }, tries: tries.map(r => ({ ok: r.ok, kmh: r.kmh, f: r.f })), vT, best: best() }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; const compact = H2 < 300, top = H2 * 0.04, bot = H2 * (compact ? 0.72 : 0.78), yl = f => lerp(bot - H2 * 0.07, top + H2 * 0.12, f), xA = W * 0.3, xB = W * 0.8, ppm = (xB - xA) / DIST;
        // 물 (가까운 강가는 얕아 밝고 · 먼 쪽은 깊어 어두움) · 흐름 무늬는 가운데(위쪽)일수록 빠르게
        const wg = g.createLinearGradient(0, top, 0, bot); wg.addColorStop(0, col('#1F4E5E')); wg.addColorStop(1, col('#4F8A8F')); g.fillStyle = wg; g.fillRect(0, 0, W, bot);
        g.lineCap = 'round'; flows.forEach(q => { const Y = top + q.y * (bot - top), f = clamp((bot - H2 * 0.07 - Y) / (bot - H2 * 0.07 - top - H2 * 0.12), 0, 1); q.x += vT * lk(f) * ppm * dt / W; if (q.x > 1.1) q.x -= 1.2; const X = q.x * W;
          g.strokeStyle = 'rgba(220,240,245,.22)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X - 16 * q.l, Y); g.quadraticCurveTo(X, Y - 2, X + 16 * q.l, Y); g.stroke(); });
        const bg2 = g.createLinearGradient(0, bot, 0, H2); bg2.addColorStop(0, col('#6B6A55')); bg2.addColorStop(1, col('#434A35')); g.fillStyle = bg2; g.beginPath(); g.moveTo(0, bot + 4); for (let x = 0; x <= W; x += 20) g.lineTo(x, bot - 3 * Math.abs(Math.sin(x * 0.07))); g.lineTo(W, bot); g.lineTo(W, H2); g.lineTo(0, H2); g.fill();
        g.fillStyle = col('#8A887C'); for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse((i * 0.13 + 0.05) * W, bot + 12 + (i % 3) * 7, 14 + (i % 4) * 5, 6, 0, 0, 7); g.fill(); }
        // A·B 선 · 2 m
        [[xA, 'A'], [xB, 'B']].forEach(([x, n]) => { g.strokeStyle = 'rgba(255,209,102,.85)'; g.setLineDash([7, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); g.setLineDash([]); g.fillStyle = '#FFD166'; g.beginPath(); g.arc(x, bot + 16, 11, 0, 7); g.fill(); txt(g, n, x, bot + 21, F9(13), '#1B1B2F'); });
        g.strokeStyle = '#FFE7A8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xA + 14, bot + 16); g.lineTo(xB - 14, bot + 16); g.stroke(); txt(g, '2 m', (xA + xB) / 2, bot + 12, F8(12), '#FFE7A8');
        // 초시계
        const tmv = bt && bt.a != null ? (bt.b != null ? bt.b - bt.a : bt.tt - bt.a) : 0; g.fillStyle = 'rgba(10,16,26,.72)'; rr(g, W - 136, top + 6, 126, 40, 12); g.fill(); txt(g, '⏱ ' + tmv.toFixed(1) + '초', W - 73, top + 34, F9(22), bt && bt.a != null && bt.b == null ? '#7DF58F' : '#FFF6DA');
        // 던지기 힘 · 떨어질 자리
        if (ph === 'aim') { if (charging) pow = 0.5 - 0.5 * Math.cos(t * 3.2); const gx = W * 0.06, gy0 = top + (bot - top) * 0.15, gh = (bot - top) * 0.66; rr(g, gx - 11, gy0 - 4, 22, gh + 8, 11); g.fillStyle = 'rgba(10,16,26,.55)'; g.fill();
          const pg2 = g.createLinearGradient(0, gy0 + gh, 0, gy0); pg2.addColorStop(0, '#FFB38A'); pg2.addColorStop(1, '#7DF58F'); g.fillStyle = pg2; rr(g, gx - 7, gy0 + gh * (1 - pow), 14, gh * pow, 7); g.fill(); txt(g, '힘', gx, gy0 - 8, F8(12), '#fff');
          const f = 0.06 + 0.92 * pow, ay = yl(f), ax = xA - RUN * ppm; g.strokeStyle = 'rgba(255,255,255,.75)'; g.setLineDash([5, 5]); g.lineWidth = 2; g.beginPath(); g.ellipse(ax, ay, 22, 8, 0, 0, 7); g.stroke(); g.setLineDash([]); txt(g, lname(f), ax, ay - 14, F7(12), 'rgba(255,255,255,.9)'); }
        // 종이배 (A·B 선을 지난 정확한 때를 기록해 두었다가 누른 때와 비교)
        if (bt && (ph === 'drift' || ph === 'result')) { if (ph === 'drift') { bt.tt += dt; const px = bt.x; bt.x += bt.v * dt * (1 + 0.03 * Math.sin(bt.tt * 2.3 + bt.wob)); if (px < 0 && bt.x >= 0) bt.ca = bt.tt - bt.x / bt.v; if (px < DIST && bt.x >= DIST) bt.cb = bt.tt - (bt.x - DIST) / bt.v; if (bt.x > DIST + 0.8) endTry({ ok: false, f: bt.f, why: bt.a == null ? '시작을 못 눌렀어요' : '멈춤을 못 눌렀어요' }); }
          drawBoat(g, xA + bt.x * ppm, yl(bt.f) + Math.sin(now * 2.4 + bt.wob) * 2, Math.max(0.8, Math.min(W, 700) / 700 * 1.1)); }
        // 결과 · 요약
        if (ph === 'result' || ph === 'summary') { const cw = Math.min(W * 0.9, 460), chh = Math.min(H2 * 0.92, ph === 'summary' ? 300 : 230), cx = (W - cw) / 2, cy = (H2 - chh) / 2; card(g, cx, cy, cw, chh, Math.min(1, t * 5)); const lh = compact ? 20 : 24;
          if (ph === 'result') { const r = res; let y = cy + (compact ? 30 : 38);
            if (r.ok) { txt(g, '⏱ ' + r.tm.toFixed(1) + '초', W / 2, y, F9(compact ? 20 : 24), '#FFF6DA'); y += lh + 4; txt(g, '2 m ÷ ' + r.tm.toFixed(1) + '초 = ' + (DIST / r.tm).toFixed(2) + ' m/s ≈ ' + r.kmh.toFixed(1) + ' km/h', W / 2, y, F8(compact ? 14 : 15), '#7DF58F'); y += lh;
              txt(g, '띄운 자리: ' + lname(r.f), W / 2, y, F7(13.5), '#EEF1F7'); y += lh; txt(g, fbTxt(r), W / 2, y, F6(13), '#AEB6C6'); y += lh; g.font = F6(12.5); g.fillStyle = '#FFE7A8'; wrapText(g, r.f > 0.68 ? '물살 가운데 값이 강물 흐름 속도에 가장 가까워요' : '강가는 물이 느려요 — 멀리(물살 가운데로) 띄워 보세요', W / 2, y, cw - 36, 16); }
            else { txt(g, '놓쳤어요 — ' + r.why, W / 2, y + 6, F9(18), '#FF9A8A'); g.font = F6(13); g.fillStyle = '#AEB6C6'; wrapText(g, '배가 A선을 지나는 순간 ⏱ 시작, B선을 지나는 순간 ⏱ 멈춤을 누르세요', W / 2, y + 36, cw - 36, 18); } }
          else { let y = cy + (compact ? 26 : 34); txt(g, '흐름 속도 결과 · ' + R.name, W / 2, y, F9(compact ? 16 : 19), '#FFF6DA'); y += lh + 4; g.textAlign = 'left'; g.font = F7(compact ? 13 : 14.5);
            tries.forEach((r, i) => { g.fillStyle = r.ok ? '#C9F7D3' : '#C9D0DD'; g.fillText((i + 1) + '번 · ' + lname(r.f) + ' · ' + (r.ok ? r.tm.toFixed(1) + '초 → ' + r.kmh.toFixed(1) + ' km/h' : r.why), cx + 24, y); y += lh; });
            const b = best(); g.textAlign = 'center'; y += 4; txt(g, b ? '대표 흐름 속도 ≈ ' + b.toFixed(1) + ' km/h' : '제대로 잰 값이 없어요', W / 2, y, F9(compact ? 16 : 18), b ? '#FFD166' : '#FF9A8A'); y += lh;
            g.font = F6(12.5); g.fillStyle = '#AEB6C6'; wrapText(g, b ? '물살 가운데 값을 썼어요 · 수첩에 적은 뒤 ⏪ 시간 되감기로 배출 시각을 계산해 봐요' : '다시 해 보세요', W / 2, y, cw - 36, 16); }
          g.globalAlpha = 1; }
        m.sub(R.name + ' · 오른쪽으로 흘러요'); m.cnt('재기 ' + Math.min(N, tries.length + (ph === 'result' || ph === 'summary' ? 0 : 1)) + ' / ' + N);
        m.tip(ph === 'aim' ? (charging ? '떼면 띄워요 — 멀리 띄울수록 물살 가운데(빠른 곳)' : '누르고 있으면 힘이 모여요 · 떼면 종이배를 띄워요') : ph === 'drift' ? (bt.a == null ? '배가 A선을 지나는 순간 누르세요 (⏱ 시작)' : '배가 B선을 지나는 순간 누르세요 (⏱ 멈춤)') : ph === 'result' ? (tries.length < N ? '누르면 다시 재요' : '누르면 결과를 봐요') : '수첩에 적으면 ⏪ 시간 되감기에 쓸 수 있어요');
        m.act(ph === 'aim' ? (charging ? '떼서 띄우기' : '🛶 띄우기 (누르고 떼기)') : ph === 'drift' ? (bt.a == null ? '⏱ 시작 (A선)' : '⏱ 멈춤 (B선)') : ph === 'result' ? (tries.length < N ? '다시 재기' : '결과 보기') : '📓 수첩에 적기');
      } });
  };
  P.afterFlow = function () {
    this.dialog('⏪', '시간 되감기', '흐름 속도를 알았어요! 오염이 <b>도착한 시각</b>과 이 속도로, 오염이 <b>배출구를 떠난 시각</b>을 거꾸로 계산해 볼까요?', [['⏪ 시간 되감기 (5분) — 도착 기록에서 배출구까지 끌기 (미니게임)', () => this.rewindMenu()], ['나중에', () => this.closeDialog()]]);
  };

  // ── ⏪ 시간 되감기 ── 도착 기록(시각·자리)에서 오염을 강 위쪽으로 끌면 흐름 속도만큼 시계가 거꾸로 감 · ▼ 배출구에 대면 떠난 시각
  const FISHER_R = { fisherT: ['taehwa', 'dongcheon'], fisherO: ['oehwang', 'hoeya'], fisherP: ['yeocheon'] };
  P.rewindArrivals = function () {
    const C = this.C, out = [], seen = {}; if (UC_POL[C.pol].path !== 'water') return out; const pt = ucPoint(C.point);
    this.evidence.forEach(e => {
      const st = UC_BIO.find(b => e.title === '🦐 ' + b.name + ' 기록');
      if (st && !seen[st.id]) { const r = ucBioLog(C, st, e.at).find(x => x.act < 70); if (r) { seen[st.id] = 1; out.push({ river: st.river, s: st.s, h: r.h, ha: r.h - 0.5, hb: r.h + 0.5, label: '🦐 ' + st.name, when: (r.h % 24) + '시 무렵 물벼룩 활동이 뚝 떨어짐' }); } }
      Object.keys(FISHER_R).forEach(id => { const n = (this.npcs || []).find(q => q.id === id); if (!n || seen[id] || e.title !== n.emoji + ' ' + n.name + '의 말') return; const a = ucMouthArrive(C); if (!a || FISHER_R[id].indexOf(pt.river) < 0 || a.h > e.at) return;
        seen[id] = 1; const h = Math.round(a.h * 6) / 6; out.push({ river: a.river, s: ucLen(UC_RIVERS[a.river].pts) - 4, h, ha: h - 0.1, hb: h + 0.1, label: '🎣 ' + n.name, when: H(h) + ' 하구에서 물고기가 떠오름' }); });
    });
    this.miniState().dead.forEach(d => out.push({ river: d.river, s: d.s, h: d.a != null ? (d.a + d.b) / 2 : d.b - 2, ha: d.a != null ? d.a : d.b - 6, hb: d.b, label: '🐟 죽은 물고기 · ' + d.where, when: '죽은 지 ' + d.band + ' → ' + (d.a != null ? spanTxt(d.a, d.b) : H(d.b) + ' 이전') }));
    if (this.set.diff === 'easy') { const r = ucReportSpot(C); if (r && !r.mouth) out.push({ river: r.river, s: r.s, h: UC_REPORT_H, ha: UC_REPORT_H - 0.5, hb: UC_REPORT_H + 0.3, label: '📄 신고 지점 · ' + UC_RIVERS[r.river].name + ' ' + (r.s / UC_KM).toFixed(1) + 'km', when: '오늘 아침 7시쯤 물고기 떼죽음' }); }
    return out;
  };
  P.rewindMenu = function () {
    if (UC_POL[this.C.pol].path !== 'water') { this.dialog('⏪', '시간 되감기', '시간 되감기는 <b>물 사건</b>에서 써요. 냄새(공기) 사건이라면 🧭 <b>기상대</b>에서 바람길을 거꾸로 그려 보세요.', [['알겠어요', () => this.closeDialog()]]); return; }
    const A = this.rewindArrivals();
    if (!A.length) { this.dialog('⏪', '시간 되감기', '오염이 <b>언제 어디에 도착했는지</b> 아직 몰라요. 먼저 아래 중 하나를 해 보세요.<br>· 🦐 하류 <b>바이오센서 기록</b> 보기 (활동이 떨어진 시각)<br>· 🎣 낚시하다 <b>죽은 물고기</b>를 건져 살펴보기<br>· 하구 <b>어민</b> 이야기 듣기', [['알겠어요', () => this.closeDialog()]]); return; }
    this.dialog('⏪', '시간 되감기 — 어느 도착 기록에서 되감을까요?', '오염을 도착한 곳에서 강 <b>위쪽</b>으로 끌어 올리면 흐름 속도만큼 시계가 거꾸로 가요. <b>▼ 배출구</b>에 대면 그곳을 떠난 시각이 나와요.',
      A.map(a => { const sp = this.riverSpeed(a.river); return [a.label + (sp ? '' : ' (흐름 속도 모름)') + ' — ' + a.when, () => { if (!sp) { this.toast(UC_RIVERS[a.river].name + ' 흐름 속도를 먼저 알아 오세요 — 🛶 종이배 또는 하천관리원'); return; } this.closeDialog(); this.startRewind(a, sp); }]; }).concat([['그만두기', () => this.closeDialog()]]));
  };
  P.startRewind = function (A, sp) {
    if (this.mg) return; const C = this.C, rid = A.river, R = UC_RIVERS[rid], L = ucLen(R.pts), v = sp.v * UC_KM;   // 칸/시간
    const outs = Object.keys(this.known).map(ucPoint).filter(p => p && p.kind === 'water' && p.river === rid && p.s <= A.s + 0.5).sort((a, b) => a.s - b.s);
    const sMin = Math.max(0, Math.min(A.s - 40, ...outs.map(o => o.s - 14))), sMax = Math.min(L, A.s + 12);
    let sb = A.s, drag = false, done = false, t = 0; const tries = [];
    const ha = A.ha != null ? A.ha : A.h, hb = A.hb != null ? A.hb : A.h, rng = hb - ha > 0.25;   // 도착 시각의 범위 (바이오센서 ±30분 · 죽은 물고기는 더 넓게)
    const hh = h => { const m2 = Math.round(h * 60) % 1440, x = (m2 + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); }, dw = h => h < 24 ? '어제' : '오늘';
    const tShort = dh => { const a = (rng ? ha : A.h) - dh, b = (rng ? hb : A.h) - dh; return rng ? dw(a) + ' ' + hh(a) + ' ~ ' + (dw(b) !== dw(a) ? dw(b) + ' ' : '') + hh(b) : dw(a) + ' ' + hh(a); };   // 좁은 화면용 (24시간 표기)
    const tTxt = (dh) => rng ? spanTxt(ha - dh, hb - dh) : H(A.h - dh), sTxt = r => r.sa === r.sb ? UC_SLOTS[r.sa] : r.sb === r.sa + 1 ? UC_SLOTS[r.sa] + ' 또는 ' + UC_SLOTS[r.sb].replace(/^(어젯밤|새벽|아침) /, '') : UC_SLOTS[r.sa] + ' ~ ' + UC_SLOTS[r.sb];
    const s0 = ucSlot(C.t0), covers = r => r.sa <= s0 && s0 <= r.sb;
    const finish = () => {
      if (done) return; done = true; if (!tries.length) return; this.spend(0.08); const key = tries.some(r => r.id === C.point && covers(r));
      const li = tries.map(r => '<li><b>▼' + r.id + '</b> ' + r.name + ' — 거리 ' + r.km.toFixed(1) + 'km ÷ ' + sp.v.toFixed(1) + 'km/h = ' + r.dh.toFixed(1) + '시간 전 → <b>' + tTxt(r.dh) + '</b> (④ ' + sTxt(r) + ')' + (hb - r.dh < 18 ? ' <span class="no">어제 낮 — 밤사이 사건과 안 맞아요</span>' : ha - r.dh > 32 ? ' <span class="no">아침 8시가 넘음 — 밤사이 사건과 안 맞아요</span>' : '') + '</li>').join('');
      this.addEvidence({ title: '⏪ 시간 되감기 · ' + A.label.replace(/^\S+ /, ''), key, html: '<p>도착 기록: ' + A.label + ' — ' + A.when + '<br>흐름 속도: ' + sp.v.toFixed(1) + ' km/h (' + sp.src + ')</p><ul class="mg-list">' + li + '</ul>' +
        hintBox([['④', '어느 배출구에서 떠났느냐에 따라 시각이 달라져요 — 위 시각 중 🗂 서류에서 <b>그 배출구의 기록이 빈 시각</b>과 맞는 것이 배출 시각이에요'], ['③', '계산한 시각이 서류(기록이 빈 시각) · 💂 경비원 말 · 🛸 드론 사진과 맞고, 그 바로 아래부터 물이 오염된 배출구가 범인이에요 (다른 곳의 빈 기록은 계측기 고장일 수 있어요)']]) });
      this.toast('⏪ 되감기 결과를 수첩에 적었어요');
    };
    let X = s => s, Sx = x => x;   // 화면 ↔ 강 거리 (frame 에서 채움)
    const m = this.mgOpen({ emoji: '⏪', title: '시간 되감기 — ' + R.name, act: '▼ 배출구까지 끌어 보세요',
      down: p => { if (p) { drag = true; sb = clamp(Sx(p[0]), sMin, A.s); return; } if (tries.length) { finish(); this.closeDialog(); } else { m.flash = '오염을 강 위쪽 ▼ 배출구까지 끌어 보세요'; m.flashT = 1.6; } },
      move: p => { if (drag) sb = clamp(Sx(p[0]), sMin, A.s); },
      up: () => { if (!drag) return; drag = false; let o = null, bd = 1e9; outs.forEach(q => { const d = Math.abs(X(q.s) - X(sb)); if (d < bd) { bd = d; o = q; } });
        if (o && bd < 20) { sb = o.s; const km = (A.s - o.s) / UC_KM, dh = km / sp.v, r = { id: o.id, name: short(UC_FAC[o.fac]) + ' ' + o.label, s: o.s, km, dh, t: A.h - dh, ta: ha - dh, tb: hb - dh, sa: ucSlot(ha - dh), sb: ucSlot(hb - dh) }; const i = tries.findIndex(q => q.id === o.id); if (i >= 0) tries.splice(i, 1); tries.push(r); SND('gem'); buzz(20); }
        else if (outs.length) { m.flash = '▼ 배출구 가까이에서 놓으면 떠난 시각이 계산돼요'; m.flashT = 1.6; } },
      onClose: () => finish(),
      state: () => ({ sb, drag, tries: tries.map(r => ({ id: r.id, sa: r.sa, sb: r.sb, ta: r.ta, tb: r.tb, dh: r.dh, covers: covers(r) })), outs: outs.map(o => [o.id, X(o.s)]), arrX: X(A.s), sMin, sMax }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; const compact = H2 < 300, x0 = 34, x1 = W - 34; X = s => x0 + (s - sMin) / (sMax - sMin) * (x1 - x0); Sx = x => sMin + clamp((x - x0) / (x1 - x0), 0, 1) * (sMax - sMin);
        const ry = H2 * (compact ? 0.56 : 0.52), rw = clamp(H2 * 0.075, 14, 30);
        g.fillStyle = '#17202B'; g.fillRect(0, 0, W, H2); g.strokeStyle = 'rgba(255,255,255,.04)'; g.lineWidth = 1; for (let x = 0; x < W; x += 28) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H2); g.stroke(); }
        // 강 (왼쪽이 상류) · km 눈금
        g.strokeStyle = '#2F6F8F'; g.lineWidth = rw; g.lineCap = 'round'; g.beginPath(); for (let x = x0 - 18; x <= x1 + 18; x += 8) { const y = ry + Math.sin(x * 0.02) * 4; if (x === x0 - 18) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
        // km 눈금: 글자가 서로 40px 넘게 떨어지게 (좁은 폰에서 겹치던 것)
        const rk = (sMax - sMin) / UC_KM, stp = [1, 2, 5, 10, 20].find(k => (x1 - x0) * k / rk >= 40) || 20; for (let k = Math.ceil(sMin / UC_KM / stp) * stp; k * UC_KM <= sMax; k += stp) { const x = X(k * UC_KM); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, ry + rw / 2 + 2); g.lineTo(x, ry + rw / 2 + 8); g.stroke(); txt(g, k + 'km', x, ry + rw / 2 + 20, F6(11), '#9AA3B5'); }
        txt(g, '← 상류', x0 - 6, ry - rw / 2 - 8, F7(11.5), '#9AA3B5', 'left'); txt(g, '하류 →', x1 + 6, ry - rw / 2 - 8, F7(11.5), '#9AA3B5', 'right');
        // ▼ 배출구 (알고 있는 곳만)
        outs.forEach((o, i) => { const x = X(o.s), yy = ry - rw / 2 - (compact ? 20 : 26) - (i % 2) * 16; g.strokeStyle = '#8C96A8'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, yy + 6); g.lineTo(x, ry - rw / 2); g.stroke();
          const on = tries.some(r => r.id === o.id); g.fillStyle = on ? '#FFD166' : '#C9D0DD'; g.beginPath(); g.moveTo(x - 7, yy - 6); g.lineTo(x + 7, yy - 6); g.lineTo(x, yy + 5); g.closePath(); g.fill(); txt(g, o.id, x, yy - 10, F8(12), on ? '#FFD166' : '#EEF1F7'); });
        if (!outs.length) { g.font = F7(13); g.fillStyle = '#FFE7A8'; g.textAlign = 'center'; wrapText(g, '알고 있는 배출구가 없어요 — 🏭 시설 서류를 보면 ▼ 배출구가 여기 나타나요', W / 2, ry - rw - 30, W - 60, 17); }
        // 도착 기록 표시
        const ax = X(A.s); g.fillStyle = '#FF7A59'; g.beginPath(); g.arc(ax, ry + rw / 2 + 34, 6, 0, 7); g.fill(); g.strokeStyle = '#FF7A59'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ry + rw / 2); g.lineTo(ax, ry + rw / 2 + 28); g.stroke(); const at = '도착 ' + (W < 520 ? (rng ? dw(ha) + ' ' + hh(ha) + ' ~ ' + hh(hb) : dw(A.h) + ' ' + hh(A.h)) : (rng ? spanTxt(ha, hb) : H(A.h)).replace(/(어제 |오늘 )/g, '')); g.font = F8(12); const aw = g.measureText(at).width / 2 + 6; txt(g, at, clamp(ax, aw, W - aw), ry + rw / 2 + 52, F8(12), '#FFB38A');
        // 오염 물감 (끌어서 되감기) · 지나온 자국
        const bx = X(sb), tg = g.createLinearGradient(bx, 0, ax, 0); tg.addColorStop(0, 'rgba(190,60,160,.75)'); tg.addColorStop(1, 'rgba(190,60,160,.15)'); g.strokeStyle = tg; g.lineWidth = rw * 0.62; g.beginPath(); g.moveTo(bx, ry); g.lineTo(ax, ry); g.stroke();
        const rg2 = g.createRadialGradient(bx, ry, 2, bx, ry, rw * 1.1); rg2.addColorStop(0, 'rgba(255,120,220,1)'); rg2.addColorStop(0.6, 'rgba(190,60,160,.85)'); rg2.addColorStop(1, 'rgba(190,60,160,0)'); g.fillStyle = rg2; g.beginPath(); g.arc(bx, ry, rw * 1.1, 0, 7); g.fill();
        if (!drag && !tries.length) { g.strokeStyle = 'rgba(255,209,102,' + (0.5 + 0.4 * Math.sin(now * 5)).toFixed(2) + ')'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 16, ry); g.lineTo(bx - 40, ry); g.moveTo(bx - 40, ry); g.lineTo(bx - 32, ry - 6); g.moveTo(bx - 40, ry); g.lineTo(bx - 32, ry + 6); g.stroke(); }
        // 시계 (되감긴 시각) · 계산식
        const km = (A.s - sb) / UC_KM, dh = km / sp.v, tt = hb - dh; g.fillStyle = 'rgba(10,16,26,.8)'; rr(g, W / 2 - Math.min(W * 0.46, 230), 8, Math.min(W * 0.92, 460), compact ? 50 : 60, 14); g.fill();
        g.save(); g.beginPath(); g.rect(W / 2 - Math.min(W * 0.46, 230), 8, Math.min(W * 0.92, 460), 60); g.clip(); txt(g, '🕰 ' + (W < 520 ? tShort(dh) : tTxt(dh)), W / 2, compact ? 30 : 34, F9(compact ? (rng ? 14 : 17) : (rng ? 17 : 20)), tt < 18 ? '#FF9A8A' : '#FFF6DA'); g.restore(); txt(g, '거리 ' + km.toFixed(1) + 'km ÷ 흐름 ' + sp.v.toFixed(1) + 'km/h = ' + dh.toFixed(1) + '시간 전', W / 2, compact ? 48 : 56, F7(12.5), '#AEB6C6');
        // 계산한 배출구들
        const narrow = W < 520, rows = []; tries.slice(narrow ? -2 : -3).forEach(r => { const a1 = '▼' + r.id + '에서 떠났다면 → ' + (narrow ? tShort(r.dh) : tTxt(r.dh).replace(/(어제 |오늘 )/g, '')), a2 = '④ ' + sTxt(r) + (r.tb < 18 ? ' ✗ 낮 — 밤사이 사건과 안 맞음' : r.ta > 32 ? ' ✗ 아침 8시 넘음 — 안 맞음' : ''); if (narrow) { rows.push([a1, r]); rows.push(['   ' + a2, r]); } else rows.push([a1 + '  (' + a2 + ')', r]); });
        g.textAlign = 'left'; g.font = F7(compact ? 12 : 13); rows.forEach(([l, r], i) => { g.fillStyle = r.tb < 18 || r.ta > 32 ? '#FF9A8A' : '#C9F7D3'; g.fillText(l, 12, H2 - 10 - (rows.length - 1 - i) * (compact ? 16 : 18)); });
        if (m.flashT > 0) { m.flashT -= dt; g.globalAlpha = clamp(m.flashT * 2, 0, 1); txt(g, m.flash, W / 2, ry - rw - (compact ? 8 : 14), F8(14), '#FFD166'); g.globalAlpha = 1; }
        m.sub('도착 기록: ' + A.label); m.cnt('흐름 ' + sp.v.toFixed(1) + 'km/h');
        m.tip(tries.length ? '다른 ▼ 배출구에도 대 보세요 · 다 됐으면 수첩에 적기' : '보라색 오염을 끌어 강 위쪽(왼쪽) ▼ 배출구에 대 보세요 — 시계가 거꾸로 가요');
        m.act(tries.length ? '📓 수첩에 적기' : '▼ 배출구까지 끌어 보세요');
      } });
  };

  // ── ⚗️ 시약 실험 (연구원) ── 물 시료: 시약 5가지를 넣고 색을 비교표와 맞추기 · 공기 시료: 검지관 3가지에 공기를 빨아들여 눈금 읽기
  //   색 비교표는 시약마다 범위가 달라요 (그 물질이 크게 새어 나왔을 때를 '아주 많이'로) → 평소 배출은 '조금', 사고 물은 '많이·아주 많이'
  //   간이 시약은 비슷한 물질에도 반응해요: 과망간산칼륨(유기물)은 페놀·기름에도 · 검지관은 벤젠 ↔ 톨루엔에 서로 조금 → 결과는 '후보', 확정은 📊 연구원 분석
  const RG = [
    { p: 'phenol', n: '페놀', r: '4-아미노안티피린', how: '붉을수록 많아요', c: ['#F2EFE6', '#F5C4BE', '#E2706E', '#A91D35'] },
    { p: 'ammonia', n: '암모니아', r: '네슬러 시약', how: '노랑 → 갈색일수록 많아요', c: ['#F3F1E2', '#F6E49A', '#EDB144', '#A2551C'] },
    { p: 'cadmium', n: '카드뮴', r: '디티존 시약', how: '초록 → 분홍일수록 많아요', c: ['#4F9A5B', '#8F9C69', '#C77D95', '#C0386B'] },
    { p: 'oil', n: '기름', r: '수단Ⅲ 염색', how: '빨간 기름방울이 많을수록 많아요', c: ['#E4ECEE', '#E4ECEE', '#E4ECEE', '#E4ECEE'], drops: [1, 4, 9, 18] },
    { p: 'bod', n: '유기물', r: '과망간산칼륨', how: '보라색이 옅어질수록 많아요', c: ['#6F2A8A', '#9150A6', '#C39BCB', '#E9DDE2'] }
  ];
  const LV = ['평소', '조금', '많이', '아주 많이'];
  const DT = [{ p: 'benzene', n: '벤젠', max: 60, c: '#8C6B4A' }, { p: 'toluene', n: '톨루엔', max: 300, c: '#9A6A3A' }, { p: 'h2s', n: '황화수소', max: 200, c: '#3E3A36' }];
  function drawDrops(g, x, y, w, n, seed) { const r = ucRng(seed); for (let i = 0; i < n; i++) { const dx = (r() - 0.5) * w * 0.8, dy = r() * 10, rad = 1.6 + r() * 2.6; g.fillStyle = '#D7263D'; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x + dx - rad * 0.3, y + dy - rad * 0.3, rad * 0.35, 0, 7); g.fill(); } }
  P.reagentMenu = function () {
    const ss = this.samples.filter(s => s.kind === 'water' || s.kind === 'air');
    if (!ss.length) { this.dialog('⚗️', '시약 실험', '시험할 <b>물 시료</b>나 <b>공기 시료</b>가 없어요. 강에서 물을 뜨거나, 대기·악취 센서에서 공기 시료를 받아 오세요.', [['알겠어요', () => this.closeDialog()]]); return; }
    this.dialog('⚗️', '시약 실험 — 시료 고르기', '물 시료는 <b>시약 5가지</b>를 넣어 색으로, 공기 시료는 <b>검지관 3가지</b>로 어떤 물질이 많은지 빠르게 알아봐요. 간이 시험이라 비슷한 물질에도 반응해요 — 확정은 📊 연구원 분석으로. (시료는 조금만 써서 연구원 분석도 그대로 맡길 수 있어요)',
      ss.map(s => [(s.rtest ? '✓ ' : '') + s.label.replace(/^💧 물 /, '💧 ').replace(/^🌫 공기 /, '🌫 ') + (s.rtest ? ' (이미 실험함)' : ''), () => { if (s.rtest) { this.toast('이미 실험한 시료예요 — 수첩에 결과가 있어요'); return; } this.closeDialog(); if (s.kind === 'air') this.startTubes(s); else this.startReagent(s); }]).concat([['그만두기', () => this.closeDialog()]]));
  };
  P.startReagent = function (sm) {
    if (this.mg) return; const C = this.C, where = sm.label.replace(/^💧 물 /, '');
    const ex = p => { const Q = UC_POL[p]; return Math.max(0, ucWaterConc(C, p, sm.river, sm.s, sm.takenH) - Q.base) / Q.peak; };
    const items = RG.map((r, i) => { const f = r.p === 'bod' ? ex('bod') + 0.5 * ex('phenol') + 0.3 * ex('oil') : ex(r.p); return Object.assign({}, r, { i, lv: f < 0.03 ? 0 : f < 0.1 ? 1 : f < 0.3 ? 2 : 3, done: false, miss: 0 }); });   // 과망간산칼륨은 다른 유기물에도 반응
    let ph = 'pick', t = 0, cur = null, fb = null, fbT = 0, done = false; const hit = { tubes: [], sw: [] };
    const finish = () => {
      if (done) return; done = true; const D = items.filter(i => i.done); if (!D.length) return; sm.rtest = true; this.spend(0.25);
      const Qc = UC_POL[C.pol], pt = ucPoint(C.point), cul = items.find(i => i.p === C.pol), top = D.slice().sort((a, b) => b.lv - a.lv || (a.p === 'bod') - (b.p === 'bod'))[0], strong = D.filter(i => i.lv >= 2);
      let key = false; if (Qc.path === 'water' && pt && pt.kind === 'water' && cul && cul.done) { const d = ucDownstream(pt.river, pt.s, sm.river, sm.s); if (d >= 0 && d < 140 && cul.lv >= 2) key = true; if (sm.river === pt.river && sm.s < pt.s && pt.s - sm.s < 70 && cul.lv <= 1) key = true; }   // 바로 위가 '평소·조금'(기준 안의 평소 배출 정도)이면 깨끗한 쪽
      const rows = D.map(i => '<tr' + (i.lv >= 2 ? ' class="hotrow"' : '') + '><th>' + i.n + '</th><td>' + i.r + '</td><td>' + (i.drops ? '빨간 방울 ' + ['거의 없음', '조금', '많음', '아주 많음'][i.lv] : '<span class="mg-sw" style="background:' + i.c[i.lv] + '"></span>') + '</td><td><b>' + LV[i.lv] + '</b></td></tr>').join('');
      const hints = []; if (top.lv >= 2) { hints.push(['①', '크게 반응한 시약: <b>' + strong.map(i => i.n + '(' + LV[i.lv] + ')').join(' · ') + '</b> → 오염물질 <b>후보</b>예요. 간이 시약은 비슷한 물질에도 반응해요 (과망간산칼륨은 페놀·기름 같은 다른 유기물에도) → 📊 연구원 분석 숫자로 확인하세요']); hints.push(['③', '이 시료를 뜬 곳까지 오염물질이 내려왔어요 → 출발점은 여기보다 위쪽(상류)']); }
      else hints.push(['①', '크게 반응한 시약이 없어요 → 이 자리는 깨끗하거나 오염이 아직 안 닿았어요 (조금 반응은 다른 시설의 평소 배출일 수 있어요)']);
      this.addEvidence({ title: '⚗️ 시약 실험 · ' + where, key, html: '<table><tr><th>찾는 물질</th><th>시약</th><th>색</th><th>양</th></tr>' + rows + '</table><p class="dim">시료를 뜬 시각 ' + H(sm.takenH) + ' · 비교표: 평소 · 조금 · 많이 · 아주 많이 (시약마다 비교표가 달라요)</p>' + hintBox(hints) });
      this.toast('⚗️ 시약 실험 결과를 수첩에 적었어요');
    };
    const pickTube = it => { if (!it || it.done || ph !== 'pick') return; cur = it; ph = 'mix'; t = 0; fb = null; SND('jump'); };
    const choose = k => { if (ph !== 'match' || !cur) return; if (k === cur.lv) { cur.done = true; fb = { ok: true, txt: '✓ ' + cur.n + ' — ' + LV[k] }; SND('gem'); buzz(20); ph = 'pick'; }
      else { cur.miss++; if (cur.miss >= 2) { cur.done = true; fb = { ok: false, txt: '정답은 “' + LV[cur.lv] + '” — 색을 한 번 더 비교해 보세요' }; ph = 'pick'; SND('bump'); } else { fb = { ok: false, txt: k < cur.lv ? '실제로는 더 많아 보여요 — 오른쪽 칸과 비교해 보세요' : '실제로는 더 적어 보여요 — 왼쪽 칸과 비교해 보세요' }; SND('bump'); } }
      fbT = 2.2; if (ph === 'pick' && items.every(i => i.done)) { ph = 'summary'; t = 0; } };
    const m = this.mgOpen({ emoji: '⚗️', title: '시약 실험 — ' + where, act: '다음 시약 넣기',
      down: p => {
        if (ph === 'summary') { finish(); this.closeDialog(); return; }
        if (p) { const tb = hit.tubes.find(q => Math.abs(q.x - p[0]) < q.w && p[1] > q.y0 - 10 && p[1] < q.y1 + 30); if (tb && ph === 'pick') { pickTube(items[tb.i]); return; } const sw = hit.sw.find(q => Math.abs(q.x - p[0]) < q.w / 2 + 6 && Math.abs(q.y - p[1]) < q.h / 2 + 10); if (sw) choose(sw.k); return; }
        if (ph === 'pick') pickTube(items.find(i => !i.done));
      },
      onClose: () => finish(),
      state: () => ({ ph, cur: cur && cur.i, lv: items.map(i => i.lv), done: items.map(i => i.done), sw: hit.sw.map(q => [q.x, q.y, q.k]), tubes: hit.tubes.map(q => [q.x, (q.y0 + q.y1) / 2, q.i]) }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; fbT = Math.max(0, fbT - dt); const compact = H2 < 300;
        const bgG = g.createLinearGradient(0, 0, 0, H2); bgG.addColorStop(0, '#E9EEF2'); bgG.addColorStop(1, '#C9D2DA'); g.fillStyle = bgG; g.fillRect(0, 0, W, H2);   // 실험대
        g.fillStyle = '#9AA6B2'; g.fillRect(0, H2 * (compact ? 0.62 : 0.58), W, 3);
        // 시험관 선반
        const n = items.length, tw = Math.min(46, W / (n * 2.1)), th = Math.min(H2 * (compact ? 0.42 : 0.36), 150), y0 = H2 * 0.08; hit.tubes = [];
        items.forEach((it, i) => { const x = W * (0.12 + i * (0.76 / (n - 1))), yb = y0 + th; hit.tubes.push({ i, x, w: tw * 0.8, y0, y1: yb });
          const mixing = cur === it && ph === 'mix', k = mixing ? clamp((t - 0.5) / 0.9, 0, 1) : (it.done || (cur === it && ph === 'match')) ? 1 : 0, liq = k > 0 ? mixC('#E4ECEE', it.c[it.lv], k) : '#E4ECEE';
          if (cur === it && ph !== 'pick') { g.fillStyle = 'rgba(255,209,102,.35)'; rr(g, x - tw * 0.9, y0 - 8, tw * 1.8, th + 16, 14); g.fill(); }
          g.fillStyle = liq; rr(g, x - tw / 2 + 3, y0 + th * 0.3, tw - 6, th * 0.7 - 3, (tw - 6) / 2); g.fill();   // 액체
          if (mixing && t < 1.4) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < 6.28; a += 0.3) { const rr3 = (tw * 0.25) * (1 - a / 6.28), px = x + Math.cos(a + t * 8) * rr3, py = y0 + th * 0.62 + Math.sin(a + t * 8) * rr3; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); }
          if (it.drops && k > 0) drawDrops(g, x, y0 + th * 0.31, tw - 6, Math.round(it.drops[it.lv] * k), 77 + i);
          g.strokeStyle = 'rgba(60,70,85,.75)'; g.lineWidth = 2; rr(g, x - tw / 2, y0, tw, th, tw / 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - tw * 0.3, y0 + 6, 3, th - 16);   // 유리
          if (mixing && t < 0.6) { g.fillStyle = '#5B6570'; g.fillRect(x - 3, y0 - 34 + t * 10, 6, 26); g.fillStyle = it.c[Math.max(1, it.lv)]; g.beginPath(); g.arc(x, y0 - 4 + (t * 90) % 40, 3, 0, 7); g.fill(); }   // 스포이트
          txt(g, it.n, x, yb + 16, F8(compact || W < 520 ? 12 : 13), '#1B2230'); if (!compact && W >= 520) txt(g, it.r, x, yb + 30, F6(10.5), '#5B6570');
          if (it.done) txt(g, '✓ ' + LV[it.lv], x, compact || W < 520 ? yb + 30 : yb + 44, F8(12), it.lv >= 2 ? '#C0283A' : '#1F8A55'); });
        // 색 비교표 (지금 시험관)
        hit.sw = [];
        if (cur && (ph === 'match' || (ph === 'mix' && t > 1.4))) { if (ph === 'mix') ph = 'match';
          const sy = H2 * (compact ? 0.82 : 0.78), sw = Math.min(W * 0.16, 110), shh = Math.min(H2 * 0.16, 56), gap = sw * 0.22, x0 = W / 2 - (sw * 4 + gap * 3) / 2;
          if (W < 520) { txt(g, cur.n + ' 비교표 — ' + cur.how, W / 2, sy - shh / 2 - 26, F8(12.5), '#1B2230'); txt(g, '시험관과 같은 색 칸을 누르세요', W / 2, sy - shh / 2 - 9, F7(11.5), '#34404F'); }
          else txt(g, cur.n + ' 색 비교표 — ' + cur.how + ' · 시험관과 같은 칸을 누르세요', W / 2, sy - shh / 2 - 10, F8(compact ? 12 : 13.5), '#1B2230');
          for (let k = 0; k < 4; k++) { const x = x0 + k * (sw + gap) + sw / 2; hit.sw.push({ k, x, y: sy, w: sw, h: shh }); g.fillStyle = cur.c[k]; rr(g, x - sw / 2, sy - shh / 2, sw, shh, 10); g.fill(); g.strokeStyle = 'rgba(40,50,60,.5)'; g.lineWidth = 1.5; g.stroke();
            if (cur.drops) drawDrops(g, x, sy - shh / 2 + 6, sw * 0.9, cur.drops[k], 9 + k); txt(g, LV[k], x, sy + shh / 2 + 14, F8(12), '#1B2230'); } }
        else if (ph === 'pick') { g.font = F7(compact ? 12.5 : 14); g.fillStyle = '#34404F'; g.textAlign = 'center'; wrapText(g, '시험관을 눌러 시약을 넣어요 — 색이 변하면 비교표에서 같은 색을 골라요', W / 2, H2 * (compact ? 0.8 : 0.76), W - 40, 18); }
        if (fbT > 0 && fb) { g.globalAlpha = clamp(fbT * 2, 0, 1); rr(g, W / 2 - 170, H2 * (compact ? 0.64 : 0.6) + 4, 340, 26, 10); g.fillStyle = fb.ok ? 'rgba(31,191,106,.92)' : 'rgba(230,57,70,.9)'; g.fill(); txt(g, fb.txt, W / 2, H2 * (compact ? 0.64 : 0.6) + 22, F8(13), '#fff'); g.globalAlpha = 1; }
        // 요약
        if (ph === 'summary') { const cw = Math.min(W * 0.9, 460), chh = Math.min(H2 * 0.92, 290), cx = (W - cw) / 2, cy = (H2 - chh) / 2, lh = compact ? 19 : 24; card(g, cx, cy, cw, chh, Math.min(1, t * 5)); let y = cy + (compact ? 24 : 32);
          txt(g, '시약 실험 결과', W / 2, y, F9(compact ? 16 : 19), '#FFF6DA'); y += lh + 2; g.textAlign = 'left'; g.font = F7(compact ? 13 : 14.5);
          items.forEach(i => { g.fillStyle = i.c[i.lv]; if (!i.drops) { rr(g, cx + 24, y - 12, 18, 14, 4); g.fill(); } else drawDrops(g, cx + 33, y - 12, 16, Math.min(6, i.drops[i.lv]), 5); g.fillStyle = i.lv >= 2 ? '#FF9A8A' : '#C9D0DD'; g.fillText(i.n + ' — ' + LV[i.lv], cx + 50, y); y += lh; });
          const st2 = items.filter(i => i.lv >= 2); g.textAlign = 'center'; g.font = F8(compact ? 13 : 14.5); g.fillStyle = '#FFD166'; wrapText(g, st2.length ? '크게 반응: ' + st2.map(i => i.n).join(' · ') + ' → ① 후보 (📊 연구원 분석으로 확인)' : '크게 반응한 시약이 없어요 — 이 자리는 깨끗한 편', W / 2, y + 4, cw - 36, 18); g.globalAlpha = 1; }
        m.sub('물 시료 · ' + where); m.cnt('시약 ' + items.filter(i => i.done).length + ' / ' + n);
        m.tip(ph === 'summary' ? '수첩에 적으면 증거로 쓸 수 있어요' : ph === 'match' ? '시험관 색과 가장 비슷한 칸을 눌러요' : ph === 'mix' ? '시약을 넣는 중…' : '시험관을 눌러 시약을 넣어요 (또는 아래 단추)');
        m.act(ph === 'summary' ? '📓 수첩에 적기' : ph === 'pick' ? '다음 시약 넣기' : ph === 'mix' ? '…' : '비교표에서 골라요');
      } });
  };
  // 공기 시료: 검지관 — 펌프로 공기를 빨아들이면 그 물질이 있는 만큼 색이 번져요 → 번진 끝의 눈금 읽기
  P.startTubes = function (sm) {
    if (this.mg) return; const C = this.C, where = sm.label.replace(/^🌫 공기 /, '');
    const pk = p => sm.airPeak ? sm.airPeak[p] : UC_POL[p].base, xs = p => Math.max(0, pk(p) - UC_POL[p].base);
    const items = DT.map((d, i) => { const v = pk(d.p) + (d.p === 'benzene' ? 0.15 * xs('toluene') : d.p === 'toluene' ? 0.4 * xs('benzene') : 0); return Object.assign({}, d, { i, v, fr: clamp(v / d.max, 0.02, 1), grow: 0, read: null, miss: 0, done: false }); });   // 벤젠관은 톨루엔에도, 톨루엔관은 벤젠에도 조금 반응
    let ph = 'pump', idx = 0, t = 0, fb = null, fbT = 0, done = false; const geo = [];
    const finish = () => {
      if (done) return; done = true; const D = items.filter(i => i.done); if (!D.length) return; sm.rtest = true; this.spend(0.25);
      const Qc = UC_POL[C.pol], cul = items.find(i => i.p === C.pol), key = Qc.path === 'air' && !!cul && cul.done && cul.v > Qc.base * 5;
      const rat = i => i.v / UC_POL[i.p].base, top = D.slice().sort((a, b) => rat(b) - rat(a))[0];
      const rows = D.map(i => '<tr' + (rat(i) >= 5 ? ' class="hotrow"' : '') + '><th>' + i.n + '</th><td><b>' + (i.read != null ? i.read : Math.round(i.v)) + ' ppb</b></td><td class="dim">평소 ' + UC_POL[i.p].base + ' ppb · 약 ' + Math.max(1, Math.round(rat(i))) + '배</td></tr>').join('');
      const hi = D.filter(i => rat(i) >= 5).sort((a, b) => rat(b) - rat(a));
      const hints = rat(top) >= 5 ? [['①', '평소보다 크게 높은 관: <b>' + hi.map(i => i.n + ' ' + Math.round(rat(i)) + '배').join(' · ') + '</b> → 오염물질 <b>후보</b>예요. 검지관은 비슷한 물질에도 조금 반응해요 (벤젠관 ↔ 톨루엔관) → 📊 연구원 분석으로 확인하고, 냄새도 맞는지 보세요 (' + hi.map(i => i.n + ': ' + UC_POL[i.p].smell).join(' · ') + ')'], ['②', '그 물질을 허가받은 시설은 여럿이에요 — 🗂 서류(허가 물질)와 🧭 바람길로 좁혀요']] : [['①', '크게 높은 물질이 없어요 — 냄새가 심했던 다른 센서의 공기 시료도 확인해 보세요']];
      this.addEvidence({ title: '⚗️ 검지관 · ' + where, key, html: '<table><tr><th>물질</th><th>읽은 눈금</th><th></th></tr>' + rows + '</table><p class="dim">센서가 밤사이 냄새가 가장 심했을 때 자동으로 채집해 둔 공기예요.</p>' + hintBox(hints) });
      this.toast('⚗️ 검지관 결과를 수첩에 적었어요');
    };
    const readAt = x => { const q = geo[idx]; if (!q || ph !== 'read') return; const it = items[idx], val = clamp((x - q.x0) / (q.x1 - q.x0), 0, 1) * it.max, ok = Math.abs(val - it.v) <= it.max * 0.07;
      if (ok) { it.read = Math.round(it.v); it.done = true; fb = { ok: true, txt: '✓ ' + it.n + ' 약 ' + it.read + ' ppb' }; SND('gem'); }
      else { it.miss++; if (it.miss >= 2) { it.read = Math.round(it.v); it.done = true; fb = { ok: false, txt: '번진 끝은 약 ' + it.read + ' ppb 눈금이에요' }; SND('bump'); } else { fb = { ok: false, txt: val < it.v ? '색이 번진 끝은 더 오른쪽이에요' : '색이 번진 끝은 더 왼쪽이에요' }; SND('bump'); } }
      fbT = 2.2; if (it.done) { if (idx < items.length - 1) { idx++; ph = 'pump'; } else { ph = 'summary'; t = 0; } } };
    const m = this.mgOpen({ emoji: '⚗️', title: '검지관 — ' + where, act: '펌프 당기기 (누르고 있기)',
      down: p => { if (ph === 'summary') { finish(); this.closeDialog(); return; } if (ph === 'read' && p) readAt(p[0]); },
      onClose: () => finish(),
      state: () => ({ ph, idx, geo: geo.map(q => [q.x0, q.x1, q.y]), items: items.map(i => ({ v: i.v, max: i.max, grow: i.grow, done: i.done })) }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; fbT = Math.max(0, fbT - dt); const compact = H2 < 300, it = items[idx];
        if (ph === 'pump' && m.held) { it.grow = Math.min(1, it.grow + dt / 1.6); if (it.grow >= 1) { ph = 'read'; SND('hitmark'); } }
        const bgG = g.createLinearGradient(0, 0, 0, H2); bgG.addColorStop(0, '#E9EEF2'); bgG.addColorStop(1, '#C9D2DA'); g.fillStyle = bgG; g.fillRect(0, 0, W, H2);
        const nar = W < 520, x0 = nar ? W * 0.07 : W * 0.16, x1 = nar ? W * 0.82 : W * 0.86, rowH = (H2 * (compact ? 0.86 : 0.8)) / items.length, th = Math.min(22, rowH * 0.24); geo.length = 0;
        items.forEach((d, i) => { const y = H2 * 0.08 + rowH * (i + 0.62); geo.push({ x0, x1, y });
          if (i === idx && ph !== 'summary') { g.fillStyle = 'rgba(255,209,102,.3)'; rr(g, nar ? 4 : x0 - 60, y - rowH * 0.55, nar ? W - 8 : x1 - x0 + 92, rowH * 0.92, 12); g.fill(); }
          if (nar) txt(g, d.n, x0, y - th / 2 - 28, F8(12.5), '#1B2230', 'left'); else txt(g, d.n, x0 - 12, y + 5, F8(compact ? 12.5 : 14), '#1B2230', 'right');
          // 눈금
          for (let k = 0; k <= 10; k++) { const x = lerp(x0, x1, k / 10); g.strokeStyle = '#5B6570'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - th / 2 - (k % 2 ? 4 : 8)); g.lineTo(x, y - th / 2); g.stroke(); if (k % 2 === 0) txt(g, String(Math.round(d.max * k / 10)), x, y - th / 2 - 11, F6(compact ? 9.5 : 10.5), '#34404F'); }
          // 유리관 · 흰 알갱이 · 번진 색
          g.fillStyle = '#F7F5EE'; rr(g, x0, y - th / 2, x1 - x0, th, th / 2); g.fill(); const len = (x1 - x0) * d.fr * d.grow; if (len > 1) { g.fillStyle = d.c; rr(g, x0, y - th / 2, len, th, th / 2); g.fill(); }
          g.strokeStyle = 'rgba(60,70,85,.7)'; g.lineWidth = 2; rr(g, x0 - 6, y - th / 2 - 3, x1 - x0 + 12, th + 6, th / 2 + 3); g.stroke(); txt(g, 'ppb', x1 + 22, y - th / 2 - 11, F6(10), '#34404F');
          if (d.done) txt(g, '✓ ' + d.read, x1 + 22, y + 5, F8(12), rat2(d) >= 5 ? '#C0283A' : '#1F8A55');
          if (i === idx && ph === 'pump') { g.fillStyle = '#5B6570'; rr(g, x1 + 8, y - 8, 30 + (m.held ? Math.sin(now * 12) * 4 : 0), 16, 5); g.fill(); } });
        function rat2(d) { return d.v / UC_POL[d.p].base; }
        if (fbT > 0 && fb) { g.globalAlpha = clamp(fbT * 2, 0, 1); rr(g, W / 2 - 160, H2 - 34, 320, 26, 10); g.fillStyle = fb.ok ? 'rgba(31,191,106,.92)' : 'rgba(230,57,70,.9)'; g.fill(); txt(g, fb.txt, W / 2, H2 - 16, F8(13), '#fff'); g.globalAlpha = 1; }
        if (ph === 'summary') { const cw = Math.min(W * 0.9, 440), chh = Math.min(H2 * 0.9, 230), cx = (W - cw) / 2, cy = (H2 - chh) / 2, lh = compact ? 20 : 26; card(g, cx, cy, cw, chh, Math.min(1, t * 5)); let y = cy + (compact ? 26 : 34);
          txt(g, '검지관 결과', W / 2, y, F9(compact ? 16 : 19), '#FFF6DA'); y += lh; g.textAlign = 'left'; g.font = F7(compact ? 13 : 14.5);
          items.forEach(d => { const r = rat2(d); g.fillStyle = r >= 5 ? '#FF9A8A' : '#C9D0DD'; g.fillText(d.n + ' ' + d.read + ' ppb · 평소의 약 ' + Math.max(1, Math.round(r)) + '배', cx + 26, y); y += lh; });
          const hi2 = items.filter(d => rat2(d) >= 5).sort((a, b) => rat2(b) - rat2(a)); g.textAlign = 'center'; g.fillStyle = '#FFD166'; g.font = F8(compact ? 13 : 14.5); wrapText(g, hi2.length ? '크게 높은 관: ' + hi2.map(d => d.n).join(' · ') + ' → ① 후보 (📊 연구원 분석으로 확인)' : '크게 높은 물질이 없어요', W / 2, y + 4, cw - 36, 18); g.globalAlpha = 1; }
        m.sub('공기 시료 · ' + where); m.cnt('검지관 ' + items.filter(d => d.done).length + ' / ' + items.length);
        m.tip(ph === 'pump' ? it.n + ' 검지관: 누르고 있으면 펌프로 공기를 빨아들여요 — 그 물질이 많을수록 색이 멀리 번져요' : ph === 'read' ? '색이 번진 끝의 눈금을 눌러 읽어요' : '수첩에 적으면 증거로 쓸 수 있어요');
        m.act(ph === 'pump' ? '펌프 당기기 (누르고 있기)' : ph === 'read' ? '눈금을 눌러 읽기' : '📓 수첩에 적기');
      } });
  };

  // ── 🛸 드론 열화상 사진 (하천관리소) ── 밤마다 1시간 간격으로 찍은 공단 열화상 사진: 평소 밤 ↔ 어젯밤 틀린 그림 찾기
  //   뜨거운 폐수·연기는 밝게 보여요 · 트럭·작업등처럼 상관없는 것도 달라져요 · 허가된 평소 배출은 두 사진 모두에 있음
  //   평소엔 없던 열은 범인의 몰래 배출일 수도, 계측기 고장 때 흘려보낸 깨끗한 물·수증기일 수도 있어요 (ucNightEvents) — 사진엔 시설·배출구 이름 대신 위치만
  //   배터리가 한정돼 사진은 몇 장만 (다른 조사로 시각을 좁힌 뒤 확인하는 도구 — 예전엔 이름까지 나와 이것 하나로 ②③④가 풀렸음)
  const DZ = UC_ZONES;   // 구역 (ulsan-case.js — 이상한 일을 범인 구역에도 하나씩 넣을 때도 씀)
  const THP = [[0, [30, 16, 60]], [0.3, [120, 24, 110]], [0.55, [220, 60, 50]], [0.75, [250, 150, 30]], [1, [255, 248, 210]]];
  const thc = (k, a) => { k = clamp(k, 0, 1); let i = 0; while (i < THP.length - 2 && k > THP[i + 1][0]) i++; const [k0, c0] = THP[i], [k1, c1] = THP[i + 1], f = (k - k0) / (k1 - k0); return 'rgba(' + c0.map((v, j) => Math.round(v + (c1[j] - v) * f)).join(',') + ',' + a + ')'; };
  const heat = (g, x, y, r, k) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, thc(k, 1)); gr.addColorStop(0.5, thc(k * 0.8, 0.75)); gr.addColorStop(1, thc(k * 0.4, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  // 글자 칸 겹침 피하기: 후보 자리 중 이미 놓인 칸과 안 겹치는 첫 자리 (없으면 첫 후보)
  const freeAt = (placed, x, y, w, h) => !placed.some(b => x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]);
  const pickSpot = (placed, cands, w, h) => { const f = cands.find(c => freeAt(placed, c[0], c[1], w, h)) || cands[0]; placed.push([f[0], f[1], w, h]); return f; };
  const dongAt = (x, z) => { if (typeof UG === 'undefined' || !UG.dongs) return ''; const inRing = r => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }; const d = UG.dongs.find(q => q.rings.some(inRing)); return d ? d.n : ''; };
  const DRONE_N = d => d === 'easy' ? 8 : 6;
  P.droneLeft = function () { return Math.max(0, DRONE_N(this.set.diff) - this.miniState().drone.length); };
  P.droneMenu = function () {
    const left = this.droneLeft();
    this.dialog('🛸', '야간 드론 열화상 사진 — 어느 구역?', '밤마다 드론이 공단 위를 날며 <b>열화상 사진</b>을 찍어요. 뜨거운 폐수·연기는 밝게 보여요. <b>평소 밤 사진</b>과 <b>어젯밤 사진</b>을 비교해 달라진 곳을 찾아보세요. (사진 한 장 10분)<br>🔋 <b>새로 볼 수 있는 사진 ' + left + '장</b> — 다른 조사로 시각을 좁힌 뒤 확인해 보세요. 이미 본 사진은 다시 볼 수 있어요.',
      DZ.map(z => [z.n + ' — ' + z.f.map(k => short(UC_FAC[k])).join(' · '), () => this.droneTime(z)]).concat([['그만두기', () => this.closeDialog()]]));
  };
  P.droneTime = function (z) {
    const M = this.miniState(), seen = h => M.drone.find(d => d.z === z.id && d.h === h), hs = [], left = this.droneLeft(); for (let h = 19; h <= 31; h++) hs.push(h);
    this.dialog('🛸', z.n + ' — 몇 시 사진을 볼까요?', '<p>어젯밤 드론은 <b>1시간마다</b> 사진을 찍었어요. 한 장씩 골라 평소 밤과 비교해요. (✓ = 이미 본 사진 · 🔥 = 평소엔 없던 열이 있었던 사진)</p><p>🔋 새로 볼 수 있는 사진 <b>' + left + '장</b></p><div class="mg-grid">' + hs.map(h => { const d = seen(h); return '<button data-h="' + h + '" class="' + (d ? (d.hot ? 'seen hot' : 'seen') : left ? '' : 'off') + '">' + (d ? (d.hot ? '🔥 ' : '✓ ') : '') + (h % 24) + '시</button>'; }).join('') + '</div>',
      [['다른 구역 고르기', () => this.droneMenu()], ['그만두기', () => this.closeDialog()]]);
    this.ui.dlg.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => { const h = +b.dataset.h; if (!seen(h) && !this.droneLeft()) { this.toast('🔋 드론 배터리가 다 됐어요 — 이미 본 사진만 다시 볼 수 있어요'); return; } this.closeDialog(); this.startDrone(z, h); }));
  };
  P.startDrone = function (z, hr) {
    if (this.mg) return; const C = this.C, hard = this.set.diff === 'hard', rng = ucRng((Math.abs(Math.floor(this.seed || 1)) % 99991) * 7 + hr * 131 + z.id.length * 977 + this.caseNo * 31);
    let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9; const ext = (x, zz) => { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, zz); bz1 = Math.max(bz1, zz); };
    z.f.forEach(k => { const F = UC_FAC[k], Y = ucYard(F); ext(Y[0], Y[1]); ext(Y[2], Y[3]); F.outs.forEach(o => { const R = UC_RIVERS[o.river]; ext(...ucAt(R.pts, o.s)); ext(...ucAt(R.pts, Math.min(ucLen(R.pts), o.s + 16))); }); F.stacks.forEach(s => ext(s.x, s.z)); });
    bx0 -= 10; bz0 -= 10; bx1 += 10; bz1 += 10;
    const w = C.wind[clamp(hr - 18, 0, C.wind.length - 1)], pt = ucPoint(C.point), on = z.f.indexOf(C.fac) >= 0 && hr + 1e-6 >= C.t0 && hr <= C.t0 + C.dur;
    const acts = ucNightEvents(C).filter(e => z.f.indexOf(e.fac) >= 0 && hr + 1e-6 >= e.h && hr <= e.h + e.dur), M0 = this.miniState();
    if (!M0.drone.some(d => d.z === z.id && d.h === hr)) M0.drone.push({ z: z.id, h: hr, hot: acts.length > 0 });   // 사진을 여는 순간 배터리 한 칸 (다 안 찾고 닫아도)
    const plume = (p, k, len) => { const out = []; if (p.kind === 'water') { const R = UC_RIVERS[p.river], L = ucLen(R.pts); for (let d = 0; d <= len; d += 1.2) { const q = ucAt(R.pts, Math.min(L, p.s + d)); out.push({ x: q[0], z: q[1], r: 3 + d * 0.16, k: k * (1 - d / len * 0.7) }); } }
      else for (let d = 0; d <= len; d += 1.2) out.push({ x: p.x + Math.cos(w.dir) * d, z: p.z + Math.sin(w.dir) * d, r: 2.4 + d * 0.28, k: k * (1 - d / len * 0.6) }); return out; };
    const warm = [], diffs = [];
    if (typeof UWORLD !== 'undefined') z.f.forEach(k => { const Y = ucYard(UC_FAC[k]), B = UWORLD.b, inY = []; for (let i = 0; i < B.length; i += 9) { const x = B[i + 1], zz = B[i + 2]; if (x > Y[0] && x < Y[2] && zz > Y[1] && zz < Y[3]) inY.push([x, zz, B[i + 3] * B[i + 4]]); } inY.sort((a, b) => b[2] - a[2]).slice(0, 2).forEach(b => warm.push({ x: b[0], z: b[1], r: 4.5, k: 0.33 })); });
    C.decoys.forEach(dc => { if (z.f.indexOf(dc.fac) >= 0 && dc.point) plume(dc.point, 0.34, 7).forEach(q => warm.push(q)); });   // 허가된 평소 배출: 두 사진 모두
    acts.forEach(e => { const q = ucPoint(e.point), water = q.kind === 'water', R = water ? UC_RIVERS[q.river] : null, len = water ? Math.min(18, (hr - e.h) * R.speed * UC_KM + 5) : 18, pts = plume(q, 0.97, len), F = UC_FAC[e.fac];
      const loc = water ? R.name + ' ' + (q.s / UC_KM).toFixed(1) + 'km 물가' : ucPlaceText(Object.assign({ kind: 'air' }, q)) + ' 자리', what = water ? '뜨거운 물' : '진한 연기';   // 서류의 위치 글자와 같게   // 이름(배출구 번호) 대신 위치만 — 서류의 배출구 위치와 맞춰 봐야 해요
      diffs.push({ kind: 'hot', cul: e.kind === 'illegal', pts, x: pts[0].x, z: pts[0].z, r: 6, water, short: '🔥 ' + what + ' — 평소엔 없음', label: '🔥 ' + loc + (hard ? '' : ' (' + short(F) + ' 쪽)') + '에서 ' + what + (water ? '이 강으로' : '가') + ' 나오고 있었어요 — 평소엔 없음', loc: loc + (hard ? '' : ' · ' + short(F) + ' 쪽') }); });
    const roadPts = []; if (typeof UWORLD !== 'undefined') UWORLD.roads.forEach(r => { if (r[0] > 2) return; for (let i = 1; i < r.length; i += 2) { const x = r[i], zz = r[i + 1]; if (x > bx0 + 6 && x < bx1 - 6 && zz > bz0 + 6 && zz < bz1 - 6) roadPts.push([x, zz]); } });
    const kinds = ['truck', 'light', 'car'].sort(() => rng() - 0.5).slice(0, 2);
    kinds.forEach(kd => { let x, zz; if (kd === 'truck' && roadPts.length) [x, zz] = roadPts[Math.floor(rng() * roadPts.length)]; else { const F = UC_FAC[z.f[Math.floor(rng() * z.f.length)]]; if (kd === 'car') [x, zz] = ucGate(F, 3, (rng() - 0.5) * 8); else { const Y = ucYard(F); x = lerp(Y[0] + 3, Y[2] - 3, rng()); zz = lerp(Y[1] + 3, Y[3] - 3, rng()); } }
      diffs.push({ kind: kd, x, z: zz, r: 3.5, short: kd === 'truck' ? '🚚 트럭 — 상관없음' : kd === 'light' ? '💡 작업등 — 상관없음' : '🚗 세운 차 — 상관없음', label: kd === 'truck' ? '🚚 지나가던 트럭 엔진 — 상관없음' : kd === 'light' ? '💡 켜 둔 작업등 — 상관없음' : '🚗 방금 세운 차 — 상관없음' }); });
    let ph = 'look', t = 0, done = false, wrongN = 0; const bad = [], cvs = { a: document.createElement('canvas'), b: document.createElement('canvas'), key: '' }, L = { panels: [] };
    const render = (cv, pw, ph2, dpr, after) => { cv.width = Math.round(pw * dpr); cv.height = Math.round(ph2 * dpr); const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = Math.min(pw / (bx1 - bx0), ph2 / (bz1 - bz0)), ox = (pw - (bx1 - bx0) * s) / 2, oz = (ph2 - (bz1 - bz0) * s) / 2, Pp = (x, zz) => [ox + (x - bx0) * s, oz + (zz - bz0) * s];
      g.fillStyle = '#120A2A'; g.fillRect(0, 0, pw, ph2);
      for (let zz = bz0; zz < bz1; zz += 2) for (let x = bx0; x < bx1; x += 2) { const c = this.cellAt(x + 1, zz + 1); g.fillStyle = c === '0' ? '#0A0C2E' : c === 'i' ? '#2A1746' : c === 'u' ? '#24153F' : '#1A1136'; const [px, pz] = Pp(x, zz); g.fillRect(px, pz, 2 * s + 1, 2 * s + 1); }
      g.lineCap = 'round'; g.lineJoin = 'round'; Object.keys(UC_RIVERS).forEach(rid => { const R = UC_RIVERS[rid]; g.strokeStyle = '#090B30'; g.lineWidth = R.w * s; g.beginPath(); R.pts.forEach((p, i) => { const [px, pz] = Pp(p[0], p[1]); if (i) g.lineTo(px, pz); else g.moveTo(px, pz); }); g.stroke(); });
      if (typeof UWORLD !== 'undefined') { UWORLD.roads.forEach(r => { if (r[0] > 2) return; g.strokeStyle = '#34205C'; g.lineWidth = Math.max(1, [1.25, 2.1, 1.8][r[0]] * s * 0.7); g.beginPath(); for (let i = 1; i < r.length; i += 2) { const [px, pz] = Pp(r[i], r[i + 1]); if (i > 1) g.lineTo(px, pz); else g.moveTo(px, pz); } g.stroke(); });
        const B = UWORLD.b; for (let i = 0; i < B.length; i += 9) { const x = B[i + 1], zz = B[i + 2]; if (x < bx0 - 6 || x > bx1 + 6 || zz < bz0 - 6 || zz > bz1 + 6) continue; const [px, pz] = Pp(x, zz); g.save(); g.translate(px, pz); g.rotate(B[i + 6] * Math.PI / 180); g.fillStyle = '#3D2366'; g.fillRect(-B[i + 3] * s / 2, -B[i + 4] * s / 2, B[i + 3] * s, B[i + 4] * s); g.restore(); }
        const CY = UWORLD.cyl; for (let i = 0; i < CY.length; i += 6) { const x = CY[i], zz = CY[i + 1]; if (x < bx0 || x > bx1 || zz < bz0 || zz > bz1) continue; const [px, pz] = Pp(x, zz); g.fillStyle = '#4A2872'; g.beginPath(); g.arc(px, pz, Math.max(1.5, CY[i + 2] * s), 0, 7); g.fill(); } }
      z.f.forEach(k => { const F = UC_FAC[k], Y = ucYard(F), [ax, az] = Pp(Y[0], Y[1]), [bx, bz] = Pp(Y[2], Y[3]); g.strokeStyle = 'rgba(160,140,220,.45)'; g.setLineDash([4, 4]); g.lineWidth = 1; g.strokeRect(ax, az, bx - ax, bz - az); g.setLineDash([]);
        if (!hard) { g.font = F8(Math.max(10, Math.min(13, s * 3))); g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(10,6,24,.85)'; g.strokeText(short(F), (ax + bx) / 2, az + 13); g.fillStyle = '#E8E0FF'; g.fillText(short(F), (ax + bx) / 2, az + 13); } });
      warm.forEach(q => { const [px, pz] = Pp(q.x, q.z); heat(g, px, pz, q.r * s, q.k); });
      if (after) diffs.forEach(d => { if (d.pts) d.pts.forEach(q => { const [px, pz] = Pp(q.x, q.z); heat(g, px, pz, q.r * s, q.k); }); else { const [px, pz] = Pp(d.x, d.z); if (d.kind === 'truck') { g.fillStyle = thc(0.78, 1); g.fillRect(px - 2.2 * s, pz - 1.2 * s, 4.4 * s, 2.4 * s); heat(g, px, pz, 3 * s, 0.6); } else heat(g, px, pz, (d.kind === 'light' ? 2.2 : 2.8) * s, d.kind === 'light' ? 0.9 : 0.62); } });
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = F6(10); g.textAlign = 'left'; g.fillText('열화상 · 밝을수록 뜨거움', 6, ph2 - 6);
      return { s, ox, oz }; };
    const toW = (P2, px, py) => [bx0 + (px - P2.x - P2.ox) / P2.s, bz0 + (py - P2.y - P2.oz) / P2.s], toS = (P2, x, zz) => [P2.x + P2.ox + (x - bx0) * P2.s, P2.y + P2.oz + (zz - bz0) * P2.s];
    const finish = () => {
      if (done) return; done = true; if (ph !== 'end') return; this.spend(0.17);
      const li = diffs.map(d => '<li>' + (d.found ? '✓ ' : '👀 (알려 줌) ') + d.label + '</li>').join(''), hot = diffs.filter(d => d.kind === 'hot'), wt = hot.length && hot[0].water ? '물' : '연기';
      const hints = hot.length ? [['②', '평소엔 없던 ' + (wt === '물' ? '뜨거운 물' : '진한 연기') + ': <b>' + hot.map(d => d.loc).join(' / ') + '</b> → 몰래 배출일 수도, 계측기가 고장 난 사이 흘려보낸 깨끗한 ' + (wt === '물' ? '물' : '수증기') + '일 수도 있어요. ' + (wt === '물' ? '그 아래 물 시료로 오염됐는지 확인하세요' : '냄새 센서가 그 시각에 반응했는지 확인하세요')],
          ['③', '위치를 🗂 시설 서류의 ' + ucJ(wt === '물' ? '배출구 위치(km)' : '굴뚝 위치', '과', '와') + ' 맞춰 보세요 — 어느 ' + (wt === '물' ? '배출구' : '굴뚝') + '인지는 사진에 안 나와요'], ['④', '<b>' + H(hr) + '</b>에 나오고 있었어요 → 언제 시작했는지는 앞뒤 시각 사진이나 ' + ucJ(wt === '물' ? '⏪ 되감기' : '센서가 처음 반응한 시각', '으로') + ' 좁혀요']]
        : [['④', '이 구역은 <b>' + H(hr) + '</b>엔 평소와 같았어요 (트럭·작업등은 상관없음) → 다른 시각이나 다른 구역도 확인해 보세요']];
      this.addEvidence({ title: '🛸 드론 열화상 · ' + z.n + ' · ' + H(hr).replace(/^(어제|오늘) /, ''), key: on, html: '<p>평소 밤(지난주 같은 시각)과 비교해 달라진 곳 — 찾은 것 ' + diffs.filter(d => d.found).length + '/' + diffs.length + (wrongN ? ' · 잘못 누름 ' + wrongN : '') + '</p><ul class="mg-list">' + li + '</ul>' + hintBox(hints) + '<p class="dim">허가된 평소 배출은 두 사진 모두에 보여서 "달라진 곳"이 아니에요.</p>' });
      this.toast('🛸 드론 사진 비교를 수첩에 적었어요');
    };
    const m = this.mgOpen({ emoji: '🛸', title: '드론 열화상 — ' + z.n + ' · ' + (hr % 24) + '시', act: '다 찾았어요',
      down: p => {
        if (ph === 'end') { if (t > 0.3) { finish(); this.closeDialog(); } return; }
        if (!p) { ph = 'end'; t = 0; return; }
        const P2 = L.panels.find(q => p[0] >= q.x && p[0] <= q.x + q.w && p[1] >= q.y && p[1] <= q.y + q.h); if (!P2) return; const [x, zz] = toW(P2, p[0], p[1]), tol = 14 / P2.s;
        const d = diffs.find(q => !q.found && (q.pts ? q.pts.some(u => Math.hypot(u.x - x, u.z - zz) < Math.max(u.r * 0.8, tol)) : Math.hypot(q.x - x, q.z - zz) < Math.max(q.r, tol)));
        if (d) { d.found = true; SND(d.kind === 'hot' ? 'gem' : 'nom'); buzz(25); if (diffs.every(q => q.found)) { ph = 'end'; t = 0; } } else { bad.push({ p: [x, zz], t: 0.9 }); wrongN++; SND('bump'); }
      },
      onClose: () => { if (ph === 'end') finish(); },
      state: () => ({ ph, on, left: this.droneLeft(), diffs: diffs.map(d => ({ kind: d.kind, cul: !!d.cul, found: !!d.found, s: L.panels[1] ? toS(L.panels[1], d.x, d.z) : null })), panels: L.panels.map(q => [q.x, q.y, q.w, q.h]) }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; const side = W > H2 * 1.25, gp = 8, lab = 18, pw = side ? (W - gp * 3) / 2 : W - gp * 2, ph2 = side ? H2 - gp * 2 - lab : (H2 - gp * 3 - lab * 2) / 2, dpr = m.dpr || 1, key = [Math.round(pw), Math.round(ph2), dpr].join(',');
        if (cvs.key !== key) { cvs.key = key; const A = render(cvs.b, pw, ph2, dpr, false); render(cvs.a, pw, ph2, dpr, true); L.panels = [0, 1].map(i => Object.assign({ x: side ? gp + i * (pw + gp) : gp, y: side ? gp + lab : gp + lab + i * (ph2 + gp + lab), w: pw, h: ph2 }, A)); }
        g.fillStyle = '#07060F'; g.fillRect(0, 0, W, H2);
        L.panels.forEach((q, i) => { g.drawImage(i ? cvs.a : cvs.b, q.x, q.y, q.w, q.h); txt(g, i ? '어젯밤 ' + (hr % 24) + '시' : '평소 밤 (지난주 같은 시각)', q.x + 4, q.y - 5, F8(12.5), i ? '#FFD166' : '#C9D0DD', 'left'); g.strokeStyle = i ? 'rgba(255,209,102,.6)' : 'rgba(255,255,255,.2)'; g.lineWidth = 1.5; g.strokeRect(q.x, q.y, q.w, q.h); });
        // 찾은 곳 (두 사진 모두 동그라미) · 끝나면 못 찾은 곳 점선 · 잘못 누른 곳
        //   이름표 자리: 시설 이름 · 다른 동그라미를 피해서 (어젯밤 사진)
        const placed = [], q1 = L.panels[1];
        if (q1) { if (!hard) z.f.forEach(k => { const F = UC_FAC[k], Y = ucYard(F), [ax, az] = toS(q1, Y[0], Y[1]), [bx] = toS(q1, Y[2], Y[3]); g.font = F8(Math.max(10, Math.min(13, q1.s * 3))); const w = g.measureText(short(F)).width + 6; placed.push([(ax + bx) / 2 - w / 2, az + 2, w, 14]); });
          diffs.forEach(d => { if (!d.found && ph !== 'end') return; const [sx, sy] = toS(q1, d.x, d.z), r = Math.max(14, (d.kind === 'hot' ? 7 : 4) * q1.s); placed.push([sx - r, sy - r, r * 2, r * 2]); }); }
        diffs.forEach(d => { if (!d.found && ph !== 'end') return; L.panels.forEach((q, i) => { const [sx, sy] = toS(q, d.x, d.z), r = Math.max(14, (d.kind === 'hot' ? 7 : 4) * q.s); g.strokeStyle = d.found ? (d.kind === 'hot' ? '#FF5C6C' : '#7DF58F') : 'rgba(255,209,102,.9)'; g.lineWidth = 2.5; if (!d.found) g.setLineDash([5, 4]); g.beginPath(); g.arc(sx, sy, r, 0, 7); g.stroke(); g.setLineDash([]);
          if (i === 1) { g.font = F7(11.5); const lw = Math.min(q.w - 10, 280, g.measureText(d.short).width + 12), cy2 = v => clamp(v, q.y + 4, q.y + q.h - 22), cx2 = v => clamp(v, q.x + 4, q.x + q.w - lw - 4), mx = cx2(sx - lw / 2);
            const [lx, ly] = pickSpot(placed, [[mx, cy2(sy + r + 4)], [mx, cy2(sy - r - 22)], [cx2(sx + r + 4), cy2(sy - 9)], [cx2(sx - r - 4 - lw), cy2(sy - 9)], [mx, cy2(sy + r + 24)], [mx, cy2(sy - r - 42)]], lw, 18);   // 아래 · 위 · 오른쪽 · 왼쪽 · 더 아래 · 더 위
            g.fillStyle = 'rgba(8,10,20,.82)'; rr(g, lx, ly, lw, 18, 6); g.fill(); g.save(); g.beginPath(); g.rect(lx, ly, lw, 18); g.clip(); txt(g, d.short, lx + 6, ly + 13, F7(11.5), d.kind === 'hot' ? '#FFB3BA' : '#C9F7D3', 'left'); g.restore(); } }); });
        for (let i = bad.length - 1; i >= 0; i--) { const b = bad[i]; b.t -= dt; if (b.t <= 0) { bad.splice(i, 1); continue; } L.panels.forEach(q => { const [sx, sy] = toS(q, b.p[0], b.p[1]); g.strokeStyle = 'rgba(230,57,70,' + clamp(b.t * 1.4, 0, 1).toFixed(2) + ')'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx - 7, sy - 7); g.lineTo(sx + 7, sy + 7); g.moveTo(sx + 7, sy - 7); g.lineTo(sx - 7, sy + 7); g.stroke(); }); }
        // 끝 카드: 평소 밤 사진 위에 (그 칸 너비에 맞춰) — 어젯밤 사진의 이름표를 가리지 않게
        if (ph === 'end') { const hot = diffs.filter(d => d.kind === 'hot'), cul = hot[0], q0 = L.panels[0] || { x: 0, y: 0, w: W, h: H2 }, cw = Math.min(q0.w - 12, 480), ch = 64, cx = q0.x + (q0.w - cw) / 2, cy = q0.y + q0.h - ch - 6; card(g, cx, cy, cw, ch, Math.min(1, t * 5));
          const t1 = cul ? '🔥 평소엔 없던 ' + ucJ((cul.water ? '뜨거운 물' : '진한 연기') + (hot.length > 1 ? ' ' + hot.length + '곳' : ''), '을', '를') + ' 찾았어요!' : '이 시각엔 수상한 열이 없어요 (트럭·작업등은 상관없음)', t2 = '찾은 것 ' + diffs.filter(d => d.found).length + ' / ' + diffs.length + ' · 수첩에 적으면 증거가 돼요';
          txt(g, t1, cx + cw / 2, cy + 26, fitF(g, t1, F9, 15, cw - 20), cul ? '#FFB3BA' : '#C9F7D3'); txt(g, t2, cx + cw / 2, cy + 48, fitF(g, t2, F6, 12.5, cw - 20), '#AEB6C6'); g.globalAlpha = 1; }
        m.sub(W < 520 ? '달라진 곳을 눌러요' : '밝을수록 뜨거워요 · 두 사진에서 달라진 곳을 눌러요'); m.cnt('찾음 ' + diffs.filter(d => d.found).length + ' / ' + diffs.length);
        m.tip(ph === 'end' ? '수첩에 적으면 증거로 쓸 수 있어요' : '어젯밤 사진에만 있는 밝은 곳을 눌러요 — 트럭·작업등 같은 것도 섞여 있어요');
        m.act(ph === 'end' ? '📓 수첩에 적기' : '다 찾았어요');
      } });
  };

  // ── 🧭 바람길 거꾸로 그리기 (기상대) ── 냄새가 가장 심했던 시각의 바람을 거슬러 센서에서 선을 긋기 → 선들이 가까이 지나는 굴뚝
  //   바람 화살표 = 바람이 '불어 간' 쪽 → 냄새는 그 반대쪽에서 왔어요 · 연기띠는 넓게 퍼져서 선이 굴뚝을 딱 지나지는 않을 수 있어요
  //   결과는 '선이 모이는 근처 굴뚝 후보'(순위 없이) — 허가 물질(①)과 서류의 끊긴 시각(④)을 맞춰야 하나로 정해져요 (예전엔 1위를 빨간 원으로 짚어 줌)
  const ARW = d => { const a = ((d * 180 / Math.PI) % 360 + 360) % 360; return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][Math.round(a / 45) % 8]; };
  const DIRN = (ux, uz) => { const a = ((Math.atan2(-uz, ux) * 180 / Math.PI) % 360 + 360) % 360; return ['동', '북동', '북', '북서', '서', '남서', '남', '남동'][Math.round(a / 45) % 8]; };
  P.windSensors = function () {
    const C = this.C; return UC_AIR.map(st => { const e = this.evidence.find(x => x.title === '💨 ' + st.name + ' 기록'); if (!e) return { st, read: false };
      const log = ucAirLog(C, st, e.at); let pk = null, first = null; log.forEach(r => { const v = Math.max(r.voc / 8, r.h2s / 5); if (v > 1) { if (first == null) first = r.h; if (!pk || v > pk.v) pk = { h: r.h, v }; } });
      return { st, read: true, h: pk ? pk.h : null, first, w: pk ? C.wind[clamp(pk.h - 18, 0, C.wind.length - 1)] : null }; });
  };
  P.startWind = function () {
    if (this.mg) return; const C = this.C, S = this.windSensors(), smell = S.filter(x => x.h != null);
    if (!smell.length) { this.dialog('🧭', '바람길 거꾸로 그리기', (S.some(x => x.read) ? '읽은 센서 기록에 <b>냄새가 치솟은 때</b>가 없어요.' : '아직 <b>대기·악취 센서 기록</b>을 본 곳이 없어요.') + ' 냄새가 기록된 센서가 있어야 바람을 거슬러 출발지를 찾을 수 있어요. (물 사건이라면 센서에 냄새가 없을 수 있어요)', [['알겠어요', () => this.closeDialog()]]); return; }
    const facs = Object.keys(UC_FAC).filter(k => UC_FAC[k].stacks.length);
    let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9; const ext = (x, z) => { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); };
    S.forEach(x => { if (x.read) ext(x.st.x, x.st.z); }); facs.forEach(k => UC_FAC[k].stacks.forEach(s => ext(s.x, s.z))); bx0 -= 16; bz0 -= 16; bx1 += 16; bz1 += 16;   // 기록 본 센서 + 굴뚝 있는 시설만 (지도를 크게)
    let sel = null, drag = null, fb = null, fbT = 0, t = 0, done = false, flashRay = null; const rays = [], Lm = {};
    const rayDist = (r, x, z) => { const px = x - r.st.x, pz = z - r.st.z, d = px * r.u[0] + pz * r.u[1]; return d < 0 ? Math.hypot(px, pz) : Math.abs(px * r.u[1] - pz * r.u[0]); };
    const rank = () => { if (rays.length < 2) return []; return facs.map(k => ({ k, sc: rays.reduce((a, r) => a + Math.min(...UC_FAC[k].stacks.map(s => rayDist(r, s.x, s.z))), 0) / rays.length })).sort((a, b) => a.sc - b.sc); };
    const cands = () => { const rk = rank(); if (!rk.length) return []; return rk.filter((x, i) => i < 2 || (i < 3 && x.sc < 40)).sort((a, b) => (a.k < b.k ? -1 : 1)); };   // 선이 모이는 곳에 가까운 굴뚝 2~3곳 (순위 없이 — 연기띠가 넓어 선만으로는 하나를 못 정함)
    const firstH = () => { const f = S.filter(x => x.first != null).map(x => x.first); return f.length ? Math.min(...f) : null; };
    const finish = () => {
      if (done) return; done = true; if (!rays.length) return; this.spend(0.17); const top = cands(), fh = firstH();
      const li = rays.map(r => '<li>' + r.st.name + ' — 냄새가 가장 심했던 ' + (r.h % 24) + '시, 바람 ' + ARW(r.w.dir) + ' (불어 간 쪽) → 냄새는 <b>' + DIRN(r.u[0], r.u[1]) + '쪽</b>에서 왔어요</li>').join('');
      const hints = []; if (top.length) { hints.push(['②', '선이 모이는 곳 근처 굴뚝: <b>' + top.map(x => short(UC_FAC[x.k])).join(' · ') + '</b>' + (top.length > 1 ? ' (순서 없음)' : '') + ' → 연기띠는 넓게 퍼져서 선만으로는 범인을 못 정해요. 이 중 ① 물질(📊 분석)을 <b>허가받은</b> 시설을 🗂 서류에서 확인하세요']); hints.push(['③', '그 시설 서류에서 <b>냄새가 난 무렵</b>에 기록이 끊긴(통신 장애) 굴뚝을 찾아보세요 — 다른 시각에 끊긴 굴뚝은 계측기 고장일 수 있어요']); }
      else hints.push(['②', '센서 두 곳 이상에서 선을 그으면 선이 모이는 곳이 보여요']);
      if (fh != null) { const b0 = fh + 0.5, sa = ucSlot(fh - 1.5), sb = Math.min(3, ucSlot(b0));   // 기록 한 칸(h시)은 h시 반쯤 잰 값 — 배출은 늦어도 그때 시작 (연기띠가 처음엔 센서를 비껴갈 수 있어 더 이를 수도)
        hints.push(['④', '냄새가 처음 기록된 칸: <b>' + (fh % 24) + '시</b> → 배출은 늦어도 <b>' + H(b0) + '</b> 전에 시작됐어요 (조금 더 이를 수도 있어요)' + (sa !== sb ? ' — 시간대 ' + UC_SLOTS[sa] + ' ~ ' + UC_SLOTS[sb] + ' 중에서 🗂 서류의 끊긴 시각으로 정해요' : ' — 아마 ' + UC_SLOTS[sa] + ' (🗂 서류의 끊긴 시각으로 확인)')]); }
      this.addEvidence({ title: '🧭 바람 역추적 · 센서 ' + rays.length + '곳', key: rays.length >= 2 && top.some(x => x.k === C.fac), html: '<ul class="mg-list">' + li + '</ul>' + hintBox(hints) + '<p class="dim">연기띠는 넓게 퍼져요 — 선이 굴뚝을 딱 지나지 않아도 가까이 지나면 후보예요.</p>' });
      this.toast('🧭 바람 역추적을 수첩에 적었어요');
    };
    const flash = (s, ok) => { fb = { s, ok }; fbT = 2.6; };
    const m = this.mgOpen({ emoji: '🧭', title: '바람길 거꾸로 그리기', act: '센서를 눌러 시작',
      down: p => {
        if (!p) { if (rays.length) { finish(); this.closeDialog(); } else flash('냄새 난 센서(👃)를 누르고, 냄새가 온 쪽으로 끌어 선을 그어요', false); return; }
        const hitS = S.find(x => { const q = Lm.P && Lm.P(x.st.x, x.st.z); return q && Math.hypot(q[0] - p[0], q[1] - p[1]) < 22; });
        if (hitS) { if (hitS.h != null) { sel = hitS; drag = null; flash(hitS.st.name + ' ' + (hitS.h % 24) + '시 — 화살표는 바람이 불어 간 쪽! 냄새가 온 쪽으로 끌어 보세요', true); SND('hitmark'); } else flash(hitS.read ? '이 센서엔 냄새 기록이 없어요' : '아직 기록을 안 본 센서예요 (센서에서 기록 보기)', false); if (hitS.h == null) return; drag = { x: p[0], y: p[1] }; return; }
        if (sel) drag = { x: p[0], y: p[1] };
      },
      move: p => { if (drag) { drag.x = p[0]; drag.y = p[1]; } },
      up: () => { if (!drag || !sel) { drag = null; return; } const q = Lm.P(sel.st.x, sel.st.z), dx = drag.x - q[0], dy = drag.y - q[1], dl = Math.hypot(dx, dy); drag = null; if (dl < 24) return;
        const ux = -Math.cos(sel.w.dir), uz = -Math.sin(sel.w.dir), ang = Math.acos(clamp((dx * ux + dy * uz) / dl, -1, 1)) * 180 / Math.PI;
        if (ang < 32) { const i = rays.findIndex(r => r.st === sel.st); if (i >= 0) rays.splice(i, 1); rays.push({ st: sel.st, h: sel.h, w: sel.w, u: [ux, uz] }); SND('gem'); buzz(20); flash(rays.length >= 2 ? '✓ 선이 모이는 곳을 보세요! (다른 센서로 더 그어도 돼요)' : '✓ 맞아요! 다른 냄새 센서에서도 그어 보세요', true); }
        else { flashRay = { st: sel.st, d: [dx / dl, dy / dl], t: 1.2 }; SND('bump'); flash(ang > 148 ? '✗ 반대예요 — 화살표는 바람이 불어 간 쪽! 냄새는 반대쪽에서 왔어요' : '조금 더 돌려 보세요 — 화살표와 정반대 쪽으로', false); } },
      onClose: () => finish(),
      state: () => ({ sel: sel && sel.st.id, rays: rays.map(r => r.st.id), rank: rank().slice(0, 3).map(x => [x.k, +x.sc.toFixed(1)]), cands: cands().map(x => x.k), sensors: S.map(x => ({ id: x.st.id, h: x.h, p: Lm.P ? Lm.P(x.st.x, x.st.z) : null, u: x.w ? [-Math.cos(x.w.dir), -Math.sin(x.w.dir)] : null })) }),   // 검사용
      frame: (dt, now, g, W, H2) => {
        t += dt; fbT = Math.max(0, fbT - dt); const side = W > H2 * 1.1, panW = side ? Math.min(250, W * 0.36) : 0, mw = W - panW - (side ? 16 : 12), mh = H2 - (side ? 12 : 64);
        const s = Math.min(mw / (bx1 - bx0), mh / (bz1 - bz0)), ox = 6 + (mw - (bx1 - bx0) * s) / 2, oz = 6 + (mh - (bz1 - bz0) * s) / 2, Pp = (x, z) => [ox + (x - bx0) * s, oz + (z - bz0) * s]; Lm.P = Pp;
        g.fillStyle = '#0E131C'; g.fillRect(0, 0, W, H2);
        // 바탕 지도 (큰 지도 그림을 잘라 씀)
        try { const G = UG.grid, img = this.mapImg(), k = img.width / G.w; g.drawImage(img, (bx0 - G.x0) / G.cell * k, (bz0 - G.z0) / G.cell * k, (bx1 - bx0) / G.cell * k, (bz1 - bz0) / G.cell * k, ox, oz, (bx1 - bx0) * s, (bz1 - bz0) * s); } catch (e) {}
        g.fillStyle = 'rgba(14,19,28,.28)'; g.fillRect(ox, oz, (bx1 - bx0) * s, (bz1 - bz0) * s);
        g.save(); g.beginPath(); g.rect(ox, oz, (bx1 - bx0) * s, (bz1 - bz0) * s); g.clip();
        // 그은 선 (바람을 거슬러 · 지도 끝까지)
        rays.forEach(r => { const [x0, y0] = Pp(r.st.x, r.st.z); g.strokeStyle = 'rgba(31,191,106,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + r.u[0] * 2000, y0 + r.u[1] * 2000); g.stroke(); });
        if (flashRay) { flashRay.t -= dt; const [x0, y0] = Pp(flashRay.st.x, flashRay.st.z); g.strokeStyle = 'rgba(230,57,70,' + clamp(flashRay.t, 0, 1).toFixed(2) + ')'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + flashRay.d[0] * 90, y0 + flashRay.d[1] * 90); g.stroke(); if (flashRay.t <= 0) flashRay = null; }
        if (drag && sel) { const [x0, y0] = Pp(sel.st.x, sel.st.z); g.strokeStyle = 'rgba(255,209,102,.95)'; g.setLineDash([6, 5]); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(drag.x, drag.y); g.stroke(); g.setLineDash([]); }
        // 굴뚝 있는 시설 · 선이 가장 가까이 지나는 곳
        const cd = cands().map(x => x.k), placed = [];
        S.forEach(x => { const [px, py] = Pp(x.st.x, x.st.z); placed.push([px - 10, py - 10, 20, 20]); });
        facs.forEach(k => { const F = UC_FAC[k], [x, y] = Pp(F.at[0], F.at[1]); placed.push([x - 8, y - 12, 16, 19]); if (cd.indexOf(k) >= 0) { g.strokeStyle = 'rgba(255,209,102,.85)'; g.setLineDash([5, 4]); g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 20, 0, 7); g.stroke(); g.setLineDash([]); }   // 후보는 모두 같은 표시 (1위를 짚지 않음)
          g.fillStyle = '#3A3F55'; g.fillRect(x - 7, y - 3, 14, 9); g.fillRect(x + 2, y - 11, 4, 8); F.stacks.forEach(st => { const [sx, sy] = Pp(st.x, st.z); g.fillStyle = '#FFD166'; g.beginPath(); g.arc(sx, sy, 2.5, 0, 7); g.fill(); }); });
        // 이름표: 센서 먼저, 그다음 시설 — 서로·동그라미와 안 겹치는 자리로 (좁은 화면에서 글자가 포개지지 않게)
        const label = (s, x, y, cands, font, fill) => { g.font = font; const w = g.measureText(s).width + 4, f = pickSpot(placed, cands.map(c => [x + c[0] - w / 2, y + c[1] - 10]), w, 12);
          g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(s, f[0] + w / 2, f[1] + 10); g.fillStyle = fill; g.fillText(s, f[0] + w / 2, f[1] + 10); };
        // 센서 (👃 냄새 난 곳 · 회색 = 냄새 없음 · ? = 아직 안 봄) · 고른 센서의 바람 화살표
        S.forEach(x => { const [px, py] = Pp(x.st.x, x.st.z), on = x.h != null, isSel = sel === x; g.fillStyle = on ? '#FF9F1C' : x.read ? '#9AA3B5' : 'rgba(154,163,181,.35)'; g.beginPath(); g.arc(px, py, isSel ? 10 : 8, 0, 7); g.fill(); g.strokeStyle = isSel ? '#fff' : 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke();
          txt(g, on ? '👃' : x.read ? '·' : '?', px, py + 4, F8(10), '#1B1B2F'); const nm = x.st.name.split(' ')[0] + (on ? ' ' + (x.h % 24) + '시' : ''); g.font = F7(10.5); const hw = g.measureText(nm).width / 2 + 14;
          label(nm, px, py, [[0, -12], [0, 22], [hw, 4], [-hw, 4], [0, -24]], F7(10.5), on ? '#8A3B00' : '#34404F');
          if (isSel && x.w) { const ax = Math.cos(x.w.dir), az = Math.sin(x.w.dir), L2 = 46; g.strokeStyle = '#2B6CB0'; g.fillStyle = '#2B6CB0'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(px, py); g.lineTo(px + ax * L2, py + az * L2); g.stroke(); g.beginPath(); g.moveTo(px + ax * (L2 + 8), py + az * (L2 + 8)); g.lineTo(px + ax * L2 - az * 7, py + az * L2 + ax * 7); g.lineTo(px + ax * L2 + az * 7, py + az * L2 - ax * 7); g.closePath(); g.fill();
            txt(g, (x.h % 24) + '시 바람 ' + x.w.spd.toFixed(1) + 'm/s', px + ax * (L2 + 20), py + az * (L2 + 20) + 4, F8(11), '#1E4E8C'); } });
        facs.forEach(k => { const F = UC_FAC[k], [x, y] = Pp(F.at[0], F.at[1]), nm = short(F); g.font = F8(11); const hw = g.measureText(nm).width / 2 + 12; label(nm, x, y, [[0, 19], [0, -15], [hw, 4], [-hw, 4], [0, 32], [0, -28]], F8(11), '#1B2230'); });
        g.restore();
        // 옆 칸(가로 화면) 또는 아래 줄: 냄새 센서 목록 · 결과
        const lines = smell.map(x => (rays.some(r => r.st === x.st) ? '✓ ' : '👃 ') + x.st.name.split(' ')[0] + ' ' + (x.h % 24) + '시 · 바람 ' + ARW(x.w.dir)), res = cd.length ? '선이 모이는 곳 근처 굴뚝: ' + cd.map(k => short(UC_FAC[k])).join(' · ') + ' — 허가 물질 · 서류 시각으로 가려요' : '';
        if (side) { const px = W - panW - 4; g.fillStyle = 'rgba(22,28,40,.92)'; rr(g, px, 6, panW, H2 - 12, 12); g.fill(); let y = 28; txt(g, '👃 냄새 난 센서', px + 12, y, F8(13), '#FFE7A8', 'left'); y += 22; g.font = F7(12.5); g.textAlign = 'left';
          lines.forEach(l => { g.fillStyle = l[0] === '✓' ? '#9FE3B0' : '#EEF1F7'; g.fillText(l, px + 12, y); y += 19; }); y += 8; g.fillStyle = '#AEB6C6'; g.font = F6(12); y = wrapText(g, '① 센서를 눌러요 ② 파란 화살표(바람이 불어 간 쪽)의 반대쪽으로 끌어 선을 그어요 ③ 두 곳 이상 그으면 선이 모이는 굴뚝이 보여요', px + 12, y, panW - 24, 16);
          if (res) { g.fillStyle = '#FFB3BA'; g.font = F8(13); wrapText(g, res, px + 12, y + 8, panW - 24, 18); } }
        else { g.fillStyle = 'rgba(22,28,40,.92)'; rr(g, 6, H2 - 56, W - 12, 50, 10); g.fill(); g.font = F7(12); g.textAlign = 'left'; g.fillStyle = res ? '#FFB3BA' : '#EEF1F7'; wrapText(g, res || lines.join('  '), 14, H2 - 36, W - 28, 16); }
        if (fbT > 0 && fb) { g.globalAlpha = clamp(fbT * 2, 0, 1); const fw = Math.min(mw - 12, 420); g.font = F8(12.5); const two = g.measureText(fb.s).width > fw - 16, fh = two ? 44 : 28; rr(g, 6 + mw / 2 - fw / 2, 10, fw, fh, 10); g.fillStyle = fb.ok ? 'rgba(31,120,80,.95)' : 'rgba(180,40,55,.95)'; g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; wrapText(g, fb.s, 6 + mw / 2, 29, fw - 16, 16); g.globalAlpha = 1; }
        m.sub('냄새 센서 ' + smell.length + '곳 · 기록 본 센서만 보여요'); m.cnt('선 ' + rays.length + '개');
        m.tip(!sel ? '👃 냄새 난 센서를 눌러요' : rays.length >= 2 ? '선이 모이는 굴뚝을 확인하고 수첩에 적어요' : '파란 화살표의 반대쪽(냄새가 온 쪽)으로 끌어 선을 그어요');
        m.act(rays.length ? '📓 수첩에 적기' : '센서를 눌러 시작');
      } });
  };
})();
