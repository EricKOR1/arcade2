// 울산 환경 수사대 — 사건 생성 · 증거 시뮬레이션 (화면과 분리된 순수 계산)
//   세계 좌표: x = 동쪽, z = 남쪽(북쪽이 −z). 1칸 ≈ 30 m, 하천 거리표 1 km = 33칸
//   진실(범인 시설 · 오염물질 · 배출 지점 · 배출 시각) 하나에서 모든 증거가 물리적으로 일관되게 나옵니다
//     · 물: 배출 지점 '하류'로만 퍼지고(상류는 깨끗), 거리만큼 흐름 속도에 따라 늦게 도착, 멀수록 옅어짐
//     · 공기: 그 시각의 바람을 따라 풀룸(연기띠)으로 퍼짐 — 바람이 부는 쪽 센서만 오름
//   함정: 다른 시설의 '허가된 평소 배출'(낮은 농도 · 항상 있음) · 틀린 소문 · 배출 지점이 둘인 시설
const UC_KM = 33;

// ── 하천 (상류 → 하류) · 흐름 속도(km/h) ──
const UC_RIVERS = {
  taehwa:   { name: '태화강', speed: 1.6, w: 7, pts: [[-230, -8], [-190, 4], [-150, -6], [-110, 8], [-70, 4], [-30, 10], [10, 4], [45, 10], [80, 4], [110, 8], [140, 14]] },
  dongcheon:{ name: '동천',   speed: 1.2, w: 3.5, pts: [[40, -190], [48, -150], [58, -110], [66, -70], [74, -35], [80, 4]], joins: ['taehwa', 8] },
  yeocheon: { name: '여천천', speed: 0.9, w: 3, pts: [[-10, 72], [20, 66], [50, 64], [80, 58], [112, 50], [140, 46]] },
  oehwang:  { name: '외황강', speed: 1.0, w: 4, pts: [[-60, 128], [-20, 134], [20, 140], [55, 150], [90, 154], [135, 158]] },
  hoeya:    { name: '회야강', speed: 1.1, w: 4.5, pts: [[-190, 178], [-150, 182], [-110, 186], [-70, 194], [-25, 200], [20, 206], [65, 210], [110, 214], [140, 216]] }
};
// 하천 폴리라인 도우미
function ucLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function ucAt(pts, s) {                                      // 상류 끝에서 s 칸 떨어진 점
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= d) { const k = s / d; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; } s -= d; }
  return pts[pts.length - 1].slice();
}
function ucProject(pts, x, z) {                              // (x,z) 에서 가장 가까운 하천 위치 → { s, d }
  let best = { s: 0, d: 1e9 }, acc = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    let k = ((x - a[0]) * dx + (z - a[1]) * dz) / (L * L); k = Math.max(0, Math.min(1, k)); const px = a[0] + dx * k, pz = a[1] + dz * k, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { s: acc + k * L, d }; acc += L; }
  return best;
}
// 한 하천의 s 지점이 다른 지점(하천 r0 의 s0)보다 하류인가 · 그 흐름 거리(칸)
function ucDownstream(r0, s0, r1, s1) {
  if (r0 === r1) return s1 >= s0 ? s1 - s0 : -1;
  const R0 = UC_RIVERS[r0];
  if (R0.joins && R0.joins[0] === r1) { const joinS = ucProject(UC_RIVERS[r1].pts, ...R0.pts[R0.pts.length - 1]).s; const rest = ucLen(R0.pts) - s0;
    return s1 >= joinS ? rest + (s1 - joinS) : -1; }
  return -1;
}

