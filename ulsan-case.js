// 울산 환경 수사대 — 사건 생성 · 증거 시뮬레이션 (화면과 분리된 순수 계산)
//   세계 좌표: 실제 울산 지도(위도·경도 → 1칸 = 90 m) · x = 동쪽, z = 남쪽 · 하천 거리표 1 km = 11.1칸
//   진실(범인 시설 · 오염물질 · 배출 지점 · 배출 시각) 하나에서 모든 증거가 물리적으로 일관되게 나옵니다
//     · 물: 배출 지점 '하류'로만 퍼지고(상류는 깨끗), 거리만큼 흐름 속도에 따라 늦게 도착, 멀수록 옅어짐
//     · 공기: 그 시각의 바람을 따라 풀룸(연기띠)으로 퍼짐 — 바람이 부는 쪽 센서만 오름
//   함정: 다른 시설의 '허가된 평소 배출'(낮은 농도 · 항상 있음) · 틀린 소문 · 배출 지점이 둘인 시설
const UC_KM = 11.1;                                       // 1km = 11.1칸 (1칸 = 90 m, 실제 울산 지도 축척)
// ── 하천 (상류 → 하류) · 실제 경로: 태화강 하류는 남구·중구·북구 경계선(행정동 경계 자료), 나머지는 실제 지점 근사 ──
const UC_RIVERS = {
  taehwa: { name: '태화강', speed: 1.6, w: 4.5, pts: [[-191.3, -127.0], [-146.0, -90.0], [-105.7, -53.0], [-65.4, -50.5], [-28.2, -60.4], [8.1, -50.5], [30.2, -39.4], [45.2, -39.4], [50.1, -35.5], [59.2, -34.7], [67.6, -31.1], [72.2, -26.5], [78.3, -24.3], [83.8, -30.7], [89.3, -33.6], [96.8, -31.5], [111.7, -30.8], [121.1, -29.9], [127.1, -30.3], [133.9, -28.9], [138.9, -25.4], [144.6, -22.5], [153.8, -16.3], [161.0, -6.5], [165.9, -0.7], [169.9, 6.7], [171.8, 10.2], [173.7, 13.7], [175.6, 17.2], [177.5, 20.7], [179.4, 24.2], [181.3, 27.7], [183.2, 31.2]] },
  dongcheon: { name: '동천', speed: 1.2, w: 2.5, pts: [[123.8, -151.6], [130.9, -117.1], [136.9, -86.3], [140.9, -57.9], [133.9, -28.9]], joins: ['taehwa', 0] },
  yeocheon: { name: '여천천', speed: 0.9, w: 2.2, pts: [[80.5, -11.1], [98.7, -3.7], [115.8, 3.7], [130.9, 12.3], [142.9, 21.0], [156.0, 27.1], [159.6, 28.8], [163.2, 30.5]] },
  oehwang: { name: '외황강', speed: 1.0, w: 2.8, pts: [[35.2, 30.8], [65.4, 45.6], [90.6, 56.7], [110.7, 69.0], [126.8, 77.7], [142.9, 83.8]] },
  hoeya: { name: '회야강', speed: 1.1, w: 3, pts: [[-5.0, 90.0], [20.1, 107.3], [45.3, 119.6], [68.5, 135.6], [90.6, 151.6], [110.7, 164.0], [128.9, 173.8], [132.4, 175.7]] },
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
//   이름은 중학생이 읽기 쉬운 말로 (v2026-10-19a · 예전: 암모니아성 질소 · 유분(기름) · BOD(유기물)) · desc = 한 줄 설명(분석표·보고서에 함께)
const UC_POL = {
  phenol:  { name: '페놀', desc: '소독약 냄새가 나는 물질', path: 'water', unit: 'mg/L', base: 0.002, limit: 0.005, peak: 0.9, panel: 'organic', smell: '소독약 같은 냄새', sym: '피부 따가움·가려움' },
  cadmium: { name: '카드뮴', desc: '몸에 쌓이는 중금속 (냄새 없음)', path: 'water', unit: 'mg/L', base: 0.0004, limit: 0.005, peak: 0.06, panel: 'metal', smell: '', sym: '' },
  ammonia: { name: '암모니아', desc: '지린내 나는 물질 (비료·오줌)', path: 'water', unit: 'mg/L', base: 0.25, limit: 1.5, peak: 7, panel: 'nutrient', smell: '지린내', sym: '눈 따가움' },
  oil:     { name: '기름', desc: '물 위에 무지갯빛 막을 만듦', path: 'water', unit: 'mg/L', base: 0.3, limit: 1, peak: 9, panel: 'oil', smell: '기름 냄새', sym: '' },
  bod:     { name: '유기물', desc: '썩으면서 물속 산소를 없앰 (음식 찌꺼기·하수)', path: 'water', unit: 'mg/L', base: 1.8, limit: 5, peak: 28, panel: 'bod', smell: '썩은 냄새', sym: '' },
  benzene: { name: '벤젠', desc: '휘발유 냄새 · 오래 마시면 위험한 물질', path: 'air', unit: 'ppb', base: 0.7, limit: 1.5, peak: 60, panel: 'air', smell: '휘발유 같은 냄새', sym: '두통·어지럼' },
  toluene: { name: '톨루엔', desc: '페인트(시너) 냄새가 나는 물질', path: 'air', unit: 'ppb', base: 3, limit: 50, peak: 260, panel: 'air', smell: '페인트(시너) 냄새', sym: '두통·메스꺼움' },
  h2s:     { name: '황화수소', desc: '달걀 썩는 냄새가 나는 기체', path: 'air', unit: 'ppb', base: 0.5, limit: 20, peak: 180, panel: 'air', smell: '달걀 썩는 냄새', sym: '두통·눈 따가움' }
};
const UC_PANELS = { organic: '페놀·벤젠', metal: '카드뮴(중금속)', nutrient: '암모니아', oil: '기름', bod: '유기물', air: '공기 속 물질(벤젠·톨루엔·황화수소)' };
const UC_WATER_POLS = ['phenol', 'cadmium', 'ammonia', 'oil', 'bod'], UC_AIR_POLS = ['benzene', 'toluene', 'h2s'];   // 연구원 분석: 물 시료 = 5가지 한꺼번에 · 공기 시료 = 3가지

// ── 시설 (모두 가상 이름 · 실제 회사·처리장과 관계없음 — 실제 산단·처리장 자리에 배치) — 배출구(물) · 굴뚝(공기) ──
//   v2026-10-19a: 실제 회사·처리장과 헷갈릴 수 있던 이름을 누가 봐도 가상인 이름으로 바꿈
const UC_FAC = {
  F1: { name: '무지개화학 (석유화학 수지공장)', zone: '울산미포국가산업단지 (남구 석유화학단지)', at: [112.7, 23.4], can: ['phenol', 'benzene', 'toluene', 'oil'],
        outs: [{ id: 'F1-A', kind: 'water', river: 'yeocheon', s: 41.5, label: '폐수 방류구', type: 'waste' }, { id: 'F1-B', kind: 'water', river: 'yeocheon', s: 23.8, label: '빗물 배수구', type: 'rain' }, { id: 'F1-C', kind: 'water', river: 'yeocheon', s: 32.5, label: '냉각수 배출구', type: 'cool' }], stacks: [{ id: 'F1-S', x: 116.8, z: 27.1, label: '공정 굴뚝' }, { id: 'F1-S2', x: 100.7, z: 26.9, label: '보일러 굴뚝', meter: false, note: '작은 보일러 굴뚝 · 자동측정 대상 아님' }, { id: 'F1-S3', x: 110.2, z: 17.4, label: '폐가스 소각로 굴뚝' }] },
  F2: { name: '고래정유 (정유공장)', zone: '울산미포국가산업단지 (남구 석유화학단지)', at: [137.9, 44.4], can: ['benzene', 'h2s', 'oil', 'phenol'],
        outs: [{ id: 'F2-A', kind: 'water', river: 'yeocheon', s: 68.9, label: '폐수 방류구', type: 'waste' }, { id: 'F2-B', kind: 'water', river: 'yeocheon', s: 78, label: '빗물 배수구', type: 'rain' }, { id: 'F2-C', kind: 'water', river: 'yeocheon', s: 60.5, label: '냉각수 배출구', type: 'cool' }], stacks: [{ id: 'F2-S1', x: 132.9, z: 46.8, label: '가열로 굴뚝' }, { id: 'F2-S2', x: 146.0, z: 40.7, label: '황 회수 굴뚝' }, { id: 'F2-S3', x: 128.9, z: 59.2, label: '플레어 스택', meter: false, note: '비상시 남는 가스를 태우는 굴뚝 · 자동측정 대상 아님' }] },
  F3: { name: '은별제련 (금속 제련소)', zone: '온산국가산업단지', at: [132.9, 99.9], can: ['cadmium'], outs: [{ id: 'F3-A', kind: 'water', river: 'oehwang', s: 102.2, label: '폐수 방류구', type: 'waste' }, { id: 'F3-B', kind: 'water', river: 'oehwang', s: 111.5, label: '빗물 배수구', type: 'rain' }], stacks: [] },
  F4: { name: '풀잎비료 (비료공장)', zone: '울주군 청량읍', at: [80.5, 67.8], can: ['ammonia', 'cadmium'], outs: [{ id: 'F4-A', kind: 'water', river: 'oehwang', s: 50.4, label: '폐수 방류구', type: 'waste' }, { id: 'F4-B', kind: 'water', river: 'oehwang', s: 59.5, label: '빗물 배수구', type: 'rain' }, { id: 'F4-C', kind: 'water', river: 'oehwang', s: 41.5, label: '냉각수 배출구', type: 'cool' }], stacks: [] },
  F5: { name: '파랑새자동차 (도장공장)', zone: '북구 양정동', at: [169.1, -43.1], can: ['toluene'], outs: [], stacks: [{ id: 'F5-S1', x: 165.1, z: -46.8, label: '도장 1라인 굴뚝' }, { id: 'F5-S2', x: 174.2, z: -39.4, label: '도장 2라인 굴뚝' }, { id: 'F5-S3', x: 180.6, z: -45.1, label: '건조로 굴뚝', meter: false, note: '페인트를 말리는 건조로 굴뚝 · 자동측정 대상 아님' }] },
  F6: { name: '푸른강 하수처리장', zone: '남구 무거동', at: [32.2, -28.4], can: ['ammonia', 'bod'], outs: [{ id: 'F6-A', kind: 'water', river: 'taehwa', s: 259.4, label: '처리수 방류구', type: 'waste' }, { id: 'F6-B', kind: 'water', river: 'taehwa', s: 248, label: '비상 우회 방류구', type: 'bypass' }, { id: 'F6-C', kind: 'water', river: 'taehwa', s: 270, label: '빗물 배수구', type: 'rain' }], stacks: [] },
  F7: { name: '꿀맛식품 (식품공장)', zone: '울주군 삼남읍', at: [-102.7, -40.7], can: ['bod', 'ammonia'], outs: [{ id: 'F7-A', kind: 'water', river: 'taehwa', s: 115.3, label: '폐수 방류구', type: 'waste' }, { id: 'F7-B', kind: 'water', river: 'taehwa', s: 105, label: '세척수 배수구', type: 'wash' }, { id: 'F7-C', kind: 'water', river: 'taehwa', s: 126, label: '빗물 배수구', type: 'rain' }], stacks: [] },
  F8: { name: '바닷가 하수처리장', zone: '울주군 청량읍', at: [118.8, 60.4], can: ['ammonia', 'h2s'], outs: [{ id: 'F8-A', kind: 'water', river: 'oehwang', s: 91.3, label: '처리수 방류구', type: 'waste' }, { id: 'F8-B', kind: 'water', river: 'oehwang', s: 82, label: '비상 우회 방류구', type: 'bypass' }], stacks: [{ id: 'F8-S', x: 122.8, z: 57.9, label: '찌꺼기 창고 배기구' }, { id: 'F8-S2', x: 106.8, z: 53.4, label: '소화조 가스 배출구', meter: false, note: '찌꺼기를 썩히는 소화조의 가스 배출구 · 자동측정 대상 아님' }] }
};
// 한 강에서 그 물질을 쓰는 시설의 배출구 (상류 → 하류) — 🔬 독성 지도 후보
function ucCandOuts(pol, river) { const out = []; Object.keys(UC_FAC).forEach(k => { const F = UC_FAC[k]; if (F.can.indexOf(pol) < 0) return; F.outs.forEach(o => { if (o.river === river) out.push(Object.assign({ fac: k }, o)); }); }); return out.sort((a, b) => a.s - b.s); }
// 배출구 종류 (v2026-10-20c): 자동측정기(TMS)는 폐수·처리수 방류구에만 — 빗물·냉각수·세척수·비상 우회관은 법적으로 측정 대상이 아니라 기록이 없음
//   그래서 시설 서류의 '빈 기록'만으로는 어느 관인지 정해지지 않아요 → 🔬 독성 지도(바로 위·아래 물)와 시각 계산으로 가려냄
const UC_OUT_TYPE = { waste: { n: '폐수·처리수 방류구', meter: true, use: '공장에서 처리한 물을 내보내는 관 · 자동측정기로 1시간마다 양을 기록' },
  rain: { n: '빗물 배수구', meter: false, use: '비 올 때 마당 빗물이 빠지는 관 · 비가 안 오면 말라 있어야 정상' },
  cool: { n: '냉각수 배출구', meter: false, use: '기계를 식힌 따뜻한 물이 늘 조금씩 나오는 관' },
  wash: { n: '세척수 배수구', meter: false, use: '설비를 씻은 물이 낮 동안 나오는 관 · 밤엔 멈춤' },
  bypass: { n: '비상 우회 방류구', meter: false, use: '처리 설비가 고장 났을 때만 여는 관 · 열면 구청에 신고해야 함' } };
function ucOutType(o) { return UC_OUT_TYPE[(o && o.type) || 'waste'] || UC_OUT_TYPE.waste; }
function ucMetered(o) { if (!o) return true; if (o.kind === 'water' || o.river) return ucOutType(o).meter; return o.meter !== false; }   // 굴뚝: 큰 공정 굴뚝만 자동측정 (보일러·플레어·건조로 등 작은 굴뚝은 기록 없음)
function ucFacShort(F) { return (typeof F === 'string' ? UC_FAC[F] : F).name.split(' (')[0]; }   // '무지개화학'
// 허가 물질을 어디에 쓰는지 (서류에 함께 적힘) — 같은 물질을 다루는 시설이 늘 두 곳 이상 (물질만으로 시설이 정해지지 않게)
const UC_USE = { F1: { phenol: '수지 원료', benzene: '원료', toluene: '수지를 녹이는 용제', oil: '공정 기름' }, F2: { benzene: '휘발유 성분', h2s: '원유의 황', oil: '원유·기름', phenol: '정유 폐수에 섞여 나옴' },
  F3: { cadmium: '아연 광석에 섞여 나옴' }, F4: { ammonia: '비료 원료', cadmium: '인산비료 원료(인광석)에 조금 섞여 있음' }, F5: { toluene: '페인트 희석제(시너)' },
  F6: { ammonia: '하수 속 오줌·음식물', bod: '하수 속 유기물' }, F7: { bod: '식품 찌꺼기', ammonia: '식품 찌꺼기가 썩으며 생김' }, F8: { ammonia: '하수 속 오줌·음식물', h2s: '하수 찌꺼기가 썩으며 생김' } };
// 시설 마당(울타리)과 정문 — 강·바다·이웃 시설을 피해 시설마다 다름 (F.at 기준 · a 동쪽+ · b 남쪽+) · 정문 [a, b, 바깥 방향 x, z]
[['F1', [-17, -10, 12, 17]], ['F2', [-12, -10, 17, 17]], ['F3', [-17, -3, 2.5, 17], [-7, 17, 0, 1]], ['F4', [-17, -6, 13, 17]], ['F5', [-17, -17, 17, 17]],
 ['F6', [-17, -7, 12, 17]], ['F7', [-17, -7, 16, 17]], ['F8', [-16, -15, 6, 0], [-16, -7, -1, 0]]].forEach(([k, y, g]) => { UC_FAC[k].yard = y; UC_FAC[k].gate = g || [0, 17, 0, 1]; });
function ucYard(F) { return [F.at[0] + F.yard[0], F.at[1] + F.yard[1], F.at[0] + F.yard[2], F.at[1] + F.yard[3]]; }   // 울타리 [x0, z0, x1, z1]
function ucGate(F, d, side) { const g = F.gate, x = F.at[0] + g[0], z = F.at[1] + g[1]; d = d || 0; side = side || 0; return [x + g[2] * d + g[3] * side, z + g[3] * d - g[2] * side]; }   // 정문에서 바깥으로 d · 옆으로 side
function ucFence(F) { const [a0, b0, a1, b1] = F.yard, [ga, gb] = F.gate, G = 4, out = [];   // 울타리 선분 (F.at 기준) — 정문 자리는 비움
  const run = (p0, p1, fixed, horiz, gc) => { const segs = gc == null ? [[p0, p1]] : [[p0, gc - G], [gc + G, p1]]; segs.forEach(([u, v]) => { if (v - u > 0.4) out.push(horiz ? [u, fixed, v, fixed] : [fixed, u, fixed, v]); }); };
  run(a0, a1, b0, true, gb === b0 ? ga : null); run(a0, a1, b1, true, gb === b1 ? ga : null); run(b0, b1, a0, false, ga === a0 && gb !== b0 && gb !== b1 ? gb : null); run(b0, b1, a1, false, ga === a1 && gb !== b0 && gb !== b1 ? gb : null); return out; }
// 조사 장소 (실제 위치 근사)
const UC_PLACES = {
  lab:     { name: '울산보건환경연구원', at: [85.6, -14.8] },
  weather: { name: '울산기상대', at: [106.6, -57.9] },   // 실제 위치: 중구 약사동 (2015년 북정동에서 옮김)
  clinic:  { name: '남구보건소', at: [112.7, -19.7] },
  garden:  { name: '태화강 국가정원', at: [72.5, -29.6] },
  riverOffice: { name: '울산시청 재난상황실', at: [92.6, -32.1] },
  port:    { name: '울산항', at: [159.1, 21.0] },
  onsanHarbor: { name: '온산항', at: [132.9, 93.7] },
  mouth:   { name: '명촌교 (태화강 하구)', at: [153.0, -21.0] }
};
const UC_START = [90.6, -29.6];
// 장소 사람들 자리 (장소 기준 · 물가에서 한 발 물러남) — 온산 어민: 위판장 뒤 마른 땅 (v2026-10-18a · 예전 자리는 제련소 담장과 바다 사이 좁은 틈이라 물에 잠긴 땅 · 카메라와 사이에 제련소가 없게) · 울산항 어민: 부두 창고 사이 마른 땅 (예전 자리는 여천천 하구 물에 잠긴 강둑)
const UC_NPC_AT = { researcher: ['lab', -5, 7], forecaster: ['weather', 4, 7], doctor: ['clinic', 4, 7], resident: ['garden', 4, 9], riverman: ['riverOffice', 4, 7], fisherT: ['mouth', 6, 5], fisherO: ['onsanHarbor', -7.9, -5.2], fisherP: ['port', -1.8, 1.2] };
function ucNpcAt(id) { const [k, a, b] = UC_NPC_AT[id], P = UC_PLACES[k].at; return [P[0] + a, P[1] + b]; }
// 고정 측정소: 물벼룩 바이오센서(물) · 대기·악취 센서(공기)
const UC_BIO = [
  { id: 'B-T1', river: 'taehwa', s: 187.3, name: '태화강 언양 바이오센서' },
  { id: 'B-T2', river: 'taehwa', s: 386.4, name: '태화강 하류 바이오센서', side: 1 },
  { id: 'B-D', river: 'dongcheon', s: 55, name: '동천 바이오센서' },
  { id: 'B-Y', river: 'yeocheon', s: 55.2, name: '여천천 바이오센서' },
  { id: 'B-Y2', river: 'yeocheon', s: 84, name: '여천천 하구 바이오센서', side: 1 },   // 고래정유 방류구(F2-A) 아래 — 예전엔 F2-A 사건에 시각 단서가 없었음
  { id: 'B-O', river: 'oehwang', s: 70.8, name: '외황강 바이오센서', side: 1 },
  { id: 'B-H', river: 'hoeya', s: 89.2, name: '회야강 바이오센서' }
];
// 바이오센서 자리: 강 옆(물길에 수직으로 강폭/2 + 2.5칸) — 예전엔 동쪽으로만 옮겨 동서로 흐르는 곳에선 물속에 놓였음
function ucBioAt(b) { const R = UC_RIVERS[b.river], L = ucLen(R.pts), p = ucAt(R.pts, b.s), q = ucAt(R.pts, Math.min(L, b.s + 1)), o = ucAt(R.pts, Math.max(0, b.s - 1)), dx = q[0] - o[0], dz = q[1] - o[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d, sg = b.side || (nx >= 0 ? 1 : -1), off = R.w / 2 + 2.5;
  return [p[0] + nx * sg * off, p[1] + nz * sg * off]; }
const UC_AIR = [
  { id: 'A1', x: 118.8, z: -17.3, name: '삼산동 대기측정소' },
  { id: 'A2', x: 122.8, z: 11.1, name: '여천동 악취센서' },
  { id: 'A3', x: 130.9, z: 55.5, name: '용연동 악취센서' },
  { id: 'A4', x: 105.7, z: 37.0, name: '부곡동 악취센서' },
  { id: 'A5', x: 142.9, z: -74.0, name: '효문동 대기측정소' },
  { id: 'A6', x: 176.2, z: -33.3, name: '양정동 악취센서' },
  { id: 'A7', x: 130.9, z: -129.4, name: '농소동 대기측정소' },
  { id: 'A8', x: 92.6, z: -9.9, name: '신정동 대기측정소' },
  { id: 'A9', x: 132.9, z: 107.3, name: '온산읍 악취센서' }
];

// ── 교사 설정: 난이도 · 사건 수 · 사건당 시간(분) ── 세션 track 값 'normal:2:20' 처럼 전달 (난이도만 오면 기본값)
//   v2026-10-19a: 중학생 눈높이로 낮춤 — 쉬움 = 함정 없음(서류의 빈 기록 = 범인) · 보통 = 헷갈리는 빈 기록 1곳 + 소문 · 어려움 = 예전 '보통'(평소 배출 · 고장 2곳 · 거짓말)
//   cand: '다음 할 일'에 그 물질을 쓰는 시설 이름을 알려 줌 · staff: 시설 정문의 환경팀장(늘 '기록이 빈 건 고장'이라고 둘러댐)을 둠
const UC_MODES = {
  easy:   { name: '쉬움', tag: '처음 해 보는 반', desc: '함정 없음 · 미니게임 2개가 열쇠(⚗️ 시약 실험 · 🔬 물벼룩/🧭 바람길) · 분석 30분 · 다음 할 일과 길 안내 · 배출 지점 지도에 표시', cases: 2, min: 18, decoy: 0, rumor: false, lie: false, labH: 0.5, ednaH: 1, ratio: 'strong', allPoints: true, guide: 'full', cand: true },
  normal: { name: '보통', tag: '추천 · 중학생', desc: '미니게임 2개가 열쇠 · 헷갈리는 빈 기록(계측기 고장) 1곳 · 소문 하나 · 분석 1시간 · 다음 할 일과 길 안내', cases: 2, min: 20, decoy: 0, rumor: true, lie: false, labH: 1, ednaH: 1.5, ratio: 'strong', allPoints: false, guide: 'full', cand: true },
  hard:   { name: '어려움', tag: '추리 고수', desc: '미니게임 2개가 열쇠 · 평소 배출 조금 · 헷갈리는 빈 기록 2곳 · 소문과 거짓말 · 분석 2시간 · 안내는 짧게', cases: 3, min: 18, decoy: 0.22, decoyK: 0.6, rumor: true, lie: true, labH: 2, ednaH: 3, ratio: 'plain', allPoints: false, guide: 'short', cand: false }
};
function ucSettings(trackId) {
  const p = String(trackId || '').split(':'), d = UC_MODES[p[0]] ? p[0] : 'normal', M = UC_MODES[d];
  const cases = Math.max(1, Math.min(3, parseInt(p[1], 10) || M.cases)), min = Math.max(5, Math.min(40, parseInt(p[2], 10) || M.min));
  return Object.assign({}, M, { diff: d, cases, min, label: M.name + ' · 사건 ' + cases + '개 · ' + min + '분씩' });   // 교사가 고른 값이 난이도 기본값보다 우선
}

// 대기 센서 기록에서 '치솟음'(빨간 막대)으로 보이는가 — 그 물질만 v, 나머지는 평소값일 때 (기록 화면: VOC = 벤젠 + 톨루엔×0.25 > 8 · H₂S > 5)
//   예전엔 사건을 만들 때 '평소의 5배'로만 봐서, 톨루엔 사건은 센서 기록에 아무것도 안 보이는 일이 있었음 (바람길·시각 단서가 사라짐)
function ucAirSpike(polId, v, margin) { const m = margin || 0, r = x => +x.toFixed(1); return polId === 'h2s' ? r(v) > 5 + m : polId === 'benzene' ? r(v + 0.25 * UC_POL.toluene.base) > 8 + m : polId === 'toluene' ? r(UC_POL.benzene.base + 0.25 * v) > 8 + m : false; }
// ── 시드 난수 ──
function ucRng(seed) { let s = (Math.abs(Math.floor(Number(seed) || 0)) % 2147483646) + 1; return () => (s = s * 48271 % 2147483647) / 2147483647; }   // 그림·나무 배치용 (예전 그대로)
// 사건 만들기용: 시드를 한 번 섞은 뒤 — 예전엔 시드가 가까우면 나오는 수도 비슷해 '범인은 보통 가장 이른 빈 칸' 같은 쏠림이 생겼음
function ucRngH(seed) { const v = Math.abs(Math.floor(Number(seed) || 0)), lo = v % 4294967296, hi = Math.floor(v / 4294967296) % 4294967296; let x = (lo ^ Math.imul(hi, 0x9E3779B1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45D9F3B) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45D9F3B) >>> 0; x = (x ^ (x >>> 16)) >>> 0; return ucRng(x); }

// ── 사건 생성 ──
//   시각은 'Day0 00:00' 부터의 시간(h). 조사는 Day1 08:00(=32h) 부터 20:00(=44h) 까지
function ucMakeCase(seed, diff, want, noFac) {
  const d = UC_MODES[diff] ? diff : 'hard', M = UC_MODES[d];
  const rnd = ucRngH(seed), pick = a => a[Math.floor(rnd() * a.length)];
  const facIds = Object.keys(UC_FAC);
  // 범인: 물질을 먼저 고르게(물 사건 · 공기 사건마다) → 그 물질을 허가받은 시설 → 배출구·굴뚝
  //   예전엔 시설부터 골라 물 사건은 제련소(카드뮴)가, 공기 사건은 도장공장(톨루엔)이 훨씬 자주 나왔음
  const pols = Object.keys(UC_POL).filter(p => !want || UC_POL[p].path === want), pol = pick(pols), path = UC_POL[pol].path, ptsOf = F => path === 'water' ? F.outs : F.stacks;
  const able = facIds.filter(k => UC_FAC[k].can.indexOf(pol) >= 0 && ptsOf(UC_FAC[k]).length), able2 = able.filter(k => k !== noFac);   // 지난 사건 범인 시설은 24시간 감시 중 (뉴스로 알려 줌)
  const fac = pick(able2.length ? able2 : able), point = pick(ptsOf(UC_FAC[fac]));
  // 밤사이 '이상한 일'의 시각들을 한꺼번에 같은 규칙으로 만들고(범인 배출 + 계측기 고장) 그중 하나를 범인 것으로 — 서류·경비원만 봐서는 어느 것이 범인인지 모름
  //   공기는 냄새가 바로 퍼져서 서로 1.5시간 넘게 떨어뜨림 (시각으로 가려낼 수 있게) · 물은 배출구마다 도착 시각이 달라 겹쳐도 됨
  const nw = (UC_GLITCH_N[d] != null ? UC_GLITCH_N[d] : 2) + 1, gap = path === 'air' ? 1.5 : 0; let wins = [];
  for (let t = 0; t < 400; t++) { wins = []; for (let i = 0; i < nw; i++) wins.push({ h: 20 + rnd() * 10, dur: 1.2 + rnd() * 1.3 });
    if (!gap || wins.every((a, i) => wins.every((b, j) => i === j || a.h + a.dur + gap <= b.h || b.h + b.dur + gap <= a.h))) break; }
  const ci = Math.floor(rnd() * nw), t0 = wins[ci].h, dur = wins[ci].dur;   // 전날 20시 ~ 새벽 6시 사이에 시작 · 1.2~2.5시간
  // 바람(기상대 기록): 밤엔 육풍(서→동), 새벽엔 방향이 조금씩 돎 — 시간마다 방향(바람이 '불어가는' 쪽, 라디안)과 속도
  const makeWind = () => { const w = []; let dir = rnd() * Math.PI * 2;
    for (let h = 18; h <= 44; h++) { dir += (rnd() - 0.5) * 0.5; w.push({ h, dir, spd: 1.2 + rnd() * 2.5 }); } return w; };
  let wind = makeWind();
  // 함정 1: 허가된 평소 배출 (항상 조금 · 기준 안) — 범인 시설도 똑같은 확률로 평소대로 내보냄 (예전엔 범인 시설만 빠져서 '평소 배출이 있는 곳 = 범인 아님'이 됐음)
  const decoys = [];
  facIds.forEach(id => { const F = UC_FAC[id]; F.can.forEach(p => { if (rnd() < M.decoy) { const pts = UC_POL[p].path === 'water' ? F.outs : F.stacks; if (pts.length) decoys.push({ fac: id, pol: p, point: pick(pts), k: (0.08 + rnd() * 0.1) * (M.decoyK || 1) }); } }); });
  // 함정 2: 소문 — 그 물질을 다룰 수 있는 시설 중 아무 곳이나 (범인일 때도, 아닐 때도 있음 · 예전엔 늘 범인이 아니어서 '소문난 곳을 빼면' 풀렸음)
  const rumor = pick(facIds.filter(id => UC_FAC[id].can.indexOf(pol) >= 0 && ptsOf(UC_FAC[id]).length));
  const C = { seed, diff: d, fac, pol, point: point.id, t0, dur, wins: wins.filter((w, i) => i !== ci), wind, decoys, rumor, noRumor: !M.rumor, noLie: !M.lie, startH: 32, endH: 44, watched: able2.length && noFac ? noFac : null };
  // 공기 사건은 연기띠가 센서 2곳 이상에 '치솟음'으로 보여야 풀 수 있음 — 그런 바람이 나올 때까지 다시 (기록 화면처럼 소수 첫째 자리 · 여유를 두고)
  if (path === 'air') {
    const hits = () => { const Cc = Object.assign({}, C, { decoys: [] }); return UC_AIR.filter(st => { let mx = 0; for (let h = 18; h <= 32; h++) mx = Math.max(mx, ucAirConc(Cc, pol, st.x, st.z, h + 0.5)); return ucAirSpike(pol, mx, 0.3); }).length; };
    // 🧭 바람길(미니게임)을 제대로 그리면 범인 시설이 후보에 들어가야 함 — 냄새 센서 전부 · 가장 진한 두 곳으로 그어도 (예전: 공기 사건 0.6% 에서 범인이 후보에 없었음)
    const ok = () => hits() >= 2 && ucWindIdeal(C).every(cs => cs.indexOf(fac) >= 0);
    for (let k = 0; k < 300 && !ok(); k++) C.wind = makeWind();
  }
  return C;
}
// 바람길 미니게임과 같은 계산: 냄새가 치솟은 센서에서 바람을 거슬러 그은 선 → 선이 모이는 곳에 가까운 굴뚝 2~3곳 (ulsan-mini.js startWind 의 cands 와 같음)
function ucWindCands(rays) { const facs = Object.keys(UC_FAC).filter(k => UC_FAC[k].stacks.length); if (rays.length < 2) return [];
  const rd = (r, x, z) => { const px = x - r.st.x, pz = z - r.st.z, d = px * r.u[0] + pz * r.u[1]; return d < 0 ? Math.hypot(px, pz) : Math.abs(px * r.u[1] - pz * r.u[0]); };
  return facs.map(k => ({ k, sc: rays.reduce((a, r) => a + Math.min(...UC_FAC[k].stacks.map(q => rd(r, q.x, q.z))), 0) / rays.length })).sort((a, b) => a.sc - b.sc).filter((x, i) => i < 2 || (i < 3 && x.sc < 40)).map(x => x.k); }
function ucWindIdeal(C) {   // [냄새 센서 전부로 그은 후보, 가장 진한 두 곳으로 그은 후보]
  const sp = []; UC_AIR.forEach(st => { let pk = null; ucAirLog(C, st, 32.5).forEach(r => { const v = Math.max(r.voc / 8, r.h2s / 5); if (v > 1 && (!pk || v > pk.v)) pk = { h: r.h, v }; });
    if (pk) { const w = C.wind[Math.max(0, Math.min(C.wind.length - 1, pk.h - 18))]; sp.push({ st, v: pk.v, u: [-Math.cos(w.dir), -Math.sin(w.dir)] }); } });
  if (sp.length < 2) return [[]]; const top2 = sp.slice().sort((a, b) => b.v - a.v).slice(0, 2); return [ucWindCands(sp), ucWindCands(top2)]; }
function ucPoint(id) { for (const f of Object.keys(UC_FAC)) { const F = UC_FAC[f]; for (const o of F.outs.concat(F.stacks)) if (o.id === id) return Object.assign({ fac: f }, o); } return null; }

// ── 물: 하천 한 지점의 농도 (시각 h) ──
//   배출 지점 하류 거리 d 칸: 도착 시각 = t0 + d/속도, 폭이 퍼지며 옅어짐 · 지나간 뒤에도 바닥·웅덩이에 일부 남음(잔류)
function ucWaterConc(C, polId, river, s, h) {
  const P = UC_POL[polId]; let c = P.base;
  const add = (src, k) => { const pt = ucPoint(src); if (!pt || pt.kind !== 'water') return 0;
    const d = ucDownstream(pt.river, pt.s, river, s); if (d < 0) return 0;
    const v = UC_RIVERS[pt.river].speed * UC_KM, arrive = d / v, dil = Math.exp(-d / 260);
    if (k != null) return P.peak * k * 0.25 * dil;                     // 평소 배출: 늘 조금 (합쳐서 기준 안으로 — 아래)
    const t = h - C.t0 - arrive, spread = C.dur + d / v * 0.35;
    const pulse = t < 0 ? 0 : (t < spread ? 1 : Math.exp(-(t - spread) / 2.2));
    return P.peak * dil * (0.22 + 0.78 * pulse) * (t < 0 ? 0 : 1); };
  if (C.pol === polId && UC_POL[polId].path === 'water') c += add(C.point, null);
  let dsum = 0; C.decoys.forEach(dc => { if (dc.pol === polId) dsum += add(dc.point.id, dc.k); });
  return c + Math.min(dsum, (P.limit - P.base) * 0.7);                // 허가된 평소 배출은 여러 곳을 합쳐도 기준(법 한도) 안 — 예전엔 페놀 평소 배출이 기준을 몇 배 넘어 범인 물질보다 커 보이기도 했음
}
// ── 공기: 센서 한 곳의 농도 (시각 h) — 가우스 풀룸(연기띠) ──
function ucAirConc(C, polId, x, z, h) {
  const P = UC_POL[polId]; let c = P.base;
  const w = C.wind[Math.max(0, Math.min(C.wind.length - 1, Math.floor(h) - 18))];
  const plume = (sx, sz, q) => { const dx = x - sx, dz = z - sz, ax = Math.cos(w.dir), az = Math.sin(w.dir);
    const along = dx * ax + dz * az, cross = -dx * az + dz * ax; if (along <= 2) return 0;
    const sig = 6 + along * 0.22; return q * Math.exp(-cross * cross / (2 * sig * sig)) / (1 + along / 40) / (0.6 + w.spd * 0.25); };
  if (C.pol === polId && P.path === 'air' && h >= C.t0 && h <= C.t0 + C.dur + 0.3) { const pt = ucPoint(C.point); c += plume(pt.x, pt.z, P.peak); }
  const cap = Math.min((P.limit - P.base) * 0.6, (polId === 'h2s' ? 3.4 : polId === 'benzene' ? 6.55 : 26.2) * 0.5);   // 허가 범위(기준) 안 · 센서 기록에 '치솟음'으로 보이지 않을 만큼 · 공기 시료 분석·검지관에서도 '평소의 5배'(크게 높음) 아래 (황화수소: 예전 4.5 → 평소 배출만으로 5.5배까지 나와 범인 물질처럼 보였음)
  let dsum = 0; C.decoys.forEach(dc => { if (dc.pol === polId && dc.point.x != null) dsum += plume(dc.point.x, dc.point.z, P.peak * dc.k * 0.3); }); c += Math.min(dsum, cap);
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
// ── 밤사이 '이상한 일' (서류의 빈 기록 · 경비원이 들은 소리 · 드론 열화상) ──
//   범인의 몰래 배출 한 건 + 다른 시설의 '계측기 고장·점검으로 기록이 빈 때'(깨끗한 물·수증기) 몇 건 — 겉으로는 똑같이 보여요
//   그래서 서류·경비원·드론만으로는 누구인지 못 정하고, 오염 측정(어디가 오염됐나)과 시각(거꾸로 계산한 출발 시각)을 맞춰야 가려져요
//   다른 시설 일은 일부러 헷갈리지 않는 시각에: 그 배출구가 범인이었다면 나왔을 출발 시각에서 1.5시간 넘게 떨어뜨림
const UC_GLITCH_N = { easy: 0, normal: 1, hard: 2 };   // v2026-10-19a (예전 1 · 2 · 2)
// 드론 열화상 구역 (🛸) — 구역마다 한 번에 찍히는 시설
const UC_ZONES = [{ id: 'petro', n: '여천천 석유화학단지', f: ['F1', 'F2'] }, { id: 'onsan', n: '외황강·온산', f: ['F3', 'F4', 'F8'] }, { id: 'gulhwa', n: '태화강 무거·굴화', f: ['F6'] }, { id: 'eonyang', n: '태화강 삼남·언양', f: ['F7'] }, { id: 'yangjeong', n: '북구 양정동', f: ['F5'] }];
function ucNightEvents(C) {
  if (C._ev) return C._ev;
  const rnd = ucRngH(Math.floor(Math.abs(Number(C.seed) || 1)) % 99991 * 31 + 4242), pt = ucPoint(C.point), water = UC_POL[C.pol].path === 'water';
  const ev = [{ fac: C.fac, point: C.point, h: C.t0, dur: C.dur, kind: 'illegal' }];
  const all = []; Object.keys(UC_FAC).forEach(k => { if (k !== C.fac) (water ? UC_FAC[k].outs : UC_FAC[k].stacks).forEach(o => { const ox = Object.assign({ fac: k, kind: water ? 'water' : 'air' }, o); if (ucMetered(ox)) all.push(ox); }); });   // 계측기 고장은 계측기가 있는 관에서만   // 범인 시설엔 고장을 두지 않음 (빈 칸이 둘인 곳 = 범인이 되지 않게)
  const shuf = a => a.map(x => [rnd(), x]).sort((a2, b2) => a2[0] - b2[0]).map(x => x[1]);
  const rival = o => UC_FAC[o.fac].can.indexOf(C.pol) >= 0 && (!water || o.river === pt.river), near = o => water ? o.river === pt.river : true;
  const v = water ? UC_RIVERS[pt.river].speed * UC_KM : 0, far = (a, b, g, gd, m) => g + gd + m <= a || g - m >= b;
  const okAt = (o, w) => { if (!water || o.river !== pt.river) return true; const fake = C.t0 + (o.s - pt.s) / v; return far(fake, fake, w.h, w.dur, 1.5); };   // 그 배출구에서 거꾸로 계산하면 나올 출발 시각과는 겹치지 않게 (시각으로 가려낼 수 있게)
  const used = {};
  (C.wins || []).forEach(w0 => {                                                               // 고장 시각마다 놓을 곳: 같은 물질을 다루는 다른 시설 → 같은 강 → 나머지 (한 시설에 하나씩)
    for (const g of [shuf(all.filter(rival)), shuf(all.filter(o => !rival(o) && near(o))), shuf(all.filter(o => !near(o)))]) for (const o of g) {
      if (used[o.fac]) continue; let w = w0; for (let k = 0; k < 30 && !okAt(o, w); k++) w = { h: 20 + rnd() * 10, dur: 1.2 + rnd() * 1.3 };   // 겹치면 같은 규칙으로 다시 뽑음
      if (okAt(o, w)) { used[o.fac] = 1; ev.push({ fac: o.fac, point: o.id, h: w.h, dur: w.dur, kind: 'glitch' }); return; } } });
  Object.defineProperty(C, '_ev', { value: ev, enumerable: false, configurable: true }); return ev;   // 복사·저장에는 안 딸려 감
}
function ucEventAt(C, pointId, h) { return ucNightEvents(C).find(e => e.point === pointId && h + 1e-6 >= e.h && h <= e.h + e.dur) || null; }   // 그 시각(정각 사진)에 그 자리에서 무언가 나오고 있었나
// 배출 지점 위치 글자: 물 = '여천천 3.7km' · 굴뚝 = 가장 가까운 동네 쪽
function ucPlaceText(o) {
  if (o.kind === 'water') return UC_RIVERS[o.river].name + ' ' + (o.s / UC_KM).toFixed(1) + 'km';
  let best = null, bd = 1e9; UC_AIR.forEach(a => { const d = Math.hypot(a.x - o.x, a.z - o.z); if (d < bd) { bd = d; best = a; } });
  const F = UC_FAC[o.fac], dx = F ? o.x - F.at[0] : 0, dz = F ? o.z - F.at[1] : 0, dir = ['동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽', '북쪽', '북동쪽'][((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];   // 8방위 (z = 남쪽) — 한 공장 굴뚝이 늘어 4방위로는 이름이 겹쳤음   // 같은 동네 굴뚝끼리도 구별되게 (공장 안 위치)
  return (best ? best.name.split(' ')[0] + ' 쪽 ' : '') + '굴뚝' + (F ? ' (공장 ' + dir + ')' : '');
}
// ── 시설 서류: 허가 물질(쓰는 곳) · 배출 지점(위치) · 야간 자동측정(유량/TMS) — 기록이 빈 칸은 범인 배출이든 계측기 고장이든 똑같이 '—'·'통신 장애' ──
function ucFacilityRecord(C, facId) {
  const F = UC_FAC[facId], rows = [];
  F.outs.concat(F.stacks).forEach(o => { const kind = o.kind || 'air', ox = Object.assign({ kind, fac: facId }, o);
    if (!ucMetered(ox)) { rows.push({ id: o.id, label: o.label, kind, pos: ucPlaceText(ox), rec: [], meter: false, note: kind === 'water' ? ucOutType(ox).use : (o.note || '자동측정 대상 아님') }); return; }   // 계측 대상이 아닌 관: 기록 자체가 없음 (몰래 내보내도 빈 칸이 안 생김)
    const rec = []; for (let h = 18; h <= 31; h++) { const hit = ucNightEvents(C).some(e => e.point === o.id && h + 1 > e.h && h < e.h + e.dur);
      rec.push({ h, v: kind === 'water' ? (hit ? '—' : String(Math.round(40 + ((h * 13 + o.id.length * 7) % 9)))) : (hit ? '통신 장애' : '정상') }); }
    rows.push({ id: o.id, label: o.label, kind, pos: ucPlaceText(ox), rec, meter: true, note: kind === 'water' ? ucOutType(ox).use : '' }); });
  return { permit: F.can.map(p => UC_POL[p].name), uses: F.can.map(p => UC_POL[p].name + ((UC_USE[facId] || {})[p] ? ': ' + UC_USE[facId][p] : '')), rows };
}
// ── 사람들 증언 ──
// 시각(h, 전날 0시부터) → '어젯밤 11시 20분쯤' · '오늘 새벽 3시쯤' · '오늘 아침 7시 10분쯤' (10분 단위 · 60분은 다음 시로 올림)
function ucHm(h, rough) {
  let t = Math.round(h * 6) / 6; if (rough) t = Math.floor(h); const d = Math.floor(t / 24), hh = Math.floor(t % 24 + 1e-6), mm = Math.round((t - Math.floor(t)) * 6) % 6 * 10;
  const part = d <= 0 ? (hh < 12 ? '어제 오전 ' : hh < 18 ? '어제 오후 ' : hh < 21 ? '어제 저녁 ' : '어젯밤 ')   // 예전엔 어제 오전도 '어제 오후', 이틀째 자정 넘어도 '어젯밤'이라 했음
    : d === 1 ? (hh === 0 ? '어젯밤 ' : hh < 6 ? '오늘 새벽 ' : hh < 9 ? '오늘 아침 ' : hh < 12 ? '오늘 오전 ' : hh < 18 ? '오늘 오후 ' : hh < 21 ? '오늘 저녁 ' : '오늘 밤 ')
    : (hh === 0 ? '오늘 밤 ' : hh < 6 ? '내일 새벽 ' : hh < 9 ? '내일 아침 ' : '내일 ');
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;   // 0시 → '어젯밤 12시' · 13시 → 1시
  return part + h12 + '시' + (mm && !rough ? ' ' + mm + '분' : '') + '쯤';
}
// 하구(바다와 만나는 곳)에 오염물이 닿는 시각 — 동천은 태화강으로 들어감
function ucMouthArrive(C) { const pt = ucPoint(C.point); if (!pt || pt.kind !== 'water') return null; const mr = pt.river === 'dongcheon' ? 'taehwa' : pt.river, R = UC_RIVERS[mr], d = ucDownstream(pt.river, pt.s, mr, ucLen(R.pts) - 4);
  return { river: mr, h: C.t0 + (d >= 0 ? d / (R.speed * UC_KM) : 3) }; }
// 물고기 떼죽음 신고 지점: 아침 7시(31h)에 오염물 맨 앞이 닿아 있던 곳 (강 끝을 넘으면 하구)
const UC_REPORT_H = 31;
function ucReportSpot(C) {
  const pt = ucPoint(C.point); if (!pt || pt.kind !== 'water') return null;
  let river = pt.river, s = pt.s + Math.max(0.4, UC_REPORT_H - C.t0) * UC_RIVERS[river].speed * UC_KM; const L = ucLen(UC_RIVERS[river].pts);
  if (s > L && UC_RIVERS[river].joins) { const over = (s - L) / UC_RIVERS[river].speed, j = UC_RIVERS[river].joins[0], R0 = UC_RIVERS[river]; river = j; s = ucProject(UC_RIVERS[j].pts, ...R0.pts[R0.pts.length - 1]).s + over * UC_RIVERS[j].speed; }
  const L2 = ucLen(UC_RIVERS[river].pts); return { river, s: Math.min(L2 - 3, s), mouth: s >= L2 - 3 };
}
// 공기 사건: 냄새가 닿은 측정소 (가장 진했던 순) · 처음 기준을 넘은 시각
function ucAirHits(C) {
  const P = UC_POL[C.pol]; if (P.path !== 'air') return []; const Cc = Object.assign({}, C, { decoys: [] });   // 범인 연기만 (다른 시설의 평소 배출은 빼고 — 예전엔 배출 전 시각을 말하기도 했음)
  return UC_AIR.map(st => { let peak = 0, first = null, logHit = false; for (let h = 18; h <= 32; h += 0.25) { const v = ucAirConc(Cc, C.pol, st.x, st.z, h); peak = Math.max(peak, v); if (first == null && ucAirSpike(C.pol, v)) first = h; }
      for (let h = 18; h <= 32; h++) if (ucAirSpike(C.pol, ucAirConc(Cc, C.pol, st.x, st.z, h + 0.5))) logHit = true;   // 1시간 기록에도 빨간 막대로 보이는 센서만
      return { st, peak, first: logHit ? first : null, area: st.name.split(' ')[0] }; })
    .filter(x => x.first != null).sort((a, b) => b.peak - a.peak);
}
function ucTestimony(C, who, nowH) {
  const P = UC_POL[C.pol], pt = ucPoint(C.point), hm = h => ucHm(h), now = nowH == null ? 99 : nowH;
  if (who === 'fisher') {                                    // 하구 어민: 물 사건이면 하구에 닿은 시각 (아직 안 닿았으면 그렇게) · 공기면 냄새만
    if (P.path === 'water') { const a = ucMouthArrive(C), R = UC_RIVERS[a.river];
      if (a.h > now) return '"하구 쪽은 아직 멀쩡해요. 그런데 ' + R.name + ' 위쪽에서 물고기가 죽었다는 얘기가 들려서 걱정이에요. 여기까지 내려오면 바로 알려 드릴게요."';
      return '"' + hm(a.h) + ' 하구에서 그물을 걷는데 물고기가 배를 뒤집고 떠올랐어요. ' + R.name + ' 쪽에서 내려온 물이었지.' + (P.smell ? ' 물에서 ' + P.smell + '가 났고요.' : ' 냄새는 딱히 없었어요.') + '"'; }
    return '"밤새 바다는 멀쩡했어요. 물고기도 평소대로고요. 대신 바람 타고 이상한 냄새는 좀 났지."';
  }
  if (who === 'resident') {                                  // 국가정원 산책 주민: 공기면 냄새가 가장 심했던 동네에서 처음 난 시각 (실제 연기띠와 맞음)
    if (P.path === 'air') { const hit = ucAirHits(C)[0];
      return hit ? '"' + hit.area + '에 사는 언니가 밤사이 창문을 닫아야 할 정도로 ' + P.smell + '가 났대요. 자다 깨서 몇 시였는지는 잘 모르겠대요. 바람도 꽤 불었고요."' : '"밤사이 창문을 닫아야 할 정도로 ' + P.smell + '가 났어요. 몇 시였는지는 잘 모르겠어요."'; }
    return '"밤엔 별일 없었어요. 아침에 강가에서 물 색이 좀 이상하다는 얘기는 들었어요."';
  }
  if (who === 'doctor') {
    if (P.sym) return '"오늘 아침 ' + P.sym + ' 때문에 온 환자가 평소의 세 배예요. 대부분 ' + (P.path === 'air' ? '밤사이 창문을 열어 두었던 분들' : '새벽에 강가에 나갔던 분들') + '이에요."';
    return '"특별히 늘어난 증상은 없어요. 물고기 사고라면 사람보다 강 생물을 먼저 조사해 보세요."';
  }
  if (who === 'activist') return C.noRumor ? '"저희도 조사 중이에요. 의심만으로 공장을 지목하면 안 돼요. 측정값과 시각, 흐름(물·바람)을 맞춰 보세요."'
    : '"보나 마나 ' + ucJ(UC_FAC[C.rumor].name, '이에요', '예요') + '! 예전에도 사고를 낸 적이 있거든요. 제 말 믿어요."';   // 소문 — 맞을 때도 틀릴 때도 있음 (증거가 아님)
  if (who === 'guard') {                                     // 범인 시설 야간 경비원만 단서
    return null;
  }
  return '';
}
function ucGuardLine(C, facId) {
  const evs = ucNightEvents(C).filter(e => e.fac === facId).sort((a, b) => a.h - b.h); if (!evs.length) return '"밤새 조용했어요. 순찰 기록도 평소랑 같아요."';
  const hsh = (Math.floor(Math.abs(C.seed || 1)) % 997 + facId.charCodeAt(1) * 7) % 6, tail = ['무슨 작업인지는 저도 몰라요.', '평소엔 그 시간에 안 돌리는데…', '제가 본 건 거기까지예요.'][hsh % 3];   // 말투는 시설마다 제각각 (범인인지와 상관없음)
  const one = (e, i) => { const pt = ucPoint(e.point), t = ucHm(e.h, true).replace(/쯤$/, '');
    return (i ? '그리고 ' : '') + t + ' 무렵 ' + (pt.kind === 'water' ? '강 쪽 배관에서 펌프 돌아가는 소리가 한참 났어요. 강으로 나가는 관이 여러 개라 어느 관인지는 모르겠어요.' : pt.label + ' 쪽에서 연기가 평소보다 진하게 났어요.'); };
  return '"' + evs.map(one).join(' ') + ' ' + tail + (hsh >= 3 ? ' 저한테 들었다고는 하지 마세요.' : '') + '"';
}
function ucManagerLine(C, facId) {
  const hasEv = ucNightEvents(C).some(e => e.fac === facId), dec = C.decoys.find(d => d.fac === facId);
  const water = UC_POL[C.pol].path === 'water', base = hasEv ? '"자동측정 기록이 빈 건 계측기 통신 문제예요. ' + (water ? '방류는' : '배출은') + ' 허가받은 대로 했습니다."' : '"저희 시설은 어젯밤 특이사항이 없었습니다. 기록 확인하셔도 됩니다."';   // 범인도 똑같이 말함 (거짓말)
  return dec ? base.replace(/"$/, ' ') + '참고로 ' + ucJ(dec.point.label, '으로') + ' ' + ucJ(UC_POL[dec.pol].name, '이', '가') + ' 조금 나가긴 하지만 허가 범위 안이에요. 매일 그 정도는 나갑니다."' : base;
}

// 조사(은/는 · 이/가 · 을/를 · 과/와 · 으로/로)를 앞말 받침에 맞게 — 끝의 괄호 설명은 빼고 봄 · 숫자·영문은 읽는 소리로 (예: ucJ('붕어', '은', '는') → '붕어는')
function ucJ(w, a, b) {
  const s = String(w).replace(/\s*\([^()]*\)\s*$/, '').trim(), c = s.charCodeAt(s.length - 1); let bat = 0;
  if (c >= 0xAC00 && c <= 0xD7A3) bat = (c - 0xAC00) % 28; else { const ch = s.slice(-1).toUpperCase(); if ('178LR'.indexOf(ch) >= 0) bat = 8; else if ('036MN'.indexOf(ch) >= 0) bat = 1; }
  return w + (a === '으로' ? (bat && bat !== 8 ? '으로' : '로') : bat ? a : b);
}
// ── 신고 지점을 '간접적으로' 알려 주는 단서 (v2026-10-20c) ──
//   예전엔 사건 개요에 '여천천 3.7km 부근'이 바로 적혀 그 강을 따라가기만 하면 됐음 → 이제 동네 이름 · 주변 모습 · 증언을 모아 추리
//   ucDongAt: 행정동 경계(ulsan-geo.js)로 그 자리의 동 이름
function ucDongAt(x, z) {
  if (typeof UG === 'undefined' || !UG.dongs) return null;
  const inRing = (r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  for (const d of UG.dongs) if (d.rings && d.rings.some(inRing)) return d;
  let best = null, bd = 1e9; UG.dongs.forEach(d => { const k = Math.hypot(d.c[0] - x, d.c[1] - z); if (k < bd) { bd = k; best = d; } }); return best;
}
function ucReportClue(C) {
  if (C._rc) return C._rc; const r = ucReportSpot(C); if (!r) return null; const R = UC_RIVERS[r.river], L = ucLen(R.pts), p = ucAt(R.pts, r.s), q = ucAt(R.pts, Math.min(L, r.s + 1)), dx = q[0] - p[0], dz = q[1] - p[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d, off = R.w / 2 + 3;
  const A = ucDongAt(p[0] + nx * off, p[1] + nz * off), B = ucDongAt(p[0] - nx * off, p[1] - nz * off), names = [A, B].filter(Boolean).map(x => x.n).filter((n, i, a) => a.indexOf(n) === i);
  const flow = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? '동쪽' : '서쪽') : (dz > 0 ? '남쪽' : '북쪽'), toMouth = (L - r.s) / UC_KM;
  let mark = null, md = 1e9;   // 주변에 보이는 것 (가장 가까운 것 하나)
  Object.keys(UC_PLACES).forEach(k => { const m = Math.hypot(UC_PLACES[k].at[0] - p[0], UC_PLACES[k].at[1] - p[1]); if (m < md && m < 22) { md = m; mark = ucJ(UC_PLACES[k].name, '이', '가') + ' 가까이 보이는 곳'; } });
  UC_BIO.forEach(b => { if (b.river !== r.river) return; const m = Math.abs(b.s - r.s); if (m < 10 && m < md) { md = m; mark = '강가에 파란 물벼룩 측정 상자가 있는 곳'; } });
  Object.keys(UC_FAC).forEach(k => { const F = UC_FAC[k], m = Math.hypot(F.at[0] - p[0], F.at[1] - p[1]); if (m < 30 && m < md) { md = m; mark = '멀리 공장 굴뚝과 탱크가 보이는 곳'; } });
  const v = { river: r.river, s: r.s, mouth: r.mouth, dongs: names, gu: (A || B || {}).gu || '울산', flow, toMouth, mark: r.mouth ? '강이 바다와 만나는 하구' : (mark || '양쪽에 산책로가 난 곳') };
  Object.defineProperty(C, '_rc', { value: v, enumerable: false, configurable: true }); return v;
}
// ── 수사 중 들어오는 소식 (📰 · 게임 속 시각에 맞춰 수첩으로) ──
//   원인과 결과를 이어 추리하도록: 신고 지점 제보 · 계측기 공사 공지(빈 기록의 진짜 이유) · 설비 고장 소식(몰래 버릴 까닭) · 날씨 · 지난 사건 후속
//   함정(보통·어려움): 소문난 시설의 '공사' 소식 · 어려움은 공사 공지를 일부만
function ucNews(C) {
  if (C._news) return C._news; const d = C.diff, P = UC_POL[C.pol], water = P.path === 'water', out = [], rnd = ucRngH(Math.floor(Math.abs(Number(C.seed) || 1)) % 99991 * 17 + 777), hm = h => ucHm(h, true).replace(/쯤$/, '');
  const esc = t => String(t).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  if (water) { const rc = ucReportClue(C), dg = rc.dongs.join('·') || rc.gu, R = UC_RIVERS[rc.river];
    const smell = P.smell ? '물에서 ' + P.smell + '가 나요' : '냄새는 안 나는데 물이 좀 뿌옇고요';
    const where = d === 'easy' ? R.name + ' ' + dg + ' 쪽' : d === 'normal' ? dg + ' 쪽 강 산책로' : rc.gu + ' 강 산책로';
    out.push({ h: 32, title: '📱 SNS 제보 · 아침 7시 12분', key: true, html: '<p class="sns">"' + where + ', 아침 운동 나왔다가 깜짝 놀람. 물고기 수십 마리가 하얗게 배를 뒤집고 떠 있어요 😢 ' + smell + '. ' + ucJ(rc.mark, '이에요', '예요') + '." <small>#울산 #' + (rc.dongs[0] || rc.gu) + '</small></p>' +
      '<p class="dim">🔎 제보는 <b>어느 동네</b>인지만 알려 줘요. 🗺 지도에서 그 동네를 지나는 강을 찾고, 🏞 <b>시청 재난상황실</b>(아침 CCTV 순찰) · 🎣 하구 어민 · 🦐 바이오센서 기록으로 <b>어느 강</b>인지 맞춰 보세요.</p>' });
    out.push({ h: 33, title: '📰 날씨 · 하천 정보', key: false, html: '<p>어젯밤 울산은 <b>비가 오지 않았어요</b>(맑음). 강물 높이는 평소와 같아요.</p><p class="dim">🔎 비가 안 왔다면 <b>빗물 배수구</b>로 물이 나올 까닭이 없어요. 강물 빠르기도 평소대로라 🏞 하천 담당 주무관이 알려 준 빠르기로 <b>거리 ÷ 빠르기</b> 계산을 할 수 있어요.</p>' }); }
  else { const hs = ucAirHits(C), area = hs.length ? hs[0].area : '울산';
    out.push({ h: 32, title: '📱 SNS 제보 · 밤 사이', key: true, html: '<p class="sns">"' + (d === 'hard' ? '우리 동네' : area) + ' 사는데 밤새 ' + P.smell + ' 때문에 잠을 못 잤어요. 창문 닫아도 들어와요 😷 ' + (P.sym ? P.sym + '까지…' : '') + '"</p><p class="dim">🔎 냄새는 바람을 타고 와요. 냄새가 난 동네의 💨 <b>대기센서 기록</b>으로 치솟은 시각을 찾고, 🌤 기상대의 그 시각 바람으로 거슬러 올라가 보세요.</p>' });
    out.push({ h: 33, title: '📰 날씨 정보', key: false, html: '<p>어젯밤은 맑고 바람이 시간마다 방향을 조금씩 바꿨어요. 🌤 <b>기상대</b>에서 시간별 바람 기록을 볼 수 있어요.</p><p class="dim">🔎 바람 방향이 바뀌었으니 <b>냄새가 치솟은 시각의 바람</b>을 써야 해요 — 다른 시각 바람으로 거슬러 가면 엉뚱한 공장이 나와요.</p>' }); }
  // 계측기 공사 공지: 계측기 고장(빈 기록)의 진짜 이유 — 쉬움·보통은 전부 · 어려움은 절반
  const gl = ucNightEvents(C).filter(e => e.kind === 'glitch'), show = d === 'hard' ? gl.filter((e, i) => i % 2 === 0) : gl;
  show.forEach(e => { const pt = ucPoint(e.point); out.push({ h: 33.5 + rnd() * 1.5, title: '📰 구청 공지 · ' + ucFacShort(e.fac) + ' 계측기 공사', key: false,
    html: '<p>' + esc(UC_FAC[e.fac].name) + ' ' + esc(pt.label) + '의 <b>자동측정기 통신 장비 교체</b> 공사를 ' + hm(e.h) + '부터 약 ' + Math.max(1, Math.round(e.dur)) + '시간 했다고 미리 신고했어요. 그동안 기록이 비어요.</p><p class="dim">🔎 미리 신고한 공사 때문에 생긴 빈 기록이라면 몰래 버린 흔적이 아닐 수 있어요. 오염이 시작된 곳 · 시각과 맞는지 함께 보세요.</p>' }); });
  // 몰래 버릴 까닭 (원인): 범인 시설의 설비 고장 소식 — 보통·어려움은 소문난 다른 시설의 비슷한 소식도 (그럴듯하지만 증거는 아님)
  const why = water ? ['폐수 처리 설비(미생물 처리조)', '폐수 저장 탱크 밸브', '폐수 처리 약품 투입기'] : ['대기오염 방지 설비(흡착탑)', '굴뚝 먼지·가스 거름 장치', '배기가스 태우는 장치(소각기)'], w1 = why[Math.floor(rnd() * why.length)];
  out.push({ h: 35, title: '📰 지역 뉴스 · ' + ucFacShort(C.fac), key: false, html: '<p>' + esc(UC_FAC[C.fac].name) + '의 <b>' + w1 + '</b>가 어제 오후 고장 나 부품을 기다리는 중이라는 소식이에요. 회사는 "생산은 평소대로"라고 했어요.</p><p class="dim">🔎 설비가 고장 났는데 생산을 계속했다면, 처리하지 못한 ' + (water ? '폐수' : '가스') + '는 어디로 갔을까요? 하지만 소식만으로는 증거가 아니에요 — 측정값으로 확인하세요.</p>' });
  if (!C.noRumor && C.rumor && C.rumor !== C.fac) out.push({ h: 36, title: '📰 지역 뉴스 · ' + ucFacShort(C.rumor), key: false, html: '<p>' + esc(UC_FAC[C.rumor].name) + '가 어제 <b>공장 증설 공사</b>를 시작했어요. 주민들 사이에서 "공사 때문에 뭔가 흘러나온 것 아니냐"는 말이 돌아요.</p><p class="dim">🔎 공사와 오염이 정말 관계가 있는지는 몰라요. 소문이 아니라 <b>어디서부터 · 언제부터</b> 오염됐는지로 판단하세요.</p>' });
  if (C.watched) out.push({ h: 32, title: '📰 지난 사건 후속 · ' + ucFacShort(C.watched), key: false, html: '<p>지난 사건의 ' + esc(UC_FAC[C.watched].name) + '는 구청이 <b>24시간 감시 카메라와 자동 경보</b>를 달아 어젯밤 내내 지켜봤어요. 이상한 배출은 없었대요.</p><p class="dim">🔎 감시 중인 시설은 이번 사건의 범인 후보에서 뺄 수 있어요.</p>' });
  out.sort((a, b) => a.h - b.h); Object.defineProperty(C, '_news', { value: out, enumerable: false, configurable: true }); return out;
}
// ── 보고서 채점 ──
function ucSlot(h) { return h < 21 ? 0 : h < 24 ? 1 : h < 27 ? 2 : h < 30 ? 3 : 4; }
const UC_SLOTS = ['어젯밤 18~21시', '어젯밤 21~24시', '새벽 0~3시', '새벽 3~6시', '아침 6~8시'];
function ucScore(C, rep) {
  const r = { pol: rep.pol === C.pol, fac: rep.fac === C.fac, point: rep.point === C.point, time: rep.slot === ucSlot(C.t0) };
  const ev = (rep.evidence || []).slice(0, 3), keys = new Set(ev.filter(e => e && e.key).map(e => String(e.title).replace(/\s*\(\d+\)$/, ''))).size;   // 같은 증거를 여러 번 적어도 하나로 — 다시 한 실험의 ' (2)' 도 같은 것으로 (예전: 바람길 3번 = +20)
  const score = (r.pol ? 20 : 0) + (r.fac ? 25 : 0) + (r.point ? 20 : 0) + (r.time ? 15 : 0) + Math.round(keys / 3 * 20);
  const grade = score >= 95 ? 'S' : score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  return Object.assign(r, { keys, score, grade });
}
if (typeof module !== 'undefined') module.exports = { ucRngH, UC_MODES, ucSettings, UC_KM, UC_RIVERS, UC_POL, UC_PANELS, UC_FAC, UC_PLACES, UC_START, UC_BIO, UC_AIR, UC_SLOTS, ucLen, ucAt, ucProject, ucDownstream, ucRng, ucMakeCase, ucPoint, ucWaterConc, ucAirConc, ucFieldKit, ucBioLog, ucEdna, ucAirLog, ucFacilityRecord, ucTestimony, ucGuardLine, ucHm, ucMouthArrive, ucReportSpot, ucAirHits, UC_REPORT_H, ucManagerLine, ucSlot, ucScore, ucYard, ucGate, ucFence, UC_NPC_AT, ucNpcAt, ucBioAt, UC_USE, ucNightEvents, ucEventAt, ucPlaceText, ucJ, UC_GLITCH_N, UC_ZONES, ucAirSpike, ucFacShort, UC_WATER_POLS, UC_AIR_POLS, ucCandOuts, ucWindCands, ucWindIdeal, UC_OUT_TYPE, ucOutType, ucMetered, ucDongAt, ucReportClue, ucNews };
