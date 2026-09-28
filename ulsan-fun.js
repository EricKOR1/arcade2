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
  const MG = [[/^🔬 물벼룩/, 'daphnia', '🔬 물벼룩 박사'], [/^⚗️ 시약/, 'reagent', '⚗️ 시약 달인'], [/^⚗️ 검지관/, 'tubes', '⚗️ 검지관 명수'], [/^🧭/, 'wind', '🧭 바람 추적자'], [/^🎣/, 'fish', '🎣 강태공'], [/^🛶/, 'flow', '🛶 물길 계산왕'], [/^⏪/, 'rewind', '⏪ 시간 탐정'], [/^🛸/, 'drone', '🛸 드론 조종사'], [/^🚓/, 'chase', '🚓 추격왕'], [/^👔 .*심문/, 'probe', '👔 명심문관'], [/^🧩/, 'board', '🧩 사건 재구성가']];
  const FEED = { pol: '① 오염물질을 알아냈어요', warrant: '🔓 결정적 증거를 잡았어요', rep: '📝 보고서를 냈어요', lv: '🏅 레벨업!', chase: '🚓 달아나던 탱크로리를 잡았어요', badge: '🎖 칭호를 얻었어요', done: '🏁 수사를 모두 마쳤어요' };
  P.funState = function () { const F = this.fun = this.fun || {}; F.xp = F.xp || 0; F.lv = F.lv || 1; F.badges = F.badges || {}; F.cs = F.cs || {}; F.sent = F.sent || {}; F.case = F.case || 0;
    if (F.case !== this.caseNo) { F.case = this.caseNo; F.cs = {}; F.sent = {}; F.chase = null; F.clue = {}; } F.clue = F.clue || {}; return F; };   // cs: 이번 사건 미니게임 종류별 가장 좋은 별 · sent: 이번 사건에 보낸 소식
  P.hotLab = function (e) { return /^📊/.test(e.title) && /hotrow|기준 초과|data-big="1"/.test(e.html || '') && (!e.sk || e.sk === (UC_POL[this.C.pol].path === 'water' ? 'water' : 'air')); };
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
  const destroy0 = P.destroy; P.destroy = function () { clearInterval(this._hbT); clearTimeout(this._chT); clearTimeout(this._luW); return destroy0.apply(this, arguments); };
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
    let p = 0; if (ev.some(e => this.hotLab(e))) p += 25; if (W.size) p += 25; if ([...W].some(k => ev.some(e => e.title === '🗂 ' + UC_FAC[k].name + ' 서류'))) p += 25;
    p += ['pol', 'fac', 'point', 'slot'].filter(set).length * 25 / 4; return Math.round(p);
  };

  // ── 경험치 · 레벨업 ──
  P.gainXP = function (n, why, x, y) {
    const F = this.funState(); F.xp += n; let up = false; while (F.xp >= need(F.lv)) { F.xp -= need(F.lv); F.lv++; up = true; }
    this.popText('+' + n + ' XP' + (why ? ' · ' + why : ''), x, y); this._dirty = true;
    if (up) { const el = this.ui.lvup, lv = F.lv, cl = this.ui.clue, wait = cl && cl.classList.contains('on') ? (cl.classList.contains('dex') ? 4300 : 2700) : 0;
      const show = () => { if (el) { el.querySelector('b').textContent = 'Lv.' + lv; el.querySelector('em').textContent = TITLES[Math.min(TITLES.length - 1, lv - 1)]; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(this._luT); this._luT = setTimeout(() => el.classList.remove('on'), 2400); } SND('levelup'); SND('gem'); buzz([30, 40, 60]); };
      clearTimeout(this._luW); if (wait) this._luW = setTimeout(show, wait); else show(); this.sendFeed('lv', { lv: F.lv }); }
    this.funHud(true);
  };
  // 떠오르는 글자 (+XP · ★★☆) — 화면 가운데 조금 위, 겹치면 조금씩 아래로
  P.popText = function (t, x, y, cls) {
    const box = this.ui.pop; if (!box) return; const el = document.createElement('div'); el.className = 'pp' + (cls ? ' ' + cls : ''); el.textContent = t; const n = box.children.length;
    el.style.left = (x != null ? x : (this.vw || 800) / 2).toFixed(0) + 'px'; el.style.top = ((y != null ? y : (this.vh || 600) * 0.42) + n * 26).toFixed(0) + 'px'; box.appendChild(el); setTimeout(() => el.remove(), 1600);
  };
  // 🔍 단서 발견 카드 (결정적 증거 · 같은 제목은 사건마다 한 번)
  P.clueCard = function (e) {
    const el = this.ui.clue; if (!el) return; el.classList.remove('dex'); el.querySelector('small').textContent = '🔍 단서 발견!'; const d = document.createElement('div'); d.innerHTML = e.html || ''; const line = (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 64);
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
    else if (this.evidence.length > n0) this.gainXP(/^🗂/.test(t) ? 10 : 5);   // 새 기록일 때만 (같은 서류를 열 번 열어도 한 번)
    const base = t.replace(/\s*\(\d+\)$/, '');
    if (e.key && !F.clue[base]) { F.clue[base] = 1; this.clueCard(e); this.gainXP(20, '단서'); }
    if (this.hotLab(e)) { if (!F.sent.pol) this.sendFeed('pol'); if (!F.chase) { F.chase = 'soon'; clearTimeout(this._chT); this._chT = setTimeout(() => this.offerChase(false), 5000); } }   // ① 을 알아내면 곧 긴급 제보
    if (this.warrantFacs && this.warrantFacs().size && !F.sent.warrant) this.sendFeed('warrant');
    this.funHud(true);
  };
  // 사건이 바뀌면 이번 사건 별 · 추격을 새로 · 보고서 · 끝 소식
  const submit0 = P.submit; P.submit = function (rep) { submit0.call(this, rep); const r = this.report; if (this.ui.alert) this.ui.alert.classList.add('hidden'); if (r) { this.gainXP(Math.round(r.score / 2), '보고서'); this.sendFeed('rep', { g: r.grade }); if (this.done) this.sendFeed('done'); } };
  const enterOv0 = P.enterOverview; if (enterOv0) P.enterOverview = function () { if (this.ui && this.ui.alert) this.ui.alert.classList.add('hidden'); return enterOv0.apply(this, arguments); };
  // 새로고침 뒤: 제보를 기다리던 · 추격하던 · 제보 중이던 추격을 다시 제보 (예전: 타이머가 없어 그 사건의 추격이 사라졌음)
  const restore0 = P.restore; P.restore = function (o) { const r = restore0.apply(this, arguments); const F = this.funState();
    if (F.chase === 'soon' || F.chase === 'playing' || F.chase === 'offered') { F.chase = null; if (!this.report && this.evidence.some(e => this.hotLab(e))) { F.chase = 'soon'; clearTimeout(this._chT); this._chT = setTimeout(() => this.offerChase(false), 4000); } }
    return r; };
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
    const F = this.funState(); if (m !== 'hb' && m !== 'lv' && m !== 'badge' && m !== 'ach') { if (F.sent[m]) return; F.sent[m] = 1; }
    const msg = Object.assign({ m, s: this.score || 0, lv: F.lv, c: this.caseNo, ct: this.caseTotal, p: this.trackPct() }, extra || {});
    this.board = this.board || {}; this.board['@me'] = { n: this.opts.myName || '나', s: msg.s, lv: F.lv, c: msg.c, p: msg.p, at: Date.now(), me: true };
    if (this.opts.onAttack) try { this.opts.onAttack('uc', null, msg); } catch (e) {}
  };
  P.onEvent = function (e) {
    if (!e || e.type !== 'uc' || !e.by) return; const nm = (this.opts.nameOf && this.opts.nameOf(e.by)) || '친구';
    const num = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    this.board = this.board || {}; this.board[e.by] = { n: nm, s: num(e.s, 0, 99999, 0), lv: num(e.lv, 1, 99, 1), c: num(e.c, 1, 9, 1), p: num(e.p, 0, 100, 0), at: Date.now() }; this.funHud(true);
    if (e.m === 'hb') return;
    // 다른 기기에서 온 값은 숫자·정해진 글자만 (예전: 사건 번호 자리에 넣은 코드가 모든 친구 화면에서 실행될 수 있었음)
    const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'), cn = Math.max(1, Math.min(9, Math.round(+e.c) || 1)), gr = /^[SABCD]$/.test(String(e.g || '')) ? e.g : '', bd = MG.map(x => x[2]).indexOf(String(e.b || '')) >= 0 ? e.b : '', an = (P._achNames || []).indexOf(String(e.a || '')) >= 0 ? e.a : '';
    const txt = e.m === 'rep' ? '📝 사건 ' + cn + ' 보고서를 냈어요' + (gr ? ' (등급 ' + gr + ')' : '') : e.m === 'lv' ? '🏅 Lv.' + Math.max(1, Math.min(99, Math.round(+e.lv) || 1)) + ' 달성!' : e.m === 'badge' ? (bd ? '🎖 칭호 ‘' + esc(bd) + '’' : '') : e.m === 'ach' ? (an ? '🏅 도전 과제 ‘' + esc(an) + '’' : '') : (Object.prototype.hasOwnProperty.call(FEED, e.m) ? FEED[e.m] : ''); if (!txt) return;
    this.feedLine('<b>' + esc(String(nm).slice(0, 12)) + '</b> ' + txt);
  };
  P.feedLine = function (html, cls) {
    const box = this.ui.feed; if (!box) return; const el = document.createElement('div'); el.className = 'fd' + (cls ? ' ' + cls : ''); el.innerHTML = (cls ? '' : '⚡ ') + html; box.appendChild(el);
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
    el.querySelector('[data-c=go]').addEventListener('click', () => { el.classList.add('hidden'); if (this.report || this.replay || this.gameOver) return; if (this.ov) this.exitOverview(); if (this.ui.modalOpen) this.closeDialog(); this.startChase(); });
    el.querySelector('[data-c=later]').addEventListener('click', () => { el.classList.add('hidden'); this.toast('🚨 퀘스트 창의 🚨 추격 단추로 2분 안에 쫓아갈 수 있어요'); });
    clearTimeout(this._chT); this._chT = setTimeout(() => { if (this.funState().chase === 'offered') { this.funState().chase = 'missed'; el.classList.add('hidden'); this.toast('🚚 탱크로리가 멀리 사라졌어요…'); this.funHud(true); } }, 120000);
    this.funHud(true);
  };
  // 🚓 추격 미니게임: 3차선 도로 · 화면 왼쪽/오른쪽을 눌러(←→) 차선 바꾸기 · 🚧 부딪히면 느려짐 · ⚡ 밟으면 빨라짐 · 22초 안에 탱크로리까지
  P.startChase = function () {
    if (this.mg || this.report || this.replay || this.gameOver) return; if (this.ov) this.exitOverview(); const F = this.funState(); F.chase = 'playing'; clearTimeout(this._chT); this.funHud(true);
    const C = this.C, water = UC_POL[C.pol].path === 'water', LIM = 22, TR = 12, MAX = 20;
    let tl = 1, tlx = 1, tlT = 1.8;   // 탱크로리 차선 — 예전엔 차선 사이를 사인파로 떠다녀 내 차(한 칸씩)가 탱크로리보다 더 많이 움직이는 것처럼 보였음
    let ph = 'ready', t = 0, lane = 1, lx = 1, dist = 140, spd = 0, hits = 0, boost = 0, shake = 0, obs = [], spawn = 0.6, road = 0, done = false, win = false, flash = 0;
    const finish = () => {
      if (done) return; done = true; if (ph !== 'end') { F.chase = 'missed'; this.funHud(true); return; } this.spend(0.25);
      // 들어간 쪽: 범인 단지만 알려 주면 그 물질을 쓰는 곳이 하나뿐일 때 답이 드러났음 → 그 물질을 쓰는 시설이 두 곳 이상 들도록 가까운 단지를 함께
      const zc = z => { const P2 = z.f.map(k => UC_FAC[k].at); return [P2.reduce((a, q) => a + q[0], 0) / P2.length, P2.reduce((a, q) => a + q[1], 0) / P2.length]; }, z0 = UC_ZONES.find(z => z.f.indexOf(C.fac) >= 0), c0 = zc(z0);
      const zs = UC_ZONES.slice().sort((a, b) => Math.hypot(zc(a)[0] - c0[0], zc(a)[1] - c0[1]) - Math.hypot(zc(b)[0] - c0[0], zc(b)[1] - c0[1])), near = []; for (const z of zs) { near.push(z); if (near.reduce((a, q) => a + q.f.filter(k => UC_FAC[k].can.indexOf(C.pol) >= 0).length, 0) >= 2) break; }
      const zone = { n: near.map(z => z.n).join(' · '), f: [].concat(...near.map(z => z.f)) }, F0 = UC_FAC[C.fac], dx = F0.at[0] - this.px, dz = F0.at[1] - this.pz, a = ((Math.atan2(-dz, dx) * 180 / Math.PI) % 360 + 360) % 360, dir = ['동', '북동', '북', '북서', '서', '남서', '남', '남동'][Math.round(a / 45) % 8];
      this._mgStars = win ? (hits <= 1 ? 3 : 2) : 1; F.chase = win ? 'done' : 'missed';
      this.addEvidence({ title: '🚓 긴급 추격 · 탱크로리', key: win, html: win ? '<p>📸 따라잡아서 사진을 찍었어요! 탱크로리가 <b>' + zone.n + '</b> 쪽 공장 단지로 사라졌어요.</p><p>그쪽 시설: <b>' + zone.f.map(ucFacShort).join(' · ') + '</b></p><p class="dim">차에 ' + (water ? '폐수 자국' : '드럼통') + '이 남아 있었지만, 이것만으로 범인을 정할 수는 없어요 — ' + (water ? '🔬 독성 지도' : '🧭 바람길') + '와 서류로 확인하세요.</p>'
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
        tlx += (tl - tlx) * Math.min(1, dt * 5); if (ph === 'run') { tlT -= dt; if (tlT <= 0) { tlT = 1.6 + Math.random() * 1.4; tl = tl === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1; } }   // 한 칸씩 · 가운데를 거쳐 감
        const draft = ph === 'run' && Math.round(tlx) === lane && dist < 90;   // 🌀 탱크로리와 같은 차선 = 바짝 추격 (조금 빨라짐)
        if (ph === 'run') { const tgt = (boost > 0 ? MAX + 8 : MAX) + (draft ? 4 : 0); spd += (tgt - spd) * Math.min(1, dt * 1.6); dist -= (spd - TR) * dt; road += spd * dt * ppm;
          spawn -= dt; if (spawn <= 0) { spawn = 0.5 + Math.random() * 0.45; const free = [0, 1, 2].filter(l => !obs.some(o => o.lane === l && o.y < 0.25)); if (free.length > 1) { const l = free[Math.floor(Math.random() * free.length)]; obs.push({ lane: l, y: -0.08, k: Math.random() < 0.18 ? 'boost' : Math.random() < 0.55 ? 'cone' : 'car' }); } }
          obs.forEach(o => { o.y += (o.k === 'car' ? spd - 8 : spd) * dt * ppm / H; if (!o.hit && Math.abs(o.y * H - PY) < H * 0.06 && o.lane === lane) { o.hit = true; if (o.k === 'boost') { boost = 1.6; SND('gem'); } else { spd *= 0.25; hits++; shake = 0.45; flash = 0.3; SND('bump'); buzz(60); } } });
          obs = obs.filter(o => o.y < 1.1 && !(o.hit && o.k === 'boost'));
          if (dist <= 0) { ph = 'end'; t = 0; win = true; SND('levelup'); buzz([40, 30, 80]); } else if (t >= LIM) { ph = 'end'; t = 0; win = false; SND('bump'); } }
        const sx = shake > 0 ? (Math.random() - 0.5) * 10 : 0; g.save(); g.translate(sx, 0);
        g.fillStyle = '#3B7A45'; g.fillRect(-10, 0, W + 20, H); g.fillStyle = '#2C5E9E'; g.fillRect(-10, 0, rx - 14, H);   // 풀밭 · 왼쪽은 강
        g.fillStyle = 'rgba(255,255,255,.25)'; for (let y = (road * 0.6) % 40 - 40; y < H; y += 40) g.fillRect(rx * 0.3, y, 18, 3);
        g.fillStyle = '#3A3F4A'; g.fillRect(rx, 0, RW, H); g.fillStyle = '#E8E3D0'; g.fillRect(rx - 4, 0, 4, H); g.fillRect(rx + RW, 0, 4, H);
        g.fillStyle = '#F2D16B'; for (let y = road % 46 - 46; y < H; y += 46) { g.fillRect(rx + LW - 2, y, 4, 24); g.fillRect(rx + LW * 2 - 2, y, 4, 24); }
        // 탱크로리 (멀수록 위 · 작게)
        const ty = clamp(H * 0.08 + (1 - clamp(dist / 140, 0, 1)) * (PY - H * 0.26 - H * 0.08), H * 0.06, PY - H * 0.2), tsc = 0.7 + (ty / PY) * 0.45, tx0 = rx + LW * tlx + LW / 2;   // 내 차와 같은 차선 중심
        g.save(); g.translate(tx0, ty); g.scale(tsc, tsc); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-20, 6, 44, 70); g.fillStyle = '#D9DDE3'; g.beginPath(); g.ellipse(0, 26, 20, 30, 0, 0, 7); g.fill(); g.fillStyle = '#B03A2E'; g.fillRect(-18, 54, 36, 22); g.fillStyle = '#1B1B1B'; g.fillRect(-14, 60, 28, 8); g.fillStyle = '#FFD166'; g.font = '900 12px Pretendard, sans-serif'; g.textAlign = 'center'; g.fillText('?', 0, 30); g.restore();
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
        g.fillStyle = 'rgba(12,17,29,.8)'; g.fillRect(8, 8, W - 16, 30); g.fillStyle = '#FFD166'; g.fillRect(12, 12, (W - 24) * clamp(1 - dist / 140, 0, 1), 22); g.fillStyle = '#fff'; g.font = '800 13px Pretendard, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('🚚 탱크로리까지 ' + Math.max(0, Math.round(dist)) + 'm', 18, 23); g.textAlign = 'right'; g.fillText('⏱ ' + Math.max(0, Math.ceil(LIM - (ph === 'run' ? t : 0))) + '초 · 쾅 ' + hits, W - 18, 23);
        if (ph === 'ready') { g.fillStyle = 'rgba(12,17,29,.75)'; g.fillRect(W * 0.1, H * 0.34, W * 0.8, 96); g.fillStyle = '#FFF6DA'; g.textAlign = 'center'; const tt = '🚨 ' + LIM + '초 안에 탱크로리를 따라잡아요!'; g.font = '900 18px Pretendard, sans-serif'; g.font = '900 ' + Math.min(18, Math.floor(18 * W * 0.76 / Math.max(1, g.measureText(tt).width))) + 'px Pretendard, sans-serif'; g.fillText(tt, W / 2, H * 0.34 + 30); g.font = '700 13px Pretendard, sans-serif'; g.fillStyle = '#DDE3F0'; g.fillText('화면 왼쪽·오른쪽을 눌러 차선 바꾸기 (← →) · 🚧 피하고 ⚡ 밟기', W / 2, H * 0.34 + 58); }
        if (ph === 'end') { g.fillStyle = 'rgba(12,17,29,.85)'; g.fillRect(W * 0.08, H * 0.32, W * 0.84, 110); g.textAlign = 'center'; g.font = '900 20px Pretendard, sans-serif'; g.fillStyle = win ? '#7DF58F' : '#FF9A8A'; g.fillText(win ? '📸 찰칵! 따라잡았어요!' : '앗, 놓쳤어요…', W / 2, H * 0.32 + 36);
          g.font = '800 16px Pretendard, sans-serif'; g.fillStyle = '#FFD166'; g.fillText(win ? (hits <= 1 ? '★★★' : '★★☆') : '★☆☆', W / 2, H * 0.32 + 66); g.font = '700 13px Pretendard, sans-serif'; g.fillStyle = '#DDE3F0'; g.fillText(win ? '탱크로리가 들어간 곳을 수첩에 적어요' : '사라진 방향만 수첩에 적어요', W / 2, H * 0.32 + 92); }
        m.sub(ph === 'run' ? (boost > 0 ? '⚡ 부스트!' : draft ? '🌀 바짝 추격! (같은 차선)' : '차선 바꾸기: 화면 왼쪽/오른쪽') : '긴급 추격'); m.cnt(ph === 'run' ? Math.max(0, Math.round(dist)) + 'm' : '');
        m.tip(ph === 'ready' ? '출발하면 탱크로리가 달아나요 — 부딪히면 느려져요' : ph === 'run' ? '🚧 콘·🚙 차는 피하고 ⚡ 는 밟아요 · 탱크로리와 같은 차선이면 더 빨라져요' : '결과를 수첩에 적으면 증거가 돼요');
        m.act(ph === 'ready' ? '출발! (누르기)' : ph === 'run' ? '◀ 왼쪽 / 오른쪽 ▶ 은 화면을 눌러요' : '📓 수첩에 적기');
      } });
    m.key = (e, isDown) => { if (!isDown) return; const c = e.code; if (c === 'ArrowLeft' || c === 'KeyA') { e.preventDefault(); if (ph === 'run') lane = Math.max(0, lane - 1); } else if (c === 'ArrowRight' || c === 'KeyD') { e.preventDefault(); if (ph === 'run') lane = Math.min(2, lane + 1); } else if (c === 'Space' || c === 'KeyE' || c === 'Enter') { e.preventDefault(); if (!e.repeat) m.down(null); } };
  };
})();