// ── 오염물질: 정밀분석 항목 · 평소값 · 기준 · 현장 관찰 · 건강 증상 ──
const UC_POL = {
  phenol:  { name: '페놀', path: 'water', unit: 'mg/L', base: 0.002, limit: 0.005, peak: 0.9, panel: 'organic', smell: '소독약 같은 냄새', sym: '피부 따가움·가려움' },
  cadmium: { name: '카드뮴', path: 'water', unit: 'mg/L', base: 0.0004, limit: 0.005, peak: 0.06, panel: 'metal', smell: '', sym: '' },
  ammonia: { name: '암모니아성 질소', path: 'water', unit: 'mg/L', base: 0.25, limit: 1.5, peak: 7, panel: 'nutrient', smell: '지린내', sym: '눈 따가움' },
  oil:     { name: '유분(기름)', path: 'water', unit: 'mg/L', base: 0.3, limit: 1, peak: 9, panel: 'oil', smell: '기름 냄새', sym: '' },
  bod:     { name: 'BOD(유기물)', path: 'water', unit: 'mg/L', base: 1.8, limit: 5, peak: 28, panel: 'bod', smell: '썩은 냄새', sym: '' },
  benzene: { name: '벤젠', path: 'air', unit: 'ppb', base: 0.7, limit: 1.5, peak: 60, panel: 'air', smell: '휘발유 같은 냄새', sym: '두통·어지럼' },
  toluene: { name: '톨루엔', path: 'air', unit: 'ppb', base: 3, limit: 50, peak: 260, panel: 'air', smell: '페인트(시너) 냄새', sym: '두통·메스꺼움' },
  h2s:     { name: '황화수소', path: 'air', unit: 'ppb', base: 0.5, limit: 20, peak: 180, panel: 'air', smell: '달걀 썩는 냄새', sym: '두통·눈 따가움' }
};
const UC_PANELS = { organic: '유기화합물(페놀·벤젠)', metal: '중금속(카드뮴·아연)', nutrient: '영양염(암모니아·질산)', oil: '유분(기름)', bod: 'BOD(유기물 오염도)', air: '대기 시료(벤젠·톨루엔·황화수소)' };

// ── 시설 (가상 이름 · 실제 산단 위치를 본뜸) — 배출구(물) · 굴뚝(공기) ──
const UC_FAC = {
  F1: { name: '태광유화 (석유화학 수지공장)', zone: '석유화학단지', at: [52, 88], can: ['phenol', 'benzene'],
        outs: [{ id: 'F1-A', kind: 'water', river: 'yeocheon', s: 64, label: '폐수 방류구' }, { id: 'F1-B', kind: 'water', river: 'yeocheon', s: 38, label: '빗물 배수구' }],
        stacks: [{ id: 'F1-S', x: 58, z: 96, label: '공정 굴뚝' }] },
  F2: { name: '한울정유 (정유공장)', zone: '석유화학단지', at: [100, 92], can: ['benzene', 'h2s', 'oil'],
        outs: [{ id: 'F2-A', kind: 'water', river: 'yeocheon', s: 118, label: '폐수 방류구' }],
        stacks: [{ id: 'F2-S1', x: 94, z: 100, label: '가열로 굴뚝' }, { id: 'F2-S2', x: 108, z: 86, label: '황 회수 굴뚝' }] },
  F3: { name: '동해비철금속 (제련소)', zone: '온산국가산단', at: [62, 170], can: ['cadmium'],
        outs: [{ id: 'F3-A', kind: 'water', river: 'oehwang', s: 128, label: '폐수 방류구' }], stacks: [] },
  F4: { name: '새봄비료화학', zone: '온산국가산단', at: [18, 158], can: ['ammonia'],
        outs: [{ id: 'F4-A', kind: 'water', river: 'oehwang', s: 82, label: '폐수 방류구' }], stacks: [] },
  F5: { name: '미래자동차 도장공장', zone: '미포국가산단(북구)', at: [96, -78], can: ['toluene'],
        outs: [], stacks: [{ id: 'F5-S1', x: 90, z: -84, label: '도장 1라인 굴뚝' }, { id: 'F5-S2', x: 104, z: -70, label: '도장 2라인 굴뚝' }] },
  F6: { name: '굴화하수처리장', zone: '태화강 중류', at: [-72, 26], can: ['ammonia', 'bod'],
        outs: [{ id: 'F6-A', kind: 'water', river: 'taehwa', s: 168, label: '처리수 방류구' }], stacks: [] },
  F7: { name: '청솔식품 공장', zone: '울주군 태화강 상류', at: [-150, 22], can: ['bod'],
        outs: [{ id: 'F7-A', kind: 'water', river: 'taehwa', s: 82, label: '폐수 방류구' }], stacks: [] },
  F8: { name: '용연하수처리장', zone: '남구 용연', at: [104, 128], can: ['ammonia', 'h2s'],
        outs: [{ id: 'F8-A', kind: 'water', river: 'oehwang', s: 168, label: '처리수 방류구' }], stacks: [{ id: 'F8-S', x: 110, z: 122, label: '슬러지동 배기구' }] }
};
// 조사 장소 (고정)
const UC_PLACES = {
  lab:     { name: '울산보건환경연구원', at: [-24, 52] },
  weather: { name: '울산기상대', at: [-8, -48] },
  clinic:  { name: '남구보건소', at: [44, 40] },
  garden:  { name: '태화강 국가정원', at: [-20, 0] },
  riverOffice: { name: '태화강 하천관리소', at: [18, -8] },
  port:    { name: '울산항', at: [128, 40] },
  onsanHarbor: { name: '온산항 어촌계', at: [128, 166] },
  mouth:   { name: '태화강 하구 선착장', at: [128, 22] }
};
// 고정 측정소: 물벼룩 바이오센서(물) · 대기·악취 센서(공기)
const UC_BIO = [
  { id: 'B-T1', river: 'taehwa', s: 120, name: '태화강 중류 바이오센서' }, { id: 'B-T2', river: 'taehwa', s: 330, name: '태화강 하류 바이오센서' },
  { id: 'B-D', river: 'dongcheon', s: 150, name: '동천 바이오센서' }, { id: 'B-Y', river: 'yeocheon', s: 100, name: '여천천 바이오센서' },
  { id: 'B-O', river: 'oehwang', s: 150, name: '외황강 바이오센서' }, { id: 'B-H', river: 'hoeya', s: 200, name: '회야강 바이오센서' }
];
const UC_AIR = [
  { id: 'A1', x: 30, z: 40, name: '삼산동 대기측정소' }, { id: 'A2', x: 70, z: 64, name: '여천동 악취센서' }, { id: 'A3', x: 128, z: 100, name: '용연동 악취센서' },
  { id: 'A4', x: 80, z: 120, name: '부곡동 악취센서' }, { id: 'A5', x: 60, z: -40, name: '효문동 대기측정소' }, { id: 'A6', x: 130, z: -60, name: '양정동 악취센서' },
  { id: 'A7', x: 40, z: -110, name: '농소동 대기측정소' }, { id: 'A8', x: -10, z: 90, name: '신정동 대기측정소' }, { id: 'A9', x: 40, z: 140, name: '온산읍 악취센서' }
];

