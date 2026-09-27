// 울산 지형 (모든 화질 공통) — 주요 산의 실제 위치·높이 + 능선 잡음 + 하류로 낮아지는 강 계곡
//   · 가로: 실제 축척 (1칸 = 90 m) · 세로: 2.6배 과장 (멀리서도 산이 산처럼 보이게)
//   · 산 위치·높이는 알려진 봉우리 자료로 만든 근사값 (정밀 수치지도는 아님)
//   · 결과: 격자(2칸마다) 높이 + 강마다 수면 높이(상류 → 하구로 점점 낮아짐, 하구 = 바다 높이)
(function () {
  const VEX = 2.6, M = m => m / 90 * VEX;
  // [이름, 위도, 경도, 높이(m), 산 덩치 반지름(km)]
  const PEAKS = [
    ['가지산', 35.607, 129.001, 1241, 6], ['운문산', 35.618, 128.954, 1188, 5], ['재약산', 35.553, 128.982, 1189, 5], ['능동산', 35.585, 129.018, 983, 3.5],
    ['간월산', 35.556, 129.041, 1069, 3.6], ['신불산', 35.539, 129.050, 1159, 4.2], ['영축산', 35.518, 129.058, 1081, 3.8], ['고헌산', 35.622, 129.078, 1034, 4.6],
    ['문복산', 35.651, 129.042, 1015, 4], ['백운산', 35.668, 129.137, 893, 4.8], ['치술령', 35.664, 129.274, 765, 4.5], ['국수봉', 35.690, 129.224, 603, 3.8],
    ['삼태봉', 35.668, 129.384, 630, 4], ['동대산', 35.638, 129.408, 447, 3.4], ['무룡산', 35.592, 129.405, 452, 3.2], ['문수산', 35.531, 129.223, 600, 3.6],
    ['남암산', 35.512, 129.203, 544, 2.6], ['대운산', 35.405, 129.212, 742, 4.6], ['정족산', 35.446, 129.137, 700, 4.2], ['천성산', 35.402, 129.103, 922, 4.8],
    ['연화산', 35.482, 129.178, 532, 3], ['함월산', 35.578, 129.338, 200, 2], ['입화산', 35.566, 129.262, 230, 2.2], ['울산대공원', 35.532, 129.296, 150, 2.4],
    ['봉대산', 35.508, 129.432, 200, 2], ['염포산', 35.534, 129.404, 203, 1.8], ['신선산', 35.515, 129.318, 80, 1.2], ['서생 언덕', 35.365, 129.300, 260, 5],
    ['두동 산지', 35.640, 129.195, 420, 7], ['삼동 산지', 35.495, 129.095, 330, 6], ['웅촌 산지', 35.455, 129.215, 300, 5], ['농소 언덕', 35.640, 129.345, 220, 4],
    ['상북 산지', 35.585, 129.090, 500, 5], ['경주 쪽 산지', 35.715, 129.300, 500, 8], ['양산 쪽 산지', 35.360, 129.080, 600, 8]];
  const imul = Math.imul;
  const hash = (i, j) => { let h = (imul(i, 374761393) + imul(j, 668265263)) | 0; h = imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vnoise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz), a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const RC = Math.cos(0.83), RS = Math.sin(0.83);   // 옥타브마다 좌표를 돌려 격자 무늬(가로·세로 줄) 없앰
  const fbm = (x, z, oct) => { let s = 0, a = 0.5, n = 0; for (let o = 0; o < oct; o++) { s += a * vnoise(x + o * 17.3, z - o * 9.1); n += a; a *= 0.5; const nx = (x * RC - z * RS) * 2.03, nz = (x * RS + z * RC) * 2.03; x = nx; z = nz; } return s / n; };
  const ridged = (x, z, oct) => { let s = 0, a = 0.5, n = 0, w = 1; for (let o = 0; o < oct; o++) { let v = 1 - Math.abs(vnoise(x + o * 31.7, z + o * 11.3) * 2 - 1); v *= v; v *= w; w = Math.min(1, v * 1.6); s += a * v; n += a; a *= 0.52; const nx = (x * RC - z * RS) * 2.07, nz = (x * RS + z * RC) * 2.07; x = nx; z = nz; } return s / n; };
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function build() {
    const G = UG.grid, W = G.w, H = G.h, N = W * H, cellOf = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? '1' : ugCell(G.x0 + (i + 0.5) * G.cell, G.z0 + (j + 0.5) * G.cell);
    const cls = new Uint8Array(N); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const c = cellOf(i, j); cls[j * W + i] = c === '0' ? 0 : c === 'u' ? 2 : c === 'i' ? 3 : 1; }   // 0 바다 · 1 농촌·산 · 2 도심 · 3 공단
    // 바다까지 거리 (칸) — 해안 경사 · 바다 깊이
    const dc = new Float32Array(N).fill(1e9), q = []; for (let k = 0; k < N; k++) if (cls[k] === 0) { dc[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) { const k = q[h], i = k % W, j = (k / W) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const kk = jj * W + ii; if (dc[kk] > dc[k] + 1) { dc[kk] = dc[k] + 1; q.push(kk); } } }
    const dl = new Float32Array(N).fill(1e9); q.length = 0; for (let k = 0; k < N; k++) if (cls[k] !== 0) { dl[k] = 0; q.push(k); }   // 땅까지 거리 (바다 깊이)
    for (let h = 0; h < q.length; h++) { const k = q[h], i = k % W, j = (k / W) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const kk = jj * W + ii; if (dl[kk] > dl[k] + 1) { dl[kk] = dl[k] + 1; q.push(kk); } } }
    // 땅 종류 비율을 흐리게 (경계에서 절벽 없이)
    const wU = new Float32Array(N), wI = new Float32Array(N), R = 4;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let u = 0, s = 0, n = 0; for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const ii = Math.max(0, Math.min(W - 1, i + a)), jj = Math.max(0, Math.min(H - 1, j + b)), c = cls[jj * W + ii]; if (c === 2) u++; else if (c === 3) s++; n++; } wU[j * W + i] = u / n; wI[j * W + i] = s / n; }
    const pk = PEAKS.map(p => { const [x, z] = ugLL(p[2], p[1]); return { x, z, h: M(p[3]), s: p[4] * 1000 / 90 * 0.62 }; });
    const out = new Float32Array(N);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell;
      if (cls[k] === 0) { out[k] = -0.8 - Math.min(4.5, dl[k] * 0.55) - fbm(x * 0.05, z * 0.05, 2) * 0.5; continue; }
      let env = 0; for (const p of pk) { const dx = x - p.x, dz = z - p.z, e = p.h * Math.exp(-(dx * dx + dz * dz) / (2 * p.s * p.s)); if (e > env) env = e + (env > e * 0.5 ? env * 0.08 : 0); else env += e * 0.08; }   // 봉우리 겹치면 조금 더 높게
      const rd = ridged(x * 0.045, z * 0.045, 5), f1 = fbm(x * 0.018, z * 0.018, 4), f2 = fbm(x * 0.07, z * 0.07, 3);
      const hills = M(35 + 170 * Math.pow(f1, 1.6)) * (0.75 + 0.5 * rd);   // 농촌의 낮은 산·구릉
      const mount = env * (0.55 + 0.6 * rd) + env * 0.12 * (f2 - 0.5);      // 큰 산: 능선·골짜기
      let hr = Math.max(hills, mount) + Math.min(hills, mount) * 0.25;
      const hu = M(6 + 22 * f1) + Math.max(0, mount - M(40)) * 0.9, hi = M(4 + 9 * f1) + Math.max(0, mount - M(120)) * 0.35;   // 도심: 평지 + 도시 안 산은 남김 · 공단: 평평하게
      const u = wU[k], s = wI[k], r = Math.max(0, 1 - u - s); let h = hr * r + hu * u + hi * s;
      h *= sstep(0, 5, dc[k]); h = Math.max(h, 0.28 + 0.08 * f2 + Math.min(1, dc[k] * 0.15));   // 해안은 바다 쪽으로 낮게
      out[k] = h;
    }
    // 강: 수면 높이(상류 → 하류로 계속 낮아짐) · 계곡 깎기
    const at = (x, z) => { const fx = (x - G.x0) / G.cell - 0.5, fz = (z - G.z0) / G.cell - 0.5, i = Math.max(0, Math.min(W - 2, Math.floor(fx))), j = Math.max(0, Math.min(H - 2, Math.floor(fz))), a = Math.min(1, Math.max(0, fx - i)), b = Math.min(1, Math.max(0, fz - j));
      return (out[j * W + i] * (1 - a) + out[j * W + i + 1] * a) * (1 - b) + (out[(j + 1) * W + i] * (1 - a) + out[(j + 1) * W + i + 1] * a) * b; };
    const rivers = {}, order = Object.keys(UC_RIVERS).sort((a, b) => (UC_RIVERS[a].joins ? 1 : 0) - (UC_RIVERS[b].joins ? 1 : 0));   // 본류 먼저 (지류 끝 = 본류 수면)
    order.forEach(rid => { const Rv = UC_RIVERS[rid], L = ucLen(Rv.pts), n = Math.ceil(L) + 1, wl = new Float32Array(n);
      for (let t = 0; t < n; t++) { const p = ucAt(Rv.pts, Math.min(L, t)); let m = 1e9; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) m = Math.min(m, at(p[0] + a * 1.5, p[1] + b * 1.5)); wl[t] = m; }   // 주변에서 가장 낮은 땅
      let endL = 0; if (Rv.joins) { const J = rivers[Rv.joins[0]], js = ucProject(UC_RIVERS[Rv.joins[0]].pts, ...Rv.pts[Rv.pts.length - 1]).s; endL = J ? J.wl[Math.min(J.wl.length - 1, Math.round(js))] : 0; }
      for (let t = 1; t < n; t++) wl[t] = Math.min(wl[t], wl[t - 1]);                      // 하류로 갈수록 낮게 (거꾸로 흐르지 않음)
      const top = wl[0]; for (let t = 0; t < n; t++) { const f = t / (n - 1); wl[t] = Math.max(endL, (wl[t] - endL) * (1 - Math.pow(f, 3)) + endL) - 0.25; }   // 하구 = 바다(지류는 본류) 높이
      for (let pass = 0; pass < 3; pass++) { const c = wl.slice(); for (let t = 1; t < n - 1; t++) { let s2 = 0, m = 0; for (let d = -6; d <= 6; d++) { const tt = t + d; if (tt < 0 || tt >= n) continue; s2 += c[tt]; m++; } wl[t] = s2 / m; } for (let t = 1; t < n; t++) wl[t] = Math.min(wl[t], wl[t - 1]); }   // 매끄럽게 · 폭포 없이
      wl[n - 1] = endL - 0.25 * (Rv.joins ? 1 : 0); rivers[rid] = { wl, top, L };
    });
    // 계곡: 강에서 멀어질수록 천천히 오르는 강둑 (가까운 땅만)
    const ids = Object.keys(UC_RIVERS), bb = {}; ids.forEach(rid => { const P = UC_RIVERS[rid].pts; bb[rid] = [Math.min(...P.map(p => p[0])) - 40, Math.max(...P.map(p => p[0])) + 40, Math.min(...P.map(p => p[1])) - 40, Math.max(...P.map(p => p[1])) + 40]; });
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (cls[k] === 0) continue; const x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell;
      for (const rid of ids) { const B = bb[rid]; if (x < B[0] || x > B[1] || z < B[2] || z > B[3]) continue; const Rv = UC_RIVERS[rid], pr = ucProject(Rv.pts, x, z); if (pr.d > 40) continue; const w = rivers[rid].wl[Math.max(0, Math.min(rivers[rid].wl.length - 1, Math.round(pr.s)))], dd = Math.max(0, pr.d - Rv.w / 2);
        const bank = w - 0.3 + dd * 0.16 + Math.pow(Math.max(0, dd - 5), 1.35) * 0.06; if (bank < out[k]) out[k] = bank; } }
    return { h: out, cls, rivers, VEX, M };
  }
  let cache = null;
  window.ulsanTerrain = function () { return cache || (cache = build()); };
  window.ulsanTerrainNoise = { vnoise, fbm, ridged, hash };
  // 강 수면 높이 (강 id · 상류 끝에서 거리 s)
  window.ulsanWaterLevel = function (rid, s) { const T = window.ulsanTerrain(), r = T.rivers[rid]; if (!r) return -0.25; const f = Math.max(0, Math.min(r.wl.length - 1, s)), a = Math.floor(f), b = Math.min(r.wl.length - 1, a + 1); return r.wl[a] + (r.wl[b] - r.wl[a]) * (f - a); };
})();