// ── (v2026-10-19d) 더 재미있게 — 게임 방법은 그대로, 곁들여 즐길 것 ──
//   🏅 도전 과제 14가지 (달성하면 소식 띠 · 경험치 · 반 친구에게 알림) · 📖 울산 생물 도감 8종 (강가를 돌아다니다 ✨ 를 찾으면 기록 · 실제 울산 생물 이야기)
//   ❓ 환경 퀴즈 (사람과 이야기한 뒤 한 문제 · 맞히면 경험치 · 연속 정답) · 📰 사건 해결 뉴스 (결과 창 맨 위 · 게임 속 가상 뉴스)
(function () {
  if (typeof UlsanRpgGame === 'undefined') return;
  const P = UlsanRpgGame.prototype;
  const SND = k => { try { if (window.Sound && Sound[k]) Sound[k](); } catch (e) {} };
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const ACH = [['first', '👣 첫 시료', '시료를 처음 떠요'], ['clue1', '🔎 첫 단서', '분석에서 크게 높은 물질을 찾아요'], ['fast', '⚡ 번개 분석', '사건 시작 5분 안에 첫 단서'], ['mg3', '🧪 실험 박사', '한 사건에서 미니게임 3가지'],
    ['star10', '⭐ 별 수집가', '미니게임 별 10개 모으기'], ['chase', '🚓 추격 성공', '달아나는 탱크로리 잡기'], ['walk', '🗺 발로 뛰는 조사관', '장소·센서·사람 8곳 조사'], ['perfect', '🎯 명탐정', '보고서 ①~④ 모두 맞히기'],
    ['sgrade', '👑 S 등급', '사건을 S 등급으로 해결'], ['streak', '🔥 연속 해결', '두 사건 연속 60점 이상'], ['time', '⏱ 시간 부자', '시간이 절반 넘게 남았을 때 60점 이상'], ['quiz3', '❓ 퀴즈왕', '환경 퀴즈 3문제 연속 정답'],
    ['dex4', '🔭 생물 탐험가', '울산 생물 4종 발견'], ['dex8', '📚 울산 생물 박사', '울산 생물 8종 모두 발견']];
  P._achNames = ACH.map(a => a[1]);   // 반 친구 소식에서 받아도 되는 이름 (그 밖의 글은 버림)
  // 📖 울산 생물 도감: 강가(둑) 자리 — 실제로 울산 강·바다에 사는(찾아오는) 생물
  const DEX = [
    { id: 'otter', e: '🦦', n: '수달', r: 'taehwa', km: 19, f: '물이 깨끗하고 물고기가 많은 강에 사는 동물이에요. 멸종위기 야생생물 Ⅰ급이자 천연기념물이에요. 수달이 산다는 건 강이 건강하다는 신호!' },
    { id: 'crow', e: '🐦', n: '떼까마귀', r: 'taehwa', km: 23.6, f: '겨울 철새예요. 겨울이면 수만 마리가 태화강 삼호대숲에 모여 자고, 해 질 녘 하늘을 뒤덮는 군무가 유명해요.' },
    { id: 'egret', e: '🕊', n: '백로', r: 'taehwa', km: 25.3, f: '여름 철새예요. 태화강 삼호대숲 대나무 숲에서 떼 지어 새끼를 길러요. 물고기를 먹고 살아서 강에 먹이가 넉넉하다는 뜻이에요.' },
    { id: 'salmon', e: '🐟', n: '연어', r: 'taehwa', km: 12, f: '바다에서 자란 연어는 태어난 강으로 돌아와 알을 낳아요. 태화강에는 가을(10~11월)에 연어가 돌아와요.' },
    { id: 'ayu', e: '🐠', n: '은어', r: 'taehwa', km: 16, f: '맑고 산소가 많은 물을 좋아하는 물고기예요. 몸에서 수박 향이 난다고 해서 ‘수박 향 물고기’라고도 불러요.' },
    { id: 'whale', e: '🐋', n: '귀신고래', r: 'taehwa', km: 34, f: '울산 앞바다는 옛날부터 고래가 오가던 바다예요. ‘울산 귀신고래 회유해면’은 천연기념물로 지정돼 있어요.' },
    { id: 'frog', e: '🐸', n: '맹꽁이', r: 'hoeya', km: 9, f: '장마철 밤에 ‘맹-꽁’ 하고 우는 개구리 무리예요. 사는 곳(습지)이 줄어 멸종위기 야생생물 Ⅱ급이에요.' },
    { id: 'kestrel', e: '🦅', n: '황조롱이', r: 'dongcheon', km: 5, f: '하늘에 제자리로 떠서(정지 비행) 먹이를 찾는 작은 매예요. 도시에서도 볼 수 있는 천연기념물이에요.' }];
  // ❓ 환경 퀴즈 (사람마다 · 한 사건에 한 사람 한 문제) — a[0] 이 정답
  const QZ = {
    researcher: [['물고기가 숨 쉬는 데 꼭 필요한데, 물이 더러워지면 줄어드는 것은?', ['물에 녹아 있는 산소(용존산소)', '물에 녹아 있는 소금', '물의 온도'], '유기물이 많아지면 미생물이 그것을 분해하느라 산소를 써 버려요. 산소가 부족하면 물고기가 숨을 못 쉬어요.'],
      ['‘BOD(생물화학적 산소 요구량)’가 높은 물은 어떤 물일까요?', ['썩기 쉬운 유기물이 많은 더러운 물', '산소가 아주 많은 깨끗한 물', '소금이 많은 바닷물'], 'BOD는 미생물이 물속 유기물을 분해할 때 쓰는 산소의 양이에요. 클수록 유기물이 많은 더러운 물이에요.'],
      ['카드뮴 같은 중금속이 특히 위험한 까닭은?', ['몸에 들어오면 잘 빠져나가지 않고 쌓여서', '물에 넣으면 금방 사라져서', '냄새가 아주 고약해서'], '중금속은 생물 몸에 쌓이고, 먹이 사슬을 따라 올라갈수록 더 많이 쌓여요(생물 농축). 일본의 이타이이타이병이 카드뮴 때문이었어요.']],
    riverman: [['종이배가 2 m를 가는 데 4초 걸렸다면 강물의 속력은?', ['0.5 m/s', '2 m/s', '8 m/s'], '속력 = 이동 거리 ÷ 걸린 시간 = 2 m ÷ 4 s = 0.5 m/s 예요.'],
      ['배출구에서 오염물질이 나오면 먼저 오염되는 곳은?', ['배출구보다 아래쪽(하류)', '배출구보다 위쪽(상류)', '강 전체가 동시에'], '강물은 위(상류)에서 아래(하류)로 흘러요. 그래서 오염은 배출구 아래쪽으로 퍼져요.'],
      ['기름이 강물 위에 얇게 퍼지면 물고기에게 해로운 까닭은?', ['공기 중 산소가 물에 녹아들기 어려워져서', '물이 갑자기 뜨거워져서', '물고기가 기름을 먹이로 착각해서'], '기름 막이 물 표면을 덮어 공기와 물 사이를 막아요. 물에 녹는 산소가 줄어들어요.']],
    forecaster: [['‘북풍’은 어느 쪽에서 불어오는 바람일까요?', ['북쪽에서 불어오는 바람', '북쪽으로 불어 가는 바람', '북극에서만 부는 바람'], '바람의 이름은 바람이 불어오는 쪽을 따서 붙여요. 북풍은 북쪽에서 남쪽으로 불어요.'],
      ['냄새가 난 곳에서 냄새가 출발한 곳을 찾으려면 어느 쪽으로 가야 할까요?', ['바람이 불어온 쪽 (바람을 거슬러)', '바람이 불어 간 쪽', '아무 쪽이나 상관없어요'], '냄새는 바람을 타고 옮겨 가요. 그러니 바람을 거슬러 올라가면 냄새가 나온 곳이 있어요.'],
      ['맑은 날 밤, 바닷가에서는 바람이 주로 어떻게 불까요?', ['육지에서 바다로 (육풍)', '바다에서 육지로 (해풍)', '바람이 전혀 불지 않아요'], '밤에는 육지가 바다보다 빨리 식어요. 그래서 육지 쪽 공기가 차갑고 무거워져 바다 쪽으로 불어요(육풍).']],
    doctor: [['황화수소는 어떤 냄새로 알아챌 수 있을까요?', ['달걀 썩는 냄새', '달콤한 꽃향기', '상쾌한 박하 냄새'], '황화수소(H₂S)는 달걀 썩는 냄새가 나요. 많이 마시면 두통·어지럼증이 생길 수 있어요.'],
      ['공기가 오염된 날 건강을 지키는 방법으로 알맞은 것은?', ['바깥 활동을 줄이고 마스크를 써요', '창문을 활짝 열고 운동해요', '물을 마시지 않아요'], '공기가 나쁜 날은 바깥 활동을 줄이고, 보건용 마스크를 쓰고, 돌아와서 손과 얼굴을 씻어요.']],
    resident: [['벤젠·톨루엔 같은 휘발성 유기화합물(VOC)의 특징은?', ['쉽게 증발해 공기 중으로 퍼져요', '물에만 녹고 공기로는 안 퍼져요', '몸에 전혀 해롭지 않아요'], 'VOC는 쉽게 기체가 되어 공기로 퍼져요. 오래 마시면 건강에 해로워요.'],
      ['공장 굴뚝의 자동 측정기가 하는 일은?', ['굴뚝에서 나오는 오염물질을 쉬지 않고 재서 기록해요', '굴뚝을 청소해요', '공장의 전기를 만들어요'], '굴뚝 자동 측정기는 오염물질 농도를 계속 재서 보내요. 기록이 끊기면 수상한 신호일 수 있어요.']],
    fisher: [['물벼룩이 물의 독성 검사에 쓰이는 까닭은?', ['아주 작은 독성에도 예민하게 반응해서', '물을 깨끗하게 걸러 줘서', '몸집이 커서 보기 쉬워서'], '물벼룩은 독성 물질에 민감해서 조금만 있어도 움직임이 둔해지거나 죽어요. 그래서 독성 검사에 널리 써요.'],
      ['강 하구처럼 민물과 바닷물이 섞이는 곳을 무엇이라고 할까요?', ['기수역', '분수령', '호수'], '기수역은 민물과 바닷물이 섞이는 곳이에요. 영양분이 많아 여러 생물이 모여 살아요.']],
    activist: [['소문이나 한 사람의 말만 듣고 범인을 정하면 안 되는 까닭은?', ['측정값 같은 증거로 확인해야 해서', '소문은 언제나 맞아서', '증거는 필요 없어서'], '과학 수사는 측정값 · 기록 · 실험 같은 증거가 서로 맞는지 확인해요. 소문은 틀릴 수도 있어요.'],
      ['생활 속에서 강을 깨끗하게 지키는 방법으로 알맞은 것은?', ['음식물 찌꺼기·기름을 하수구에 버리지 않아요', '세제를 아주 많이 써요', '쓰레기를 강가에 모아 둬요'], '기름과 음식물 찌꺼기는 물을 더럽히고 산소를 빼앗아요. 세제도 알맞은 양만 써요.']] };
  P.funX = function () { const F = this.funState(); F.ach = F.ach || {}; F.dex = F.dex || {}; F.dexNear = F.dexNear || {}; F.q = F.q || { ok: 0, streak: 0, asked: {}, used: {} }; F.st = F.st || { samples: 0, stars: 0, row: 0 }; return F; };
  // ── 🏅 도전 과제 ──
  P.achGet = function (id) {
    const F = this.funX(); if (F.ach[id]) return false; const a = ACH.find(x => x[0] === id); if (!a) return false; F.ach[id] = 1; this._dirty = true;
    this.feedLine('🏅 도전 과제 달성 — <b>' + esc(a[1]) + '</b> <small>' + esc(a[2]) + '</small>', 'ach'); SND('levelup'); buzz([20, 30, 40]);
    this.gainXP(30, '도전 과제'); this.sendFeed('ach', { a: a[1] }); return true; };
  P.achCheck = function () {
    if (!this.C) return; const F = this.funX(), n = k => Object.keys(this[k] || {}).length;
    if (F.st.samples >= 1) this.achGet('first');
    if (this.evidence.some(e => this.hotLab(e))) { this.achGet('clue1'); if (Date.now() - (this.caseStartReal || 0) < 5 * 60e3) this.achGet('fast'); }
    if (Object.keys(F.cs).length >= 3) this.achGet('mg3'); if (F.st.stars >= 10) this.achGet('star10');
    if (n('visited') + n('talked') >= 8) this.achGet('walk');
    const dn = Object.keys(F.dex).length; if (dn >= 4) this.achGet('dex4'); if (dn >= DEX.length) this.achGet('dex8'); if (F.q.streak >= 3) this.achGet('quiz3'); };
  const take0 = P.takeSample; P.takeSample = function () { const n0 = this.samples.length, r = take0.apply(this, arguments); if (this.samples.length > n0) { this.funX().st.samples++; this.achCheck(); } return r; };
  const addEv1 = P.addEvidence; P.addEvidence = function (e) {
    const F = this.funX(), s0 = Object.values(F.cs).reduce((a, v) => a + v, 0); addEv1.call(this, e); if (e.id === 'case' || !this.ui || !this.ui.pop) return;
    const s1 = Object.values(this.funState().cs).reduce((a, v) => a + v, 0); if (s1 > s0) F.st.stars += s1 - s0;   // 별 합계 (사건마다 종류별 가장 좋은 별이 늘어난 만큼)
    if (/^🚓/.test(e.title) && e.key) this.achGet('chase'); this.achCheck(); };
  const submit1 = P.submit; P.submit = function (rep) { submit1.call(this, rep); const r = this.report; if (!r) return; const F = this.funX();
    if (r.pol && r.fac && r.point && r.time) this.achGet('perfect'); if (r.grade === 'S') this.achGet('sgrade');
    F.st.row = r.score >= 60 ? (F.st.row || 0) + 1 : 0; if (F.st.row >= 2) this.achGet('streak');
    if (r.score >= 60 && (this._leftAtSubmit || 0) >= (this.set.min * 60) / 2) this.achGet('time'); this.achCheck(); };
  // ── 📖 울산 생물 도감: ✨ 반짝이는 곳에 가까이 가면 발견 ──
  P.dexTex = function () { if (P._dexTex) return P._dexTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,214,102,.85)'); gr.addColorStop(1, 'rgba(255,214,102,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#FFFBEA'; g.beginPath(); [[32, 2], [36, 28], [62, 32], [36, 36], [32, 62], [28, 36], [2, 32], [28, 28]].forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
    return (P._dexTex = new THREE.CanvasTexture(c)); };
  P.dexInit = function () {
    if (this._dexS || !this.scene || !this.arriveRiver || typeof THREE === 'undefined') return; const mat = new THREE.SpriteMaterial({ map: this.dexTex(), transparent: true, depthWrite: false, fog: false });
    this._dexS = DEX.map((d, i) => { const R = UC_RIVERS[d.r], at = R ? this.arriveRiver(d.r, Math.min(ucLen(R.pts) - 2, d.km * UC_KM)) : null; if (!at) return null;
      const sp = new THREE.Sprite(mat); const y0 = this.groundH(at[0], at[1]) + 2.4; sp.position.set(at[0], y0, at[1]); sp.scale.set(3, 3, 1); sp.visible = false; sp.userData.noShadow = true; sp.renderOrder = 5; this.scene.add(sp);
      return { d, i, x: at[0], z: at[1], y0, sp }; }).filter(Boolean); };
  P.dexStep = function () {
    if (!this._dexS) { if (this.C && this.scene && this.ui && this.ui.root) this.dexInit(); if (!this._dexS) return; }
    const F = this.funX(), now = this.now || 0, busy = this.ui.modalOpen || this.mg || this.replay || this.gameOver;
    this._dexS.forEach(o => { const got = !!F.dex[o.d.id], dist = Math.hypot(o.x - this.px, o.z - this.pz), vis = !got && (dist < 70 || !!this.ov);   // three.js 는 visible === false 일 때만 숨김 (null 이면 그려짐)
      o.sp.visible = vis; if (!vis) return; const k = 0.5 + 0.5 * Math.sin(now / 380 + o.i * 1.7); o.sp.position.y = o.y0 + k * 0.5; const sc = 2.6 + k * 0.9 + (this.ov ? 3 : 0); o.sp.scale.set(sc, sc, 1);
      if (busy || this.ov) return;
      if (dist < 4.5) this.dexFind(o); else if (dist < 22 && !F.dexNear[o.d.id]) { F.dexNear[o.d.id] = 1; this.toast('✨ 근처에서 뭔가 반짝여요 — 가까이 가 보세요!'); } }); };
  P.dexFind = function (o) {
    const F = this.funX(); if (F.dex[o.d.id]) return; F.dex[o.d.id] = this.nowH || 1; this._dirty = true; const n = Object.keys(F.dex).length;
    const el = this.ui.clue; if (el) { el.classList.add('dex'); el.querySelector('small').textContent = '📖 울산 생물 도감 ' + n + ' / ' + DEX.length; el.querySelector('b').textContent = o.d.e + ' ' + o.d.n + ' 발견!'; el.querySelector('em').textContent = o.d.f;
      el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(this._clT); this._clT = setTimeout(() => { el.classList.remove('on'); setTimeout(() => { el.classList.remove('dex'); el.querySelector('small').textContent = '🔍 단서 발견!'; }, 400); }, 4200); }
    SND('gem'); buzz([30, 30, 30]); this.gainXP(15, '도감'); this.achCheck(); };
  const hud1 = P.updateHud; P.updateHud = function () { hud1.call(this); try { this.dexStep(); } catch (e) {} };
  // ── ❓ 환경 퀴즈: 사람과 이야기한 뒤 (한 사건에 한 사람 한 문제) ──
  P.quizPick = function (id) { const grp = /^fisher/.test(id) ? 'fisher' : id, L = QZ[grp]; if (!L) return null; const F = this.funX(), key = this.caseNo + ':' + grp; if (F.q.asked[key]) return null;
    let i = L.findIndex((q, j) => !F.q.used[grp + j]); if (i < 0) { L.forEach((q, j) => { delete F.q.used[grp + j]; }); i = 0; } return { grp, i, key }; };
  P.openQuiz = function (pk) {
    const Q = QZ[pk.grp][pk.i], order = [0, 1, 2].sort(() => Math.random() - 0.5), F = this.funX();
    this.dialog('❓', '환경 퀴즈 · 맞히면 경험치 +20', '<p class="qz-q">' + esc(Q[0]) + '</p><p class="dim">' + (F.q.streak ? '🔥 연속 정답 ' + F.q.streak + '개 째 도전!' : '천천히 생각하고 골라요') + '</p>',
      order.map(k => [String.fromCharCode(9312 + order.indexOf(k)) + ' ' + Q[1][k], () => this.quizAnswer(pk, k === 0)]).concat([['그만두기', () => this.closeDialog()]]));
    this.ui.dlg.classList.add('quiz'); };
  P.quizAnswer = function (pk, ok) {
    const F = this.funX(), Q = QZ[pk.grp][pk.i]; F.q.asked[pk.key] = 1; F.q.used[pk.grp + pk.i] = 1; this._dirty = true;
    if (ok) { F.q.ok++; F.q.streak++; SND('gem'); buzz(30); } else { F.q.streak = 0; SND('bump'); }
    this.dialog(ok ? '✅' : '❌', ok ? '정답이에요!' + (F.q.streak >= 2 ? ' 🔥 ' + F.q.streak + '연속' : '') : '아쉬워요 — 정답은 ‘' + esc(Q[1][0]) + '’', '<p>' + esc(Q[2]) + '</p>', [['계속하기 ▸', () => this.closeDialog()]]);
    if (ok) this.gainXP(20, '퀴즈'); this.achCheck(); };
  const tx0 = P.talkExtra; P.talkExtra = function (id) { const a = tx0 ? tx0.call(this, id) || [] : []; const pk = this.quizPick(id); if (pk) a.push(['❓ 환경 퀴즈', () => this.openQuiz(pk)]); return a; };
  // ── 📰 사건 해결 뉴스 (결과 창 맨 위 · 게임 속 가상 뉴스) ──
  const show0 = P.showResult; P.showResult = function (r) { show0.apply(this, arguments); try {
    const body = this.ui.dlg.querySelector('.u-body'); if (!body || !r) return; const nm = esc(String(this.opts.myName || '우리 반').slice(0, 12)), F0 = UC_FAC[this.C.fac], P0 = UC_POL[this.C.pol], water = P0.path === 'water';
    const where = water ? UC_RIVERS[ucReportSpot(this.C).river].name : this.caseTitle().replace(/ 한밤 악취 민원$/, '');
    const all = r.pol && r.fac && r.point && r.time, hl = all ? '“' + nm + ' 조사관, ' + esc(ucFacShort(F0)) + '의 한밤 ' + (water ? '폐수' : '가스') + ' 배출 밝혀내”' : r.score >= 60 ? '“' + esc(where) + ' ' + (water ? '물고기 떼죽음' : '악취') + ', 환경 수사대가 원인에 바짝”' : '“' + esc(where) + ' ' + (water ? '물고기 떼죽음' : '악취 사건') + ', 아직 풀리지 않은 수수께끼…”';
    body.insertAdjacentHTML('afterbegin', '<div class="u-news"><small>📰 울산 환경 뉴스 · 속보 <i>(게임 속 가상 뉴스)</i></small><b>' + hl + '</b><span>' + (all ? '결정적 증거로 물질 · 시설 · 배출구 · 시각을 모두 밝혔어요' : r.score >= 60 ? '몇 가지는 맞혔어요 — 해설을 보고 다음 사건에서 완벽하게!' : '해설을 보면 어디서 길을 잃었는지 알 수 있어요') + '</span></div>'); } catch (e) {} };
  // ── 📋 할 일 자세히 · 🏅 내 기록 창에 도감 · 도전 과제 ──
  const oq0 = P.openQuest; if (oq0) P.openQuest = function () { oq0.apply(this, arguments); const g = this.ui.dlg && this.ui.dlg.querySelector('.q-got'); if (!g) return; const F = this.funX();
    g.insertAdjacentHTML('beforeend', '<span>📖 도감 <b>' + Object.keys(F.dex).length + '/' + DEX.length + '</b></span><span>🏅 도전 과제 <b>' + Object.keys(F.ach).length + '/' + ACH.length + '</b></span>'); };
  const prof0 = P.openProfile; P.openProfile = function () { prof0.apply(this, arguments); const body = this.ui.dlg.querySelector('.u-body'); if (!body) return; const F = this.funX();
    body.insertAdjacentHTML('beforeend', '<p><b>🏅 도전 과제 ' + Object.keys(F.ach).length + ' / ' + ACH.length + '</b> <span class="dim">— 달성할 때마다 경험치 +30</span></p><div class="u-achs">' + ACH.map(a => '<span class="' + (F.ach[a[0]] ? 'on' : '') + '"><b>' + (F.ach[a[0]] ? a[1] : '🔒 ' + a[1].replace(/^\S+\s/, '')) + '</b><small>' + a[2] + '</small></span>').join('') + '</div>' +
      '<p><b>📖 울산 생물 도감 ' + Object.keys(F.dex).length + ' / ' + DEX.length + '</b> <span class="dim">— 강가를 돌아다니다 ✨ 반짝이는 곳에 가까이 가 보세요</span></p><div class="u-dex">' + DEX.map(d => F.dex[d.id] ? '<span class="on"><i>' + d.e + '</i><b>' + d.n + '</b><small>' + d.f + '</small></span>' : '<span><i>❔</i><b>???</b><small>' + UC_RIVERS[d.r].name + ' 어딘가</small></span>').join('') + '</div>' +
      '<p class="dim">❓ 환경 퀴즈 맞힌 수 <b>' + F.q.ok + '</b> · 사람과 이야기한 뒤 ❓ 단추로 풀 수 있어요</p>'); };
  const fin1 = P.finalReport; P.finalReport = function () { fin1.apply(this, arguments); const body = this.ui.dlg && this.ui.dlg.querySelector('.u-body'); if (!body) return; const F = this.funX();
    body.insertAdjacentHTML('beforeend', '<p class="dim">🏅 도전 과제 ' + Object.keys(F.ach).length + ' / ' + ACH.length + ' · 📖 생물 도감 ' + Object.keys(F.dex).length + ' / ' + DEX.length + ' · ❓ 퀴즈 ' + F.q.ok + '문제 정답</p>'); };
})();