// ── 시드 난수 ──
function ucRng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = s * 48271 % 2147483647) / 2147483647; }

// ── 사건 생성 ──
//   시각은 'Day0 00:00' 부터의 시간(h). 조사는 Day1 08:00(=32h) 부터 20:00(=44h) 까지
function ucMakeCase(seed) {
  const rnd = ucRng(seed), pick = a => a[Math.floor(rnd() * a.length)];
  const facIds = Object.keys(UC_FAC);
  // 범인: 시설과 그 시설이 낼 수 있는 물질 · 물이면 배출구 · 공기면 굴뚝
  let fac, pol, point;
  for (let tries = 0; tries < 50; tries++) {
    fac = pick(facIds); const F = UC_FAC[fac]; pol = pick(F.can); const path = UC_POL[pol].path;
    const pts = path === 'water' ? F.outs : F.stacks; if (pts.length) { point = pick(pts); break; }
  }
  const t0 = 20 + Math.floor(rnd() * 10) + rnd() * 0.8;           // 전날 20시 ~ 새벽 6시 사이에 시작
  const dur = 1.2 + rnd() * 1.3;
  // 바람(기상대 기록): 밤엔 육풍(서→동), 새벽엔 방향이 조금씩 돎 — 시간마다 방향(바람이 '불어가는' 쪽, 라디안)과 속도
  const makeWind = () => { const w = []; let dir = rnd() * Math.PI * 2;
    for (let h = 18; h <= 44; h++) { dir += (rnd() - 0.5) * 0.5; w.push({ h, dir, spd: 1.2 + rnd() * 2.5 }); } return w; };
  let wind = makeWind();
  // 함정 1: 다른 시설의 허가된 평소 배출 (항상 조금) — 같은 물질을 고르면 헷갈림
  const decoys = [];
  facIds.forEach(id => { if (id === fac) return; const F = UC_FAC[id]; F.can.forEach(p => { if (rnd() < 0.45) { const pts = UC_POL[p].path === 'water' ? F.outs : F.stacks; if (pts.length) decoys.push({ fac: id, pol: p, point: pick(pts), k: 0.08 + rnd() * 0.1 }); } }); });
  // 함정 2: 틀린 소문 (범인이 아닌, 같은 물질을 다룰 수 있는 시설을 지목하면 더 그럴듯)
  const suspects = facIds.filter(id => id !== fac && UC_FAC[id].can.indexOf(pol) >= 0);
  const rumor = suspects.length ? pick(suspects) : pick(facIds.filter(id => id !== fac));
  const C = { seed, fac, pol, point: point.id, t0, dur, wind, decoys, rumor, startH: 32, endH: 44 };
  // 공기 사건은 연기띠가 센서 2곳 이상에 걸려야 풀 수 있음 — 그런 바람이 나올 때까지 다시 (증거 없는 사건 방지)
  if (UC_POL[pol].path === 'air') {
    const hits = () => UC_AIR.filter(st => { let mx = 0; for (let h = 18; h <= 32; h++) mx = Math.max(mx, ucAirConc(C, pol, st.x, st.z, h + 0.5)); return mx > UC_POL[pol].base * 5; }).length;
    for (let k = 0; k < 200 && hits() < 2; k++) C.wind = makeWind();
  }
  return C;
}
function ucPoint(id) { for (const f of Object.keys(UC_FAC)) { const F = UC_FAC[f]; for (const o of F.outs.concat(F.stacks)) if (o.id === id) return Object.assign({ fac: f }, o); } return null; }

