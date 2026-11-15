// 젬 아레나 3D — 규칙·캐릭터·맵·네트워크·HUD 는 ArenaGame(arena-engine.js) 그대로, 월드 그림만 Three.js 로 그립니다
//   · 브롤스타즈처럼 비스듬히 내려다보는 카메라, 내 팀 진영이 항상 화면 아래 (레드 팀은 카메라가 반대편에서 봄)
//   · 화질 3단계 (기기 판별로 시작 · ?q=high|mid|low 고정 · 느리면 그림자 → 후처리 → 해상도 순으로 한 단계씩 내림, 다시 올리지 않음)
//       high: 부드러운 그림자 2048 · HDR 환경광(assets/hdr, high 만 내려받음) · 블룸·비네트 후처리 · 캐릭터 윤곽선 · 빛 4개
//       mid : 그림자 1024 · 그려 만든 환경맵 · PBR 재질 · 절차 텍스처(바닥 디테일·벽 삼면 투영·구름 그림자) · 빛 2개
//       low : 그림자 없음(둥근 그림자) · 램버트 재질 · 입자 적게 — 예전(10라운드 전) 모습보다 가벼움
//   · 지형: 바닥 한 장(칸마다 그린 그림 + 가까이서 보이는 디테일 무늬), 물/얼음 연못은 움푹 패인 바닥 + 물결 수면, 맵 밖은 언덕·나무·바위
//   · 벽: 칸 모양에 따라 절벽·돌벽·상자·통나무 울타리·얼음 결정 (판정 칸과 같은 자리·크기), 수풀: 바람에 흔들리는 풀 (내가 들어가면 둘레가 비침)
//   · 캐릭터 6종: 캐릭터마다 다른 3D 모델(뼈대 1개 = 그리기 1번) · 걷기/공격/궁극기/맞음/쓰러짐/부활 동작 · 발밑 팀색 고리 + 팀색 테두리 빛
//   · 이름·체력·탄약·피해 숫자는 3D 위치를 화면 좌표로 바꿔 HUD 캔버스에 그립니다 (판정·통신·조작·HUD 배치는 부모 그대로)
(function () {
  'use strict';
  if (typeof ArenaGame === 'undefined') return;

  // ───────────────────────── 작은 도우미 ─────────────────────────
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const hash3 = (x, y, z) => { const n = Math.sin(Math.round(x * 1000) * 0.1271 + Math.round(y * 1000) * 0.3117 + Math.round(z * 1000) * 0.0747) * 43758.5453; return n - Math.floor(n); };
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const hexRgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
  const cssHex = s => parseInt(String(s).replace('#', ''), 16);

  // 이어 붙일 수 있는(타일) 값 노이즈 0~1
  function tileNoise(size, cells, oct, seed) {
    const out = new Float32Array(size * size); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const c = cells << o, R = rng(seed * 31 + o * 977), g = new Float32Array(c * c); for (let i = 0; i < g.length; i++) g[i] = R();
      for (let y = 0; y < size; y++) { const fy = y / size * c, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = (iy % c) * c, y1 = ((iy + 1) % c) * c;
        for (let x = 0; x < size; x++) { const fx = x / size * c, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % c, x1 = (ix + 1) % c;
          const a = g[y0 + x0] + (g[y0 + x1] - g[y0 + x0]) * sx, b = g[y1 + x0] + (g[y1 + x1] - g[y1 + x0]) * sx; out[y * size + x] += (a + (b - a) * sy) * amp; } }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  // 높이(0~1) → RGBA 캔버스: R = 밝기 무늬, G·B = 법선 기울기(0.5 중심)
  function heightTex(size, hgt, lumFn, k) {
    const c = mkCanvas(size, size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = y * size + x, h = (xx, yy) => hgt[((yy + size) % size) * size + ((xx + size) % size)];
      const nx = (h(x - 1, y) - h(x + 1, y)) * k, ny = (h(x, y - 1) - h(x, y + 1)) * k;
      d[i * 4] = clamp(lumFn(hgt[i], x, y) * 255, 0, 255); d[i * 4 + 1] = clamp(128 + nx * 127, 0, 255); d[i * 4 + 2] = clamp(128 + ny * 127, 0, 255); d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); return c;
  }

  // ───────────────────────── 화질 단계 ─────────────────────────
  const TIERS = {
    high: { name: 'high', shadow: 2048, soft: true, post: true, hdr: true, env: true, std: true, tri: true, grass: 4, seg: 12, parts: 560, fxLights: 3, mineLight: true, outline: true, pr: 1.5, floorPx: 24, cloud: true, amb: 70, decor: 1 },
    mid:  { name: 'mid', shadow: 1024, soft: false, post: false, hdr: false, env: true, std: true, tri: true, grass: 3, seg: 10, parts: 320, fxLights: 1, mineLight: false, outline: false, pr: 1.25, floorPx: 16, cloud: true, amb: 36, decor: 0.8 },
    low:  { name: 'low', shadow: 0, soft: false, post: false, hdr: false, env: false, std: false, tri: false, grass: 2, seg: 7, parts: 120, fxLights: 0, mineLight: false, outline: false, pr: 1.0, floorPx: 12, cloud: false, amb: 0, decor: 0.5 }
  };

  // ───────────────────────── 맵 분위기 3종 ─────────────────────────
  const THEME3 = {
    mine: { exposure: 1.0, fog: 0xE6C9A0, fogN: 30, fogF: 82, sky: [0x7FB4E6, 0xF6DDB4, 0xB08A60], sun: [0xFFE2B8, 1.45], sunDir: [-0.5, 1, 0.62], hemi: [0xDCE9FF, 0x9C7A55, 0.5],
      floor: { base: '#DDAE72', alt: '#CF9D61', dark: '#B07A45', path: '#C6915A', speck: '#8A5A2E', light: '#F0CC93', pave: '#C9A27A', zone: true }, rough: 0.94, hdr: 'quarry_01_1k',
      water: 0x2E9BD6, waterDeep: '#2B6E8E', waterOp: 0.8, wave: 0.2, iceWater: false,
      cliff: 0xC07C4E, top: 0xE0B07A, topK: 0.85, stone: 0xD2A06A, wood: 0x9A6438, crateMetal: false, ice: 0x9FD8F5,
      bush: ['#5E8E26', '#9DBD45', '#2F5414', '#C8D86A'], mound: 0x4A7424, decor: 'desert', amb: 'dust', cloudK: 0.16, mineGlow: 0xB15DFF },
    jungle: { exposure: 1.02, fog: 0xA9C9A2, fogN: 26, fogF: 72, sky: [0x8CC4E8, 0xD9EFD0, 0x5B7A3A], sun: [0xFFF1CC, 1.4], sunDir: [-0.4, 1, 0.5], hemi: [0xD8F0FF, 0x4F6B32, 0.52],
      floor: { base: '#7DB548', alt: '#6CA33C', dark: '#4F7F2A', path: '#A88B5C', speck: '#3E6A22', light: '#9BCB5A', pave: '#8E8A78', zone: false }, rough: 0.9, hdr: 'spruit_sunrise_1k',
      water: 0x2A8FC4, waterDeep: '#1E5470', waterOp: 0.84, wave: 0.26, iceWater: false,
      cliff: 0x6E7566, top: 0x4F8A36, topK: 1.0, stone: 0x8C8F7C, wood: 0x7A5230, crateMetal: false, ice: 0x9FD8F5,
      bush: ['#2E8A34', '#5DBB45', '#17561E', '#86D45A'], mound: 0x1E5E26, decor: 'jungle', amb: 'firefly', cloudK: 0.22, mineGlow: 0xB15DFF },
    ice: { exposure: 0.9, fog: 0xCFE3F2, fogN: 28, fogF: 78, sky: [0x8FBDE8, 0xE6F1FA, 0xB8CCDA], sun: [0xFFF6EA, 1.25], sunDir: [-0.55, 1, 0.45], hemi: [0xE4F1FF, 0x8FA6BA, 0.5],
      floor: { base: '#D8E8F2', alt: '#C6DBE9', dark: '#A3BED2', path: '#BCD2E3', speck: '#8FAAC0', light: '#F2F8FC', pave: '#AFC6D8', zone: true }, rough: 0.6, hdr: 'blouberg_sunrise_2_1k',
      water: 0x9BD8F2, waterDeep: '#6FA9C8', waterOp: 0.92, wave: 0.05, iceWater: true,
      cliff: 0x9DBCD2, top: 0xF4F9FC, topK: 1.0, stone: 0x9AA6B4, wood: 0x6B5A4A, crateMetal: true, ice: 0xA8DDF6,
      bush: ['#2F6E57', '#4E9A7C', '#1C4A3A', '#EAF6FA'], mound: 0x24533F, decor: 'snow', amb: 'snow', cloudK: 0.12, mineGlow: 0xB15DFF }
  };
  // 벽 칸 모양 → 그릴 종류 (맵마다)
  const WALL_KIND = { mine: { border: 'cliff', block: 'stone', small: 'crate', thin: 'palisade' }, jungle: { border: 'cliff', block: 'stone', small: 'crate', thin: 'palisade' }, ice: { border: 'cliff', block: 'stone', small: 'crystal', thin: 'icewall' } };
  // 캐릭터별 탄 색
  const SHOT_COL = { bolt: 0xFFE066, rock: 0xFF9F43, hawk: 0x7CF3FF, sprout: 0x9BFF7A, owl: 0xFFB347, spark: 0xFF6B3D };

  // ───────────────────────── 셰이더 덧붙이기 (재질 한 개로 여러 효과) ─────────────────────────
  //  o: { tri, top, ao, cloud, detail, water, wind, dither, mat(정점별 거칠기·금속·빛남), rim, flash, outline }
  function patchMat(mat, key, U, o) {
    mat.onBeforeCompile = sh => {
      ['uTime', 'uPlayer', 'uCloud', 'uCloudK', 'uDetail', 'uDetS', 'uDetN'].forEach(k => { if (U[k]) sh.uniforms[k] = U[k]; });
      if (o.u) Object.assign(sh.uniforms, o.u);
      let vs = sh.vertexShader, fs = sh.fragmentShader;
      vs = vs.replace('#include <common>', '#include <common>\nvarying vec3 vA3W;\nvarying vec3 vA3N;\nuniform float uTime;\nuniform vec3 uPlayer;\n' + (o.mat ? 'attribute vec3 aMat;\nvarying vec3 vMat;\n' : '') + (o.outline ? 'uniform float uOutline;\n' : ''));
      if (o.mat) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;');
      if (o.outline) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * uOutline;');
      if (vs.indexOf('#include <defaultnormal_vertex>') >= 0) vs = vs.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n{ vec3 a3n = objectNormal;\n#ifdef USE_INSTANCING\n a3n = mat3(instanceMatrix) * a3n;\n#endif\n vA3N = normalize(mat3(modelMatrix) * a3n); }');
      if (o.wind) vs = vs.replace('#include <project_vertex>', [
        'vec4 a3w = vec4(transformed, 1.0);', '#ifdef USE_INSTANCING', 'a3w = instanceMatrix * a3w;', '#endif', 'a3w = modelMatrix * a3w;',
        'float a3h = clamp(position.y / 1.3, 0.0, 1.0); a3h *= a3h;',
        'vec2 a3v = vec2(sin(uTime * 1.7 + a3w.x * 0.9 + a3w.z * 0.5), cos(uTime * 1.3 + a3w.z * 0.8 + a3w.x * 0.3)) * 0.085;',
        'vec2 a3d = a3w.xz - uPlayer.xy; float a3l = length(a3d) + 1e-4; float a3p = (1.0 - smoothstep(0.15, 1.15, a3l)) * 0.5;',
        'a3w.xz += (a3v + a3d / a3l * a3p) * a3h; a3w.y -= a3p * a3h * 0.45;',
        'vA3W = a3w.xyz;', 'vec4 mvPosition = viewMatrix * a3w;', 'gl_Position = projectionMatrix * mvPosition;'].join('\n'));
      else vs = vs.replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 a3w = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n a3w = instanceMatrix * a3w;\n#endif\n vA3W = (modelMatrix * a3w).xyz; }');
      let pars = 'varying vec3 vA3W;\nvarying vec3 vA3N;\nuniform float uTime;\nuniform vec3 uPlayer;\n';
      if (o.mat) pars += 'varying vec3 vMat;\n';
      if (o.tri) pars += 'uniform sampler2D uTri;\nuniform float uTriS;\n';
      if (o.top) pars += 'uniform vec3 uTopC;\nuniform float uTopK;\n';
      if (o.cloud) pars += 'uniform sampler2D uCloud;\nuniform float uCloudK;\n';
      if (o.detail) pars += 'uniform sampler2D uDetail;\nuniform float uDetS;\nuniform float uDetN;\n';
      if (o.water) pars += 'uniform float uWave;\n';
      if (o.rim) pars += 'uniform vec3 uRim;\n';
      if (o.flash) pars += 'uniform float uFlash;\n';
      fs = fs.replace('#include <common>', '#include <common>\n' + pars);
      let col = '';
      if (o.tri) col += 'vec3 a3bw = pow(abs(vA3N), vec3(4.0)); a3bw /= dot(a3bw, vec3(1.0));\nvec4 a3tx = texture2D(uTri, vA3W.zy * uTriS) * a3bw.x + texture2D(uTri, vA3W.xz * uTriS) * a3bw.y + texture2D(uTri, vA3W.xy * uTriS) * a3bw.z;\ndiffuseColor.rgb *= 0.42 + a3tx.r * 1.16;\n';
      if (o.top) col += 'float a3tp = smoothstep(0.45, 0.85, vA3N.y) * uTopK;' + (o.tri ? ' a3tp *= smoothstep(0.25, 0.55, a3tx.r + 0.25);' : '') + '\ndiffuseColor.rgb = mix(diffuseColor.rgb, uTopC, a3tp);\n';
      if (o.ao) col += 'diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.7, vA3W.y));\n';
      if (o.detail) col += 'vec4 a3dt = texture2D(uDetail, vA3W.xz * uDetS);\ndiffuseColor.rgb *= 0.72 + a3dt.r * 0.56;\n';
      if (o.cloud) col += 'diffuseColor.rgb *= mix(1.0, texture2D(uCloud, vA3W.xz * 0.011 + uTime * vec2(0.0045, 0.0028)).r, uCloudK);\n';
      if (o.dither) col += 'if (uPlayer.z > 0.5) { float a3dd = distance(vA3W.xz, uPlayer.xy); float a3th = 0.62 * (1.0 - smoothstep(1.5, 2.6, a3dd)); if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < a3th) discard; }\n';
      if (col) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + col);
      if (o.mat && fs.indexOf('#include <roughnessmap_fragment>') >= 0) { fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vMat.x;'); fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMat.y;'); }
      let nrm = '';
      if (o.detail) nrm += 'normal = normalize(normal + (viewMatrix * vec4((a3dt.g - 0.5) * uDetN, 0.0, (a3dt.b - 0.5) * uDetN, 0.0)).xyz);\n';
      if (o.water) nrm += '{ vec2 p = vA3W.xz; float t = uTime; vec2 g = vec2(cos(p.x * 1.7 + t * 1.3) + cos(p.x * 2.9 - p.y * 1.3 + t * 2.1) * 0.6, sin(p.y * 2.1 + t * 1.1) + sin(p.y * 3.3 + p.x * 0.7 - t * 1.7) * 0.6) * uWave; normal = normalize(normal + (viewMatrix * vec4(g.x, 0.0, g.y, 0.0)).xyz); }\n';
      if (nrm && fs.indexOf('#include <normal_fragment_maps>') >= 0) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + nrm);
      let em = '';
      if (o.mat) em += 'totalEmissiveRadiance += diffuseColor.rgb * vMat.z;\n';
      if (o.rim && fs.indexOf('vViewPosition') >= 0 && fs.indexOf('#include <normal_fragment_begin>') >= 0) em += '{ float a3r = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += uRim * pow(a3r, 2.6); }\n';
      if (o.flash) em += 'totalEmissiveRadiance += vec3(1.0, 0.9, 0.85) * uFlash;\n';
      if (em) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + em);
      sh.vertexShader = vs; sh.fragmentShader = fs;
      mat.userData.shader = sh;
    };
    mat.customProgramCacheKey = () => 'a3:' + key;
    return mat;
  }

  // ───────────────────────── 지오메트리 도우미 ─────────────────────────
  // 부품(지오메트리 + 위치·회전·크기 + 색 + 재질값 + 뼈 번호)을 한 지오메트리로 합침
  function mergeParts(parts, withSkin) {
    const T = THREE, M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), P = new T.Vector3(), S = new T.Vector3();
    const pos = [], nor = [], col = [], mat = [], si = [], sw = [];
    parts.forEach(pt => {
      let g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
      ['uv', 'uv2'].forEach(k => g.deleteAttribute && g.getAttribute(k) && g.deleteAttribute(k));
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const p = pt.p || [0, 0, 0], r = pt.r || [0, 0, 0], s = pt.s || [1, 1, 1], o = pt.o || [0, 0, 0];
      E.set(r[0], r[1], r[2]); Q.setFromEuler(E); P.set(p[0] + o[0], p[1] + o[1], p[2] + o[2]); S.set(s[0], s[1], s[2]); M.compose(P, Q, S); g.applyMatrix4(M);
      if (pt.flat) { g.deleteAttribute('normal'); g.computeVertexNormals(); }
      const pa = g.getAttribute('position'), na = g.getAttribute('normal'), n = pa.count, c = pt.c || [1, 1, 1], m = pt.m || [0.7, 0, 0];
      for (let i = 0; i < n; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); nor.push(na.getX(i), na.getY(i), na.getZ(i)); col.push(c[0], c[1], c[2]); mat.push(m[0], m[1], m[2]); if (withSkin) { si.push(pt.b || 0, 0, 0, 0); sw.push(1, 0, 0, 0); } }
      g.dispose();
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3)); out.setAttribute('aMat', new T.Float32BufferAttribute(mat, 3));
    if (withSkin) { out.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); out.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4)); }
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
  const C3 = hex => { const c = lin(hex); return [c.r, c.g, c.b]; };
  // 모서리를 깎은 상자 (바닥 y=0 ~ 위 y=1)
  function chamferBox(w, d, c) {
    const T = THREE, s = new T.Shape(), a = w / 2 - c, b = d / 2 - c; s.moveTo(-a, -b); s.lineTo(a, -b); s.lineTo(a, b); s.lineTo(-a, b); s.lineTo(-a, -b);
    const g = new T.ExtrudeGeometry(s, { depth: 1 - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, c, 0); g.deleteAttribute('uv'); const ng = g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g; ng.computeVertexNormals(); return ng;
  }
  // 울퉁불퉁한 절벽 상자 (바닥 y=0 ~ 위 y=1)
  function cliffBox(seed) {
    const T = THREE, g = new T.BoxGeometry(1, 1, 1, 2, 3, 2), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n1 = hash3(x + seed, y, z) - 0.5, n2 = hash3(x, y + seed, z + 3) - 0.5, n3 = hash3(z, x + 7, y + seed) - 0.5;
      const top = y > 0.49, side = Math.abs(x) > 0.49 || Math.abs(z) > 0.49; let k = top ? 0.86 : 1;
      if (side && !top && y > -0.49) { x += n1 * 0.12; z += n2 * 0.12; }
      x *= k; z *= k; if (top) y += n3 * 0.16; x = clamp(x, -0.53, 0.53); z = clamp(z, -0.53, 0.53); p.setXYZ(i, x, y + 0.5, z); }
    const ng = g.toNonIndexed(); ng.deleteAttribute('uv'); ng.computeVertexNormals(); g.dispose(); return ng;
  }
  // 바위 (지름 약 1)
  function rockGeo(seed, detail) {
    const T = THREE, g = new T.IcosahedronGeometry(0.5, detail || 0), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.78 + hash3(x + seed, y, z) * 0.44; p.setXYZ(i, x * k, Math.max(-0.2, y * k * 0.8), z * k); }
    g.deleteAttribute('uv'); g.computeVertexNormals(); return g;
  }
  // 통나무 울타리 한 칸 (x 방향)
  function palisadeGeo(seg) {
    const T = THREE, parts = [];
    [-0.32, 0, 0.32].forEach((x, i) => { const h = 1.05 + (i === 1 ? 0.12 : 0); parts.push({ geo: new T.CylinderGeometry(0.15, 0.16, h, seg), p: [x, h / 2, 0], c: [1, 1, 1], r: [0, i * 0.7, 0] }, { geo: new T.ConeGeometry(0.15, 0.24, seg), p: [x, h + 0.12, 0], c: [1, 1, 1] }); });
    parts.push({ geo: new T.BoxGeometry(1.0, 0.12, 0.12), p: [0, 0.78, 0.13], c: [0.75, 0.75, 0.75] }, { geo: new T.BoxGeometry(1.0, 0.12, 0.12), p: [0, 0.32, 0.13], c: [0.75, 0.75, 0.75] });
    return mergeParts(parts, false);
  }
  // 얼음 결정 기둥 한 칸
  function crystalGeo(seg) {
    const T = THREE, parts = [], R = rng(7);
    parts.push({ geo: new T.CylinderGeometry(0.3, 0.42, 1.0, 6), p: [0, 0.5, 0], flat: true }, { geo: new T.ConeGeometry(0.3, 0.42, 6), p: [0, 1.21, 0], flat: true });
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4, h = 0.5 + R() * 0.3; parts.push({ geo: new T.CylinderGeometry(0.12, 0.16, h, 6), p: [Math.cos(a) * 0.3, h / 2, Math.sin(a) * 0.3], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], flat: true }, { geo: new T.ConeGeometry(0.12, 0.2, 6), p: [Math.cos(a) * 0.36, h + 0.08, Math.sin(a) * 0.36], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], flat: true }); }
    return mergeParts(parts, false);
  }
  // 보석 (위는 평평한 면, 아래는 뾰족 — 면마다 반짝이게 평평 음영)
  function gemGeo() {
    const T = THREE; return mergeParts([{ geo: new T.CylinderGeometry(0.15, 0.27, 0.11, 8), p: [0, 0.055, 0], flat: true }, { geo: new T.ConeGeometry(0.27, 0.32, 8), p: [0, -0.16, 0], r: [Math.PI, 0, 0], flat: true }], false);
  }
  // 발밑 고리 + 앞쪽 화살표 (바닥에 눕힘)
  function ringGeo() {
    const T = THREE, r = new T.RingGeometry(0.44, 0.54, 36); r.rotateX(-Math.PI / 2);
    const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-0.13, 0, 0.6, 0.13, 0, 0.6, 0, 0, 0.8], 3)); tri.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    return mergeParts([{ geo: r }, { geo: tri }], false);
  }
  // 풀 덤불 한 포기: 엇갈린 세로 판 3장 (법선은 위로 — 풀처럼 고르게 밝게)
  function grassClump() {
    const T = THREE, pos = [], uv = [], nor = [];
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, h = 1.3;
      const v = [[-cx, 0, -cz, 0, 0], [cx, 0, cz, 1, 0], [cx, h, cz, 1, 1], [-cx, 0, -cz, 0, 0], [cx, h, cz, 1, 1], [-cx, h, -cz, 0, 1]];
      v.forEach(q => { pos.push(q[0], q[1], q[2]); uv.push(q[3], q[4]); nor.push(0, 1, 0); }); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); return g;
  }
  // 맵 밖 나무 (맵 분위기별)
  function treeGeo(kind, seg) {
    const T = THREE, P = [];
    if (kind === 'desert') {   // 선인장
      P.push({ geo: new T.CylinderGeometry(0.2, 0.24, 1.6, seg), p: [0, 0.8, 0], c: C3(0x4E8C3A) }, { geo: new T.SphereGeometry(0.2, seg, 6), p: [0, 1.6, 0], c: C3(0x4E8C3A) },
        { geo: new T.CylinderGeometry(0.12, 0.13, 0.6, seg), p: [0.32, 0.95, 0], c: C3(0x4E8C3A) }, { geo: new T.CylinderGeometry(0.12, 0.12, 0.3, seg), p: [0.2, 0.68, 0], r: [0, 0, 1.4], c: C3(0x4E8C3A) },
        { geo: new T.CylinderGeometry(0.11, 0.12, 0.45, seg), p: [-0.3, 1.15, 0], c: C3(0x4A8436) }, { geo: new T.CylinderGeometry(0.11, 0.11, 0.26, seg), p: [-0.18, 0.95, 0], r: [0, 0, -1.4], c: C3(0x4A8436) },
        { geo: new T.SphereGeometry(0.09, 6, 4), p: [0, 1.82, 0], c: C3(0xFF7AA8), m: [0.6, 0, 0.3] });
    } else if (kind === 'snow') {   // 눈 덮인 전나무
      P.push({ geo: new T.CylinderGeometry(0.1, 0.14, 0.6, 6), p: [0, 0.3, 0], c: C3(0x5A4636) });
      [[0.95, 0.9, 0.55], [0.75, 0.8, 1.05], [0.52, 0.7, 1.5]].forEach(([r, h, y], i) => { P.push({ geo: new T.ConeGeometry(r, h, seg), p: [0, y, 0], c: C3(0x2E5E4A) }, { geo: new T.ConeGeometry(r * 0.72, h * 0.42, seg), p: [0, y + h * 0.3, 0], c: C3(0xF2F8FC) }); });
    } else {   // 정글 활엽수
      P.push({ geo: new T.CylinderGeometry(0.13, 0.2, 1.3, 6), p: [0, 0.65, 0], c: C3(0x6B4A2E) });
      [[0, 1.6, 0, 0.75, 0x2F8A3A], [0.45, 1.35, 0.2, 0.55, 0x3FA048], [-0.4, 1.4, -0.15, 0.55, 0x267A32], [0.05, 2.0, -0.1, 0.5, 0x4BB052]].forEach(([x, y, z, r, c]) => P.push({ geo: new T.IcosahedronGeometry(r, 1), p: [x, y, z], c: C3(c), flat: true }));
    }
    return mergeParts(P, false);
  }
  function bombGeo(seg) {
    const T = THREE; return mergeParts([{ geo: new T.SphereGeometry(0.2, seg, seg - 2), c: C3(0x2B2D42), m: [0.35, 0.5, 0] }, { geo: new T.CylinderGeometry(0.205, 0.205, 0.06, seg), c: C3(0xC9A227), m: [0.3, 0.8, 0] },
      { geo: new T.CylinderGeometry(0.06, 0.07, 0.08, 6), p: [0, 0.22, 0], c: C3(0x555B6E) }, { geo: new T.CylinderGeometry(0.015, 0.015, 0.12, 4), p: [0.02, 0.3, 0], r: [0, 0, -0.4], c: C3(0xD9C9A3) }], false);
  }

  // ───────────────────────── 절차 텍스처 ─────────────────────────
  function texDetail(theme) {
    const S = 256, h1 = tileNoise(S, 8, 4, 11), h2 = tileNoise(S, 32, 2, 23), H = new Float32Array(S * S);
    const snow = theme === 'ice', grass = theme === 'jungle';
    for (let i = 0; i < H.length; i++) H[i] = h1[i] * 0.6 + h2[i] * 0.4 + (grass ? Math.max(0, h2[i] - 0.55) * 1.4 : 0);
    const R = rng(5); for (let k = 0; k < (snow ? 60 : 380); k++) { const x = R() * S | 0, y = R() * S | 0, r = 1 + R() * 2.5; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = Math.hypot(dx, dy); if (d <= r) { const i = ((y + dy + S) % S) * S + ((x + dx + S) % S); H[i] += (1 - d / r) * 0.35; } } }
    return heightTex(S, H, v => 0.25 + v * 0.75, snow ? 1.6 : 3.2);
  }
  function texTri(kind) {
    const S = 256, H = new Float32Array(S * S), n = tileNoise(S, 8, 4, kind.length * 7), n2 = tileNoise(S, 32, 2, 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; let v = n[i] * 0.7 + n2[i] * 0.3;
      if (kind === 'brick') { const row = Math.floor(y / 32), bx = (x + (row % 2) * 32) % 64, by = y % 32; const m = Math.min(bx, 64 - bx, by, 32 - by); v = v * 0.5 + 0.5; if (m < 3) v *= 0.45 + m * 0.12; }
      else if (kind === 'wood') { v = 0.55 + Math.sin(x * 0.35 + n[i] * 12) * 0.12 + n2[i] * 0.25; if (x % 64 < 3) v *= 0.55; }
      else if (kind === 'ice') { v = 0.7 + n[i] * 0.3; const c = Math.abs(Math.sin(x * 0.07 + n[i] * 9) * Math.cos(y * 0.05 + n2[i] * 5)); if (c < 0.03) v *= 0.7; }
      else { v = v * 0.8 + 0.2; const st = Math.abs(Math.sin(y * 0.11 + n[i] * 6)); if (st < 0.06) v *= 0.7; }   // 바위: 지층 줄무늬
      H[i] = v; }
    return heightTex(S, H, v => v, 2);
  }
  function texGrass(cols, snowy) {
    const S = 128, c = mkCanvas(S, S), g = c.getContext('2d'), R = rng(41);
    for (let i = 0; i < 46; i++) { const x = 6 + R() * (S - 12), w = 3 + R() * 5, h = S * (0.45 + R() * 0.55), lean = (R() - 0.5) * 34;
      const gr = g.createLinearGradient(0, S, 0, S - h); gr.addColorStop(0, cols[2]); gr.addColorStop(0.55, R() < 0.5 ? cols[0] : cols[1]); gr.addColorStop(1, snowy ? cols[3] : cols[1]);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, S); g.quadraticCurveTo(x + lean * 0.3, S - h * 0.5, x + lean, S - h); g.quadraticCurveTo(x + lean * 0.3 + w * 0.3, S - h * 0.5, x + w, S); g.closePath(); g.fill(); }
    if (!snowy) for (let i = 0; i < 6; i++) { g.fillStyle = cols[3]; g.beginPath(); g.ellipse(10 + R() * (S - 20), 20 + R() * 50, 4, 7, R() * 3, 0, Math.PI * 2); g.fill(); }
    return c;
  }
  function texCrate(metal) {
    const S = 128, c = mkCanvas(S, S), g = c.getContext('2d'), R = rng(9);
    g.fillStyle = metal ? '#7E8FA3' : '#B5793F'; g.fillRect(0, 0, S, S);
    if (!metal) for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'; g.fillRect(0, i * 26, S, 26); for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(70,40,15,0.25)'; g.beginPath(); const y = i * 26 + R() * 26; g.moveTo(0, y); g.bezierCurveTo(40, y + R() * 6 - 3, 80, y + R() * 6 - 3, S, y); g.stroke(); } }
    else { g.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 16, S, 2); }
    g.strokeStyle = metal ? '#4B5869' : '#6E4220'; g.lineWidth = 14; g.strokeRect(7, 7, S - 14, S - 14);
    g.lineWidth = 12; g.beginPath(); g.moveTo(10, 10); g.lineTo(S - 10, S - 10); g.stroke();
    g.fillStyle = metal ? '#D0D8E2' : '#3B2412'; [[12, 12], [S - 12, 12], [12, S - 12], [S - 12, S - 12]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); });
    return c;
  }
  // 입자 그림 모음 (4×2): 0 부드러운 빛 · 1 연기 · 2 불꽃줄 · 3 별 · 4 잎 · 5 고리 · 6 눈송이 · 7 조각
  function texAtlas() {
    const c = mkCanvas(256, 128), g = c.getContext('2d'), cell = (i, f) => { g.save(); g.translate((i % 4) * 64 + 32, Math.floor(i / 4) * 64 + 32); f(); g.restore(); };
    const rad = (r, stops) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); stops.forEach(([o, s]) => gr.addColorStop(o, s)); return gr; };
    cell(0, () => { g.fillStyle = rad(31, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-32, -32, 64, 64); });
    cell(1, () => { const R = rng(3); for (let i = 0; i < 9; i++) { const a = R() * 6.28, r = R() * 10; g.fillStyle = rad(14 + R() * 6, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]); g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); g.fillRect(-32, -32, 64, 64); g.restore(); } });
    cell(2, () => { g.scale(1, 0.22); g.fillStyle = rad(31, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-32, -32, 64, 64); });
    cell(3, () => { g.fillStyle = rad(30, [[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); });
    cell(4, () => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 9, 22, 0.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, 18); g.lineTo(10, -18); g.stroke(); });
    cell(5, () => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.shadowColor = '#fff'; g.shadowBlur = 8; g.beginPath(); g.arc(0, 0, 25, 0, Math.PI * 2); g.stroke(); });
    cell(6, () => { g.fillStyle = rad(12, [[0, 'rgba(255,255,255,1)'], [0.6, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-16, -16, 32, 32); });
    cell(7, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-14, -10); g.lineTo(12, -14); g.lineTo(15, 9); g.lineTo(-8, 14); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-2, -12, 14, 22); });
    return c;
  }

  // ───────────────────────── 입자 (그리기 1번에 수백 개) ─────────────────────────
  //   flat = 바닥에 눕힌 판(충격파 · 그을음 · 둥근 그림자), 아니면 카메라를 보는 판. add = 더하기 섞기(빛)
  class A3Particles {
    constructor(max, add, flat, tex, uLin) {
      const T = THREE; this.max = max; this.list = []; this.extra = 0; this.flat = flat;
      const base = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry(); g.setIndex(base.index); g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
      const A = (n, k) => { const a = new T.InstancedBufferAttribute(new Float32Array(max * k), k); a.setUsage(T.DynamicDrawUsage); g.setAttribute(n, a); return a; };
      this.aPos = A('aPos', 3); this.aCol = A('aCol', 4); this.aSz = A('aSz', 4); this.aVel = A('aVel', 3); this.aTex = A('aTex', 1); g.instanceCount = 0; this.geo = g;
      this.mat = new T.ShaderMaterial({ uniforms: { map: { value: tex }, uLin: uLin },
        vertexShader: [
          'attribute vec3 aPos; attribute vec4 aCol; attribute vec4 aSz; attribute vec3 aVel; attribute float aTex; varying vec2 vUv; varying vec4 vCol;',
          'void main() { vec2 p = position.xy * aSz.xy; float r = aSz.z;',
          flat ? ' float c = cos(r), s = sin(r); vec3 w = aPos + vec3(c * p.x - s * p.y, 0.0, s * p.x + c * p.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);'
            : ' vec4 mv = modelViewMatrix * vec4(aPos, 1.0); if (aSz.w > 0.5) { vec3 vv = (modelViewMatrix * vec4(aVel, 0.0)).xyz; r = atan(vv.y, vv.x); } float c = cos(r), s = sin(r); mv.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y); gl_Position = projectionMatrix * mv;',
          ' float col = mod(aTex, 4.0), row = floor(aTex / 4.0); vUv = vec2((uv.x + col) * 0.25, (uv.y + 1.0 - row) * 0.5); vCol = aCol; }'].join('\n'),
        fragmentShader: 'uniform sampler2D map; uniform float uLin; varying vec2 vUv; varying vec4 vCol; void main() { vec4 c = vCol * texture2D(map, vUv); if (c.a < 0.004) discard; if (uLin > 0.5) c.rgb = pow(c.rgb, vec3(2.2)); gl_FragColor = c; }',
        transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, polygonOffset: flat, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.mesh = new T.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = flat ? 1 : 5;
    }
    // o: x,y,z, vx,vy,vz, g(중력), drag, life(초), s0,s1(크기), w(가로배율), c(색 hex 또는 [r,g,b]), a0,a1, rot, vr, tex, st(속도 방향으로 늘이기)
    add(o) { if (this.list.length >= this.max) return null; const c = Array.isArray(o.c) ? o.c : hexRgb(o.c == null ? 0xFFFFFF : o.c);
      const p = { x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, drag: o.drag || 0, t: 0, life: o.life || 0.6, s0: o.s0 == null ? 0.3 : o.s0, s1: o.s1 == null ? (o.s0 == null ? 0.3 : o.s0) : o.s1, w: o.w || 1, r: c[0], gg: c[1], b: c[2], a0: o.a0 == null ? 1 : o.a0, a1: o.a1 == null ? 0 : o.a1, rot: o.rot || 0, vr: o.vr || 0, tex: o.tex || 0, st: o.st ? 1 : 0, ease: o.ease || 0 };
      this.list.push(p); return p; }
    step(dt) { const L = this.list; let j = 0; for (let i = 0; i < L.length; i++) { const p = L[i]; p.t += dt; if (p.t >= p.life) continue;
      const dr = p.drag ? Math.exp(-p.drag * dt) : 1; p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      if (p.y < 0.02 && p.g > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } L[j++] = p; } L.length = j; this.n = 0; }
    // 이번 프레임에만 그릴 판 (젬 빛 · 둥근 그림자 등)
    put(x, y, z, s, w, c, a, tex, rot) { if (this.n >= this.max) return; this._write(this.n++, x, y, z, s * w, s, rot || 0, 0, 0, 0, 0, c[0], c[1], c[2], a, tex); }
    _write(i, x, y, z, sw, sh, rot, st, vx, vy, vz, r, g, b, a, tex) { const P = this.aPos.array, C = this.aCol.array, Z = this.aSz.array, V = this.aVel.array;
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = b; C[i * 4 + 3] = a; Z[i * 4] = sw; Z[i * 4 + 1] = sh; Z[i * 4 + 2] = rot; Z[i * 4 + 3] = st; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz; this.aTex.array[i] = tex; }
    flush() { const L = this.list; for (let k = 0; k < L.length && this.n < this.max; k++) { const p = L[k], u = p.t / p.life, e = p.ease ? 1 - Math.pow(1 - u, 2) : u, s = p.s0 + (p.s1 - p.s0) * e, a = p.a0 + (p.a1 - p.a0) * u;
        this._write(this.n++, p.x, p.y, p.z, s * p.w, s, p.rot, p.st, p.vx, p.vy, p.vz, p.r, p.gg, p.b, a, p.tex); }
      this.geo.instanceCount = this.n; ['aPos', 'aCol', 'aSz', 'aVel', 'aTex'].forEach(k => { this[k].needsUpdate = true; }); }
    dispose() { this.geo.dispose(); this.mat.dispose(); }
  }

  // ───────────────────────── 가벼운 후처리 (high 전용): 블룸(1/4 크기 2번) + 합성(비네트 · 색 · sRGB) ─────────────────────────
  class A3Post {
    constructor(renderer) {
      const T = THREE; this.r = renderer;
      const isGL2 = renderer.capabilities.isWebGL2, fl = isGL2 && renderer.extensions.get('EXT_color_buffer_float');
      this.ok = !!(isGL2 && fl); if (!this.ok) return;
      const opt = { type: T.HalfFloatType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false };
      this.rtS = new T.WebGLMultisampleRenderTarget(4, 4, { type: T.HalfFloatType, format: T.RGBAFormat }); this.rtS.samples = 4;
      this.rtA = new T.WebGLRenderTarget(4, 4, opt); this.rtB = new T.WebGLRenderTarget(4, 4, opt);
      const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
      const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      this.mBright = new T.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTx: { value: new T.Vector2() }, uThr: { value: 0.72 } }, vertexShader: VS, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D tSrc; uniform vec2 uTx; uniform float uThr; varying vec2 vUv; vec3 bp(vec2 u) { vec3 c = texture2D(tSrc, u).rgb; float l = max(c.r, max(c.g, c.b)); return c * smoothstep(uThr, uThr + 0.3, l); }\n' +
          'void main() { vec3 s = vec3(0.0); float w[5]; w[0] = 0.2270; w[1] = 0.1946; w[2] = 0.1216; w[3] = 0.0541; w[4] = 0.0162; for (int i = -4; i <= 4; i++) { float k = w[i < 0 ? -i : i]; vec2 o = vec2(float(i) * 2.0 * uTx.x, 0.0); s += (bp(vUv + o + vec2(0.0, uTx.y)) + bp(vUv + o - vec2(0.0, uTx.y))) * 0.5 * k; } gl_FragColor = vec4(s, 1.0); }' });
      this.mBlur = new T.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTx: { value: new T.Vector2() } }, vertexShader: VS, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D tSrc; uniform vec2 uTx; varying vec2 vUv; void main() { vec3 s = texture2D(tSrc, vUv).rgb * 0.2270; s += (texture2D(tSrc, vUv + vec2(0.0, 1.3846) * uTx).rgb + texture2D(tSrc, vUv - vec2(0.0, 1.3846) * uTx).rgb) * 0.3162; s += (texture2D(tSrc, vUv + vec2(0.0, 3.2308) * uTx).rgb + texture2D(tSrc, vUv - vec2(0.0, 3.2308) * uTx).rgb) * 0.0703; gl_FragColor = vec4(s, 1.0); }' });
      this.mComp = new T.ShaderMaterial({ uniforms: { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.55 }, uVig: { value: 0.32 }, uTint: { value: new T.Vector4(0, 0, 0, 0) }, uAsp: { value: 1 } }, vertexShader: VS, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uVig; uniform vec4 uTint; uniform float uAsp; varying vec2 vUv;\n' +
          'vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c)); }\n' +
          'void main() { vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom; vec2 q = (vUv - 0.5) * vec2(uAsp, 1.0); float e = smoothstep(0.35, 1.05, length(q)); c *= 1.0 - e * uVig; c = mix(c, uTint.rgb, uTint.a * e);\n' +
          ' float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, 1.08), 0.0); vec3 o = toSRGB(c); o += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; gl_FragColor = vec4(o, 1.0); }' });
      this.quad = new T.Mesh(tri, this.mBright); this.quad.frustumCulled = false; this.qs = new T.Scene(); this.qs.add(this.quad); this.qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.w = 0; this.h = 0;
    }
    size(w, h) { if (!this.ok || (w === this.w && h === this.h)) return; this.w = w; this.h = h; this.rtS.setSize(w, h); const qw = Math.max(1, Math.round(w / 4)), qh = Math.max(1, Math.round(h / 4)); this.rtA.setSize(qw, qh); this.rtB.setSize(qw, qh); }
    pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc); }
    render(scene, cam, tint) {
      const r = this.r, sz = r.getDrawingBufferSize(this._v || (this._v = new THREE.Vector2())); this.size(sz.x, sz.y);
      r.setRenderTarget(this.rtS); r.render(scene, cam);
      this.mBright.uniforms.tSrc.value = this.rtS.texture; this.mBright.uniforms.uTx.value.set(1 / this.w, 1 / this.h); this.pass(this.mBright, this.rtA);
      this.mBlur.uniforms.tSrc.value = this.rtA.texture; this.mBlur.uniforms.uTx.value.set(1 / this.rtA.width, 1 / this.rtA.height); this.pass(this.mBlur, this.rtB);
      const u = this.mComp.uniforms; u.tScene.value = this.rtS.texture; u.tBloom.value = this.rtB.texture; u.uAsp.value = this.w / Math.max(1, this.h); if (tint) u.uTint.value.copy(tint); else u.uTint.value.set(0, 0, 0, 0);
      this.pass(this.mComp, null);
    }
    dispose() { if (!this.ok) return; [this.rtS, this.rtA, this.rtB, this.mBright, this.mBlur, this.mComp, this.quad.geometry].forEach(o => o.dispose()); }
  }

  // ───────────────────────── 캐릭터 6종 모델 ─────────────────────────
  //  뼈: 0 발밑(쓰러질 때 축) · 1 골반 · 2 몸통 · 3 머리 · 4 왼팔 · 5 오른팔(무기) · 6 왼다리 · 7 오른다리 · 8 머리 장식 · 9 등 장식(망토·목도리)
  //  모델 앞 = +z, 캐릭터의 오른쪽 = -x. 판정은 원(반지름 0.55)이라 모델은 그 안에 들어가게 만듦
  const SKIN = 0xF2C9A0, DARK = 0x2B2D42, METAL = 0x3A3F55, STEEL = 0x8E9AAF, EYE = 0x15151F;
  const CHAR3 = {
    bolt:   { s: 1.0,  legH: 0.32, torsoH: 0.38, shW: 0.27, hipW: 0.1,  headR: 0.27, twoHand: false },
    rock:   { s: 1.22, legH: 0.26, torsoH: 0.44, shW: 0.37, hipW: 0.14, headR: 0.2,  twoHand: true },
    hawk:   { s: 1.0,  legH: 0.34, torsoH: 0.36, shW: 0.24, hipW: 0.09, headR: 0.25, twoHand: true },
    sprout: { s: 0.93, legH: 0.27, torsoH: 0.32, shW: 0.25, hipW: 0.1,  headR: 0.31, twoHand: false },
    owl:    { s: 1.02, legH: 0.18, torsoH: 0.46, shW: 0.33, hipW: 0.12, headR: 0.3,  twoHand: false },
    spark:  { s: 0.9,  legH: 0.31, torsoH: 0.34, shW: 0.25, hipW: 0.09, headR: 0.25, twoHand: true }
  };
  function buildChar(chId, teamHex, teamDark, seg) {
    const T = THREE, D = CHAR3[chId] || CHAR3.bolt, s = D.s, P = [];
    const legH = D.legH, tH = D.torsoH, hR = D.headR;
    // 뼈 위치 (부모 기준이 아닌 모델 기준 — 아래에서 부모 기준으로 바꿈)
    const piv = [[0, 0, 0], [0, legH, 0], [0, legH + 0.03, 0], [0, legH + 0.03 + tH, 0], [D.shW, legH + tH - 0.06, 0], [-D.shW, legH + tH - 0.06, 0], [D.hipW, legH, 0], [-D.hipW, legH, 0], [0, legH + 0.03 + tH + hR * 1.75, 0], [0, legH + tH - 0.02, -0.18]];
    const par = [-1, 0, 1, 2, 2, 2, 1, 1, 3, 2];
    const add = (b, geo, hex, m, p, r, sc, flat) => P.push({ b, geo, c: C3(hex), m: m || [0.7, 0, 0], p, r, s: sc, o: piv[b], flat });
    const sph = (r) => new T.SphereGeometry(r, seg, Math.max(5, seg * 0.75 | 0)), cyl = (a, b, h, n) => new T.CylinderGeometry(a, b, h, n || seg), box = (w, h, d) => new T.BoxGeometry(w, h, d), cone = (r, h, n) => new T.ConeGeometry(r, h, n || seg);
    const C = teamHex, CD = teamDark, Z90 = [Math.PI / 2, 0, 0];
    // 다리 · 신발
    const leg = (b, col, shoe, thick) => { add(b, cyl(0.075 * thick, 0.068 * thick, legH, 8), col, [0.8, 0, 0], [0, -legH / 2, 0]); add(b, box(0.15 * thick, 0.09, 0.22 * thick), shoe, [0.6, 0, 0], [0, -legH + 0.045, 0.035]); };
    // 팔: 앞으로 뻗음(yaw = 안쪽으로 모으는 각) 또는 내림
    const armF = (b, col, hand, len, yaw, thick) => { const dx = Math.sin(yaw) * len, dz = Math.cos(yaw) * len; add(b, cyl(0.062 * thick, 0.055 * thick, len, 8), col, [0.75, 0, 0], [dx / 2, -0.02, dz / 2], [Math.PI / 2, 0, -yaw]);
      add(b, sph(0.085 * thick), col, [0.75, 0, 0], [0, 0, 0]); add(b, sph(0.068 * thick), hand, [0.7, 0, 0], [dx, -0.03, dz]); return [dx, -0.03, dz]; };
    const armD = (b, col, hand, len, out, thick) => { add(b, cyl(0.06 * thick, 0.054 * thick, len, 8), col, [0.75, 0, 0], [out * 0.05, -len / 2, 0.03], [0.15, 0, out * 0.15]); add(b, sph(0.08 * thick), col, [0.75, 0, 0], [0, 0, 0]); add(b, sph(0.066 * thick), hand, [0.7, 0, 0], [out * 0.1, -len, 0.06]); };
    const eyes = (y, z, gap, r, col) => [-1, 1].forEach(k => { add(3, sph(r), col || EYE, [0.25, 0, 0], [k * gap, y, z]); add(3, sph(r * 0.38), 0xFFFFFF, [0.2, 0, 0.6], [k * gap - r * 0.3, y + r * 0.35, z + r * 0.75]); });
    let tip = [0, 0, 0.6];
    if (chId === 'bolt') {
      leg(6, DARK, 0xF5F5F5, 1); leg(7, DARK, 0xF5F5F5, 1);
      add(1, cyl(0.25, 0.24, 0.13), DARK, [0.8, 0, 0], [0, -0.02, 0]);
      add(2, cyl(0.23, 0.27, tH), C, [0.65, 0, 0], [0, tH / 2, 0]); add(2, box(0.045, tH * 0.85, 0.03), 0xFFD23F, [0.4, 0.3, 0.35], [0, tH / 2, 0.25]);
      add(2, cyl(0.275, 0.275, 0.07), CD, [0.6, 0, 0], [0, 0.03, 0]); add(2, cyl(0.17, 0.235, 0.07), CD, [0.6, 0, 0], [0, tH, 0]);
      add(2, box(0.28, 0.27, 0.14), METAL, [0.5, 0.3, 0], [0, tH * 0.55, -0.27]); add(2, cyl(0.012, 0.012, 0.26, 4), STEEL, [0.4, 0.6, 0], [0.09, tH + 0.1, -0.3]); add(2, sph(0.035), 0xFFD23F, [0.3, 0, 1.2], [0.09, tH + 0.24, -0.3]);
      add(3, sph(hR), SKIN, [0.6, 0, 0], [0, hR * 0.95, 0]);
      add(3, new T.SphereGeometry(hR * 1.06, seg, seg / 2 | 0, 0, Math.PI * 2, 0, Math.PI / 2), CD, [0.6, 0, 0], [0, hR * 1.02, -0.01]);
      add(3, box(0.36, 0.035, 0.2), CD, [0.6, 0, 0], [0, hR * 1.05, hR * 0.88]); add(3, box(0.07, 0.13, 0.02), 0xFFD23F, [0.4, 0.2, 0.5], [0, hR * 1.42, hR * 0.86], [0, 0, 0.5]);
      add(3, sph(hR * 0.5), 0x5A3A22, [0.8, 0, 0], [0, hR * 0.9, -hR * 0.62], null, [1.1, 0.8, 0.6]);
      eyes(hR * 0.88, hR * 0.86, 0.09, 0.048);
      armD(4, C, SKIN, 0.3, 1, 1);
      const h = armF(5, C, SKIN, 0.3, 0.12, 1);
      add(5, box(0.11, 0.15, 0.3), METAL, [0.4, 0.6, 0], [h[0], 0.02, h[2] + 0.08]); add(5, box(0.07, 0.15, 0.08), DARK, [0.6, 0, 0], [h[0], -0.08, h[2] + 0.01]);
      add(5, cyl(0.055, 0.055, 0.13), 0xFFD23F, [0.3, 0.2, 1.1], [h[0], 0.06, h[2] + 0.12], Z90); add(5, cyl(0.035, 0.035, 0.2), STEEL, [0.3, 0.8, 0], [h[0], 0.05, h[2] + 0.3], Z90);
      tip = [h[0], 0.05, h[2] + 0.42];
    } else if (chId === 'rock') {
      const STONE = 0x9A948C, STONE_D = 0x76706A;
      leg(6, STONE_D, DARK, 1.5); leg(7, STONE_D, DARK, 1.5);
      add(1, box(0.5, 0.14, 0.38), DARK, [0.8, 0, 0], [0, -0.01, 0]);
      add(2, box(0.62, tH, 0.44), STONE, [0.95, 0, 0], [0, tH / 2, 0], null, null, true); add(2, box(0.66, tH * 0.62, 0.48), C, [0.55, 0.15, 0], [0, tH * 0.5, 0]);
      add(2, box(0.3, 0.17, 0.04), CD, [0.4, 0.5, 0], [0, tH * 0.6, 0.25]); add(2, box(0.66, 0.07, 0.5), DARK, [0.6, 0, 0], [0, 0.04, 0]); add(2, box(0.12, 0.09, 0.03), 0xE0B341, [0.3, 0.9, 0], [0, 0.04, 0.26]);
      add(3, sph(hR), STONE, [0.95, 0, 0], [0, hR * 0.85, 0.03], null, [1.15, 0.95, 1]);
      add(3, new T.SphereGeometry(hR * 1.18, seg, seg / 2 | 0, 0, Math.PI * 2, 0, Math.PI / 2), 0xF4C430, [0.4, 0.3, 0], [0, hR * 1.0, 0]); add(3, cyl(hR * 1.25, hR * 1.25, 0.03), 0xD9A520, [0.4, 0.3, 0], [0, hR * 1.0, 0]);
      add(3, cyl(0.05, 0.05, 0.05), 0xFFF3C4, [0.2, 0, 1.6], [0, hR * 1.35, hR * 1.05], Z90);
      add(3, box(hR * 1.9, 0.05, 0.08), STONE_D, [0.9, 0, 0], [0, hR * 1.02, hR * 0.85]); eyes(hR * 0.82, hR * 0.9, 0.075, 0.035, 0x101018);
      add(4, rockGeo(3, 0), STONE_D, [0.95, 0, 0], [0.02, 0.07, 0], null, [0.36, 0.3, 0.36], true); add(5, rockGeo(5, 0), STONE_D, [0.95, 0, 0], [-0.02, 0.07, 0], null, [0.36, 0.3, 0.36], true);
      const hl = armF(4, STONE, STONE, 0.3, -0.5, 1.55), h = armF(5, STONE, STONE, 0.3, 0.42, 1.55);
      add(5, box(0.12, 0.13, 0.32), 0x7A4A24, [0.8, 0, 0], [h[0] + 0.02, 0.0, h[2] - 0.04]);
      [-0.045, 0.045].forEach(o => add(5, cyl(0.045, 0.045, 0.56), METAL, [0.35, 0.7, 0], [h[0] + 0.03 + o, 0.05, h[2] + 0.36], Z90));
      add(5, box(0.18, 0.06, 0.12), 0x7A4A24, [0.8, 0, 0], [h[0] + 0.03, -0.01, h[2] + 0.22]);
      tip = [h[0] + 0.03, 0.05, h[2] + 0.66];
    } else if (chId === 'hawk') {
      const SUIT = 0x34384A, BEAK = 0xF5A524, FEATHER = 0x8B5E3C;
      leg(6, SUIT, 0x4A3B2E, 1); leg(7, SUIT, 0x4A3B2E, 1);
      add(1, cyl(0.21, 0.2, 0.12), SUIT, [0.8, 0, 0], [0, -0.02, 0]);
      add(2, cyl(0.19, 0.23, tH), SUIT, [0.7, 0, 0], [0, tH / 2, 0]); add(2, box(0.06, tH * 0.9, 0.42), C, [0.6, 0, 0], [0.05, tH / 2, 0.03], [0, 0, 0.55]);
      add(2, cyl(0.2, 0.25, 0.1), CD, [0.6, 0, 0], [0, tH, 0]);
      add(9, box(0.44, 0.58, 0.035), C, [0.75, 0, 0], [0, -0.28, -0.04], [0.12, 0, 0]); add(9, box(0.46, 0.06, 0.05), CD, [0.6, 0, 0], [0, 0.0, -0.01]);
      add(3, sph(hR), 0xE8C9A0, [0.6, 0, 0], [0, hR * 0.95, 0]);
      add(3, new T.SphereGeometry(hR * 1.12, seg, seg / 2 | 0, 0, Math.PI * 2, 0, Math.PI * 0.62), C, [0.75, 0, 0], [0, hR * 0.98, -0.04]);
      add(3, cone(0.07, 0.2, 6), BEAK, [0.45, 0, 0], [0, hR * 0.72, hR * 1.0], [Math.PI / 2, 0, 0]);
      [-1, 1].forEach(k => { add(3, cyl(0.065, 0.065, 0.06), METAL, [0.3, 0.7, 0], [k * 0.095, hR * 1.02, hR * 0.86], Z90); add(3, cyl(0.048, 0.048, 0.02), 0x5CE1E6, [0.1, 0, 1.3], [k * 0.095, hR * 1.02, hR * 0.9], Z90); });
      add(3, box(hR * 2.1, 0.035, 0.03), DARK, [0.6, 0, 0], [0, hR * 1.02, hR * 0.6]);
      [-0.3, 0, 0.3].forEach((o, i) => add(8, cone(0.05, 0.22, 5), FEATHER, [0.8, 0, 0], [o * 0.25, -0.02, -hR * 0.5 - i * 0.02], [-0.9, 0, o]));
      [-1, 1].forEach(k => add(2, cone(0.06, 0.2, 5), FEATHER, [0.8, 0, 0], [k * 0.22, tH + 0.02, -0.02], [0, 0, -k * 1.1]));
      armF(4, SUIT, 0x4A3B2E, 0.36, -0.42, 0.95); const h = armF(5, SUIT, 0x4A3B2E, 0.28, 0.32, 0.95);
      add(5, box(0.09, 0.12, 0.42), METAL, [0.4, 0.6, 0], [h[0] + 0.04, 0.03, h[2] + 0.1]); add(5, cyl(0.03, 0.03, 0.62), DARK, [0.3, 0.8, 0], [h[0] + 0.04, 0.05, h[2] + 0.6], Z90);
      add(5, cyl(0.045, 0.045, 0.22), DARK, [0.3, 0.7, 0], [h[0] + 0.04, 0.14, h[2] + 0.12], Z90); add(5, cyl(0.04, 0.04, 0.01), 0x5CE1E6, [0.1, 0, 1.4], [h[0] + 0.04, 0.14, h[2] + 0.235], Z90);
      add(5, box(0.08, 0.14, 0.16), 0x6B4A2E, [0.8, 0, 0], [h[0] + 0.04, -0.03, h[2] - 0.16]);
      tip = [h[0] + 0.04, 0.05, h[2] + 0.92];
    } else if (chId === 'sprout') {
      const LEAF = 0x6BBF59, LEAF_D = 0x4E9A3E, BULB = 0xB8E986;
      leg(6, LEAF_D, 0x6B4A2E, 1); leg(7, LEAF_D, 0x6B4A2E, 1);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(1, sph(0.1), LEAF_D, [0.75, 0, 0], [Math.sin(a) * 0.2, -0.06, Math.cos(a) * 0.2], [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], [0.9, 1.6, 0.35]); }
      add(2, cyl(0.2, 0.25, tH), LEAF, [0.7, 0, 0], [0, tH / 2, 0]); add(2, cyl(0.258, 0.258, 0.06), C, [0.6, 0, 0], [0, 0.06, 0]);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(2, sph(0.1), C, [0.6, 0, 0.05], [Math.sin(a) * 0.19, tH + 0.01, Math.cos(a) * 0.19], [Math.cos(a) * -0.7, 0, Math.sin(a) * 0.7], [1, 0.4, 1.5]); }
      add(3, sph(hR), BULB, [0.6, 0, 0], [0, hR * 0.95, 0]);
      eyes(hR * 0.9, hR * 0.84, 0.11, 0.06); [-1, 1].forEach(k => add(3, sph(0.045), 0xFF9AA2, [0.6, 0, 0.25], [k * 0.19, hR * 0.68, hR * 0.8], null, [1, 0.6, 0.4]));
      add(8, cyl(0.025, 0.03, 0.2, 6), LEAF_D, [0.7, 0, 0], [0, -0.08, 0]); [-1, 1].forEach(k => add(8, sph(0.12), 0x5EE05E, [0.6, 0, 0.1], [k * 0.12, 0.04, 0], [0, 0, k * 0.5], [1.6, 0.3, 0.85]));
      armD(4, LEAF, BULB, 0.26, 1, 1);
      const h = armF(5, LEAF, BULB, 0.24, 0.1, 1);
      add(5, cyl(0.028, 0.032, 0.86, 6), 0x8B5A2B, [0.8, 0, 0], [h[0], 0.12, h[2] + 0.02]);
      add(5, sph(0.085), 0x9BFF7A, [0.2, 0, 1.4], [h[0], 0.6, h[2] + 0.02]); [0, 2.1, 4.2].forEach(a => add(5, sph(0.06), 0x4E9A3E, [0.7, 0, 0], [h[0] + Math.cos(a) * 0.08, 0.53, h[2] + 0.02 + Math.sin(a) * 0.08], [0, a, 0.6], [1.4, 0.35, 0.7]));
      tip = [h[0], 0.6, h[2] + 0.06];
    } else if (chId === 'owl') {
      const BR = 0x8B5E3C, BR_D = 0x5C3A21, BELLY = 0xD9B48F, ORANGE = 0xF4A261;
      [6, 7].forEach(b => { add(b, cyl(0.04, 0.04, legH, 6), ORANGE, [0.7, 0, 0], [0, -legH / 2, 0]); [-0.06, 0, 0.06].forEach(o => add(b, box(0.035, 0.03, 0.12), ORANGE, [0.7, 0, 0], [o, -legH + 0.015, 0.05], [0, o * 4, 0])); });
      add(2, sph(0.34), BR, [0.85, 0, 0], [0, 0.2, 0], null, [1, 1.05, 0.95]); add(2, sph(0.26), BELLY, [0.85, 0, 0], [0, 0.17, 0.15], null, [0.9, 0.95, 0.55]);
      add(2, box(0.08, 0.72, 0.05), C, [0.6, 0, 0], [0, 0.2, 0.1], [0, 0, 0.62], [1, 1, 1]); add(2, box(0.08, 0.72, 0.05), C, [0.6, 0, 0], [0, 0.2, -0.12], [0, 0, 0.62]);
      [-0.16, 0, 0.16].forEach((o, i) => add(2, sph(0.06), DARK, [0.4, 0.4, 0], [o * 0.9, 0.2 + o * 1.4, 0.3 - Math.abs(o) * 0.3]));
      add(2, cyl(0.22, 0.27, 0.08), C, [0.6, 0, 0], [0, tH - 0.06, 0]);
      add(2, box(0.3, 0.24, 0.16), 0x6B4A2E, [0.8, 0, 0], [0, 0.26, -0.33]);
      add(3, sph(hR), BR, [0.85, 0, 0], [0, hR * 0.8, 0], null, [1.05, 0.95, 1]); add(3, sph(hR * 0.9), 0xE8C9A0, [0.8, 0, 0], [0, hR * 0.78, hR * 0.38], null, [1, 0.85, 0.45]);
      [-1, 1].forEach(k => { add(3, cone(0.075, 0.2, 5), BR_D, [0.8, 0, 0], [k * 0.18, hR * 1.6, -0.02], [0, 0, -k * 0.45]);
        add(3, cyl(0.105, 0.105, 0.07), 0xB8860B, [0.3, 0.8, 0], [k * 0.12, hR * 0.88, hR * 0.8], Z90); add(3, cyl(0.078, 0.078, 0.02), 0xFFB703, [0.1, 0, 1.0], [k * 0.12, hR * 0.88, hR * 0.84], Z90); add(3, sph(0.025), EYE, [0.2, 0, 0], [k * 0.12, hR * 0.88, hR * 0.86]); });
      add(3, cone(0.05, 0.1, 5), ORANGE, [0.5, 0, 0], [0, hR * 0.55, hR * 0.88], [Math.PI * 0.6, 0, 0]);
      add(4, sph(0.16), BR_D, [0.85, 0, 0], [0.05, -0.16, 0.0], [0, 0, -0.3], [0.4, 1.1, 0.75]);
      add(5, sph(0.16), BR_D, [0.85, 0, 0], [0, -0.04, 0.16], [0.9, 0, 0], [0.45, 1.1, 0.75]);
      add(5, sph(0.12), DARK, [0.35, 0.5, 0], [0, 0.0, 0.34]); add(5, cyl(0.012, 0.012, 0.1, 4), 0xD9C9A3, [0.7, 0, 0], [0, 0.14, 0.34]); add(5, sph(0.03), 0xFFB347, [0.3, 0, 2.0], [0, 0.2, 0.34]);
      tip = [0, 0.2, 0.34];
    } else {   // spark
      const SUIT = DARK, FL1 = 0xFF9F1C, FL2 = 0xFFD166, FL3 = 0xFF5E3A;
      leg(6, SUIT, C, 0.95); leg(7, SUIT, C, 0.95); [6, 7].forEach(b => add(b, box(0.03, legH * 0.8, 0.16), C, [0.6, 0, 0], [(b === 6 ? 1 : -1) * 0.07, -legH * 0.5, 0]));
      add(1, cyl(0.21, 0.2, 0.12), SUIT, [0.7, 0, 0], [0, -0.02, 0]);
      add(2, cyl(0.19, 0.23, tH), SUIT, [0.6, 0.1, 0], [0, tH / 2, 0]); add(2, box(0.4, 0.06, 0.4), C, [0.5, 0.1, 0.1], [0, tH * 0.62, 0], [0, 0, 0.35]); add(2, box(0.06, tH * 0.8, 0.02), FL1, [0.3, 0, 0.8], [0, tH * 0.5, 0.215]);
      add(9, box(0.1, 0.03, 0.55), C, [0.8, 0, 0], [0.06, 0.02, -0.25], [0.15, 0.25, 0]); add(9, box(0.08, 0.03, 0.42), CD, [0.8, 0, 0], [-0.08, 0.0, -0.2], [0.25, -0.2, 0]); add(9, cyl(0.2, 0.22, 0.09), C, [0.7, 0, 0], [0, 0.02, 0.17]);
      add(3, sph(hR), SKIN, [0.6, 0, 0], [0, hR * 0.95, 0]);
      add(3, box(hR * 1.65, 0.1, 0.2), METAL, [0.2, 0.6, 0], [0, hR * 0.95, hR * 0.72]); add(3, box(hR * 1.5, 0.045, 0.02), FL1, [0.2, 0, 1.4], [0, hR * 0.95, hR * 0.83]);
      [[0, 0.05, 0, 0.11, 0.42, FL1, -0.6], [0.1, 0.02, 0.04, 0.08, 0.3, FL2, -0.3], [-0.1, 0.02, 0.04, 0.08, 0.3, FL2, -0.3], [0.06, 0.0, -0.1, 0.09, 0.36, FL3, -0.9], [-0.06, 0.0, -0.1, 0.09, 0.36, FL3, -0.9]].forEach(([x, y, z, r, h, c, rx]) => add(8, cone(r, h, 6), c, [0.4, 0, 1.1], [x, y + h * 0.3, z - 0.12], [rx, 0, x * 2]));
      const hl = armF(4, SUIT, SKIN, 0.28, -0.05, 0.9), h = armF(5, SUIT, SKIN, 0.28, 0.05, 0.9);
      [[4, hl], [5, h]].forEach(([b, p]) => { add(b, box(0.08, 0.12, 0.24), METAL, [0.4, 0.6, 0], [p[0], 0.02, p[2] + 0.06]); add(b, box(0.05, 0.12, 0.05), FL1, [0.4, 0.2, 0.4], [p[0], -0.08, p[2] + 0.09]); add(b, cyl(0.025, 0.025, 0.12), STEEL, [0.3, 0.8, 0], [p[0], 0.05, p[2] + 0.22], Z90); });
      tip = [h[0], 0.05, h[2] + 0.3];
    }
    // 모두 크기 s 배 (발밑 기준)
    const geo = mergeParts(P, true); geo.scale(s, s, s); geo.computeBoundingSphere();
    return { geo, piv: piv.map(p => [p[0] * s, p[1] * s, p[2] * s]), par, tip: [tip[0] * s, tip[1] * s, tip[2] * s], s, D };
  }

  // ───────────────────────── 게임 ─────────────────────────
  class ArenaGame3D extends ArenaGame {
    constructor(canvas, opts) {
      // 부모(ArenaGame)는 2D 캔버스를 잡으므로, 화면 위에 겹친 HUD 캔버스를 대신 넘깁니다 (WebGL 캔버스는 3D 전용)
      const host = canvas.parentElement, hud = document.createElement('canvas');
      hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
      host.appendChild(hud);
      super(hud, opts);
      this.world3d = true; this.glCanvas = canvas; this.host = host; this.hudCanvas = hud;
      this.flip = this.team === 'r';            // 레드 팀(위쪽 진영)은 카메라를 돌려 내 진영이 아래로
      this.initThree();
      this.resize();
    }
    // 조이스틱·마우스 방향: 카메라를 돌렸으면 반대로
    setMove(x, y) { super.setMove(this.flip ? -x : x, this.flip ? -y : y); }
    setAim(dx, dy) { if (dx == null) return super.setAim(null); super.setAim(this.flip ? -dx : dx, this.flip ? -dy : dy); }
    releaseAim(dx, dy) { super.releaseAim(this.flip ? -(dx || 0) : dx, this.flip ? -(dy || 0) : dy); }

    // ── 화질 ──
    pickTier() {
      let q = 'mid', locked = false;
      if (window.ThreeQuality) { const pq = ThreeQuality.pick(this.renderer, this.opts); q = pq.q; locked = !!pq.locked; }
      else { const m = location.search.match(/[?&]q=(high|mid|low)/); if (m) { q = m[1]; locked = true; } }
      if (!locked && q !== 'low' && navigator.deviceMemory && navigator.deviceMemory <= 2) q = 'low';   // 메모리 2GB 이하 기기
      this.hq = q; this.hqLocked = locked; this.tier = Object.assign({}, TIERS[q] || TIERS.mid);
      this.steps = [];   // 실행 중 내린 단계 기록
    }
    // index.html 의 적응형 화질(0~2): 낮출 때만 받아 '한 단계 내림' 신호로 씀 (해상도 배율 자동 조절과 겹치지 않게 한 곳에서 처리)
    setQuality(q) { if (this._idxQ != null && q < this._idxQ) this.stepDown('index'); this._idxQ = q; }
    stepDown(why) {
      if (this.hqLocked || !this.renderer || this._dead) return false;
      const t = this.tier, now = performance.now(); if (this._stepAt && now - this._stepAt < 2500) return false;
      let did = null;
      if (this.renderer.shadowMap.enabled) { this.renderer.shadowMap.enabled = false; if (this.sun) this.sun.castShadow = false; this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); this.blobK = 0.34; did = 'shadow'; }
      else if (this.post && this.usePost) { this.usePost = false; this.uLin.value = 0; did = 'post'; }
      else if ((this.resK || 1) > 0.72) { this.resK = (this.resK || 1) > 0.9 ? 0.85 : 0.72; this.resize(); did = 'res' + this.resK; }
      if (did) { this._stepAt = now; this.steps.push(did + ':' + why); }
      return !!did;
    }
    watchFps(dtMs) {   // 3초 평균 초당 30프레임 밑이면 한 단계 내림 (시작 4초는 셰이더 준비라 건너뜀)
      if (this.hqLocked || dtMs > 250) return; const now = performance.now(); if (!this._born) this._born = now; if (now - this._born < 4000) return;
      this._fN = (this._fN || 0) + 1; this._fT = (this._fT || 0) + dtMs;
      if (this._fT > 3000) { const fps = this._fN * 1000 / this._fT; this._fN = 0; this._fT = 0; if (fps < 30) this.stepDown('fps' + fps.toFixed(0)); }
    }

    resize() {
      const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (W < 10 || H < 10 || this._dead) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.hudDpr = dpr;
      if (this.renderer) {
        const cap = this.tier.name === 'high' ? this.tier.pr : Math.min(this.tier.pr, this.opts.maxDpr || 1.25);
        this.renderer.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, cap) * (this.resK || 1)));
        this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%'; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
      this.vw = W; this.vh = H;
    }
    renderFrame() {
      if (this.post && this.usePost) this.post.render(this.scene, this.camera, this._tint);
      else { this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.camera); }
    }
    captureTo(g, w, h) {
      if (!this.renderer || this._dead) return;
      this.renderFrame();                 // 그린 직후 같은 순간에 복사해야 빈 화면이 아님
      g.drawImage(this.glCanvas, 0, 0, w, h);
      if (this.hudCanvas && this.hudCanvas.width) g.drawImage(this.hudCanvas, 0, 0, w, h);
    }
    destroy() { this._dead = true; try { this.freeGL(); } catch (e) {} try { this.renderer.dispose(); if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas); } catch (e) {} }
    // 판을 끝낼 때 GPU 자원(그물 · 재질 · 무늬 · 인스턴스 · 그림자 · 렌더 타깃 · 환경맵)을 돌려줌 — renderer.dispose() 보다 먼저
    freeGL() {
      const seen = this._freed || (this._freed = new Set());
      if (this.scene) this.scene.traverse(o => ArenaGame3D.freeObj(o, seen, true));
      (this._chunkSrc || []).forEach(g => { if (!seen.has(g)) { seen.add(g); g.dispose(); } });
      Object.values(this.charGeo || {}).forEach(c => { if (!seen.has(c.geo)) { seen.add(c.geo); c.geo.dispose(); } });
      (this._disp || []).forEach(d => { if (d && !seen.has(d)) { seen.add(d); try { d.dispose(); } catch (e) {} } });
      if (this.post) this.post.dispose();
      if (this.scene) { this.scene.environment = null; }
    }
    static freeObj(o, seen, all) {
      const tex = t => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } };
      if (o.geometry && !seen.has(o.geometry) && (all || !o.geometry.userData.shared)) { seen.add(o.geometry); o.geometry.dispose(); }
      [].concat(o.material || []).forEach(m => { if (!m || seen.has(m) || (!all && m.userData.shared)) return; seen.add(m); Object.keys(m).forEach(k => tex(m[k])); if (m.uniforms) Object.keys(m.uniforms).forEach(k => tex(m.uniforms[k] && m.uniforms[k].value)); m.dispose(); });
      if (o.isInstancedMesh && o.dispose) o.dispose();
      if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
    }
    // 나간 친구의 모델: 장면에서 빼면서 재질은 돌려줌 (지오메트리는 같은 캐릭터끼리 함께 씀)
    dropModel(m) { this.scene.remove(m); const seen = new Set(); m.traverse(o => ArenaGame3D.freeObj(o, seen, false)); }

    // ───────────── 장면 만들기 ─────────────
    initThree() {
      const T = THREE, t0 = performance.now();
      this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
      this.pickTier();
      const tier = this.tier, th = this.th = THEME3[this.mapId] || THEME3.mine, r = this.renderer;
      this._disp = [];
      r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = th.exposure;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pr));
      if (tier.shadow) { r.shadowMap.enabled = true; r.shadowMap.type = tier.soft ? T.PCFSoftShadowMap : T.PCFShadowMap; }
      this.scene = new T.Scene(); this.scene.background = lin(th.fog); this.scene.fog = new T.Fog(lin(th.fog), th.fogN, th.fogF);
      this.camera = new T.PerspectiveCamera(42, 1, 0.5, 400);
      // 공용 셰이더 값
      this.uLin = { value: 0 };
      const cloud = (() => { const S = 128, n = tileNoise(S, 4, 4, 77), c = mkCanvas(S, S), g = c.getContext('2d'), im = g.createImageData(S, S); for (let i = 0; i < S * S; i++) { const v = 255 * (1 - smooth(0.5, 0.72, n[i]) * 0.75); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
      const det = new T.CanvasTexture(texDetail(this.mapId)); det.wrapS = det.wrapT = T.RepeatWrapping; det.anisotropy = 4;
      this.U = { uTime: { value: 0 }, uPlayer: { value: new T.Vector3() }, uCloud: { value: cloud }, uCloudK: { value: tier.cloud ? th.cloudK : 0 }, uDetail: { value: det }, uDetS: { value: 0.42 }, uDetN: { value: this.mapId === 'ice' ? 0.5 : 0.9 } };
      this._disp.push(cloud, det);
      // 빛
      const hs = th.hemi; this.hemi = new T.HemisphereLight(lin(hs[0]), lin(hs[1]), tier.name === 'high' ? hs[2] * 0.75 : hs[2] * 1.15); this.scene.add(this.hemi);
      const sun = this.sun = new T.DirectionalLight(lin(th.sun[0]), th.sun[1]); const sd = new T.Vector3(th.sunDir[0], th.sunDir[1], th.sunDir[2]).normalize();
      this.sunOff = sd.multiplyScalar(40); sun.position.copy(this.sunOff); this.scene.add(sun); this.scene.add(sun.target);
      if (tier.shadow) { sun.castShadow = true; sun.shadow.mapSize.set(tier.shadow, tier.shadow); const c = sun.shadow.camera, hh = tier.name === 'high' ? 15 : 13; c.left = -hh; c.right = hh; c.top = hh; c.bottom = -hh; c.near = 1; c.far = 90; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; this.shHalf = hh; }
      this.blobK = tier.shadow ? 0.2 : 0.34;
      if (tier.env) this.buildEnv();
      // 만들기
      this.cells = k => { const out = []; for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.map[y][x] === k) out.push([x, y]); return out; };
      this.buildFloor(); this.buildSkirt(); this.buildWalls(); this.buildBushes(); this.buildMine(); this.buildDecor(); this.buildDynamic();
      if (tier.post) { this.post = new A3Post(r); this.usePost = !!this.post.ok; if (!this.post.ok) this.post = null; this.uLin.value = this.usePost ? 1 : 0; }
      if (tier.hdr) this.loadHdr();
      this.models = {}; this.charGeo = {}; this.camPos = null; this.tmpV = new T.Vector3(); this.tmpM = new T.Matrix4();
      this.shake = 0; this.fovKick = 0; this.gemFx = {}; this._bset = new Map(); this._gemFirst = true;
      this.buildMs = Math.round(performance.now() - t0);   // 장면 만드는 데 걸린 시간 (시험용)
    }
    // mid/high: 하늘 색으로 그린 작은 환경맵 (반사·환경광) — 한 번만 만듦
    buildEnv() {
      const T = THREE, th = this.th, es = new T.Scene(), sk = th.sky;
      // 하늘 구: 정점 색으로 그라데이션 + 해 (MeshBasic 이라 PMREM 의 RGBE 저장 형식에 맞게 자동 변환됨)
      const sg = new T.SphereGeometry(10, 32, 16), pa = sg.getAttribute('position'), cols = [], cT = lin(sk[0]), cH = lin(sk[1]), cG = lin(sk[2]), sD = new T.Vector3(th.sunDir[0], th.sunDir[1], th.sunDir[2]).normalize(), v = new T.Vector3(), c = new T.Color();
      for (let i = 0; i < pa.count; i++) { v.set(pa.getX(i), pa.getY(i), pa.getZ(i)).normalize(); const y = v.y; if (y > 0) c.copy(cH).lerp(cT, Math.pow(y, 0.6)); else c.copy(cH).lerp(cG, Math.pow(-y, 0.4)); const sn = Math.pow(Math.max(0, v.dot(sD)), 24) * 4; c.r += sn; c.g += sn * 0.9; c.b += sn * 0.7; cols.push(c.r, c.g, c.b); }
      sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      const m = new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, depthWrite: false, toneMapped: false });
      const sp = new T.Mesh(sg, m); es.add(sp);
      const pm = new T.PMREMGenerator(this.renderer); const rt = pm.fromScene(es, 0.03); pm.dispose(); sp.geometry.dispose(); m.dispose();
      this.envRT = rt; this._disp.push(rt); this.scene.environment = rt.texture;
    }
    // high: HDR 환경광을 내려받아 바꿈 (실패하면 그린 환경맵 그대로)
    loadHdr() {
      const name = this.th.hdr, go = () => { if (this._dead || !THREE.RGBELoader) return;
        new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/' + name + '.hdr', tex => {
          if (this._dead) { tex.dispose(); return; }
          try { const pm = new THREE.PMREMGenerator(this.renderer); const rt = pm.fromEquirectangular(tex); pm.dispose(); tex.dispose(); this.scene.environment = rt.texture; this._disp.push(rt); this.hdrOn = true;
            this.scene.traverse(o => [].concat(o.material || []).forEach(mm => { if (mm && mm.isMeshStandardMaterial) mm.envMapIntensity = (mm.userData.envK || 1) * 0.75; })); } catch (e) {}
        }, undefined, () => {}); };
      if (THREE.RGBELoader) return go();
      if (!ArenaGame3D._rgbe) { ArenaGame3D._rgbe = new Promise(res => { const s = document.createElement('script'); s.src = 'lib/RGBELoader.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); }); }
      ArenaGame3D._rgbe.then(go);
    }
    // 화질에 맞는 재질: high 는 모두 PBR · mid 는 반짝이는 것(거칠기 < 0.55 · 금속)만 PBR, 넓은 무광 면(바닥·벽·풀)은 램버트(정점 조명 — 빠름) · low 는 모두 램버트
    stdMat(o, key, patch) {
      const T = THREE, lo = {}; Object.keys(o).forEach(k => { if (['roughness', 'metalness', 'envMapIntensity', 'flatShading'].indexOf(k) < 0) lo[k] = o[k]; });
      const pbr = this.tier.name === 'high' || (this.tier.std && ((o.roughness != null && o.roughness < 0.55) || (o.metalness || 0) > 0.1));
      const m = pbr ? new T.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, o)) : new T.MeshLambertMaterial(lo);
      if (pbr && this.tier.name !== 'high' && o.envMapIntensity) m.envMapIntensity = o.envMapIntensity * 0.6;
      if (o.envMapIntensity) m.userData.envK = o.envMapIntensity;
      if (patch) patchMat(m, key + (pbr ? 's' : 'l'), this.U, patch);
      return m;
    }

    // ── 바닥: 칸마다 그린 한 장 + 물 웅덩이(움푹) ──
    buildFloor() {
      const T = THREE, th = this.th, F = th.floor, W = this.W, H = this.H, P = this.tier.floorPx, R = rng(this.mapId.length * 101 + W);
      const c = mkCanvas(W * P, H * P), g = c.getContext('2d'), at = (x, y) => (this.map[y] && this.map[y][x]) || '#';
      const solid = ch => ch === '#' || ch === 'G';
      g.fillStyle = F.base; g.fillRect(0, 0, c.width, c.height);
      // 큰 얼룩 (밝고 어두운 땅)
      for (let i = 0; i < W * H / 9; i++) { const x = R() * c.width, y = R() * c.height, rr = P * (1.5 + R() * 4); const gr = g.createRadialGradient(x, y, 0, x, y, rr); const col = R() < 0.5 ? F.alt : (R() < 0.6 ? F.light : F.dark); gr.addColorStop(0, col); gr.addColorStop(1, col + '00'); g.globalAlpha = 0.35; g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      g.globalAlpha = 1;
      // 가운데 길 (진영 → 광산) · 광산 둘레 닳은 땅
      const mx = this.mine[0] * P, my = this.mine[1] * P;
      g.strokeStyle = F.path; g.lineCap = 'round'; g.globalAlpha = 0.5;
      for (let k = 0; k < 3; k++) { g.lineWidth = P * (2.4 - k * 0.6); g.beginPath(); g.moveTo(mx + (R() - 0.5) * P, P * 2); for (let y = 2; y < H - 2; y += 3) g.lineTo(mx + Math.sin(y * 0.3 + k) * P * 1.2, y * P); g.stroke(); }
      g.globalAlpha = 1;
      { const gr = g.createRadialGradient(mx, my, P * 2, mx, my, P * 11); gr.addColorStop(0, F.path); gr.addColorStop(1, F.path + '00'); g.globalAlpha = 0.6; g.fillStyle = gr; g.fillRect(mx - P * 11, my - P * 11, P * 22, P * 22); g.globalAlpha = 1; }
      // 포장돌: 광산 둘레(광산·얼음) · 징검돌(정글)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (at(x, y) !== '.') continue; const d = Math.hypot(x + 0.5 - this.mine[0], y + 0.5 - this.mine[1]);
        if (F.zone && d > 3.2 && d < 7.5 && (x + y) % 1 === 0) { g.fillStyle = F.pave; g.globalAlpha = 0.55 * (1 - Math.abs(d - 5.3) / 2.3); const o = P * 0.06; g.beginPath(); g.rect(x * P + o, y * P + o, P / 2 - o * 2, P / 2 - o * 2); g.rect(x * P + P / 2 + o, y * P + o, P / 2 - o * 2, P / 2 - o * 2); g.rect(x * P + o, y * P + P / 2 + o, P - o * 2, P / 2 - o * 2); g.fill(); }
        else if (!F.zone && R() < 0.035) { g.fillStyle = F.pave; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(x * P + P / 2, y * P + P / 2, P * 0.32, P * 0.24, R() * 3, 0, Math.PI * 2); g.fill(); } }
      g.globalAlpha = 1;
      // 작은 무늬 (조약돌 · 풀 · 꽃 · 눈 결정)
      const flowers = ['#FFD166', '#FF7AA8', '#FFFFFF', '#B983FF'];
      for (let i = 0; i < W * H * 0.9; i++) { const x = R() * c.width, y = R() * c.height; if (solid(at(x / P | 0, y / P | 0))) continue; const k = R();
        if (this.mapId === 'jungle') { if (k < 0.08) { g.fillStyle = flowers[R() * 4 | 0]; g.beginPath(); g.arc(x, y, P * 0.06, 0, 7); g.fill(); } else { g.strokeStyle = R() < 0.5 ? F.dark : F.light; g.lineWidth = Math.max(1, P * 0.04); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * P * 0.2, y - P * 0.18); g.stroke(); } }
        else if (this.mapId === 'ice') { g.fillStyle = k < 0.5 ? F.light : F.dark; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(x, y, P * (0.1 + R() * 0.2), P * 0.05, R() * 3, 0, 7); g.fill(); g.globalAlpha = 1; }
        else { g.fillStyle = k < 0.6 ? F.speck : F.light; g.globalAlpha = 0.32; g.beginPath(); g.arc(x, y, P * (0.025 + R() * 0.045), 0, 7); g.fill(); g.globalAlpha = 1; if (k > 0.97) { g.strokeStyle = F.dark; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 4; s++) g.lineTo(x + (R() - 0.5) * P * 1.2, y + (R() - 0.5) * P * 1.2); g.stroke(); } } }
      // 팀 진영 (위 · 아래 6줄): 은은한 팀색 + 경계선 — 내 진영은 파랑
      const myTop = this.team === 'r', zone = (y0, col) => { const gr = g.createLinearGradient(0, y0 === 0 ? 0 : c.height, 0, y0 === 0 ? P * 7 : c.height - P * 7); gr.addColorStop(0, col + '40'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, y0 === 0 ? 0 : c.height - P * 7, c.width, P * 7);
        g.strokeStyle = col; g.globalAlpha = 0.45; g.lineWidth = P * 0.08; g.setLineDash([P * 0.5, P * 0.35]); const ly = y0 === 0 ? P * 6.5 : c.height - P * 6.5; g.beginPath(); g.moveTo(0, ly); g.lineTo(c.width, ly); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; };
      zone(0, myTop ? '#3FA9F5' : '#F24E4E'); zone(1, myTop ? '#F24E4E' : '#3FA9F5');
      // 출발점 표시
      ['r', 'b'].forEach(tm => (this.spawns[tm] || []).forEach(([x, y]) => { const mine = tm === this.team; g.strokeStyle = mine ? '#3FA9F5' : '#F24E4E'; g.globalAlpha = 0.35; g.lineWidth = P * 0.07; g.beginPath(); g.arc(x * P, y * P, P * 0.38, 0, 7); g.stroke(); g.globalAlpha = 1; }));
      // 수풀 밑 흙 · 물 바닥 · 물가
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ch = at(x, y);
        if (ch === 'b') { g.fillStyle = F.dark; g.globalAlpha = 0.45; g.beginPath(); g.ellipse(x * P + P / 2, y * P + P / 2, P * 0.75, P * 0.7, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
        if (ch === 'w') { g.fillStyle = th.waterDeep; g.fillRect(x * P - 1, y * P - 1, P + 2, P + 2); } }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === 'w') [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (at(x + dx, y + dy) === 'w') return; g.fillStyle = th.iceWater ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)'; g.fillRect(x * P + (dx > 0 ? P * 0.85 : 0), y * P + (dy > 0 ? P * 0.85 : 0), dx ? P * 0.15 : P, dy ? P * 0.15 : P); });
      // 벽 밑 그림자(접지 그림자를 미리 구움)
      g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = P * 0.7; g.fillStyle = 'rgba(40,30,20,0.9)'; g.beginPath(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(at(x, y))) g.rect(x * P + 1, y * P + 1, P - 2, P - 2); g.fill(); g.restore();
      const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = this.tier.name === 'low' ? 2 : 8; this.floorTex = tex;
      // 지오메트리: 칸 모서리마다 꼭짓점 — 물 칸 둘레는 움푹
      const pos = [], uv = [], idx = [], wAt = (x, y) => at(x, y) === 'w';
      for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) { const n = (wAt(i - 1, j - 1) ? 1 : 0) + (wAt(i, j - 1) ? 1 : 0) + (wAt(i - 1, j) ? 1 : 0) + (wAt(i, j) ? 1 : 0); const y = [0, -0.03, -0.1, -0.2, -0.34][n]; pos.push(i, y, j); uv.push(i / W, 1 - j / H); }
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const a = j * (W + 1) + i, b = a + 1, cc = a + W + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const mat = this.stdMat({ map: tex, roughness: th.rough, envMapIntensity: 0.6 }, 'floor', this.tier.std ? { detail: true, cloud: this.tier.cloud } : null);
      const floor = new T.Mesh(geo, mat); floor.receiveShadow = true; floor.userData.noCast = true; this.scene.add(floor); this.floor = floor;
      // 수면 (물 칸을 감싸는 판 하나)
      const wc = this.cells('w'); if (wc.length) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; wc.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); });
        const wg = new T.PlaneGeometry(x1 - x0 + 1, y1 - y0 + 1); wg.rotateX(-Math.PI / 2);
        const wm = th.iceWater ? this.stdMat({ color: lin(th.water), roughness: 0.12, metalness: 0.05, envMapIntensity: 1.4, transparent: true, opacity: th.waterOp }, 'ice', this.tier.std ? { water: true, u: { uWave: { value: th.wave } } } : null)
          : this.stdMat({ color: lin(th.water), roughness: 0.06, metalness: 0.1, envMapIntensity: 1.3, transparent: true, opacity: th.waterOp }, 'water', this.tier.std ? { water: true, u: { uWave: { value: th.wave } } } : null);
        const water = new T.Mesh(wg, wm); water.position.set((x0 + x1) / 2, -0.07, (y0 + y1) / 2); water.receiveShadow = !!this.tier.std; water.userData.noCast = true; this.scene.add(water); this.water = water; }
    }
    // 맵 밖 땅: 멀어질수록 솟는 언덕 (가장자리 높낮이)
    skirtH(x, z) { const W = this.W, H = this.H, dx = Math.max(0 - x, x - W, 0), dz = Math.max(0 - z, z - H, 0), d = Math.hypot(dx, dz); if (d <= 0) return -0.02;
      const n = Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.5 + Math.sin(x * 0.11 + z * 0.13) * 0.5; return smooth(1.5, 12, d) * (2.4 + n * 1.6) + Math.min(d, 1) * 0.15 - 0.02; }
    buildSkirt() {
      const T = THREE, th = this.th, M = 26, S = 2, x0 = -M, z0 = -M, nx = Math.ceil((this.W + 2 * M) / S), nz = Math.ceil((this.H + 2 * M) / S);
      const pos = [], col = [], idx = [], base = lin(cssHex(th.floor.base)), dark = lin(cssHex(th.floor.dark)), top = lin(th.top), cc = new T.Color();
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * S, z = z0 + j * S, y = this.skirtH(x, z); pos.push(x, y, z); cc.copy(base).lerp(dark, clamp(y / 3, 0, 0.6)); if (this.mapId !== 'mine') cc.lerp(top, clamp((y - 1.5) / 2, 0, 0.7)); col.push(cc.r, cc.g, cc.b); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const xa = x0 + i * S, za = z0 + j * S; if (xa >= 0 && xa + S <= this.W && za >= 0 && za + S <= this.H) continue; const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = this.stdMat({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.5 }, 'skirt', this.tier.std ? { detail: true, cloud: this.tier.cloud } : null);
      const sk = new T.Mesh(geo, m); sk.receiveShadow = true; sk.userData.noCast = true; sk.position.y = -0.005; this.scene.add(sk);
    }

    // 움직이지 않는 인스턴스를 20칸 조각으로 나눔 — three r128 의 InstancedMesh 는 화면 밖도 다 그리므로(그림자 패스 포함) 조각마다 경계 구를 줘서 안 보이는 조각은 건너뜀
    //   items: [{ m: Matrix4, c: Color?, s: 최대 배율 }] · 조각들은 같은 정점 버퍼를 함께 씀
    instChunks(geo, mat, items, cast, CS) {
      const T = THREE; CS = CS || 20; if (!items.length) return []; geo.computeBoundingSphere(); const gr = geo.boundingSphere.radius + geo.boundingSphere.center.length();
      const groups = new Map(), v = new T.Vector3(); items.forEach(it => { v.setFromMatrixPosition(it.m); const k = Math.floor(v.x / CS) + ',' + Math.floor(v.z / CS); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
      const out = []; groups.forEach(list => { const g2 = new T.BufferGeometry(); Object.keys(geo.attributes).forEach(n => g2.setAttribute(n, geo.attributes[n])); if (geo.index) g2.setIndex(geo.index);
        const im = new T.InstancedMesh(g2, mat, list.length), box = new T.Box3(); let ms = 1; if (list[0].c) im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
        list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); v.setFromMatrixPosition(it.m); box.expandByPoint(v); ms = Math.max(ms, it.s || 1); });
        const sph = new T.Sphere(); box.getBoundingSphere(sph); sph.radius += gr * ms; g2.boundingSphere = sph; im.frustumCulled = true; im.castShadow = !!(cast && this.tier.shadow); im.receiveShadow = true; this.scene.add(im); out.push(im); });
      if (!this._chunkSrc) this._chunkSrc = []; this._chunkSrc.push(geo); return out;
    }
    // ── 벽: 칸 묶음 모양으로 종류를 나눠 종류마다 인스턴스 하나 ──
    buildWalls() {
      const T = THREE, th = this.th, W = this.W, H = this.H, kindOf = WALL_KIND[this.mapId] || WALL_KIND.mine, R = rng(W * 7 + H);
      const at = (x, y) => (this.map[y] && this.map[y][x]) || '#', isW = (x, y) => at(x, y) === '#';
      const comp = new Int32Array(W * H).fill(-1), info = [];
      const mx = this.mine[0], my = this.mine[1];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!isW(x, y) || comp[y * W + x] >= 0) continue; const id = info.length, st = [[x, y]], cells = []; comp[y * W + x] = id; let border = false;
        while (st.length) { const [cx, cy] = st.pop(); cells.push([cx, cy]); if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) border = true; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || !isW(nx, ny) || comp[ny * W + nx] >= 0) return; comp[ny * W + nx] = id; st.push([nx, ny]); }); }
        let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; cells.forEach(([a, b]) => { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); });
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1, n = cells.length, nearMine = !border && bw <= 8 && bh <= 6 && Math.abs((x0 + x1 + 1) / 2 - mx) < 4 && Math.abs((y0 + y1 + 1) / 2 - my) < 3;
        info.push({ cells, kind: nearMine ? 'rim' : border ? 'border' : n <= 4 ? 'small' : (Math.min(bw, bh) === 1 || n / (bw * bh) < 0.55) ? 'thin' : 'block' }); }
      const groups = {}; info.forEach(c => { const k = c.kind === 'rim' ? 'rim' : kindOf[c.kind]; (groups[k] = groups[k] || []).push(...c.cells); });
      // 테두리 바깥 줄(맵 밖 바로 옆)도 절벽으로 둘러 가장자리를 두껍게
      const ring = []; for (let x = -1; x <= W; x++) { ring.push([x, -1]); ring.push([x, H]); } for (let y = 0; y < H; y++) { ring.push([-1, y]); ring.push([W, y]); }
      groups.cliff = (groups.cliff || []).concat(ring);
      const tri = this.tier.tri, seg = this.tier.name === 'low' ? 5 : 7, M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), E = new T.Euler(), col = new T.Color();
      const triTex = {}, getTri = k => { if (!triTex[k]) { const t = new T.CanvasTexture(texTri(k)); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; triTex[k] = t; this._disp.push(t); } return triTex[k]; };
      const mk = (cells, geo, mat, place) => { if (!cells.length) return null; const items = [];
        cells.forEach(([x, y], i) => { const o = place(x, y, i); if (!o) return; E.set(0, o.ry || 0, 0); Q.setFromEuler(E); V.set(x + 0.5, o.y || 0, y + 0.5); S.set(o.sx || 1, o.sy || 1, o.sz || 1); items.push({ m: new T.Matrix4().compose(V, Q, S), c: o.c.clone(), s: Math.max(S.x, S.y, S.z) }); });
        return this.instChunks(geo, mat, items, true); };
      const tint = (hex, v) => lin(hex).multiplyScalar(1 - v / 2 + R() * v);
      const wallPatch = (kind, top) => tri ? { tri: true, top: !!top, ao: true, cloud: this.tier.cloud, u: { uTri: { value: getTri(kind) }, uTriS: { value: 0.55 }, uTopC: { value: lin(th.top) }, uTopK: { value: top ? th.topK : 0 } } } : { top: !!top, ao: true, u: { uTopC: { value: lin(th.top) }, uTopK: { value: top ? th.topK * 0.8 : 0 } } };
      Object.keys(groups).forEach(kind => { const cells = groups[kind];
        if (kind === 'cliff') { const g = cliffBox(3); const m = this.stdMat({ color: 0xffffff, roughness: 0.95, envMapIntensity: 0.6 }, 'cliff', wallPatch('rock', true));
          mk(cells, g, m, (x, y) => { const out = x < 0 || y < 0 || x >= W || y >= H; return { sy: (out ? 1.9 : 1.45) + R() * (out ? 1.1 : 0.8), ry: (R() * 4 | 0) * Math.PI / 2, c: tint(th.cliff, 0.18) }; });
          this.wallCliff = true; }
        else if (kind === 'stone') { const g = chamferBox(1.0, 1.0, 0.06); const m = this.stdMat({ color: 0xffffff, roughness: 0.85, envMapIntensity: 0.7 }, 'stone', wallPatch('brick', true));
          mk(cells, g, m, () => ({ sy: 1.15 + R() * 0.2, c: tint(th.stone, 0.14) })); }
        else if (kind === 'crate') { const ct = new T.CanvasTexture(texCrate(th.crateMetal)); ct.encoding = T.sRGBEncoding; ct.anisotropy = 4; const g = new T.BoxGeometry(0.92, 0.92, 0.92); g.translate(0, 0.46, 0);
          const m = this.stdMat({ map: ct, roughness: th.crateMetal ? 0.45 : 0.85, metalness: th.crateMetal ? 0.6 : 0, envMapIntensity: 0.8 }, 'crate', { ao: true, cloud: this.tier.cloud && this.tier.std });
          const extra = []; mk(cells, g, m, (x, y) => { if (R() < 0.45) extra.push([x, y]); return { ry: (R() - 0.5) * 0.18, c: tint(0xffffff, 0.16) }; });
          mk(extra, g, m, () => ({ y: 0.92, sx: 0.66, sy: 0.66, sz: 0.66, ry: R() * 1.2, c: tint(0xffffff, 0.2) })); }
        else if (kind === 'palisade') { const g = palisadeGeo(seg); const m = this.stdMat({ color: 0xffffff, vertexColors: true, roughness: 0.9, envMapIntensity: 0.5 }, 'pal', wallPatch('wood', false));
          mk(cells, g, m, (x, y) => ({ ry: (isW(x - 1, y) || isW(x + 1, y)) ? 0 : Math.PI / 2, sy: 1 + R() * 0.12, c: tint(th.wood, 0.2) })); }
        else if (kind === 'crystal') { const g = crystalGeo(); const m = this.stdMat({ color: 0xffffff, vertexColors: true, roughness: 0.12, metalness: 0.05, envMapIntensity: 1.6, emissive: lin(0x2A6C8E), emissiveIntensity: 0.35 }, 'cry', { ao: true });
          mk(cells, g, m, () => ({ ry: R() * 6.28, sy: 0.95 + R() * 0.35, c: tint(th.ice, 0.12) })); }
        else if (kind === 'icewall') { const g = chamferBox(1.0, 1.0, 0.08); const m = this.stdMat({ color: 0xffffff, roughness: 0.2, metalness: 0.02, envMapIntensity: 1.3, emissive: lin(0x1D4E6A), emissiveIntensity: 0.25 }, 'icew', wallPatch('ice', true));
          mk(cells, g, m, () => ({ sy: 1.15 + R() * 0.15, c: tint(0xBFE6FA, 0.1) })); }
        else if (kind === 'rim') { const g = chamferBox(1.0, 1.0, 0.1); const m = this.stdMat({ color: 0xffffff, roughness: 0.75, envMapIntensity: 0.7 }, 'rim', wallPatch('brick', false));
          mk(cells, g, m, () => ({ sy: 0.62, c: tint(0x6A5A80, 0.12) })); }
      });
      // 절벽 위 바위 (실루엣)
      const rocks = groups.cliff.filter(() => R() < 0.22 * this.tier.decor);
      if (rocks.length) { const g = rockGeo(11, 0); const m = this.stdMat({ color: 0xffffff, roughness: 0.95, flatShading: true }, 'rockc', { top: true, u: { uTopC: { value: lin(th.top) }, uTopK: { value: this.mapId === 'mine' ? 0.3 : th.topK * 0.7 } } });
        mk(rocks, g, m, (x, y) => { const out = x < 0 || y < 0 || x >= W || y >= H; return { y: out ? 2.3 : 1.7, sx: 0.8 + R() * 0.6, sy: 0.6 + R() * 0.6, sz: 0.8 + R() * 0.6, ry: R() * 6, c: tint(th.cliff, 0.25) }; }); }
    }

    // ── 수풀: 흔들리는 풀 포기 + 밑둥 덩어리 (내가 들어가면 둘레가 점점이 비침) ──
    buildBushes() {
      const T = THREE, th = this.th, cells = this.cells('b'); if (!cells.length) return; const R = rng(cells.length * 3 + 1);
      const gt = new T.CanvasTexture(texGrass(th.bush, this.mapId === 'ice')); gt.encoding = T.sRGBEncoding; gt.anisotropy = 4;
      const gm = this.stdMat({ map: gt, alphaTest: 0.42, side: T.DoubleSide, roughness: 0.85, envMapIntensity: 0.5 }, 'grass', { wind: true, dither: true });
      const Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(), gi = [];
      cells.forEach(([x, y]) => { for (let i = 0; i < this.tier.grass; i++) { const a = (i / this.tier.grass) * 6.28 + R(), rr = this.tier.grass > 1 ? 0.22 + R() * 0.12 : 0; E.set(0, R() * 6.28, 0); Q.setFromEuler(E); V.set(x + 0.5 + Math.cos(a) * rr, 0, y + 0.5 + Math.sin(a) * rr); const sc = 0.95 + R() * 0.3; S.set(sc * 1.1, sc * (0.95 + R() * 0.2), sc * 1.1); gi.push({ m: new T.Matrix4().compose(V, Q, S), c: new T.Color(0.85 + R() * 0.3, 0.85 + R() * 0.3, 0.85 + R() * 0.2), s: 1.6 }); } });
      this.instChunks(grassClump(), gm, gi, false);
      const mm = this.stdMat({ color: 0xffffff, roughness: 0.9, flatShading: true }, 'mound', { dither: true, cloud: this.tier.cloud && this.tier.std });
      const mg = new T.IcosahedronGeometry(0.5, this.tier.name === 'high' ? 1 : 0); { const p = mg.getAttribute('position'); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), kk = 0.85 + hash3(x, y, z) * 0.3; p.setXYZ(i, x * kk, Math.max(0, y) * kk, z * kk); } mg.deleteAttribute('uv'); mg.computeVertexNormals(); }
      this.instChunks(mg, mm, cells.map(([x, y]) => { E.set(0, R() * 6, 0); Q.setFromEuler(E); V.set(x + 0.5, 0, y + 0.5); S.set(1.25, 1.1 + R() * 0.3, 1.25); return { m: new T.Matrix4().compose(V, Q, S), c: lin(th.mound).multiplyScalar(0.85 + R() * 0.3), s: 1.4 }; }), true);
    }

    // ── 가운데 광산: 구덩이 · 보라 수정 무리 · 나무 틀 · 빛 · 카운트다운 빛기둥 ──
    buildMine() {
      const T = THREE, mx = this.mine[0], mz = this.mine[1], g = this.mineG = new T.Group(); g.position.set(mx, 0, mz); this.scene.add(g); const R = rng(17), seg = this.tier.seg;
      const G = this.cells('G'); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; G.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); z0 = Math.min(z0, y); z1 = Math.max(z1, y + 1); });
      if (!G.length) { x0 = mx - 2; x1 = mx + 2; z0 = mz - 1; z1 = mz + 1; }
      const pw = x1 - x0, pd = z1 - z0;
      const pit = new T.Mesh(new T.BoxGeometry(pw, 0.3, pd), this.stdMat({ color: lin(0x2A1F3D), roughness: 0.9 }, 'pit')); pit.position.set((x0 + x1) / 2 - mx, 0.1, (z0 + z1) / 2 - mz); pit.receiveShadow = true; g.add(pit);
      // 수정 무리 (합친 한 덩어리)
      const P = []; for (let i = 0; i < 16; i++) { const x = (R() - 0.5) * (pw - 0.6), z = (R() - 0.5) * (pd - 0.4), h = 0.35 + R() * 0.6, rr = 0.07 + R() * 0.08, tx = (R() - 0.5) * 0.7, tz = (R() - 0.5) * 0.7, c = [0xB15DFF, 0x9B4DFF, 0xD49BFF, 0x7B3FE4][i % 4];
        P.push({ geo: new T.CylinderGeometry(rr * 0.8, rr, h, 6), p: [x, 0.25 + h / 2, z], r: [tx, 0, tz], c: C3(c), m: [0.15, 0.2, 0.5], flat: true }, { geo: new T.ConeGeometry(rr * 0.8, rr * 2.2, 6), p: [x + Math.sin(tz) * -h * 0.5, 0.25 + h + rr * 0.9, z + Math.sin(tx) * h * 0.5], r: [tx, 0, tz], c: C3(c), m: [0.15, 0.2, 0.6], flat: true }); }
      const cm = this.stdMat({ vertexColors: true, roughness: 0.15, metalness: 0.2, envMapIntensity: 1.5, emissive: lin(0x5A22B8), emissiveIntensity: 0.55 }, 'mcry', this.tier.std ? { mat: true } : null);
      const cg = mergeParts(P, false); const cry = new T.Mesh(cg, cm); cry.castShadow = !!this.tier.shadow; g.add(cry);
      // 가운데 큰 수정 (돌며 떠 있음)
      const big = new T.Mesh(mergeParts([{ geo: new T.CylinderGeometry(0.22, 0.26, 0.6, 6), p: [0, 0, 0], flat: true }, { geo: new T.ConeGeometry(0.22, 0.42, 6), p: [0, 0.51, 0], flat: true }, { geo: new T.ConeGeometry(0.26, 0.3, 6), p: [0, -0.45, 0], r: [Math.PI, 0, 0], flat: true }], false),
        this.stdMat({ color: lin(0xC58BFF), roughness: 0.08, metalness: 0.3, envMapIntensity: 2, emissive: lin(0x8A3FFF), emissiveIntensity: 0.9 }, 'bigcry'));
      big.position.y = 1.15; big.castShadow = !!this.tier.shadow; g.add(big); this.bigCry = big;
      // 나무 틀 (기둥 둘 + 가로대 + 등불)
      const W0 = C3(this.th.wood), FP = [];
      [-1, 1].forEach(k => { const x = k * (pw / 2 + 0.55); FP.push({ geo: new T.BoxGeometry(0.18, 1.7, 0.18), p: [x, 0.85, 0], c: W0 }, { geo: new T.BoxGeometry(0.1, 0.9, 0.1), p: [x - k * 0.25, 0.4, 0.25], r: [0, 0, k * 0.5], c: W0 }); });
      FP.push({ geo: new T.BoxGeometry(pw + 1.4, 0.16, 0.2), p: [0, 1.72, 0], c: W0 }, { geo: new T.CylinderGeometry(0.012, 0.012, 0.3, 4), p: [0.6, 1.5, 0], c: C3(0x333333) }, { geo: new T.BoxGeometry(0.16, 0.2, 0.16), p: [0.6, 1.28, 0], c: C3(0xFFD27A), m: [0.4, 0, 1.4] }, { geo: new T.CylinderGeometry(0.012, 0.012, 0.3, 4), p: [-0.6, 1.5, 0], c: C3(0x333333) }, { geo: new T.BoxGeometry(0.16, 0.2, 0.16), p: [-0.6, 1.28, 0], c: C3(0xFFD27A), m: [0.4, 0, 1.4] });
      // 광차 레일 (짧게)
      [-1, 1].forEach(k => { FP.push({ geo: new T.BoxGeometry(0.06, 0.05, 2.4), p: [k * 0.28 + pw / 2 + 1.2, 0.03, 0.4], c: C3(0x7A7F8C), m: [0.4, 0.7, 0] }); });
      for (let i = 0; i < 6; i++) FP.push({ geo: new T.BoxGeometry(0.8, 0.04, 0.12), p: [pw / 2 + 1.2, 0.015, -0.6 + i * 0.4], c: W0 });
      const fm = this.stdMat({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.5 }, 'frame', this.tier.std ? { mat: true } : null);
      const fr = new T.Mesh(mergeParts(FP, false), fm); fr.castShadow = !!this.tier.shadow; fr.receiveShadow = true; g.add(fr);
      // 빛
      if (this.tier.mineLight) { const L = new T.PointLight(lin(0xB879FF), 1.6, 8, 2); L.position.set(0, 1.4, 0); g.add(L); this.mineLight = L; }
      // 빛기둥 (카운트다운) — 위로 갈수록 옅어짐
      const bc = mkCanvas(4, 64), bg = bc.getContext('2d'), gr = bg.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); bg.fillStyle = gr; bg.fillRect(0, 0, 4, 64);
      const bt = new T.CanvasTexture(bc); const beam = new T.Mesh(new T.CylinderGeometry(1.1, 1.3, 9, 20, 1, true), new T.MeshBasicMaterial({ map: bt, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, color: 0xffffff, toneMapped: false }));
      beam.position.y = 4.5; beam.visible = false; beam.userData.noCast = true; g.add(beam); this.beam = beam;
    }

    // ── 맵 밖 장식: 나무(선인장 · 활엽수 · 전나무) · 바위 ──
    buildDecor() {
      const T = THREE, th = this.th, R = rng(99 + this.W), W = this.W, H = this.H, n = Math.round((W + H) * 2.2 * this.tier.decor), trees = [], rocks = [];
      for (let i = 0; i < n; i++) { const side = R() * (W + H) * 2; let x, z; const off = 2 + R() * 13;
        if (side < W) { x = side; z = -off; } else if (side < 2 * W) { x = side - W; z = H + off; } else if (side < 2 * W + H) { x = -off; z = side - 2 * W; } else { x = W + off; z = side - 2 * W - H; }
        (R() < 0.6 ? trees : rocks).push([x, z, 0.8 + R() * 0.7, R() * 6.28]); }
      const M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3();
      const put = (list, geo, mat, k, rot) => { if (!list.length) return; this.instChunks(geo, mat, list.map(([x, z, s, r]) => { E.set(rot ? (R() - 0.5) * 0.3 : 0, r, 0); Q.setFromEuler(E); V.set(x, this.skirtH(x, z) - 0.05, z); S.set(s * k, s * k * (rot ? 0.7 : 1), s * k); return { m: new T.Matrix4().compose(V, Q, S), c: rot ? lin(th.cliff).multiplyScalar(0.8 + R() * 0.3) : null, s: s * k }; }), true); };
      put(trees, treeGeo(th.decor, this.tier.name === 'high' ? 7 : 5), this.stdMat({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.5 }, 'tree'), th.decor === 'jungle' ? 1.5 : 1.25, false);
      put(rocks, rockGeo(21, 0), this.stdMat({ color: 0xffffff, roughness: 0.95, flatShading: true }, 'rockd', { top: true, u: { uTopC: { value: lin(th.top) }, uTopK: { value: this.mapId === 'mine' ? 0.25 : 0.8 } } }), 1.6, true);
    }

    // ── 움직이는 것들: 젬 · 탄 · 폭탄 · 입자 · 발밑 고리 · 빛 ──
    buildDynamic() {
      const T = THREE, tier = this.tier, std = tier.std;
      const atlas = new T.CanvasTexture(texAtlas()); this._disp.push(atlas);
      this.pAdd = new A3Particles(tier.parts, true, false, atlas, this.uLin); this.pAlpha = new A3Particles(Math.round(tier.parts * 0.7), false, false, atlas, this.uLin);
      this.fAdd = new A3Particles(120, true, true, atlas, this.uLin); this.fAlpha = new A3Particles(140, false, true, atlas, this.uLin);
      [this.pAdd, this.pAlpha, this.fAdd, this.fAlpha].forEach(p => { this.scene.add(p.mesh); this._disp.push(p); });
      this.gemMesh = new T.InstancedMesh(gemGeo(), this.stdMat({ color: lin(0xB15DFF), emissive: lin(0x7A2FE0), emissiveIntensity: std ? 0.6 : 0.8, roughness: 0.1, metalness: 0.35, envMapIntensity: 2.2, flatShading: true }, 'gem'), 120);
      this.gemMesh.count = 0; this.gemMesh.frustumCulled = false; this.gemMesh.castShadow = !!tier.shadow; this.scene.add(this.gemMesh);
      this.coreMesh = new T.InstancedMesh(new T.SphereGeometry(0.5, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), 360);
      this.coreMesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(360 * 3), 3); this.coreMesh.count = 0; this.coreMesh.frustumCulled = false; this.coreMesh.renderOrder = 4; this.scene.add(this.coreMesh);
      this.bombMesh = new T.InstancedMesh(bombGeo(Math.max(6, tier.seg - 2)), this.stdMat({ vertexColors: true, roughness: 0.4 }, 'bomb', std ? { mat: true } : null), 48);
      this.bombMesh.count = 0; this.bombMesh.frustumCulled = false; this.bombMesh.castShadow = !!tier.shadow; this.scene.add(this.bombMesh);
      this.ringMesh = new T.InstancedMesh(ringGeo(), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), 72);
      this.ringMesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(72 * 3), 3); this.ringMesh.count = 0; this.ringMesh.frustumCulled = false; this.ringMesh.renderOrder = 2; this.scene.add(this.ringMesh);
      this.fxLights = []; for (let i = 0; i < tier.fxLights; i++) { const L = new T.PointLight(0xffffff, 0, 7, 2); L.position.set(0, -50, 0); this.scene.add(L); this.fxLights.push({ L, t0: 0, dur: 1, int: 0 }); }
    }

    // ───────────── 캐릭터 모델 ─────────────
    charGeoFor(chId, ally) {
      const key = chId + (ally ? 'A' : 'E'); if (this.charGeo[key]) return this.charGeo[key];
      const c = buildChar(chId, ally ? 0x3FA9F5 : 0xF24E4E, ally ? 0x1C6FB5 : 0xA92430, this.tier.seg); c.geo.userData.shared = true; this.charGeo[key] = c; return c;
    }
    makeModel(chId, ally, isMe) {
      const T = THREE, cg = this.charGeoFor(chId, ally), g = new T.Group();
      const bones = cg.piv.map(() => new T.Bone()); bones.forEach((b, i) => { const p = cg.piv[i], pp = cg.par[i] >= 0 ? cg.piv[cg.par[i]] : [0, 0, 0]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); if (cg.par[i] >= 0) bones[cg.par[i]].add(b); });
      const mat = this.tier.std ? new T.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: 0.7, metalness: 0, envMapIntensity: this.tier.name === 'high' ? 0.9 : 0.55 }) : new T.MeshLambertMaterial({ vertexColors: true, skinning: true });
      const rimC = isMe ? 0x9FE0FF : ally ? 0x3FA9F5 : 0xFF4D4D;
      const uFlash = { value: 0 }, uRim = { value: lin(rimC).multiplyScalar(this.tier.std ? 0.9 : 0) };
      patchMat(mat, 'char' + (this.tier.std ? 's' : 'l'), this.U, { mat: true, rim: this.tier.std, flash: true, u: { uFlash, uRim } });
      const mesh = new T.SkinnedMesh(cg.geo, mat); mesh.add(bones[0]); bones[0].updateMatrixWorld(true); const sk = new T.Skeleton(bones); mesh.bind(sk); mesh.frustumCulled = false;
      mesh.castShadow = !!this.tier.shadow; mesh.receiveShadow = !!this.tier.std; g.add(mesh);
      if (this.tier.outline) { const om = new T.MeshBasicMaterial({ color: lin(ally ? 0x0B2C4A : 0x4A0B12), skinning: true, side: T.BackSide }); patchMat(om, 'outl', this.U, { outline: true, u: { uOutline: { value: 0.022 } } }); const ol = new T.SkinnedMesh(cg.geo, om); ol.bind(sk, mesh.bindMatrix); ol.frustumCulled = false; ol.userData.noCast = true; g.add(ol); g.userData.outline = ol; }
      g.userData = Object.assign(g.userData, { chId, ally, isMe, mesh, mat, bones, cg, uFlash, a: { phase: Math.random() * 6, spd: 0, px: null, pz: null, fireT: -1e9, ultT: -1e9, ultKind: null, hurtT: -1e9, deadT: 0, spawnT: performance.now(), lastHp: null, lastSup: 0, alpha: 1, vis: false } });
      this.scene.add(g); return g;
    }
    modelFor(id, chId, ally, isMe) {
      let m = this.models[id];
      if (m && (m.userData.chId !== chId || m.userData.ally !== ally)) { this.dropModel(m); m = null; }
      if (!m) m = this.models[id] = this.makeModel(chId, ally, isMe);
      return m;
    }
    // 모델 하나의 자세 (뼈 회전) — st: { x, y, ang, moving 속도 계산용, dash, dead, hidden, alpha, hp, sup }
    poseModel(m, st, now, dt) {
      const u = m.userData, a = u.a, B = u.bones, D = u.cg.D, s = u.cg.s, ch = AR_CHARS[u.chId] || AR_CHARS.bolt;
      // 걷는 속도
      if (a.px == null) { a.px = st.x; a.pz = st.y; }
      const v = Math.hypot(st.x - a.px, st.y - a.pz) / Math.max(1e-3, dt); a.px = st.x; a.pz = st.y; a.spd += (Math.min(v, 12) - a.spd) * Math.min(1, dt * 10);
      const walk = clamp(a.spd / (5.1 * ch.speed), 0, 1.3); a.phase += dt * (5 + 7 * Math.min(1, walk)) * Math.min(1, walk * 2);
      const sw = Math.sin(a.phase), cw = Math.cos(a.phase), wk = Math.min(1, walk);
      B.forEach(b => { b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1); }); B[1].position.z = 0;
      B[1].position.y = u.cg.piv[1][1] + Math.abs(cw) * 0.05 * s * wk + Math.sin(now / 420) * 0.008 * s;
      B[2].rotation.x = 0.16 * wk; B[2].scale.y = 1 + Math.sin(now / 420) * 0.015;
      B[6].rotation.x = sw * 0.8 * wk; B[7].rotation.x = -sw * 0.8 * wk;
      B[3].rotation.x = -0.08 * wk; B[3].rotation.y = Math.sin(now / 1300 + a.phase * 0.1) * 0.08 * (1 - wk);
      if (!D.twoHand) B[4].rotation.x = -sw * 0.65 * wk; else B[4].rotation.x = Math.sin(a.phase * 2) * 0.05 * wk;
      B[5].rotation.x = Math.sin(a.phase * 2) * 0.05 * wk;
      B[8].rotation.x = -0.25 * wk + Math.sin(now / 160) * 0.06; B[9].rotation.x = 0.35 * wk + Math.sin(now / 190 + 1) * 0.08 * (0.3 + wk);
      if (u.chId === 'spark') { const f = 1 + Math.sin(now / 45) * 0.08 + Math.sin(now / 71) * 0.06; B[8].scale.set(1, f, 1); }
      // 공격 반동
      const ft = (now - a.fireT) / 1000;
      if (ft < 0.35) { const k = Math.max(0, 1 - ft / (u.chId === 'owl' ? 0.35 : 0.2));
        if (u.chId === 'owl') { const q = ft / 0.35; B[5].rotation.x = q < 0.4 ? -2.4 * (q / 0.4) : -2.4 + (q - 0.4) / 0.6 * 2.6; B[2].rotation.x += 0.2 * Math.sin(q * Math.PI); }
        else if (u.chId === 'sprout') { B[5].rotation.x -= 0.5 * k; B[2].rotation.x += 0.1 * k; }
        else { const kick = u.chId === 'rock' ? 0.55 : u.chId === 'hawk' ? 0.45 : 0.32; B[5].rotation.x -= kick * k; if (D.twoHand) B[4].rotation.x -= kick * k * 0.8; B[2].rotation.x -= 0.14 * k; B[1].position.z = -0.05 * k; } }
      // 궁극기
      const ut = (now - a.ultT) / 1000;
      if (ut < 0.8) { const q = ut / 0.8, k = Math.sin(q * Math.PI);
        if (a.ultKind === 'heal') { m.rotation.y += q * Math.PI * 2; B[5].rotation.x = -2.2 * k; B[1].position.y += 0.12 * k * s; }
        else if (a.ultKind === 'volley') { m.rotation.y += q * Math.PI * 4; B[4].rotation.z = 1.3 * k; B[5].rotation.z = -1.3 * k; }
        else if (a.ultKind === 'blast') { B[2].rotation.x -= 0.5 * Math.max(0, 1 - q * 2); B[1].position.y += 0.18 * k * s; B[5].rotation.x -= 0.6 * Math.max(0, 1 - q * 2); }
        else if (a.ultKind === 'pierce') { B[1].position.y -= 0.1 * k * s; B[6].rotation.x = -0.9 * k; B[7].rotation.x = 0.5 * k; B[2].rotation.x -= 0.35 * Math.max(0, 1 - q * 3); } }
      if (st.dash) { B[2].rotation.x = 0.55; B[4].rotation.x = 0.9; B[5].rotation.x = D.twoHand ? -0.2 : 0.9; B[6].rotation.x = 0.9 * Math.sin(now / 50); B[7].rotation.x = -0.9 * Math.sin(now / 50); }
      // 맞음 (번쩍)
      u.uFlash.value = Math.max(0, 1 - (now - a.hurtT) / 140) * 0.9;
      if (now - a.hurtT < 160) B[2].rotation.x -= 0.18 * (1 - (now - a.hurtT) / 160);
      // 쓰러짐 / 부활
      let alpha = st.alpha, sc = 1;
      if (a.deadT) { const t = now - a.deadT; B[0].rotation.x = -Math.pow(Math.min(1, t / 380), 2) * 1.45; B[0].position.y = t > 600 ? -(t - 600) / 600 * 0.5 : 0; B[4].rotation.z = 0.8; B[5].rotation.z = -0.8; alpha *= t > 600 ? Math.max(0, 1 - (t - 600) / 600) : 1; }
      else { B[0].position.y = 0; const sp = (now - a.spawnT) / 380; if (sp < 1) sc = Math.max(0.01, easeOutBack(sp)); }
      m.scale.setScalar(sc);
      // 반투명 (수풀 속 동료 · 나)
      if (Math.abs(alpha - a.alpha) > 0.01 || (alpha < 1) !== u.mat.transparent) { a.alpha = alpha; u.mat.transparent = alpha < 0.999; u.mat.opacity = alpha; u.mat.depthWrite = alpha > 0.4; }
    }
    // 무기 끝 (월드 좌표) — 총구 섬광 · 탄 출발점
    muzzle(m) { const u = m.userData, b = u.bones[5], v = this.tmpV.set(u.cg.tip[0] - u.cg.piv[5][0], u.cg.tip[1] - u.cg.piv[5][1], u.cg.tip[2] - u.cg.piv[5][2]); b.updateMatrixWorld(true); return v.applyMatrix4(b.matrixWorld).clone(); }

    // ───────────── 효과 ─────────────
    light(x, y, z, hex, int, dur) { if (!this.fxLights.length) return; let best = this.fxLights[0]; this.fxLights.forEach(l => { if (l.int * (1 - (this._t - l.t0) / l.dur) < best.int * (1 - (this._t - best.t0) / best.dur)) best = l; });
      best.L.color.copy(lin(hex)); best.L.position.set(x, y, z); best.t0 = this._t; best.dur = dur; best.int = int; best.L.intensity = int; }
    addShake(a) { this.shake = Math.min(0.6, Math.max(this.shake, a)); }
    sparks(x, y, z, n, hex, spd, life) { const c = hexRgb(hex); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.2, v = spd * (0.4 + Math.random() * 0.8); this.pAdd.add({ x, y, z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + 1, vz: Math.sin(a) * Math.cos(e) * v, g: 9, drag: 2, life: (life || 0.4) * (0.6 + Math.random() * 0.6), s0: 0.14, s1: 0.02, w: 3.2, c, tex: 2, st: true }); } }
    puff(x, y, z, n, hex, size, life, rise) { const c = hexRgb(hex); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = Math.random() * 1.2; this.pAlpha.add({ x: x + Math.cos(a) * 0.2, y, z: z + Math.sin(a) * 0.2, vx: Math.cos(a) * v, vy: (rise || 0.8) + Math.random() * 0.6, vz: Math.sin(a) * v, drag: 2.5, life: (life || 0.9) * (0.7 + Math.random() * 0.6), s0: size * 0.5, s1: size * 1.6, c, a0: 0.55, a1: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2, tex: 1, ease: 1 }); } }
    wave(x, z, hex, r, life, a0) { this.fAdd.add({ x, y: 0.05, z, life: life || 0.5, s0: 0.3, s1: r * 2, c: hexRgb(hex), a0: a0 == null ? 0.9 : a0, a1: 0, tex: 5, ease: 1 }); }
    explosion(x, z, r, hex, big) {
      const now = this._t, n = big ? 1.5 : 1;
      for (let i = 0; i < 12 * n; i++) { const a = Math.random() * 6.28, v = 1 + Math.random() * 3 * r; this.pAdd.add({ x, y: 0.4, z, vx: Math.cos(a) * v, vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * v, drag: 4, life: 0.35 + Math.random() * 0.3, s0: 0.5 * r + 0.3, s1: 0.1, c: i % 3 ? hex : 0xFFF1C1, a0: 1, tex: 0 }); }
      this.puff(x, 0.4, z, Math.round(7 * n), 0x5A5048, 0.9 * r + 0.4, 1.2, 1.4);
      for (let i = 0; i < 6 * n; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 3; this.pAlpha.add({ x, y: 0.4, z, vx: Math.cos(a) * v, vy: 2 + Math.random() * 3, vz: Math.sin(a) * v, g: 14, life: 0.9, s0: 0.1, s1: 0.08, c: 0x3B3127, a0: 1, a1: 0.6, rot: Math.random() * 6, vr: 10, tex: 7 }); }
      this.sparks(x, 0.4, z, Math.round(10 * n), 0xFFD166, 6, 0.45);
      this.wave(x, z, hex, r * 1.4, 0.45); this.fAlpha.add({ x, y: 0.035, z, life: 4, s0: r * 1.8, s1: r * 1.6, c: 0x1A120C, a0: 0.45, a1: 0, tex: 0 });
      this.light(x, 1.2, z, hex, big ? 4 : 2.6, 0.35);
      const d = Math.hypot(x - this.x, z - this.y); if (d < 9) this.addShake((big ? 0.32 : 0.2) * (1 - d / 9));
    }

    // 총 · 궁극기 · 쓰러짐 · 맞음: 부모 동작은 그대로, 그림 효과만 덧붙임
    fire() {
      const before = this.ammo; super.fire();
      if (this.ammo < before && this.renderer && this.models.__me) { const m = this.models.__me, a = m.userData.a; a.fireT = performance.now();
        const p = this.muzzle(m), c = SHOT_COL[this.charId] || 0xFFE066;
        this.pAdd.add({ x: p.x, y: p.y, z: p.z, life: 0.08, s0: 0.55, s1: 0.2, c: 0xFFF6D8, tex: 3, rot: Math.random() * 3 }); this.pAdd.add({ x: p.x, y: p.y, z: p.z, life: 0.12, s0: 0.7, s1: 0.3, c, a0: 0.8, tex: 0 });
        this.light(p.x, p.y + 0.2, p.z, c, 1.6, 0.09); this.puff(p.x, p.y, p.z, 2, 0xCFCFCF, 0.25, 0.4, 0.4);
        if (this.charId === 'rock') this.addShake(0.06); }
    }
    useSuper() {
      const was = this.super; super.useSuper();
      if (was >= 100 && this.super < 100 && this.renderer && this.models.__me) { const m = this.models.__me, a = m.userData.a; a.ultT = performance.now(); a.ultKind = this.ch.sup.kind; this.ultFx(this.x, this.y, this.ch.sup.kind, true); }
    }
    ultFx(x, z, kind, mine) {
      const c = kind === 'heal' ? 0x7DF58F : kind === 'pierce' ? 0x8EF6FF : kind === 'dash' ? 0xFFD166 : 0xFFB347;
      this.wave(x, z, c, kind === 'heal' ? 4 : 1.6, kind === 'heal' ? 0.9 : 0.5); this.light(x, 1.2, z, c, 3, 0.5);
      for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; this.pAdd.add({ x: x + Math.cos(a) * 0.5, y: 0.2, z: z + Math.sin(a) * 0.5, vx: Math.cos(a) * 1.2, vy: 2 + Math.random() * 2, vz: Math.sin(a) * 1.2, drag: 1.5, life: 0.8, s0: 0.22, s1: 0.04, c, tex: 3, rot: Math.random() * 3 }); }
      if (kind === 'heal') for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, r = Math.random() * 4; this.pAdd.add({ x: x + Math.cos(a) * r, y: 0.1, z: z + Math.sin(a) * r, vy: 1.5 + Math.random(), life: 1, s0: 0.2, s1: 0.05, c: 0x9BFF7A, tex: 3 }); }
      if (mine) { this.addShake(0.16); this.fovKick = kind === 'dash' ? 6 : 3; }
    }
    onEvent(e) {
      const wasDead = this.isDead, hp0 = this.hp; super.onEvent(e);
      if (!e || !this.renderer) return;
      if (e.type === 'hit' && e.target === this.myId && this.hp < hp0) { const m = this.models.__me; if (m) m.userData.a.hurtT = performance.now(); this.addShake(this.isDead && !wasDead ? 0.4 : 0.14); this.sparks(this.x, 0.7, this.y, 6, 0xFF5C7A, 3, 0.3);
        const pm = e.by && this.models[e.by]; if (pm) pm.userData.a.fireT = performance.now(); }
      if (e.type === 'heal' && e.target === this.myId) for (let i = 0; i < 10; i++) this.pAdd.add({ x: this.x + (Math.random() - 0.5), y: 0.3, z: this.y + (Math.random() - 0.5), vy: 1.6, life: 0.8, s0: 0.2, s1: 0.05, c: 0x9BFF7A, tex: 3 });
    }
    burst(x, y, n, c) { super.burst(x, y, n, c); if (!this.pAdd) return; const hex = cssHex(c || '#ffffff'); if (n >= 18) return;   // 큰 폭발은 탄 사라짐에서 따로 그림
      if (hex === 0xB15DFF) { for (let i = 0; i < 10; i++) this.pAdd.add({ x, y: 0.5, z: y, vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, g: 4, drag: 2, life: 0.6, s0: 0.22, s1: 0.03, c: [0.85, 0.6, 1], tex: 3, rot: Math.random() * 3 }); this.wave(x, y, 0xC08BFF, 0.7, 0.35); }
      else this.sparks(x, 0.6, y, Math.min(10, n), hex, 3.5, 0.3); }

    // ───────────── 매 프레임 그리기 ─────────────
    draw() {
      if (this._dead) return;                                          // 끝낸 판(destroy 뒤): 대기 화면 크기 맞추기 등이 부르는 draw() 가 지운 장면을 같은 WebGL 에 다시 올리지 않게
      if (!this.renderer) return super.draw();
      const T = THREE, now = this.now || performance.now(), tnow = performance.now(), dtMs = this._lastDraw ? tnow - this._lastDraw : 16.7, dt = clamp(dtMs / 1000, 0, 0.1); this._lastDraw = tnow; this._t = tnow;
      this.watchFps(dtMs);
      this.U.uTime.value = tnow / 1000 % 1000; this.U.uPlayer.value.set(this.x, this.y, this.hidden && !this.isDead ? 1 : 0);
      // ── 캐릭터 ──
      const seen = {}, rings = [], blobs = [], held = [];
      const put = (id, p, isMe) => {
        const ally = isMe || p.team === this.team, chId = p.ch || 'bolt', m = this.modelFor(id, chId, ally, isMe), u = m.userData, a = u.a; seen[id] = 1;
        const dead = isMe ? this.isDead : !!p.dead, hiddenFar = !isMe && p.hidden && !ally && Math.hypot(p.x - this.x, p.y - this.y) > 2.2;
        // 상태 변화 → 동작·효과
        if (dead && !a.deadT && a.vis && !hiddenFar) { a.deadT = tnow; this.puff(p.x, 0.3, p.y, 6, 0xBFB6A8, 0.6, 1, 0.6); this.sparks(p.x, 0.7, p.y, 10, ally ? 0x3FA9F5 : 0xF24E4E, 4, 0.5); this.wave(p.x, p.y, ally ? 0x3FA9F5 : 0xF24E4E, 1.2, 0.5); if (isMe) this.addShake(0.35); }
        if (!dead && a.deadT) { a.deadT = 0; a.spawnT = tnow; for (let i = 0; i < 16; i++) this.pAdd.add({ x: p.x + (Math.random() - 0.5) * 0.6, y: Math.random() * 0.4, z: p.y + (Math.random() - 0.5) * 0.6, vy: 3 + Math.random() * 3, life: 0.7, s0: 0.3, s1: 0.05, c: ally ? 0x8FD6FF : 0xFF9A9A, tex: 0 }); this.wave(p.x, p.y, ally ? 0x8FD6FF : 0xFF9A9A, 1, 0.5); }
        if (dead && !a.deadT) { m.visible = false; a.vis = false; return; }
        if (!isMe) { if (p.hp != null && a.lastHp != null && p.hp < a.lastHp - 0.5 && !dead) { a.hurtT = tnow; if (!hiddenFar) this.sparks(p.x, 0.7, p.y, 5, 0xFFD166, 3, 0.25); } a.lastHp = p.hp;
          if ((p.sup || 0) < 50 && a.lastSup >= 100 && !dead) { a.ultT = tnow; a.ultKind = (AR_CHARS[chId] || AR_CHARS.bolt).sup.kind; if (!hiddenFar) this.ultFx(p.x, p.y, a.ultKind, false); } a.lastSup = p.sup || 0; }
        const deathAnim = a.deadT && tnow - a.deadT < 1250;
        const visible = (!dead && !hiddenFar) || (deathAnim && a.vis !== false);
        m.visible = visible; if (!visible) { a.vis = false; a.px = null; return; }
        a.vis = true;
        m.position.set(p.x, 0, p.y); m.rotation.y = Math.PI / 2 - (isMe ? this.angle : (p.angle || 0));
        const alpha = isMe ? (this.hidden ? 0.6 : 1) : (p.hidden ? 0.55 : 1);
        const dash = isMe ? now < this.dashUntil : !!p.dash;
        this.poseModel(m, { x: p.x, y: p.y, dash, alpha }, tnow, dt);
        if (dash && Math.random() < 0.7) this.pAdd.add({ x: p.x, y: 0.5, z: p.y, life: 0.3, s0: 0.8, s1: 0.2, c: ally ? 0x8FD6FF : 0xFF9A9A, a0: 0.5, tex: 0 });
        if (deathAnim && dead) return;
        // 걸을 때 발밑 먼지 · 수풀 잎
        if (a.spd > 2 && Math.random() < dt * 6) { if (this.cell(p.x, p.y) === 'b') this.pAlpha.add({ x: p.x, y: 0.6, z: p.y, vx: (Math.random() - 0.5) * 2, vy: 1, vz: (Math.random() - 0.5) * 2, g: 2, drag: 1.5, life: 1, s0: 0.14, s1: 0.1, c: cssHex(this.th.bush[1]), a0: 1, a1: 0, rot: Math.random() * 6, vr: 4, tex: 4 }); else if (this.tier.name !== 'low') this.puff(p.x, 0.05, p.y, 1, cssHex(this.th.floor.light), 0.25, 0.5, 0.3); }
        const sup = isMe ? this.super : (p.sup || 0);
        rings.push([p.x, p.y, isMe ? this.angle : (p.angle || 0), isMe ? 0xFFFFFF : ally ? 0x3FA9F5 : 0xF24E4E, sup >= 100, alpha]);
        blobs.push([p.x, p.y, u.cg.s]);
        const gn = isMe ? this.held : (p.gems || 0); if (gn > 0) held.push([p.x, p.y, Math.min(gn, 10), u.cg.s, ally]);
      };
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; put(id, p, false); });
      put('__me', { x: this.x, y: this.y, ch: this.charId, team: this.team }, true);
      Object.keys(this.models).forEach(id => { if (!seen[id]) { this.dropModel(this.models[id]); delete this.models[id]; } });
      // 발밑 고리 · 궁극기 준비 빛 · 그림자
      const RM = this.ringMesh, M = this.tmpM, Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1), col = new T.Color(); let nr = 0;
      rings.forEach(([x, z, ang, hex, ready, al]) => { if (nr >= 72) return; E.set(0, Math.PI / 2 - ang, 0); Q.setFromEuler(E); V.set(x, 0.03, z); M.compose(V, Q, S); RM.setMatrixAt(nr, M); col.copy(lin(hex)).multiplyScalar(al < 1 ? 0.7 : 1); RM.setColorAt(nr, col); nr++;
        if (ready) { const pulse = 0.6 + Math.sin(tnow / 140) * 0.3; (this._puts = this._puts || []).push(() => { this.fAdd.put(x, 0.04, z, 1.5 + pulse * 0.2, 1, [1, 0.82, 0.4], 0.55 * pulse, 5); this.fAdd.put(x, 0.04, z, 1.6, 1, [1, 0.7, 0.3], 0.35 * pulse, 0); }); } });
      RM.count = nr; RM.instanceMatrix.needsUpdate = true; if (RM.instanceColor) RM.instanceColor.needsUpdate = true;
      (this._puts = this._puts || []).push(() => blobs.forEach(([x, z, s]) => this.fAlpha.put(x, 0.025, z, 1.15 * s, 1, [0, 0, 0], this.blobK, 0)));
      // ── 젬 (솟아오름 · 떨어짐 · 주우면 빨려 감) ──
      this.drawGems(tnow, dt, held);
      // ── 탄 · 폭탄 · 탄이 사라진 자리 효과 ──
      this.drawBullets(tnow, dt);
      // ── 광산 · 카운트다운 ──
      this.drawMine(tnow, dt);
      // ── 분위기 입자 ──
      this.ambient(dt);
      // 빛 줄이기
      this.fxLights.forEach(l => { const k = 1 - (tnow - l.t0) / (l.dur * 1000); l.L.intensity = k > 0 ? l.int * k : 0; if (k <= 0) l.L.position.y = -50; });
      [this.pAdd, this.pAlpha, this.fAdd, this.fAlpha].forEach(p => { if (p._stepped !== tnow) { p.step(dt); p._stepped = tnow; } });
      this.flushParticles(tnow);
      // ── 카메라: 비스듬히 내려다봄 (내 진영이 아래). 화면에 가로 약 11칸(세로 폰)~20칸(가로 태블릿) ──
      const aspect = (this.vw || 800) / (this.vh || 600), wantW = aspect < 1 ? 8.5 : Math.min(20, 11 * aspect * 0.9);
      this.fovKick *= Math.exp(-dt * 5); const fov = 42 + this.fovKick; if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
      const fovR = 42 * Math.PI / 180, dist = wantW / (2 * Math.tan(fovR / 2) * aspect);
      const dir = this._dir || (this._dir = new T.Vector3()); dir.set(0, 1.35, this.flip ? -1 : 1).normalize();
      const target = this._tgt || (this._tgt = new T.Vector3()); target.set(this.x, 0, this.y + (this.flip ? 1.2 : -1.2));
      const want = target.clone().addScaledVector(dir, dist);
      if (!this.camPos || this.camPos.distanceTo(want) > 12) this.camPos = want.clone(); else this.camPos.lerp(want, 1 - Math.exp(-dt * 11.5));
      this.shake *= Math.exp(-dt * 7); const sh = this.shake * this.shake * 1.6, st = tnow / 1000;
      this.camera.position.copy(this.camPos); this.camera.position.x += (Math.sin(st * 37) + Math.sin(st * 23.7)) * 0.5 * sh; this.camera.position.z += (Math.cos(st * 31) + Math.sin(st * 19.3)) * 0.5 * sh; this.camera.position.y += Math.sin(st * 29) * 0.3 * sh;
      this.camera.lookAt(this.camPos.x - dir.x * dist, this.camPos.y - dir.y * dist, this.camPos.z - dir.z * dist);
      // 그림자 범위가 카메라가 보는 곳을 따라옴 (그림자 칸에 맞춰 떨림 없게)
      if (this.renderer.shadowMap.enabled && this.sun.castShadow) { const cx = this.camPos.x - dir.x * dist, cz = this.camPos.z - dir.z * dist + (this.flip ? -1.5 : 1.5), step = this.shHalf * 2 / this.tier.shadow; const sx = Math.round(cx / step) * step, sz = Math.round(cz / step) * step;
        this.sun.position.set(sx + this.sunOff.x, this.sunOff.y, sz + this.sunOff.z); this.sun.target.position.set(sx, 0, sz); this.sun.target.updateMatrixWorld(); }
      // 카운트다운 · 맞음 화면 테두리 색 (high 후처리)
      this._tint = this._tintV || (this._tintV = new T.Vector4()); this._tint.set(0, 0, 0, 0);
      if (this.countTeam && !this.gameOver) { const mineT = this.countTeam === this.team, left = (this.countUntil - now) / 1000, pulse = 0.5 + 0.5 * Math.sin(tnow / (left < 5 ? 90 : 180)); const c = lin(mineT ? 0x3FA9F5 : 0xF24E4E); this._tint.set(c.r, c.g, c.b, 0.25 * pulse * (left < 5 ? 1.6 : 1)); }
      if (this.hurt > 0.01) { this._tint.set(0.9, 0.05, 0.1, Math.max(this._tint.w, this.hurt * 0.6)); }
      this.renderFrame();
      // ── HUD (부모 draw 가 월드는 건너뛰고 HUD 만 그림) ──
      const ctx = this.ctx; ctx.setTransform(this.hudDpr || 1, 0, 0, this.hudDpr || 1, 0, 0);
      super.draw();
    }
    flushParticles(tnow) { const q = this._puts || []; this._puts = []; [this.pAdd, this.pAlpha, this.fAdd, this.fAlpha].forEach(p => { p.n = 0; }); q.forEach(f => f()); [this.pAdd, this.pAlpha, this.fAdd, this.fAlpha].forEach(p => p.flush()); }

    drawGems(tnow, dt, held) {
      const T = THREE, GM = this.gemMesh, M = this.tmpM, Q = this._q || (this._q = new T.Quaternion()), E = this._e || (this._e = new T.Euler()), V = this._v3 || (this._v3 = new T.Vector3()), S = this._s3 || (this._s3 = new T.Vector3()); let n = 0;
      const mx = this.mine[0], mz = this.mine[1], fx = this.gemFx, glow = [];
      const place = (x, y, z, s, rot) => { if (n >= 120) return; E.set(0.15, rot, 0); Q.setFromEuler(E); V.set(x, y, z); S.set(s, s, s); M.compose(V, Q, S); GM.setMatrixAt(n++, M); };
      const ids = Object.keys(this.gems);
      ids.forEach(id => { const gm = this.gems[id]; if (!gm) return; let f = fx[id];
        if (!f) { f = fx[id] = { t0: this._gemFirst ? -1e9 : tnow, kind: String(id).charAt(0) === 'd' ? 'drop' : 'rise', gone: 0 }; }
        if (gm.by && !f.gone) { f.gone = tnow; f.by = gm.by; f.gx = gm.x; f.gy = gm.y; this.wave(gm.x, gm.y, 0xC08BFF, 0.6, 0.3); for (let i = 0; i < 8; i++) this.pAdd.add({ x: gm.x, y: 0.5, z: gm.y, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, drag: 3, life: 0.5, s0: 0.2, s1: 0.02, c: [0.85, 0.6, 1], tex: 3 }); }
        f.seen = tnow;
        if (f.gone) { const t = (tnow - f.gone) / 260; if (t >= 1) return; const tgt = f.by === this.myId ? { x: this.x, y: this.y } : (this.peers[f.by] || { x: f.gx, y: f.gy }); const x = f.gx + (tgt.x - f.gx) * t * t, z = f.gy + (tgt.y - f.gy) * t * t; place(x, 0.5 + t * 1.2, z, 1 - t * 0.7, tnow / 120); return; }
        const t = (tnow - f.t0) / 800; let x = gm.x, z = gm.y, y = 0.48 + Math.sin(tnow / 260 + gm.x) * 0.07, s = 1;
        if (t < 1 && f.kind === 'rise') { const e = 1 - Math.pow(1 - t, 2); x = mx + (gm.x - mx) * e; z = mz + (gm.y - mz) * e; y = 1.2 + Math.sin(t * Math.PI) * 2.2 + (0.48 - 1.2) * t; s = 0.5 + 0.5 * t;
          if (Math.random() < 0.6) this.pAdd.add({ x, y, z, life: 0.4, s0: 0.25, s1: 0.02, c: [0.8, 0.55, 1], tex: 3 }); if (!f.landed && t > 0.92) { f.landed = 1; this.wave(gm.x, gm.y, 0xC08BFF, 0.7, 0.4); } }
        else if (t < 1 && f.kind === 'drop') { y = 0.48 + Math.abs(Math.sin(t * Math.PI * 2.5)) * (1 - t) * 0.9; }
        place(x, y, z, s, tnow / 520 + gm.x * 3); glow.push([x, y, z]);
        if (Math.random() < dt * 1.2) this.pAdd.add({ x: x + (Math.random() - 0.5) * 0.3, y: y + Math.random() * 0.3, z: z + (Math.random() - 0.5) * 0.3, life: 0.35, s0: 0.28, s1: 0, c: [1, 0.95, 1], tex: 3, rot: Math.random() * 3 }); });
      Object.keys(fx).forEach(id => { if (fx[id].seen !== tnow) { const f = fx[id]; if (!f.gone && this.gems[id] === undefined && f.t0 > 0) { /* 사라짐 */ } delete fx[id]; } });
      this._gemFirst = false;
      // 들고 있는 젬: 머리 위에 빙글
      held.forEach(([x, z, k, s, ally]) => { const hgt = 1.55 * s + 0.35, r = 0.18 + k * 0.025; for (let i = 0; i < k; i++) { const a = tnow / 700 + i / k * 6.28; place(x + Math.cos(a) * r, hgt + Math.sin(tnow / 300 + i) * 0.04, z + Math.sin(a) * r, 0.42, tnow / 300 + i); } glow.push([x, hgt, z, 0.6 + k * 0.05]); });
      GM.count = n; GM.instanceMatrix.needsUpdate = true;
      (this._puts = this._puts || []).push(() => glow.forEach(([x, y, z, k]) => { this.pAdd.put(x, y, z, (k || 1) * 1.1, 1, [0.7, 0.4, 1], 0.4, 0); this.fAdd.put(x, 0.04, z, (k || 1) * 1.2, 1, [0.6, 0.3, 1], 0.35, 0); }));
    }
    drawBullets(tnow, dt) {
      const T = THREE, CM = this.coreMesh, BM = this.bombMesh, M = this.tmpM, Q = this._q, E = this._e, V = this._v3, S = this._s3, col = this._col || (this._col = new T.Color()); let nc = 0, nb = 0;
      const shot = SHOT_COL[this.charId] || 0xFFE066, cur = new Set();
      const core = (x, y, z, vx, vz, w, len, hex, k) => { if (nc >= 360) return; const ang = Math.atan2(vx, vz); E.set(0, ang, 0); Q.setFromEuler(E); V.set(x, y, z); S.set(w, w, len); M.compose(V, Q, S); CM.setMatrixAt(nc, M); col.copy(lin(hex)).multiplyScalar(k); CM.setColorAt(nc, col); nc++; };
      const marks = [];
      this.bullets.forEach(b => { cur.add(b); let rec = this._bset.get(b); if (!rec) { rec = { t0: tnow }; this._bset.set(b, rec); }
        rec.x = b.x; rec.y = b.y; rec.lob = b.lob; rec.big = b.big; rec.life = b.life; rec.pierce = b.pierce; rec.vx = b.vx; rec.vy = b.vy; rec.radius = b.radius;
        if (b.lob) { const q = 1 - b.life / b.t0, h = 0.6 + Math.sin(q * Math.PI) * 1.8; if (nb < 48) { E.set(tnow / 150, tnow / 200, 0); Q.setFromEuler(E); V.set(b.x, h, b.y); S.set(1, 1, 1); M.compose(V, Q, S); BM.setMatrixAt(nb++, M); }
          if (Math.random() < 0.7) this.pAdd.add({ x: b.x, y: h + 0.3, z: b.y, vy: 0.5, life: 0.25, s0: 0.18, s1: 0.02, c: 0xFFB347, tex: 0 });
          marks.push([b.x + b.vx * b.life, b.y + b.vy * b.life, b.radius || 1]); (this._puts = this._puts || []).push(() => this.fAlpha.put(b.x, 0.03, b.y, 0.45 + (1 - Math.sin(q * Math.PI)) * 0.2, 1, [0, 0, 0], 0.3, 0)); return; }
        const sp = Math.hypot(b.vx, b.vy) || 0.3, h = 0.62;
        if (b.big && b.pierce) { core(b.x, h, b.y, b.vx, b.vy, 0.22, 2.4, 0x8EF6FF, 1); core(b.x, h, b.y, b.vx, b.vy, 0.55, 3.4, 0x2FB8FF, 0.45); if (Math.random() < 0.8) this.pAdd.add({ x: b.x, y: h, z: b.y, life: 0.3, s0: 0.4, s1: 0.05, c: 0x8EF6FF, tex: 0 }); }
        else if (b.big) { const pul = 1 + Math.sin(tnow / 40) * 0.12; core(b.x, h + 0.1, b.y, b.vx, b.vy, 0.62 * pul, 0.72 * pul, 0xFFB347, 1); core(b.x, h + 0.1, b.y, b.vx, b.vy, 1.1, 1.3, 0xFF6B1A, 0.4);
          for (let i = 0; i < 2; i++) this.pAdd.add({ x: b.x + (Math.random() - 0.5) * 0.4, y: h + 0.1 + (Math.random() - 0.5) * 0.4, z: b.y + (Math.random() - 0.5) * 0.4, vy: 0.4, life: 0.35, s0: 0.45, s1: 0.05, c: i ? 0xFFD166 : 0xFF6B1A, tex: 0 }); }
        else { const len = this.charId === 'hawk' ? 1.4 : 0.32 + sp * 1.2, w = this.charId === 'rock' ? 0.13 : this.charId === 'hawk' ? 0.1 : 0.16; core(b.x, h, b.y, b.vx, b.vy, w, len, shot, 0.9); core(b.x - b.vx * 0.6, h, b.y - b.vy * 0.6, b.vx, b.vy, w * 2.2, len * 1.7, shot, 0.16); }
        if (this.fxLights.length && b.big && !rec.lit) { rec.lit = 1; } });
      // 사라진 탄 → 터짐 · 벽 맞음 · 명중
      this._bset.forEach((r, b) => { if (cur.has(b)) return; this._bset.delete(b);
        if (r.lob) this.explosion(r.x, r.y, r.radius || 1, 0xFF9F43, false);
        else if (r.big && !r.pierce) this.explosion(r.x, r.y, 1.2, 0xFFB347, true);
        else if (r.life > 1.5) { const nx = r.x + r.vx, ny = r.y + r.vy; if (this.wall(nx, ny)) { this.sparks(r.x, 0.62, r.y, 5, 0xFFE9B0, 3, 0.25); this.puff(r.x, 0.6, r.y, 2, cssHex(this.th.floor.light), 0.3, 0.5, 0.3); } else { this.sparks(r.x, 0.65, r.y, 7, SHOT_COL[this.charId] || 0xFFD166, 4, 0.3); this.pAdd.add({ x: r.x, y: 0.65, z: r.y, life: 0.12, s0: 0.7, s1: 0.2, c: 0xFFFFFF, tex: 3 }); this.light(r.x, 0.9, r.y, SHOT_COL[this.charId] || 0xFFD166, 1.2, 0.1); } } });
      // 폭탄 떨어질 자리 표시
      (this._puts = this._puts || []).push(() => marks.forEach(([x, z, r]) => { const p = 0.7 + Math.sin(tnow / 80) * 0.3; this.fAdd.put(x, 0.04, z, r * 2, 1, [1, 0.45, 0.2], 0.55 * p, 5); }));
      // 내 큰 탄은 빛을 끌고 다님
      if (this.fxLights.length) this.bullets.forEach(b => { if (b.big && !b.lob) { const l = this.fxLights[this.fxLights.length - 1]; l.L.position.set(b.x, 0.9, b.y); l.L.color.copy(lin(b.pierce ? 0x8EF6FF : 0xFFB347)); l.t0 = tnow; l.dur = 0.15; l.int = 2.4; } });
      CM.count = nc; CM.instanceMatrix.needsUpdate = true; if (CM.instanceColor) CM.instanceColor.needsUpdate = true; BM.count = nb; BM.instanceMatrix.needsUpdate = true;
    }
    drawMine(tnow, dt) {
      const mx = this.mine[0], mz = this.mine[1], big = this.bigCry;
      if (big) { big.rotation.y = tnow / 900; big.position.y = 1.15 + Math.sin(tnow / 500) * 0.1; }
      const lead = this.countTeam && !this.gameOver ? this.countTeam : null, left = lead ? Math.max(0, (this.countUntil - (this.now || tnow)) / 1000) : 0;
      const tc = lead ? (lead === this.team ? 0x3FA9F5 : 0xF24E4E) : 0xB15DFF;
      if (this.mineLight) { this.mineLight.color.copy(lin(tc)); this.mineLight.intensity = (lead ? 2.4 : 1.4) + Math.sin(tnow / (lead && left < 5 ? 90 : 300)) * 0.4; }
      if (big && big.material.emissive) big.material.emissive.copy(lin(lead ? tc : 0x8A3FFF));
      (this._puts = this._puts || []).push(() => { const p = 0.75 + Math.sin(tnow / 400) * 0.25, c = hexRgb(tc); this.fAdd.put(mx, 0.04, mz, 6.5, 1, c, 0.32 * p, 0); this.pAdd.put(mx, 1.2, mz, 2.2, 1, c, 0.35 * p, 0); });
      if (Math.random() < dt * 3) this.pAdd.add({ x: mx + (Math.random() - 0.5) * 3, y: 0.4, z: mz + (Math.random() - 0.5) * 1.6, vy: 0.8 + Math.random(), life: 1.4, s0: 0.12, s1: 0, c: [0.8, 0.55, 1], tex: 3, rot: Math.random() * 3 });
      // 카운트다운: 빛기둥 + 매초 퍼지는 고리
      const beam = this.beam; beam.visible = !!lead;
      if (lead) { beam.material.color.copy(lin(tc)).multiplyScalar(0.55 + Math.sin(tnow / (left < 5 ? 80 : 200)) * 0.25); beam.rotation.y = tnow / 1000; const sec = Math.ceil(left);
        if (sec !== this._lastSec) { this._lastSec = sec; this.wave(mx, mz, tc, left < 5 ? 9 : 6, 1.1, 0.8); if (left < 5) this.addShake(0.05); } }
      else this._lastSec = null;
      if (this.gameOver && !this._confetti) { this._confetti = true; const win = this.winner === this.team; for (let i = 0; i < 80; i++) { const a = Math.random() * 6.28, v = 2 + Math.random() * 4; this.pAlpha.add({ x: this.x, y: 1.5, z: this.y, vx: Math.cos(a) * v, vy: 4 + Math.random() * 5, vz: Math.sin(a) * v, g: 6, drag: 1.2, life: 2.5, s0: 0.14, s1: 0.12, c: [0xFFD166, 0x3FA9F5, 0xF24E4E, 0x7DF58F, 0xB15DFF][i % 5], a0: 1, a1: win ? 0.8 : 0, rot: Math.random() * 6, vr: 8, tex: 7 }); } }
    }
    ambient(dt) {
      const k = this.tier.amb; if (!k) return; const tx = this.x, tz = this.y + (this.flip ? 2 : -2), kind = this.th.amb, n = k * dt, R = Math.random;
      const cnt = Math.floor(n) + (R() < n - Math.floor(n) ? 1 : 0);
      for (let i = 0; i < cnt; i++) { const x = tx + (R() - 0.5) * 22, z = tz + (R() - 0.5) * 16;
        if (kind === 'snow') this.pAlpha.add({ x, y: 4 + R() * 3, z, vx: 0.4 + R() * 0.3, vy: -1.1 - R() * 0.5, vz: (R() - 0.5) * 0.4, life: 4, s0: 0.07 + R() * 0.06, c: 0xFFFFFF, a0: 0.85, a1: 0.6, tex: 6 });
        else if (kind === 'firefly') { if (R() < 0.4) this.pAdd.add({ x, y: 0.4 + R() * 1.2, z, vx: (R() - 0.5) * 0.5, vy: (R() - 0.5) * 0.3, vz: (R() - 0.5) * 0.5, life: 2 + R() * 2, s0: 0.14, s1: 0.1, c: 0xD9FF7A, a0: 0.9, a1: 0, tex: 0 }); else if (R() < 0.3) this.pAlpha.add({ x, y: 3 + R() * 2, z, vx: 0.3, vy: -0.5, vz: 0.2, life: 5, s0: 0.12, c: cssHex(this.th.bush[0]), a0: 1, a1: 0.6, rot: R() * 6, vr: 2, tex: 4 }); }
        else this.pAlpha.add({ x, y: 0.3 + R() * 1.5, z, vx: 0.4 + R() * 0.4, vy: 0.05, vz: (R() - 0.5) * 0.3, life: 3, s0: 0.05 + R() * 0.05, c: 0xFFF2D6, a0: 0.5, a1: 0, tex: 6 }); }
    }

    // 3D 위치 → 화면 좌표
    toScreen(x, h, y) { const v = this.tmpV.set(x, h, y).project(this.camera); if (v.z > 1) return null; return [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh]; }
    drawLabels3D(ctx) {
      // high 가 아니면 카운트다운 · 맞음 화면 테두리를 여기서 (후처리 대신)
      if (!(this.post && this.usePost) && this._tint && this._tint.w > 0.01) { const t = this._tint, toS = v => Math.round(255 * Math.pow(clamp(v, 0, 1), 1 / 2.2)), W = this.vw, H = this.vh, gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(' + toS(t.x) + ',' + toS(t.y) + ',' + toS(t.z) + ',' + Math.min(0.6, t.w).toFixed(3) + ')'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
      const OUT = '#1B1B2F', px = Math.max(26, Math.min(40, this.vw / 14));   // 막대 크기 기준
      const bar = (id, x, y, hpK, name, isMe, ally, gems, chId, alpha) => {
        const ch = AR_CHARS[chId] || AR_CHARS.bolt, s = this.toScreen(x, (ch.hp >= 150 ? 1.9 : 1.6), y); if (!s) return;
        const bw = px * 1.6, bh = px * 0.24, bx = s[0] - bw / 2, bY = s[1] - bh - 4; ctx.globalAlpha = alpha;
        ctx.fillStyle = OUT; FX.rr(ctx, bx - 2, bY - 2, bw + 4, bh + 4, bh * 0.6); ctx.fill(); ctx.fillStyle = '#3A3F55'; FX.rr(ctx, bx, bY, bw, bh, bh * 0.5); ctx.fill();
        ctx.fillStyle = isMe ? '#5EE05E' : (ally ? '#4CB3FF' : '#FF5A5A'); FX.rr(ctx, bx, bY, bw * Math.max(0, Math.min(1, hpK)), bh, bh * 0.5); ctx.fill();
        FX.text(ctx, String(Math.max(0, Math.round(hpK * ch.hp))), s[0], bY + bh * 0.85, { size: bh * 1.05, weight: 400, font: AR_FONT, color: '#fff', align: 'center', stroke: OUT, strokeW: 2.5 });
        FX.text(ctx, (name || '') + (gems ? '  ◆' + gems : ''), s[0], bY - 5, { size: px * 0.42, weight: 400, font: AR_FONT, color: isMe ? '#fff' : (ally ? '#BFE3FF' : '#FFC2C2'), align: 'center', stroke: OUT, strokeW: 3.5 });
        if (isMe) { const gap = 3, aw = (bw - gap * 2) / 3, ah = px * 0.18, ay = bY + bh + 5; for (let k = 0; k < 3; k++) { const full = k < Math.floor(this.ammo), part = k === Math.floor(this.ammo) ? this.ammoT / (this.ch.shot.cd * 1.6) : 0, ax = bx + k * (aw + gap);
            ctx.fillStyle = OUT; FX.rr(ctx, ax - 1.5, ay - 1.5, aw + 3, ah + 3, ah * 0.5); ctx.fill(); ctx.fillStyle = '#3A3F55'; FX.rr(ctx, ax, ay, aw, ah, ah * 0.4); ctx.fill();
            if (full || part > 0) { ctx.fillStyle = full ? '#FF9F1C' : 'rgba(255,159,28,0.5)'; FX.rr(ctx, ax, ay, aw * (full ? 1 : part), ah, ah * 0.4); ctx.fill(); } } }
        ctx.globalAlpha = 1; };
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead) return; if (p.hidden && p.team !== this.team && Math.hypot(p.x - this.x, p.y - this.y) > 2.2) return;
        bar(id, p.x, p.y, (p.hp || 0) / ((AR_CHARS[p.ch] || AR_CHARS.bolt).hp), p.name, false, p.team === this.team, p.gems, p.ch, p.hidden ? 0.6 : 1); });
      if (!this.isDead) bar('__me', this.x, this.y, this.hp / this.maxHp, this.myName, true, true, this.held, this.charId, 1);
      // 피해 숫자
      this.dmgNums.forEach(d => { const s = this.toScreen(d.x, 1.9 + d.t * 0.8, d.y); if (!s) return; ctx.globalAlpha = 1 - d.t;
        FX.text(ctx, String(d.v), s[0], s[1], { size: px * (0.6 + 0.3 * (1 - d.t)), weight: 400, font: AR_FONT, color: d.c, align: 'center', stroke: OUT }); ctx.globalAlpha = 1; });
    }
  }
  window.ArenaGame3D = ArenaGame3D;
})();