// ════════════════════════════════════════════════════════════════════
//  (v2026-10-20e) 👔 환경팀장 심문 · 🧩 사건 재구성 보드
//   · 심문: 서류를 볼 수 있는(증거가 가리킨) 시설 정문에서 — 팀장의 주장 3개에 맞는 증거를 수첩에서 골라 내밀면 모순이 깨지고 사실을 털어놓음
//          범인이 아닌 시설 팀장에게 내밀면 '관계없는 이야기' (헛짚기 3번이면 입을 닫음) · 증거 종류가 주장과 안 맞아도 헛짚기
//   · 재구성 보드: 보고서에 고른 답으로 사건 카드를 만들어 원인 → 결과 순서로 놓기 · 거꾸로 된 인과 · 물리적으로 불가능한 카드 · 소문 카드는 빼야 함
// ════════════════════════════════════════════════════════════════════
(function () {
  if (typeof UlsanRpgGame === 'undefined') return;
  const P = UlsanRpgGame.prototype;
  const SND = k => { try { if (window.Sound && Sound[k]) Sound[k](); } catch (e) {} };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = F => ucFacShort(F);
  // 다른 창을 여는 함수에 단추 하나를 끼워 넣음 (그만두기·닫기 단추 바로 앞)
  const withExtra = (self, extra, run) => { const d0 = self.dialog; self.dialog = function (e, t, b, opts) { self.dialog = d0; const i = opts.findIndex(o => /^(그만두기|닫기|취소)/.test(o[0])); opts.splice(i < 0 ? opts.length : i, 0, extra); return d0.apply(self, arguments); }; try { return run(); } finally { self.dialog = d0; } };

  // ── 👔 심문 ──
  P.probeState = function (fid) { const F = this.funState(); if (!F.probe || F.probe.case !== this.caseNo) F.probe = { case: this.caseNo }; return F.probe[fid] || (F.probe[fid] = { i: 0, strikes: 0, got: [], done: false }); };
  P.probeClaims = function (fid) {
    const C = this.C, Q = UC_POL[C.pol], water = Q.path === 'water', pt = ucPoint(C.point), metered = ucMetered(Object.assign({ kind: water ? 'water' : 'air' }, pt)), when = ucHm(C.t0, true).replace(/쯤$/, '');
    const T = re => e => re.test(e.title);
    return water ? [
      { say: '어젯밤 저희 공장이 내보낸 물은 전부 <b>기준 안</b>이었어요. 재 보시면 알 거예요.', ok: T(/^(📊|🔬 물벼룩|🧬)/), kind: '측정 결과(📊 분석 · 🔬 물벼룩 · 🧬 환경DNA)',
        conf: '…처리 설비가 고장 나서 <b>' + esc(ucJ(Q.name, '이', '가')) + '</b> 섞인 물이 나갔을 수는 있어요.' },
      { say: '밤에는 강으로 가는 펌프를 <b>한 번도 돌리지 않았어요</b>. 경비원이 잘못 들은 거예요.', ok: T(/(경비원의 말$|^⏪|^🛸|^🦐|^🗂)/), kind: '시각 증거(💂 경비원 · ⏪ 시간 되감기 · 🛸 드론 · 🦐 센서 · 🗂 서류)',
        conf: '…' + when + ' 무렵 펌프를 한두 시간 돌렸어요. 탱크가 넘칠 것 같아서요.' },
      { say: metered ? '서류에 빈 칸이 있는 건 <b>계측기 통신 장애</b> 때문이에요. 그 시간엔 아무것도 안 나갔어요.' : '저희 관은 <b>자동측정기로 다 지켜보고</b> 있어요. 기록이 멀쩡하잖아요?', ok: T(/^(🔬 물벼룩|⏪|🛸)/), kind: '어느 관인지 가리키는 증거(🔬 독성 지도 · ⏪ 시간 되감기 · 🛸 드론)',
        conf: '…<b>' + pt.id + ' ' + esc(ucJ(pt.label, '으로')) + '</b> 흘려보냈어요. ' + (metered ? '빈 기록은 통신 장애라고 둘러댄 거예요.' : '거긴 자동측정기가 없는 관이라서…') } ]
    : [
      { say: '저희 굴뚝 가스는 늘 <b>기준 안</b>이에요. 측정기가 증명해요.', ok: T(/^(📊|💨|⚗️ 검지관)/), kind: '측정 결과(📊 분석 · 💨 센서 · ⚗️ 검지관)',
        conf: '…방지 설비가 고장 나서 <b>' + esc(ucJ(Q.name, '이', '가')) + '</b> 섞인 가스가 나갔을 수는 있어요.' },
      { say: '냄새는 <b>다른 공장 쪽에서</b> 날아온 거예요. 바람을 보면 알아요.', ok: T(/(^🧭|예보관의 말$|^💨)/), kind: '바람 증거(🧭 바람길 · 🌤 예보관 · 💨 센서)',
        conf: '…바람이 저희 쪽에서 그 동네로 분 건 맞아요. ' + when + ' 무렵이었죠.' },
      { say: metered ? '서류가 끊긴 건 <b>계측기 통신 장애</b>였어요.' : '저희 굴뚝은 <b>자동측정 기록이 전부 정상</b>이에요.', ok: T(/(경비원의 말$|^🛸|^🗂)/), kind: '어느 굴뚝인지 가리키는 증거(💂 경비원 · 🛸 드론 · 🗂 서류)',
        conf: '…<b>' + pt.id + ' ' + esc(pt.label) + '</b>에서 가스를 뺐어요. ' + (metered ? '통신 장애라고 둘러댄 거예요.' : '거긴 자동측정 대상이 아니라서…') } ];
  };
  P.startProbe = function (fid) {
    const S = this.probeState(fid), F = UC_FAC[fid], cl = this.probeClaims(fid), guilty = fid === this.C.fac;
    if (S.done) { this.toast('이미 심문을 마쳤어요 — 📓 수첩에 적혀 있어요'); return; }
    if (S.i === 0 && !S.strikes) this.spend(0.2);
    const ev = this.evidence.filter(e => e.id !== 'case' && !/^(📰|📱|👔|🧩)/.test(e.title));
    const finish = () => { S.done = true; this._mgStars = S.got.length === 3 ? (S.strikes === 0 ? 3 : 2) : 1;
      const html = (S.got.length ? '<p>팀장이 털어놓은 말:</p><ul class="mg-list">' + S.got.map(i => '<li>' + cl[i].conf + '</li>').join('') + '</ul>' : '<p>팀장의 말에서 모순을 찾지 못했어요.</p>') + '<p class="dim">헛짚기 ' + S.strikes + '번. ' + (S.got.length ? '털어놓은 말도 측정 증거와 맞는지 다시 확인하세요.' : '이 시설이 범인이 아니거나, 아직 맞는 증거가 없을 수 있어요.') + '</p>';
      this.addEvidence({ title: '👔 ' + short(F) + ' 환경팀장 심문', key: S.got.length > 0 && guilty, html }); this.closeDialog(); this.toast(S.got.length ? '👔 팀장이 사실을 털어놓았어요 — 수첩에 적었어요' : '👔 심문을 마쳤어요 — 모순을 찾지 못했어요'); };
    const show = (msg) => {
      if (S.strikes >= 3) { this.dialog('👔', short(F) + ' 환경팀장', '<p class="pb-say">"더 이상 드릴 말씀이 없습니다. 변호사와 이야기하세요."</p><p class="dim">헛짚기 3번 — 팀장이 입을 닫았어요.</p>', [['수첩에 적기', finish]]); return; }
      if (S.i >= 3) { finish(); return; }
      const c = cl[S.i];
      const body = (msg ? '<p class="pb-msg">' + msg + '</p>' : '') + '<p class="pb-n">주장 ' + (S.i + 1) + ' / 3 · 헛짚기 ' + '✖'.repeat(S.strikes) + '<span class="dim">' + '✖'.repeat(3 - S.strikes) + '</span></p><p class="pb-say">"' + c.say + '"</p>' +
        '<p class="dim">📓 이 말과 <b>맞지 않는</b> 증거를 골라 내미세요 — 필요한 것: ' + c.kind + '</p><div class="pb-evs">' + (ev.length ? ev.map(e => '<button type="button" data-pe="' + e.id + '">' + esc(e.title) + '</button>').join('') : '<p class="dim">아직 증거가 없어요</p>') + '</div>';
      this.dialog('👔', short(F) + ' 환경팀장 심문', body, [['🤐 넘어가기 — 반박할 증거가 없어요', () => { S.i++; show('다음 주장으로 넘어갔어요.'); }], ['그만두기 — 나중에 이어서', () => this.closeDialog()]], true);
      this.ui.dlg.querySelectorAll('[data-pe]').forEach(b => b.addEventListener('click', () => { const e = this.evidence.find(x => x.id === b.dataset.pe); this.spend(0.1);
        if (guilty && e && e.key && c.ok(e)) { S.got.push(S.i); S.i++; SND('levelup'); show('💥 <b>모순 발견!</b> 팀장이 잠시 말을 잃더니… "' + c.conf + '"'); }
        else { S.strikes++; SND('bump'); show(!c.ok(e) ? '"그게 제 말이랑 무슨 상관이죠?" <span class="dim">— 이 주장엔 ' + c.kind + ' 중 하나가 필요해요</span>' : '"그건 저희 공장과 관계없는 이야기예요." <span class="dim">— 이 증거로는 이 시설의 말을 깰 수 없어요</span>'); } }));
    };
    show(S.i || S.strikes ? '이어서 심문해요.' : '팀장: "무엇이든 물어보세요. 저희는 떳떳합니다."');
  };
  const visit0 = P.visitFacility;
  P.visitFacility = function (fid) {
    const open = this.warrantFacs().has(fid), S = this.probeState(fid);
    return withExtra(this, [open ? (S.done ? '👔 환경팀장 심문 — 이미 마쳤어요 (수첩)' : '👔 환경팀장 심문 (12분) — 수첩의 증거로 팀장 말의 모순 깨기') : '🔒 환경팀장 심문 — 증거가 있어야 해요', () => { if (!open) { this.toast('🔒 서류를 볼 수 있는 증거가 있어야 심문할 수 있어요'); return; } this.closeDialog(); this.startProbe(fid); }], () => visit0.call(this, fid));
  };

  // ── 🧩 사건 재구성 보드 ──
  P.boardCards = function () {
    const C = this.C, D = this.draft || {}, water = UC_POL[C.pol].path === 'water', pt = ucPoint(D.point), fac = UC_FAC[D.fac], slot = UC_SLOTS[+D.slot] || '어젯밤', rnd = ucRng(Math.abs(Math.floor(this.seed || 1)) % 9973 + this.caseNo * 71);
    const T = water ? [
      '🏭 ' + short(fac) + ' 폐수 처리 설비 고장 — 처리 못 한 폐수가 쌓임', '🌙 ' + slot + ' ' + pt.id + ' ' + ucJ(pt.label, '으로') + ' 몰래 흘려보냄', '🌊 오염된 물이 강을 따라 하류로 흘러감 (거리 ÷ 빠르기만큼 걸림)', '🐟 독한 물이 지나간 곳에서 물고기 떼죽음 → 아침 7시 제보', '🔬 오늘 조사: 배출구 바로 위는 깨끗, 바로 아래부터 독함']
      : ['🏭 ' + short(fac) + ' 대기오염 방지 설비 고장', '🌙 ' + slot + ' ' + pt.id + ' ' + pt.label + '에서 가스를 내보냄', '🌬 가스가 그 시각의 바람을 타고 퍼짐', '😷 바람이 향한 동네 센서가 치솟고 냄새·두통 민원', '🧭 오늘 조사: 센서에서 바람을 거슬러 그은 선이 공장 쪽으로 모임'];
    const X = (water ? [['🐟 물고기가 먼저 죽어서 강물이 오염됐다', '원인과 결과가 거꾸로예요 — 물고기 떼죽음은 오염의 <b>결과</b>예요.'], ['⬆️ 오염된 물이 강을 거슬러 위쪽으로 올라갔다', '강물은 위(상류)에서 아래(하류)로만 흘러요.'], ['🌧 어젯밤 큰비에 빗물 배수구가 넘쳤다', '📰 날씨 소식: 어젯밤엔 비가 오지 않았어요.']]
      : [['😷 사람들이 냄새를 맡아서 바람 방향이 바뀌었다', '바람이 냄새를 옮기지, 냄새가 바람을 바꾸지 않아요 — 원인과 결과가 거꾸로예요.'], ['⬅️ 냄새가 바람을 거슬러 퍼졌다', '기체는 바람이 <b>불어 가는</b> 쪽으로 퍼져요.'], ['💧 강물이 오염돼서 냄새 민원이 났다', '이번 사건은 굴뚝·공기 사건이에요 — 대기센서 기록이 증거예요.']])
      .concat(!C.noRumor && C.rumor && C.rumor !== D.fac ? [['📰 ' + short(UC_FAC[C.rumor]) + ' 증설 공사 때문에 오염됐다', '소문일 뿐 측정으로 확인되지 않았어요 — 오염이 시작된 곳·시각과 안 맞아요.']] : []);
    const pick = X.map(x => [rnd(), x]).sort((a, b) => a[0] - b[0]).slice(0, 2).map(x => x[1]);
    const cards = T.map((t, i) => ({ id: 't' + i, t, ord: i })).concat(pick.map((x, i) => ({ id: 'x' + i, t: x[0], why: x[1] })));
    return cards.map(c => [rnd(), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  };
  P.openBoard = function () {
    const D = this.draft || {}; if (!D.fac || !D.point || D.slot === '' || D.slot == null) { this.toast('🧩 보고서 ② 시설 · ③ 배출 지점 · ④ 시간대를 먼저 골라요'); return; }
    const F = this.funState(); if (!F.board || F.board.case !== this.caseNo || F.board.key !== D.fac + D.point + D.slot) F.board = { case: this.caseNo, key: D.fac + D.point + D.slot, tries: 0, done: false };
    const B = F.board, cards = this.boardCards(), chain = []; let msg = B.done ? '✅ 이미 맞혔어요 — 다시 놓아 봐도 돼요' : '';
    const render = () => {
      const byId = id => cards.find(c => c.id === id), slots = [0, 1, 2, 3, 4].map(i => chain[i] ? '<button type="button" class="bd-slot on" data-out="' + i + '"><i>' + (i + 1) + '</i>' + esc(byId(chain[i]).t) + '</button>' : '<div class="bd-slot"><i>' + (i + 1) + '</i><span class="dim">' + (i === 0 ? '맨 처음 (원인)' : i === 4 ? '맨 나중' : '') + '</span></div>').join('<b class="bd-arr">↓</b>');
      const pool = cards.filter(c => chain.indexOf(c.id) < 0).map(c => '<button type="button" class="bd-card" data-in="' + c.id + '">' + esc(c.t) + '</button>').join('');
      this.ui.dlg.querySelector('.u-body').innerHTML = '<p class="dim">보고서에 고른 답으로 만든 사건 카드예요. <b>원인 → 결과</b> 순서로 5장을 골라 놓으세요. 섞여 있는 <b>틀린 카드 2장</b>(거꾸로 된 원인·결과, 일어날 수 없는 일, 소문)은 빼야 해요. <span class="u-evn">시도 ' + B.tries + '/3</span></p>' + (msg ? '<p class="pb-msg">' + msg + '</p>' : '') + '<div class="bd-chain">' + slots + '</div><p class="bd-h">카드 <small>(누르면 다음 칸에 놓여요 · 놓인 카드를 누르면 빠져요)</small></p><div class="bd-pool">' + pool + '</div>';
      this.ui.dlg.querySelectorAll('[data-in]').forEach(b => b.addEventListener('click', () => { if (chain.length < 5) { chain.push(b.dataset.in); msg = ''; SND('hitmark'); render(); } }));
      this.ui.dlg.querySelectorAll('[data-out]').forEach(b => b.addEventListener('click', () => { chain.splice(+b.dataset.out, 1); msg = ''; render(); }));
    };
    const check = () => {
      if (chain.length < 5) { msg = '5칸을 모두 채워요'; render(); return; }
      if (B.tries >= 3 && !B.done) { msg = '시도를 다 썼어요'; render(); return; }
      const byId = id => cards.find(c => c.id === id), bad = chain.map(byId).filter(c => c.why), ok = !bad.length && chain.every((id, i) => byId(id).ord === i);
      if (!B.done) B.tries++;
      if (ok) { SND('levelup'); if (!B.done) { B.done = true; this._mgStars = B.tries === 1 ? 3 : B.tries === 2 ? 2 : 1;
          this.addEvidence({ title: '🧩 사건 재구성', key: false, html: '<ol class="mg-list">' + chain.map(id => '<li>' + esc(byId(id).t) + '</li>').join('') + '</ol><p class="dim">원인에서 결과로 이어지는 흐름이 맞아요 (시도 ' + B.tries + '번). 이 흐름이 증거와 맞는지 보고서를 다시 확인하세요.</p>' }); }
        msg = '🎉 <b>원인 → 결과가 이어졌어요!</b>' + (this._mgStars ? '' : ''); render(); return; }
      SND('bump');
      const right = chain.filter((id, i) => byId(id).ord === i).length;
      msg = (bad.length ? '❌ 틀린 카드가 섞여 있어요: <b>' + esc(bad[0].t) + '</b><br><span class="dim">' + bad[0].why + '</span>' : '🔁 제자리에 놓인 카드 ' + right + '/5 — 무엇이 먼저 일어나야 다음 일이 생길지 생각해 보세요.') + (B.tries >= 3 ? '<br>시도를 다 썼어요. 정답: ' + cards.filter(c => !c.why).sort((a, b) => a.ord - b.ord).map((c, i) => (i + 1) + '. ' + esc(c.t)).join(' → ') : '');
      if (B.tries >= 3 && !B.done) { B.done = true; this._mgStars = 1; this.addEvidence({ title: '🧩 사건 재구성', key: false, html: '<p>세 번 안에 맞히지 못했어요. 올바른 흐름:</p><ol class="mg-list">' + cards.filter(c => !c.why).sort((a, b) => a.ord - b.ord).map(c => '<li>' + esc(c.t) + '</li>').join('') + '</ol>' }); }
      render();
    };
    this.dialog('🧩', '사건 재구성 보드 — 원인 → 결과', '', [['✅ 확인하기', check], ['처음부터', () => { chain.length = 0; msg = ''; render(); }], ['닫기 — 보고서로', () => { this.closeDialog(); this.openReport(); }]], true);
    this.ui.dlg.querySelector('.u-opts button').className = 'primary'; render();
  };
  const report0 = P.openReport;
  P.openReport = function () {
    if (this.report || this.gameOver) return report0.call(this);
    const F = this.funState(), done = F.board && F.board.case === this.caseNo && F.board.done;
    return withExtra(this, ['🧩 사건 재구성 보드 — 원인→결과 순서 맞추기 · 보너스 별' + (done ? ' ✓' : ''), () => { this.saveDraft(); this.closeDialog(); this.openBoard(); }], () => report0.call(this));
  };
})();