// ── 물: 하천 한 지점의 농도 (시각 h) ──
//   배출 지점 하류 거리 d 칸: 도착 시각 = t0 + d/속도, 폭이 퍼지며 옅어짐 · 지나간 뒤에도 바닥·웅덩이에 일부 남음(잔류)
function ucWaterConc(C, polId, river, s, h) {
  const P = UC_POL[polId]; let c = P.base;
  const add = (src, k) => { const pt = ucPoint(src); if (!pt || pt.kind !== 'water') return 0;
    const d = ucDownstream(pt.river, pt.s, river, s); if (d < 0) return 0;
    const v = UC_RIVERS[pt.river].speed * UC_KM, arrive = d / v, dil = Math.exp(-d / 260);
    if (k != null) return P.peak * k * dil * 0.25;                     // 평소 배출: 늘 조금
    const t = h - C.t0 - arrive, spread = C.dur + d / v * 0.35;
    const pulse = t < 0 ? 0 : (t < spread ? 1 : Math.exp(-(t - spread) / 2.2));
    return P.peak * dil * (0.22 + 0.78 * pulse) * (t < 0 ? 0 : 1); };
  if (C.pol === polId && UC_POL[polId].path === 'water') c += add(C.point, null);
  C.decoys.forEach(dc => { if (dc.pol === polId) c += add(dc.point.id, dc.k); });
  return c;
}
// ── 공기: 센서 한 곳의 농도 (시각 h) — 가우스 풀룸(연기띠) ──
function ucAirConc(C, polId, x, z, h) {
  const P = UC_POL[polId]; let c = P.base;
  const w = C.wind[Math.max(0, Math.min(C.wind.length - 1, Math.floor(h) - 18))];
  const plume = (sx, sz, q) => { const dx = x - sx, dz = z - sz, ax = Math.cos(w.dir), az = Math.sin(w.dir);
    const along = dx * ax + dz * az, cross = -dx * az + dz * ax; if (along <= 2) return 0;
    const sig = 6 + along * 0.22; return q * Math.exp(-cross * cross / (2 * sig * sig)) / (1 + along / 40) / (0.6 + w.spd * 0.25); };
  if (C.pol === polId && P.path === 'air' && h >= C.t0 && h <= C.t0 + C.dur + 0.3) { const pt = ucPoint(C.point); c += plume(pt.x, pt.z, P.peak); }
  C.decoys.forEach(dc => { if (dc.pol === polId && dc.point.x != null) c += plume(dc.point.x, dc.point.z, P.peak * dc.k * 0.3); });
  return c;
}

