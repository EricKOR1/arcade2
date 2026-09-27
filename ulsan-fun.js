// 울산 환경 수사대 3D — 재미 요소 (v2026-10-19b · ulsan-rpg-engine.js · ulsan-mini.js 다음에 불러옴)
//   ⭐ 별점 · 경험치 · 레벨업 · 칭호: 조사·미니게임마다 경험치 · 미니게임 별 1~3개 (종류마다 가장 좋은 별만 모아 사건당 최대 +10점 보너스) · 별 3개 첫 달성 = 칭호
//   🔍 단서 발견 카드: 결정적 증거를 얻으면 카드가 뒤집히며 등장 · 🎯 범인 추적 게이지 (①②③④ 단계)
//   🚨 긴급 추격: 사건마다 한 번 — ① 물질을 알아내면 제보가 들어옴 → 🚓 추격 미니게임 (잡으면 결정적 증거 + 별)
//   🏁 반 친구 소식 · 순위: 중요한 순간(물질 발견 · 증거 확보 · 보고서 · 레벨업 · 추격 성공)을 반 전체에 알림 · 🏆 순위표 (게임 안)
//   소식은 짧은 신호(Firebase events)로만 — 답(물질 이름 · 시설)은 절대 보내지 않음
(function () {
  if (typeof UlsanRpgGame === 'undefined') return;
  const P = UlsanRpgGame.prototype;
  const SND = k => { try { if (window.Sound && Sound[k]) Sound[k](); } catch (e) {} };
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TITLES = ['새내기 조사관', '현장 조사관', '수석 조사관', '환경 탐정', '명탐정', '전설의 환경 수사관'];
  const need = lv => 60 + (lv - 1) * 45;   // 다음 레벨까지 경험치 (60 · 105 · 150 …)
  const MG = [[/^🔬 물벼룩/, 'daphnia', '🔬 물벼룩 박사'], [/^⚗️ 시약/, 'reagent', '⚗️ 시약 달인'], [/^⚗️ 검지관/, 'tubes', '⚗️ 검지관 명수'], [/^🧭/, 'wind', '🧭 바람 추적자'], [/^🎣/, 'fish', '🎣 강태공'], [/^🛶/, 'flow', '🛶 물길 계산왕'], [/^⏪/, 'rewind', '⏪ 시간 탐정'], [/^🛸/, 'drone', '🛸 드론 조종사'], [/^🚓/, 'chase', '🚓 추격왕']];
  const FEED = { pol: '① 오염물질을 알아냈어요', warrant: '🔓 결정적 증거를 잡았어요', rep: '📝 보고서를 냈어요', lv: '🏅 레벨업!', chase: '🚓 달아나던 탱크로리를 잡았어요', badge: '🎖 칭호를 얻었어요', done: '🏁 수사를 모두 마쳤어요' };
  P.funState = function () { const F = this.fun = this.fun || {}; F.xp = F.xp || 0; F.lv = F.lv || 1; F.badges = F.badges || {}; F.cs = F.cs || {}; F.sent = F.sent || {}; F.case = F.case || 0;
    if (F.case !== this.caseNo) { F.case = this.caseNo; F.cs = {}; F.sent = {}; F.chase = null; F.clue = {}; } F.clue = F.clue || {}; return F; };   // cs: 이번 사건 미니게임 종류별 가장 좋은 별 · sent: 이번 사건에 보낸 소식
  P.caseBonus = function () { const F = this.funState(); return Math.min(10, Object.values(F.cs).reduce((a, v) => a + v, 0)); };
  P.caseStars = function () { return Object.values(this.funState().cs).reduce((a, v) => a + v, 0); };

  // ── 화면: 퀘스트 창에 레벨 · 별 · 순위 · 추적 게이지 / 떠오르는 카드 · 레벨업 · 소식 띠 · 추격 제보 ──
  const buildUI0 = P.buildUI;
  P.buildUI = function () {
    buildUI0.call(this); const root = this.ui.root, q = root.querySelector('.u-quest'), clock = q.querySelector('.u-clock');
    const meta = document.createElement('div'); meta.className = 'uq-meta'; meta.innerHTML = '<button class="uq-lv" aria-label="내 레벨"><b>Lv.1</b><small></small><em><i></i></em></button><span class="uq-star">⭐ 0</span><button class="uq-rank" aria-label="반 순위">🏆 <b>–</b></button><span class="uq-pct">🎯 0%</span><button class="uq-chase hidden">🚨 추격</button>';
    const trk = document.createElement('div'); trk.className = 'uq-track'; trk.innerHTML = '<small>🎯 범인 추적</small><em><i></i></em><b>0%</b>';
    clock.after(meta); meta.after(trk);
    const fx = document.createElement('div'); fx.className = 'u-fx'; fx.innerHTML = '<div class="u-clue"><div class="cl-in"><div class="cl-f">?</div><div class="cl-b"><small>🔍 단서 발견!</small><b></b><em></em></div></div></div><div class="u-lvup"><small>LEVEL UP</small><b></b><em></em></div><div class="u-pop"></div><div class="u-feed"></div><div class="u-alert hidden"></div>';
    root.appendChild(fx);
    Object.assign(this.ui, { meta, lvB: meta.querySelector('.uq-lv b'), lvS: meta.querySelector('.uq-lv small'), lvI: meta.querySelector('.uq-lv i'), star: meta.querySelector('.uq-star'), rankB: meta.querySelector('.uq-rank b'), chaseB: meta.querySelector('.uq-chase'), trk, trkI: trk.querySelector('i'), trkB: trk.querySelector('b'), pctS: meta.querySelector('.uq-pct'),
      clue: fx.querySelector('.u-clue'), lvup: fx.querySelector('.u-lvup'), pop: fx.querySelector('.u-pop'), feed: fx.querySelector('.u-feed'), alert: fx.querySelector('.u-alert') });
    const act = f => e => { e.stopPropagation(); if (this.ui.modalOpen || this.gameOver || this.replay) return; if (this.ov) this.exitOverview(); f(); };
    meta.querySelector('.uq-lv').addEventListener('click', act(() => this.openProfile()));
    meta.querySelector('.uq-rank').addEventListener('click', act(() => this.openRank()));
    this.ui.chaseB.addEventListener('click', act(() => this.offerChase(true)));
    this.ui.clue.addEventListener('click', () => this.ui.clue.classList.remove('on'));
    this.funHud(true);
    clearInterval(this._hbT); this._hbT = setInterval(() => { if (!this.gameOver) this.sendFeed('hb'); }, 45000);   // 순위표가 비지 않게 45초마다 점수만
  };
  const destroy0 = P.destroy; P.destroy = function () { clearInterval(this._hbT); clearTimeout(this._chT); return destroy0.apply(this, arguments); };
  // 레벨 · 별 · 순위 · 추적 게이지 (0.2초마다 renderObj 와 함께)
  P.funHud = function (force) {
    const U = this.ui; if (!U.lvB) return; const F = this.funState(), k = F.lv + '|' + F.xp + '|' + this.caseStars() + '|' + this.trackPct() + '|' + this.myRank() + '|' + (F.chase || '');
    if (!force && k === this._funK) return; this._funK = k;
    U.lvB.textContent = 'Lv.' + F.lv; U.lvS.textContent = TITLES[Math.min(TITLES.length - 1, F.lv - 1)]; U.lvI.style.width = Math.round(F.xp / need(F.lv) * 100) + '%';
    U.star.textContent = '⭐ ' + this.caseStars(); U.star.title = '이번 사건 별 (보너스 +' + this.caseBonus() + '점)';
    const pc = this.trackPct(); if (U.trkB.textContent !== pc + '%') { if (this._lastPct != null && pc > this._lastPct) { U.trk.classList.remove('up'); void U.trk.offsetWidth; U.trk.classList.add('up'); } this._lastPct = pc; U.trkB.textContent = pc + '%'; U.trkI.style.width = pc + '%'; U.pctS.textContent = '🎯 ' + pc + '%'; }
    const r = this.myRank(); U.rankB.textContent = r ? r[0] + '위' : '–';
    U.chaseB.classList.toggle('hidden', F.chase !== 'offered');
  };
  const renderObj0 = P.renderObj; P.renderObj = function () { renderObj0.call(this); this.funHud(); };
  // 🎯 범인 추적: ① 분석에서 높은 물질 · ② 서류를 볼 증거 · ③ 그 시설 서류 · ④ 보고서 네 칸 — 답을 알려 주지 않는 단계만
  P.trackPct = function () {
    if (this.report) return 100; const ev = this.evidence, D = this.draft || {}, W = this.warrantFacs ? this.warrantFacs() : new Set(), set = k => !(D[k] === '' || D[k] == null);
    let p = 0; if (ev.some(e => /^📊/.test(e.title) && /hotrow|기준 초과/.test(e.html))) p += 25; if (W.size) p += 25; if ([...W].some(k => ev.some(e => e.title === '🗂 ' + UC_FAC[k].name + ' 서류'))) p += 25;
    p += ['pol', 'fac', 'point', 'slot'].filter(set).length * 25 / 4; return Math.round(p);
  };

  // ── 경험치 · 레벨업 ──
  P.gainXP = function (n, why, x, y) {
    const F = this.funState(); F.xp += n; let up = false; while (F.xp >= need(F.lv)) { F.xp -= need(F.lv); F.lv++; up = true; }
    this.popText('+' + n + ' XP' + (why ? ' · ' + why : ''), x, y); this._dirty = true;
    if (up) { const el = this.ui.lvup; if (el) { el.querySelector('b').textContent = 'Lv.' + F.lv; el.querySelector('em').textContent = TITLES[Math.min(TITLES.length - 1, F.lv - 1)]; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(this._luT); this._luT = setTimeout(() => el.classList.remove('on'), 2400); }
      SND('levelup'); SND('gem'); buzz([30, 40, 60]); this.sendFeed('lv', { lv: F.lv }); }
    this.funHud(true);
  };
  // 떠오르는 글자 (+XP · ★★☆) — 화면 가운데 조금 위, 겹치면 조금씩 아래로
  P.popText = function (t, x, y, cls) {
    const box = this.ui.pop; if (!box) return; const el = document.createElement('div'); el.className = 'pp' + (cls ? ' ' + cls : ''); el.textContent = t; const n = box.children.length;
    el.style.left = (x != null ? x : (this.vw || 800) / 2).toFixed(0) + 'px'; el.style.top = ((y != null ? y : (this.vh || 600) * 0.42) + n * 26).toFixed(0) + 'px'; box.appendChild(el); setTimeout(() => el.remove(), 1600);
  };
  // 🔍 단서 발견 카드 (결정적 증거 · 같은 제목은 사건마다 한 번)
  P.clueCard = function (e) {
    const el = this.ui.clue; if (!el) return; const d = document.createElement('div'); d.innerHTML = e.html || ''; const line = (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 64);
    el.querySelector('b').textContent = e.title.replace(/\s*\(\d+\)$/, ''); el.querySelector('em').textContent = line + (line.length >= 64 ? '…' : '');
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(this._clT); this._clT = setTimeout(() => el.classList.remove('on'), 2600); SND('gem'); buzz(40);
  };
  // 증거를 얻을 때마다: 경험치 · 미니게임 별 · 칭호 · 단서 카드 · 소식 · 긴급 추격 제보
  const addEvidence0 = P.addEvidence;
  P.addEvidence = function (e) {
    const n0 = this.evidence.length; addEvidence0.call(this, e); if (e.id === 'case' || !this.ui || !this.ui.pop) return; const F = this.funState(), t = e.title;
    const mg = MG.find(m => m[0].test(t));
    if (mg) { const st = clamp(this._mgStars || 2, 1, 3); this._mgStars = 0; const first = !(mg[1] in F.cs); F.cs[mg[1]] = Math.max(F.cs[mg[1]] || 0, st);
      this.popText('★★★'.slice(0, st) + '☆☆☆'.slice(0, 3 - st), null, (this.vh || 600) * 0.36, 'stars'); this.gainXP((first ? 15 : 5) + st * 10, '미니게임');
      if (st === 3 && !F.badges[mg[1]]) { F.badges[mg[1]] = 1; setTimeout(() => { this.toast('🎖 칭호 획득: ' + mg[2] + '!'); SND('levelup'); }, 900); this.sendFeed('badge', { b: mg[2] }); } }
    else this.gainXP(/^🗂/.test(t) ? 10 : 5);
    const base = t.replace(/\s*\(\d+\)$/, '');
    if (e.key && !F.clue[base]) { F.clue[base] = 1; this.clueCard(e); this.gainXP(20, '단서'); }
    if (/^📊/.test(t) && /hotrow|기준 초과/.test(e.html || '')) { if (!F.sent.pol) this.sendFeed('pol'); if (!F.chase) { F.chase = 'soon'; clearTimeout(this._chT); this._chT = setTimeout(() => this.offerChase(false), 5000); } }   // ① 을 알아내면 곧 긴급 제보
    if (this.warrantFacs && this.warrantFacs().size && !F.sent.warrant) this.sendFeed('warrant');
    this.funHud(true);
  };
  // 사건이 바뀌면 이번 사건 별 · 추격을 새로 · 보고서 · 끝 소식
  const submit0 = P.submit; P.submit = function (rep) { submit0.call(this, rep); const r = this.report; if (r) { this.gainXP(Math.round(r.score / 2), '보고서'); this.sendFeed('rep', { g: r.grade }); if (this.done) this.sendFeed('done'); } };
  const startCase0 = P.startCase; P.startCase = function (k) { clearTimeout(this._chT); if (this.ui.alert) this.ui.alert.classList.add('hidden'); startCase0.call(this, k); this.funState(); this.funHud(true); };
  const finalReport0 = P.finalReport; P.finalReport = function () { finalReport0.call(this); const F = this.funState(), b = MG.filter(m => F.badges[m[1]]).map(m => m[2]), body = this.ui.dlg.querySelector('.u-body'), r = this.myRank();
    if (body) body.insertAdjacentHTML('beforeend', '<div class="u-prof"><b>🏅 Lv.' + F.lv + ' ' + TITLES[Math.min(TITLES.length - 1, F.lv - 1)] + '</b>' + (r ? '<span>🏆 반 ' + r[0] + '위 / ' + r[1] + '명 (소식을 받은 친구 중)</span>' : '') + (b.length ? '<p>🎖 ' + b.join(' · ') + '</p>' : '<p class="dim">미니게임에서 별 3개를 받으면 칭호가 생겨요</p>') + '</div>'); };
  // 내 레벨 · 칭호 창
  P.openProfile = function () {
    const F = this.funState(), b = MG.map(m => '<span class="' + (F.badges[m[1]] ? 'on' : '') + '">' + m[2] + '</span>').join(''), cs = MG.filter(m => m[1] in F.cs).map(m => m[2].split(' ')[0] + ' ' + '★'.repeat(F.cs[m[1]])).join(' · ');
    this.dialog('🏅', '내 조사관 기록', '<div class="u-prof"><b>Lv.' + F.lv + ' ' + TITLES[Math.min(TITLES.length - 1, F.lv - 1)] + '</b><div class="xp"><i style="width:' + Math.round(F.xp / need(F.lv) * 100) + '%"></i></div><small>다음 레벨까지 ' + (need(F.lv) - F.xp) + ' XP</small></div>' +
      '<p>⭐ 이번 사건 별 <b>' + this.caseStars() + '개</b> → 보고서에 <b>+' + this.caseBonus() + '점</b> 보너스 <span class="dim">(미니게임 종류마다 가장 좋은 별 · 최대 +10점)</span></p>' + (cs ? '<p class="dim">' + cs + '</p>' : '') +
      '<p><b>🎖 칭호</b> <span class="dim">— 미니게임에서 별 3개</span></p><div class="u-badges">' + b + '</div>', [['닫기', () => this.closeDialog()]], true);
  };

  // ── 🏁 반 친구 소식 · 순위 (Firebase events 로 짧은 신호) ──
  P.sendFeed = function (m, extra) {
    const F = this.funState(); if (m !== 'hb' && m !== 'lv' && m !== 'badge') { if (F.sent[m]) return; F.sent[m] = 1; }
    const msg = Object.assign({ m, s: this.score || 0, lv: F.lv, c: this.caseNo, ct: this.caseTotal, p: this.trackPct() }, extra || {});
    this.board = this.board || {}; this.board['@me'] = { n: this.opts.myName || '나', s: msg.s, lv: F.lv, c: msg.c, p: msg.p, at: Date.now(), me: true };
    if (this.opts.onAttack) try { this.opts.onAttack('uc', null, msg); } catch (e) {}
  };
  P.onEvent = function (e) {
    if (!e || e.type !== 'uc' || !e.by) return; const nm = (this.opts.nameOf && this.opts.nameOf(e.by)) || '친구';
    this.board = this.board || {}; this.board[e.by] = { n: nm, s: +e.s || 0, lv: +e.lv || 1, c: +e.c || 1, p: +e.p || 0, at: Date.now() }; this.funHud(true);
    if (e.m === 'hb') return;
    const txt = e.m === 'rep' ? '📝 사건 ' + e.c + ' 보고서를 냈어요' + (e.g ? ' (등급 ' + String(e.g).slice(0, 1) + ')' : '') : e.m === 'lv' ? '🏅 Lv.' + (+e.lv || 1) + ' 달성!' : e.m === 'badge' ? '🎖 칭호 ‘' + String(e.b || '').slice(0, 12) + '’' : FEED[e.m]; if (!txt) return;
    this.feedLine('<b>' + nm.replace(/[<>&]/g, '') + '</b> ' + txt);
  };
  P.feedLine = function (html) {
    const box = this.ui.feed; if (!box) return; const el = document.createElement('div'); el.className = 'fd'; el.innerHTML = '⚡ ' + html; box.appendChild(el);
    while (box.children.length > 2) box.firstChild.remove(); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3600);
    const L = this._feedL || [8, (this.vw || 800) - 8]; box.style.top = (this._feedTop || 120) + 'px'; box.style.left = ((L[0] + L[1]) / 2).toFixed(0) + 'px'; box.style.maxWidth = Math.max(180, L[1] - L[0]).toFixed(0) + 'px';
  };
  P.rankList = function () { const B = Object.assign({}, this.board || {}), F = this.funState(); B['@me'] = { n: this.opts.myName || '나', s: this.score || 0, lv: F.lv, c: this.caseNo, p: this.trackPct(), at: Date.now(), me: true };
    return Object.keys(B).map(k => B[k]).sort((a, b) => b.s - a.s || b.c - a.c || b.p - a.p || b.lv - a.lv); };
  P.myRank = function () { if (!this.board || !Object.keys(this.board).some(k => k !== '@me')) return null; const L = this.rankList(); return [L.findIndex(x => x.me) + 1, L.length]; };
  P.openRank = function () {
    const L = this.rankList(), now = Date.now();
    const rows = L.map((x, i) => '<tr class="' + (x.me ? 'me' : '') + (now - x.at > 180000 ? ' old' : '') + '"><th>' + (i + 1) + '</th><td>' + (x.me ? '⭐ ' : '') + String(x.n).replace(/[<>&]/g, '') + '</td><td><b>' + x.s + '</b>점</td><td>Lv.' + x.lv + '</td><td>사건 ' + x.c + ' · 🎯' + x.p + '%</td></tr>').join('');
    this.dialog('🏆', '반 순위 (게임 안)', '<table class="u-rank"><tr><th>순위</th><th>이름</th><th>점수</th><th>레벨</th><th>진행</th></tr>' + rows + '</table><p class="dim">점수 = 끝낸 사건의 점수 합(⭐ 보너스 포함) · 같으면 진행이 빠른 순 · 소식을 보낸 친구만 보여요 (45초마다 갱신) · 정식 순위는 선생님 화면</p>', [['닫기', () => this.closeDialog()]], true);
  };

  // ── 🚨 긴급 추격 ──
  P.offerChase = function (now) {
    const F = this.funState(); if (this.report || this.gameOver || F.chase === 'done' || F.chase === 'missed') return;
    if (now) { this.ui.alert.classList.add('hidden'); this.startChase(); return; }
    if (this.ui.modalOpen || this.ov) { clearTimeout(this._chT); this._chT = setTimeout(() => this.offerChase(false), 1500); return; }   // 창이 닫히면 제보
    F.chase = 'offered'; const water = UC_POL[this.C.pol].path === 'water', el = this.ui.alert;
    el.innerHTML = '<b>🚨 긴급 제보!</b><span>' + (water ? '밤에 폐수를 싣고 나간' : '냄새 나는 드럼통을 실은') + ' 탱크로리가 지금 달아나고 있어요!</span><div><button data-c="go" class="primary">🚓 추격하기</button><button data-c="later">나중에</button></div>';
    el.classList.remove('hidden'); SND('alarm'); SND('bump'); buzz([60, 40, 60]);
    el.querySelector('[data-c=go]').addEventListener('click', () => { el.classList.add('hidden'); if (this.ui.modalOpen) this.closeDialog(); this.startChase(); });
    el.querySelector('[data-c=later]').addEventListener('click', () => { el.classList.add('hidden'); this.toast('🚨 퀘스트 창의 🚨 추격 단추로 2분 안에 쫓아갈 수 있어요'); });
    clearTimeout(this._chT); this._chT = setTimeout(() => { if (this.funState().chase === 'offered') { this.funState().chase = 'missed'; el.classList.add('hidden'); this.toast('🚚 탱크로리가 멀리 사라졌어요…'); this.funHud(true); } }, 120000);
    this.funHud(true);
  };
  // 🚓 추격 미니게임: 3차선 도로 · 화면 왼쪽/오른쪽을 눌러(←→) 차선 바꾸기 · 🚧 부딪히면 느려짐 · ⚡ 밟으면 빨라짐 · 25초 안에 탱크로리까지
  P.startChase = function () {
    if (this.mg) return; const F = this.funState(); F.chase = 'playing'; clearTimeout(this._chT); this.funHud(true);
    const C = this.C, water = UC_POL[C.pol].path === 'water', LIM = 25, TR = 12, MAX = 20;
    let ph = 'ready', t = 0, lane = 1, lx = 1, dist = 110, spd = 0, hits = 0, boost = 0, shake = 0, obs = [], spawn = 0.6, road = 0, done = false, win = false, flash = 0;
    const finish = () => {
      if (done) return; done = true; if (ph !== 'end') { F.chase = 'missed'; this.funHud(true); return; } this.spend(0.25);
      const zone = UC_ZONES.find(z => z.f.indexOf(C.fac) >= 0), F0 = UC_FAC[C.fac], dx = F0.at[0] - this.px, dz = F0.at[1] - this.pz, a = ((Math.atan2(-dz, dx) * 180 / Math.PI) % 360 + 360) % 360, dir = ['동', '북동', '북', '북서', '서', '남서', '남', '남동'][Math.round(a / 45) % 8];
      this._mgStars = win ? (hits <= 1 ? 3 : 2) : 1; F.chase = win ? 'done' : 'missed';
      this.addEvidence({ title: '🚓 긴급 추격 · 탱크로리', key: win, html: win ? '<p>📸 따라잡아서 사진을 찍었어요! 탱크로리가 <b>' + zone.n + '</b> 쪽 공장 단지로 들어갔어요.</p><p>그 단지의 시설: <b>' + zone.f.map(ucFacShort).join(' · ') + '</b></p><p class="dim">차에 ' + (water ? '폐수 자국' : '드럼통') + '이 남아 있었지만, 이것만으로 범인을 정할 수는 없어요 — ' + (water ? '🔬 독성 지도' : '🧭 바람길') + '와 서류로 확인하세요.</p>'
        : '<p>앗, 놓쳤어요… 탱크로리는 여기서 <b>' + dir + '쪽</b>으로 사라졌어요.</p><p class="dim">방향만으로는 시설을 정할 수 없어요 — 다른 증거와 맞춰 보세요.</p>' });
      if (win) this.sendFeed('chase'); this.funHud(true);
    };
    const m = this.mgOpen({ emoji: '🚓', title: '긴급 추격 — 달아나는 탱크로리', act: '출발! (누르기)',
      down: p => { if (ph === 'ready') { ph = 'run'; t = 0; SND('jump'); return; } if (ph === 'end') { if (t > 0.5) { finish(); this.closeDialog(); } return; }
        if (ph === 'run') { if (p) lane = clamp(lane + (p[0] < m.W / 2 ? -1 : 1), 0, 2); SND('hitmark'); } },
      onClose: () => finish(),
      state: () => ({ ph, lane, dist: +dist.toFixed(1), hits, t: +t.toFixed(1), obs: obs.map(o => [o.lane, +o.y.toFixed(2), o.k]) }),   // 검사용
      frame: (dt, now, g, W, H) => {
        t += dt; shake = Math.max(0, shake - dt); boost = Math.max(0, boost - dt); flash = Math.max(0, flash - dt); lx += (lane - lx) * Math.min(1, dt * 14);
        const ppm = H / 60, RW = Math.min(W * 0.78, 360), rx = (W - RW) / 2, LW = RW / 3, PY = H * 0.8;   // 도로 · 차선
        if (ph === 'run') { const tgt = boost > 0 ? MAX + 8 : MAX; spd += (tgt - spd) * Math.min(1, dt * 1.6); dist -= (spd - TR) * dt; road += spd * dt * ppm;
          spawn -= dt; if (spawn <= 0) { spawn = 0.5 + Math.random() * 0.45; const free = [0, 1, 2].filter(l => !obs.some(o => o.lane === l && o.y < 0.25)); if (free.length > 1) { const l = free[Math.floor(Math.random() * free.length)]; obs.push({ lane: l, y: -0.08, k: Math.random() < 0.18 ? 'boost' : Math.random() < 0.55 ? 'cone' : 'car' }); } }
          obs.forEach(o => { o.y += (o.k === 'car' ? spd - 8 : spd) * dt * ppm / H; if (!o.hit && Math.abs(o.y * H - PY) < H * 0.06 && o.lane === lane) { o.hit = true; if (o.k === 'boost') { boost = 1.6; SND('gem'); } else { spd *= 0.3; hits++; shake = 0.45; flash = 0.3; SND('bump'); buzz(60); } } });
          obs = obs.filter(o => o.y < 1.1 && !(o.hit && o.k === 'boost'));
          if (dist <= 0) { ph = 'end'; t = 0; win = true; SND('levelup'); buzz([40, 30, 80]); } else if (t >= LIM) { ph = 'end'; t = 0; win = false; SND('bump'); } }
        const sx = shake > 0 ? (Math.random() - 0.5) * 10 : 0; g.save(); g.translate(sx, 0);
        g.fillStyle = '#3B7A45'; g.fillRect(-10, 0, W + 20, H); g.fillStyle = '#2C5E9E'; g.fillRect(-10, 0, rx - 14, H);   // 풀밭 · 왼쪽은 강
        g.fillStyle = 'rgba(255,255,255,.25)'; for (let y = (road * 0.6) % 40 - 40; y < H; y += 40) g.fillRect(rx * 0.3, y, 18, 3);
        g.fillStyle = '#3A3F4A'; g.fillRect(rx, 0, RW, H); g.fillStyle = '#E8E3D0'; g.fillRect(rx - 4, 0, 4, H); g.fillRect(rx + RW, 0, 4, H);
        g.fillStyle = '#F2D16B'; for (let y = road % 46 - 46; y < H; y += 46) { g.fillRect(rx + LW - 2, y, 4, 24); g.fillRect(rx + LW * 2 - 2, y, 4, 24); }
        // 탱크로리 (멀수록 위 · 작게)
        const ty = clamp(H * 0.08 + (1 - clamp(dist / 110, 0, 1)) * (PY - H * 0.26 - H * 0.08), H * 0.06, PY - H * 0.2), tsc = 0.7 + (ty / PY) * 0.45, tx0 = rx + LW * (1 + Math.sin(now * 0.9) * 0.6) + LW / 2 - LW / 2;
        g.save(); g.translate(tx0 + LW / 2, ty); g.scale(tsc, tsc); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-20, 6, 44, 70); g.fillStyle = '#D9DDE3'; g.beginPath(); g.ellipse(0, 26, 20, 30, 0, 0, 7); g.fill(); g.fillStyle = '#B03A2E'; g.fillRect(-18, 54, 36, 22); g.fillStyle = '#1B1B1B'; g.fillRect(-14, 60, 28, 8); g.fillStyle = '#FFD166'; g.font = '900 12px Pretendard, sans-serif'; g.textAlign = 'center'; g.fillText('?', 0, 30); g.restore();
        // 장애물 · ⚡
        obs.forEach(o => { const X = rx + LW * o.lane + LW / 2, Y = o.y * H; if (o.k === 'cone') { g.fillStyle = '#FF7A1A'; g.beginPath(); g.moveTo(X, Y - 16); g.lineTo(X + 12, Y + 12); g.lineTo(X - 12, Y + 12); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(X - 7, Y - 1, 14, 4); }
          else if (o.k === 'car') { g.fillStyle = '#5B8DD6'; g.fillRect(X - 15, Y - 22, 30, 44); g.fillStyle = '#9DD3F5'; g.fillRect(X - 11, Y - 14, 22, 10); }
          else { g.fillStyle = 'rgba(255,209,102,.9)'; g.beginPath(); g.arc(X, Y, 15, 0, 7); g.fill(); g.fillStyle = '#3A2600'; g.font = '900 16px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚡', X, Y + 1); } });
        // 내 차 (조사 차량)
        const PX = rx + LW * lx + LW / 2; g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(PX - 16, PY - 20, 36, 50); g.fillStyle = boost > 0 ? '#36E08F' : '#FFFFFF'; g.fillRect(PX - 17, PY - 26, 34, 52); g.fillStyle = '#1FBF6A'; g.fillRect(PX - 17, PY - 4, 34, 8);
        g.fillStyle = '#23395B'; g.fillRect(PX - 12, PY - 20, 24, 10); const bl = Math.sin(now * 14) > 0; g.fillStyle = bl ? '#FF3B3B' : '#3B82F6'; g.fillRect(PX - 10, PY - 30, 8, 5); g.fillStyle = bl ? '#3B82F6' : '#FF3B3B'; g.fillRect(PX + 2, PY - 30, 8, 5);
        if (boost > 0) { g.fillStyle = 'rgba(54,224,143,.5)'; g.fillRect(PX - 10, PY + 26, 20, 16 + Math.random() * 10); }
        g.restore(); if (flash > 0) { g.fillStyle = 'rgba(255,60,60,' + (flash * 1.2).toFixed(2) + ')'; g.fillRect(0, 0, W, H); }
        // 거리 · 시간
        g.fillStyle = 'rgba(12,17,29,.8)'; g.fillRect(8, 8, W - 16, 30); g.fillStyle = '#FFD166'; g.fillRect(12, 12, (W - 24) * clamp(1 - dist / 110, 0, 1), 22); g.fillStyle = '#fff'; g.font = '800 13px Pretendard, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('🚚 탱크로리까지 ' + Math.max(0, Math.round(dist)) + 'm', 18, 23); g.textAlign = 'right'; g.fillText('⏱ ' + Math.max(0, Math.ceil(LIM - (ph === 'run' ? t : 0))) + '초 · 쾅 ' + hits, W - 18, 23);
        if (ph === 'ready') { g.fillStyle = 'rgba(12,17,29,.75)'; g.fillRect(W * 0.1, H * 0.34, W * 0.8, 96); g.fillStyle = '#FFF6DA'; g.textAlign = 'center'; g.font = '900 18px Pretendard, sans-serif'; g.fillText('🚨 25초 안에 탱크로리를 따라잡아요!', W / 2, H * 0.34 + 30); g.font = '700 13px Pretendard, sans-serif'; g.fillStyle = '#DDE3F0'; g.fillText('화면 왼쪽·오른쪽을 눌러 차선 바꾸기 (← →) · 🚧 피하고 ⚡ 밟기', W / 2, H * 0.34 + 58); }
        if (ph === 'end') { g.fillStyle = 'rgba(12,17,29,.85)'; g.fillRect(W * 0.08, H * 0.32, W * 0.84, 110); g.textAlign = 'center'; g.font = '900 20px Pretendard, sans-serif'; g.fillStyle = win ? '#7DF58F' : '#FF9A8A'; g.fillText(win ? '📸 찰칵! 따라잡았어요!' : '앗, 놓쳤어요…', W / 2, H * 0.32 + 36);
          g.font = '800 16px Pretendard, sans-serif'; g.fillStyle = '#FFD166'; g.fillText(win ? (hits <= 1 ? '★★★' : '★★☆') : '★☆☆', W / 2, H * 0.32 + 66); g.font = '700 13px Pretendard, sans-serif'; g.fillStyle = '#DDE3F0'; g.fillText(win ? '탱크로리가 들어간 곳을 수첩에 적어요' : '사라진 방향만 수첩에 적어요', W / 2, H * 0.32 + 92); }
        m.sub(ph === 'run' ? (boost > 0 ? '⚡ 부스트!' : '차선 바꾸기: 화면 왼쪽/오른쪽') : '긴급 추격'); m.cnt(ph === 'run' ? Math.max(0, Math.round(dist)) + 'm' : '');
        m.tip(ph === 'ready' ? '출발하면 탱크로리가 달아나요 — 부딪히면 느려져요' : ph === 'run' ? '🚧 콘·🚙 차는 피하고 ⚡ 는 밟아요' : '결과를 수첩에 적으면 증거가 돼요');
        m.act(ph === 'ready' ? '출발! (누르기)' : ph === 'run' ? '◀ 왼쪽 / 오른쪽 ▶ 은 화면을 눌러요' : '📓 수첩에 적기');
      } });
    m.key = (e, isDown) => { if (!isDown) return; const c = e.code; if (c === 'ArrowLeft' || c === 'KeyA') { e.preventDefault(); if (ph === 'run') lane = Math.max(0, lane - 1); } else if (c === 'ArrowRight' || c === 'KeyD') { e.preventDefault(); if (ph === 'run') lane = Math.min(2, lane + 1); } else if (c === 'Space' || c === 'KeyE' || c === 'Enter') { e.preventDefault(); if (!e.repeat) m.down(null); } };
  };
})();