// ── 현장 측정 키트 (채수한 자리 · 지금 시각): pH · 용존산소 · 탁도 · 수온 · 냄새·겉보기 ──
function ucFieldKit(C, river, s, h, rnd) {
  const r = p => { const P = UC_POL[p]; return Math.max(0, (ucWaterConc(C, p, river, s, h) - P.base) / P.peak); };
  const rp = r('phenol'), rc = r('cadmium'), ra = r('ammonia'), ro = r('oil'), rb = r('bod'), n = () => (rnd() - 0.5);
  const out = { pH: 7.6 - rc * 0.9 + ra * 0.8 + n() * 0.1, DO: 8.6 - rp * 2.2 - ra * 3.2 - ro * 1.2 - rb * 4.8 + n() * 0.3, turb: 4 + rc * 3 + rb * 18 + ro * 4 + n() * 1.5, temp: 17.5 + n() * 0.6, notes: [] };
  if (rp > 0.12) out.notes.push(UC_POL.phenol.smell); if (ra > 0.12) out.notes.push(UC_POL.ammonia.smell);
  if (ro > 0.08) out.notes.push('수면에 무지갯빛 기름막'); if (rb > 0.2) out.notes.push(UC_POL.bod.smell);
  if (rp + rc + ra + rb > 0.35) out.notes.push('죽은 물고기가 보임');
  return out;
}
// ── 물벼룩 바이오센서 기록 (18시 ~ 지금, 1시간마다 활동량 %) ──
function ucBioLog(C, st, nowH) {
  const rows = [];
  for (let h = 18; h <= Math.floor(nowH); h++) { let tox = 0;
    ['phenol', 'cadmium', 'ammonia', 'oil', 'bod'].forEach(p => { const P = UC_POL[p]; tox += Math.max(0, ucWaterConc(C, p, st.river, st.s, h + 0.5) - P.base) / (P.peak * 0.35); });
    rows.push({ h, act: Math.max(4, Math.round(96 - Math.min(92, tox * 100) + ((h * 7 + st.s) % 5) - 2)) }); }
  return rows;
}
// ── 환경DNA: 물고기 종 수 (평소 대비) ──
function ucEdna(C, river, s, h) {
  let tox = 0; ['phenol', 'cadmium', 'ammonia', 'bod'].forEach(p => { const P = UC_POL[p]; tox += Math.max(0, ucWaterConc(C, p, river, s, h) - P.base) / P.peak; });
  const usual = river === 'taehwa' ? 18 : 12; return { usual, now: Math.max(2, Math.round(usual * (1 - Math.min(0.85, tox * 1.6)))) };
}
// ── 센서 시계열 (공기) ──
function ucAirLog(C, st, nowH) {
  const rows = [];
  for (let h = 18; h <= Math.floor(nowH); h++) rows.push({ h, voc: +(ucAirConc(C, 'benzene', st.x, st.z, h + 0.5) + ucAirConc(C, 'toluene', st.x, st.z, h + 0.5) * 0.25).toFixed(1), h2s: +ucAirConc(C, 'h2s', st.x, st.z, h + 0.5).toFixed(1) });
  return rows;
}
// ── 시설 서류: 허가 물질 · 배출 지점 · 야간 자동측정(유량/TMS) ──
function ucFacilityRecord(C, facId) {
  const F = UC_FAC[facId], culprit = facId === C.fac, pt = ucPoint(C.point), rows = [];
  F.outs.concat(F.stacks).forEach(o => {
    const rec = []; for (let h = 18; h <= 31; h++) { const hit = culprit && o.id === C.point && h + 1 > C.t0 && h < C.t0 + C.dur;
      rec.push({ h, v: o.kind === 'water' ? (hit ? '—' : String(Math.round(40 + ((h * 13 + o.id.length * 7) % 9)))) : (hit ? '통신 장애' : '정상') }); }
    rows.push({ id: o.id, label: o.label, kind: o.kind || 'air', rec }); });
  return { permit: F.can.map(p => UC_POL[p].name), rows };
}
// ── 사람들 증언 ──
function ucTestimony(C, who) {
  const P = UC_POL[C.pol], pt = ucPoint(C.point), hm = h => { const d = Math.floor(h / 24), hh = Math.floor(h % 24), mm = Math.round((h % 1) * 6) * 10; return (d === 0 ? '어젯밤 ' : '오늘 새벽 ') + hh + '시' + (mm ? ' ' + mm + '분' : '') + '쯤'; };
  if (who === 'fisher') {                                    // 하구 어민: 물 사건이면 하구에 닿은 시각 · 공기면 냄새 없음
    if (P.path === 'water') { const mouthRiver = pt.river === 'dongcheon' ? 'taehwa' : pt.river; const R = UC_RIVERS[mouthRiver], d = ucDownstream(pt.river, pt.s, mouthRiver, ucLen(R.pts) - 4);
      const arr = C.t0 + (d >= 0 ? d / (R.speed * UC_KM) : 3);
      return '"' + hm(arr) + ' 하구에서 그물을 걷는데 물고기가 배를 뒤집고 떠올랐어요. ' + R.name + ' 쪽에서 내려온 물이었지.' + (P.smell ? ' 물에서 ' + P.smell + '가 났고요.' : ' 냄새는 딱히 없었어요.') + '"'; }
    return '"밤새 바다는 멀쩡했어요. 물고기도 평소대로고요. 대신 바람 타고 이상한 냄새는 좀 났지."';
  }
  if (who === 'resident') {                                  // 국가정원 산책 주민: 공기면 냄새를 맡은 시각
    if (P.path === 'air') return '"' + hm(C.t0 + 0.6) + ' 창문을 닫아야 할 정도로 ' + P.smell + '가 났어요. 바람이 꽤 불었고요."';
    return '"밤엔 별일 없었어요. 아침에 강가에서 물 색이 좀 이상하다는 얘기는 들었어요."';
  }
  if (who === 'doctor') {
    if (P.sym) return '"오늘 아침 ' + P.sym + ' 때문에 온 환자가 평소의 세 배예요. 대부분 ' + (P.path === 'air' ? '밤사이 창문을 열어 두었던 분들' : '새벽에 강가에 나갔던 분들') + '이에요."';
    return '"특별히 늘어난 증상은 없어요. 물고기 사고라면 사람보다 강 생물을 먼저 조사해 보세요."';
  }
  if (who === 'activist') return '"보나 마나 ' + UC_FAC[C.rumor].name + '예요! 예전에도 사고를 낸 적이 있거든요. 제 말 믿어요."';   // 틀린 소문(함정)
  if (who === 'guard') {                                     // 범인 시설 야간 경비원만 단서
    return null;
  }
  return '';
}
function ucGuardLine(C, facId) {
  if (facId !== C.fac) return '"밤새 조용했어요. 순찰 기록도 평소랑 같아요."';
  const pt = ucPoint(C.point); const hh = Math.floor(C.t0 % 24);
  return '"' + (hh < 12 ? '새벽 ' : '밤 ') + hh + '시 무렵 ' + (pt.kind === 'water' ? pt.label + ' 쪽에서 펌프 돌아가는 소리가 한참 났어요. 평소엔 그 시간에 안 돌리는데…' : pt.label + ' 쪽에서 평소보다 시커먼 연기가 났어요.') + ' 저한테 들었다고는 하지 마세요."';
}
function ucManagerLine(C, facId) {
  const F = UC_FAC[facId];
  if (facId === C.fac) return '"저희는 허가받은 대로만 운영합니다. 어젯밤도 모두 정상이었어요. 자동측정 기록을 보시면 알 거예요."';   // 거짓말
  const dec = C.decoys.find(d => d.fac === facId);
  return dec ? '"저희 ' + dec.point.label + '로 ' + UC_POL[dec.pol].name + '이(가) 조금 나가긴 하지만 허가 범위 안이에요. 매일 그 정도는 나갑니다."' : '"저희 시설은 어젯밤 특이사항이 없었습니다. 기록 확인하셔도 됩니다."';
}

// ── 보고서 채점 ──
function ucSlot(h) { return h < 21 ? 0 : h < 24 ? 1 : h < 27 ? 2 : h < 30 ? 3 : 4; }
const UC_SLOTS = ['어젯밤 18~21시', '어젯밤 21~24시', '새벽 0~3시', '새벽 3~6시', '아침 6~8시'];
function ucScore(C, rep) {
  const r = { pol: rep.pol === C.pol, fac: rep.fac === C.fac, point: rep.point === C.point, time: rep.slot === ucSlot(C.t0) };
  const ev = (rep.evidence || []).slice(0, 3), keys = ev.filter(e => e && e.key).length;
  const score = (r.pol ? 20 : 0) + (r.fac ? 25 : 0) + (r.point ? 20 : 0) + (r.time ? 15 : 0) + Math.round(keys / 3 * 20);
  const grade = score >= 95 ? 'S' : score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  return Object.assign(r, { keys, score, grade });
}
if (typeof module !== 'undefined') module.exports = { UC_KM, UC_RIVERS, UC_POL, UC_PANELS, UC_FAC, UC_PLACES, UC_BIO, UC_AIR, UC_SLOTS, ucLen, ucAt, ucProject, ucDownstream, ucRng, ucMakeCase, ucPoint, ucWaterConc, ucAirConc, ucFieldKit, ucBioLog, ucEdna, ucAirLog, ucFacilityRecord, ucTestimony, ucGuardLine, ucManagerLine, ucSlot, ucScore };
