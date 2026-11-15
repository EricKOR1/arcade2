// 카트 레이싱 3D — 로우폴리 레이싱 연출 (고화질·보통 화질에서만. 가벼움 모드는 예전 모습)
//   · 운전자가 탄 카트(헬멧 · 카트 색) — 한 대를 한 덩어리로 합쳐 가볍게(몸체 1 + 바퀴 2)
//   · 출발선 양쪽 관람석과 관중(인스턴스) · 도로 옆 광고판 띠 · 출발 신호등 아치 · 차선
//   · 눈 덮인 봉우리 · 둥근 나무
//   (10라운드 실감 연출 — 아래 '실감' 묶음)
//   · 하늘: 그라데이션 + 해/달 + 구름 띠 + 별(셰이더 1번 · 그림 파일 없음) · 맵마다 해의 높이·색·환경광
//   · 노면: 골재 무늬 아스팔트 · 타이어 마모 띠 · 균열 · 연석 입체 · W형 가드레일 + 기둥 · 옹벽 무늬 · 땅 재질(잔디·눈·모래·도시)
//   · 코너의 고무 자국 · 출발 격자 · 출발 자국(한 덩어리) · 실시간 스키드 자국(한 덩어리)
//   · 바다·물웅덩이: 하늘 반사 + 물결 + 햇빛 반짝임(셰이더)
//   · 카트: 도색 광택(보통 = 물리 재질 · 고화질 = 클리어코트) · 바퀴 굴림·조향 · 서스펜션 · 운전자 고개 · 접지 그림자
//   · 입자(부드러운 연기·먼지·물보라·불꽃·스파크 — 그리기 2번): 드리프트 연기 · 흙길 먼지 · 물보라 · 배기 불꽃 · 착지 먼지 · 폭발
//   · 카메라: 벽 충돌·착지 흔들림 · 밤 트랙 헤드라이트·가로등 빛 웅덩이
(function () {
  if (typeof KartGame3D === 'undefined') return;
  const P = KartGame3D.prototype;

  // 여러 도형을 정점 색 한 덩어리로 합침 (그리기 호출 1번) · gl: 광택(0 무광 · 1 도색 · 2 금속)
  function merge(parts, lin) {
    const T = THREE, pos = [], nor = [], col = [], gls = [];
    parts.forEach(({ geo, color, m, gl }) => {
      const g = (geo.index ? geo.toNonIndexed() : geo.clone()); g.applyMatrix4(m);
      const c = new T.Color(color); if (lin) c.convertSRGBToLinear();
      const pa = g.attributes.position.array, na = g.attributes.normal.array;
      for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
      for (let i = 0; i < pa.length / 3; i++) { col.push(c.r, c.g, c.b); gls.push(gl || 0); }
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3)); out.setAttribute('gloss', new T.Float32BufferAttribute(gls, 1));
    return out;
  }
  // 정점 색이 있는 도형 여러 개를 이동시켜 하나로 이어 붙임 (상대 카트: 몸체 + 바퀴 = 그리기 1번)
  function concat(list) {
    const T = THREE, pos = [], nor = [], col = [], gls = [];
    list.forEach(({ geo, m }) => { const g = geo.clone(); if (m) g.applyMatrix4(m);
      const pa = g.attributes.position.array, na = g.attributes.normal.array, ca = g.attributes.color.array, ga = g.attributes.gloss ? g.attributes.gloss.array : null;
      for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); col.push(ca[i]); }
      for (let i = 0; i < pa.length / 3; i++) gls.push(ga ? ga[i] : 0); });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3)); out.setAttribute('gloss', new T.Float32BufferAttribute(gls, 1));
    return out;
  }
  const M = (x, y, z, rx, ry, rz, sx, sy, sz) => { const T = THREE; return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx || 1, sy || 1, sz || 1)); };
  const shade = (hex, k) => { const c = new THREE.Color(hex); return k > 0 ? c.lerp(new THREE.Color(0xffffff), k).getHex() : c.multiplyScalar(1 + k).getHex(); };
  P.flatMat = function () { if (!this._flat) { this._flat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 12, specular: 0x151515 }); this._flat.userData.lin = true; } return this._flat; };
  // 카트 재질: 정점마다 광택(gloss) — 도색은 반들반들(고화질은 클리어코트 한 겹 더) · 타이어·좌석은 무광 · 배기관·휠은 금속
  P.kartMat = function () {
    if (this._kmat) return this._kmat; const T = THREE, hi = this.hq === 'high';
    const o = { vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0, envMapIntensity: 0.5 };
    const m = hi ? new T.MeshPhysicalMaterial(Object.assign(o, { clearcoat: 1, clearcoatRoughness: 0.1 })) : new T.MeshStandardMaterial(o);
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'attribute float gloss;\nvarying float vGloss;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGloss = gloss;');
      sh.fragmentShader = 'varying float vGloss;\n' + sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vGloss > 1.5 ? 0.32 : mix( 0.85, 0.42, clamp( vGloss, 0.0, 1.0 ) );')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vGloss > 1.5 ? 0.55 : 0.0;')
        .replace('#include <lights_physical_fragment>', T.ShaderChunk.lights_physical_fragment.replace('material.clearcoat = clearcoat;', 'material.clearcoat = clearcoat * step( 0.5, vGloss ) * step( vGloss, 1.5 );'));
    };
    m.customProgramCacheKey = () => 'kart3d-gloss-' + (hi ? 'h' : 'm');
    m.userData.lin = true; m.userData.keep = true; this._kmat = m; return m;
  };

  // ── 운전자가 탄 카트 (앞 = +z, 길이 약 3.2) ──
  P.makeKartStyled = function (look, isMe) {
    const T = THREE, g = new T.Group(), C = new T.Color(look && look.color || '#3FA9F5').getHex(), dark = 0x2B2F3A, grey = 0x8A93A6, lin = this.hq !== 'low';
    const B = (w, h, d) => new T.BoxGeometry(w, h, d), Cy = (r1, r2, h, n) => new T.CylinderGeometry(r1, r2, h, n || 10), S = (r, a, b) => new T.SphereGeometry(r, a || 12, b || 9);
    // 같은 색·같은 머리 모양의 카트 몸체와 바퀴는 한 번 만든 도형을 같이 씀 (30명이 들어올 때 도형 합치기를 30번 하며 멈칫하던 것)
    const gc = this._kGeo || (this._kGeo = {}), bodyKey = C + '|' + String((look && look.color) || '') + String((look && look.style) || '') + String((look && look.name) || '') + '|' + lin;
    const bodyParts = [
      { geo: B(1.5, 0.14, 2.9), color: dark, m: M(0, 0.26, 0) },                                  // 바닥 판
      { geo: B(0.34, 0.3, 1.5), color: C, m: M(0.72, 0.42, 0.1), gl: 1 }, { geo: B(0.34, 0.3, 1.5), color: C, m: M(-0.72, 0.42, 0.1), gl: 1 },   // 옆 포드
      { geo: B(1.2, 0.26, 0.75), color: C, m: M(0, 0.42, 1.2, -0.18), gl: 1 },                    // 앞 코
      { geo: Cy(0.09, 0.09, 1.7, 8), color: shade(C, -0.35), m: M(0, 0.32, 1.62, 0, 0, Math.PI / 2), gl: 1 },   // 앞 범퍼
      { geo: B(0.8, 0.14, 0.14), color: 0xFFFFFF, m: M(0, 0.57, 1.05), gl: 1 },                    // 코 줄무늬
      { geo: B(0.9, 0.5, 0.7), color: dark, m: M(0, 0.6, -0.35) },                                // 좌석
      { geo: B(0.8, 0.45, 0.6), color: grey, m: M(0, 0.62, -1.1), gl: 2 },                        // 엔진
      { geo: Cy(0.07, 0.07, 0.4, 6), color: 0xC9CED8, m: M(0.22, 0.75, -1.45, Math.PI / 2), gl: 2 }, { geo: Cy(0.07, 0.07, 0.4, 6), color: 0xC9CED8, m: M(-0.22, 0.75, -1.45, Math.PI / 2), gl: 2 },   // 배기관
      { geo: B(1.6, 0.12, 0.14), color: shade(C, -0.35), m: M(0, 0.36, -1.55), gl: 1 },            // 뒤 범퍼
      { geo: Cy(0.05, 0.05, 0.5, 6), color: dark, m: M(0, 0.75, 0.5, -0.9) },                      // 운전대 기둥
      { geo: new T.TorusGeometry(0.2, 0.045, 6, 14), color: 0x1B1B2F, m: M(0, 0.95, 0.35, -0.5) },  // 운전대
      // 운전자: 몸 · 팔 · 헬멧(카트 색 + 흰 줄) · 얼굴 가리개
      { geo: Cy(0.26, 0.33, 0.62, 10), color: shade(C, -0.25), m: M(0, 1.05, -0.3, -0.12) },
      { geo: Cy(0.08, 0.08, 0.62, 6), color: shade(C, -0.25), m: M(0.3, 1.02, 0.02, -1.15) }, { geo: Cy(0.08, 0.08, 0.62, 6), color: shade(C, -0.25), m: M(-0.3, 1.02, 0.02, -1.15) },
      { geo: S(0.07, 6, 5), color: 0x1B1B2F, m: M(0.17, 0.98, 0.36) }, { geo: S(0.07, 6, 5), color: 0x1B1B2F, m: M(-0.17, 0.98, 0.36) },   // 장갑 (운전대를 잡은 손)
      { geo: B(0.5, 0.08, 0.02), color: 0xFFFFFF, m: M(0, 0.47, -1.62), gl: 1 },                    // 뒤 번호판 띠
    ];
    const head = this.driverHead(look, C, S, B, Cy);
    // 나: 머리는 따로(코너에서 고개를 돌림) · 상대: 한 덩어리
    const body = isMe && lin ? (gc[bodyKey + '|me'] || (gc[bodyKey + '|me'] = merge(bodyParts, lin))) : (gc[bodyKey] || (gc[bodyKey] = merge(bodyParts.concat(head), lin)));
    const mat = lin ? this.kartMat() : this.flatMat();
    // 바퀴: 앞(작게) · 뒤(크게) 두 묶음 — 내 카트는 네 바퀴를 따로 (굴림 · 앞바퀴 조향)
    const wheelGeo = (r, w, x) => { const wk = 'w' + r + ',' + w + ',' + x + '|' + lin; return gc[wk] || (gc[wk] = merge([
        { geo: Cy(r, r, w, 14), color: 0x23262E, m: M(x, 0, 0, 0, 0, Math.PI / 2) }, { geo: Cy(r * 0.55, r * 0.55, w + 0.02, 6), color: 0xB8C0CE, m: M(x, 0, 0, 0, 0, Math.PI / 2), gl: 2 },
        { geo: Cy(r, r, w, 14), color: 0x23262E, m: M(-x, 0, 0, 0, 0, Math.PI / 2) }, { geo: Cy(r * 0.55, r * 0.55, w + 0.02, 6), color: 0xB8C0CE, m: M(-x, 0, 0, 0, 0, Math.PI / 2), gl: 2 }], lin)); };
    const oneWheel = (r, w) => { const wk = 'w1' + r + ',' + w + '|' + lin; return gc[wk] || (gc[wk] = merge([
        { geo: Cy(r, r, w, 16), color: 0x23262E, m: M(0, 0, 0, 0, 0, Math.PI / 2) }, { geo: Cy(r * 0.55, r * 0.55, w + 0.02, 6), color: 0xB8C0CE, m: M(0, 0, 0, 0, 0, Math.PI / 2), gl: 2 },
        { geo: Cy(r * 0.2, r * 0.2, w + 0.05, 6), color: 0x3A3F4C, m: M(0, 0, 0, 0, 0, Math.PI / 2), gl: 2 }], lin)); };
    const wf = wheelGeo(0.3, 0.26, 0.82), wr = wheelGeo(0.38, 0.36, 0.86);
    if (isMe) {
      const chassis = new T.Group(); g.add(chassis); g.userData.chassis = chassis;               // 서스펜션: 몸체·운전자만 출렁 (바퀴는 땅에)
      const bm = new T.Mesh(body, mat); bm.castShadow = true; chassis.add(bm);
      if (lin) {
        const hg = gc[bodyKey + '|head'] || (gc[bodyKey + '|head'] = merge(head, lin).translate(0, -1.55, 0.25));
        const hm = new T.Mesh(hg, mat); hm.position.set(0, 1.55, -0.25); hm.castShadow = true; chassis.add(hm); g.userData.head = hm;
        const w1f = oneWheel(0.3, 0.26), ws = [];
        [[0.82, 0.3, 1.05, w1f], [-0.82, 0.3, 1.05, w1f], [0, 0.38, -1.0, wr]].forEach(([x, y, z, geo]) => { const w = new T.Mesh(geo, mat); w.position.set(x, y, z); w.rotation.order = 'YXZ'; w.castShadow = true; g.add(w); ws.push(w); });
        g.userData.wheels4 = ws; g.userData.wheels = null;                                            // 앞바퀴 둘(조향) + 뒷바퀴 한 쌍 · 굴림·조향은 updateStyle 에서 — 반지름에 맞게
      } else {
        const wheelPair = (wg, r, z) => { const wm = new T.Mesh(wg, mat); wm.position.set(0, r, z); wm.castShadow = true; g.add(wm); return wm; };
        g.userData.wheels = [wheelPair(wf, 0.3, 1.05), wheelPair(wr, 0.38, -1.0)];
      }
    } else {
      // 상대 카트: 바퀴를 몸체에 붙인 한 덩어리 (그리기 3번 → 1번 · 그림자도 1번) — 멀리서는 바퀴 회전이 거의 보이지 않음
      const one = gc[bodyKey + '|1'] || (gc[bodyKey + '|1'] = concat([{ geo: body }, { geo: wf, m: M(0, 0.3, 1.05) }, { geo: wr, m: M(0, 0.38, -1.0) }]));
      const bm = new T.Mesh(one, mat); bm.castShadow = true; g.add(bm); g.userData.wheels = null; g.userData.bodyMesh = bm;
    }
    g.userData.body = { color: new T.Color() };                                                       // (스타 무지개: 이 모델은 몸체 색이 정점 색이라 효과 대신 방어막·불꽃으로 표시)
    // 둥근 그림자 · 방어막 · 부스터 불꽃
    if (!this.shTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const s2 = c.getContext('2d'), rg = s2.createRadialGradient(32, 32, 4, 32, 32, 32); rg.addColorStop(0, 'rgba(0,0,0,0.45)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); s2.fillStyle = rg; s2.fillRect(0, 0, 64, 64); this.shTex = new T.CanvasTexture(c); }
    const sh = new T.Mesh(new T.PlaneGeometry(3, 3.8), new T.MeshBasicMaterial({ map: this.shTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh); g.userData.shadow = sh;
    if (lin) { const ct = new T.Object3D(); ct.position.y = 0.04; g.userData.contact = ct; }          // 접지 그림자 자리(높이·보임) — 그림은 모든 카트를 한 번에 (updateReal10 의 인스턴스)
    const shield = new T.Mesh(new T.SphereGeometry(2.1, 14, 10), new T.MeshBasicMaterial({ color: 0x9DE9FF, transparent: true, opacity: 0.25, depthWrite: false })); shield.position.y = 0.9; shield.visible = false; g.add(shield); g.userData.shield = shield;
    const flame = new T.Group();                                                                     // 부스터 불꽃: 보통·고화질은 입자(배기 불꽃)로 — 원뿔은 가벼움 모드만
    if (!lin) [-0.22, 0.22].forEach(x => { const f = new T.Mesh(new T.ConeGeometry(0.16, 0.9, 8), new T.MeshBasicMaterial({ color: 0xFF9F1C, transparent: true, opacity: 0.9 })); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.75, -1.9); flame.add(f); });
    flame.visible = false; g.add(flame); g.userData.flame = flame;
    this.lin(g); this.scene.add(g); return g;
  };
  // 접지 그림자 재질 (가운데가 짙고 가장자리로 빨리 옅어짐 — 바퀴 네 곳이 조금 더 짙게)
  P.contactMat = function () {
    if (this._ctMat) return this._ctMat; const T = THREE, c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
    const blob = (x, y, rx, ry, a) => { g.save(); g.translate(x, y); g.scale(rx, ry); const r = g.createRadialGradient(0, 0, 0, 0, 0, 1); r.addColorStop(0, 'rgba(0,0,0,' + a + ')'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore(); };
    blob(32, 48, 26, 42, 0.42); [[10, 18], [54, 18], [9, 78], [55, 78]].forEach(([x, y]) => blob(x, y, 10, 13, 0.5));
    const t = new T.CanvasTexture(c); this._ctMat = new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); this._ctMat.userData.lin = true; return this._ctMat;
  };

  // 운전자 머리 6종 (카트 색 기준 · 학생마다 다르게): 풀페이스 헬멧 · 고글 헬멧 · 야구 모자 · 토끼 귀 헬멧 · 뿔 헬멧 · 안테나 헬멧
  P.driverHead = function (look, C, S, B, Cy) {
    const T = THREE, key = String((look && look.color) || '') + String((look && look.style) || '') + String((look && look.name) || '');
    let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const kind = h % 6;
    const skin = [0xF2C9A0, 0xD9A77A, 0xF5D7B8, 0xA8765A][h % 4], hair = [0x3B2A20, 0x1B1B1B, 0x8B5A2B, 0xD9B45A][(h >> 3) % 4], hy = 1.55, hz = -0.25;
    const helmet = [{ geo: S(0.34), color: C, m: M(0, hy, hz), gl: 1 }], visor = { geo: B(0.5, 0.2, 0.12), color: 0x1B2A44, m: M(0, hy, hz + 0.31), gl: 1 }, stripe = { geo: B(0.12, 0.3, 0.62), color: 0xFFFFFF, m: M(0, hy + 0.07, hz), gl: 1 };
    if (kind === 0) return helmet.concat([stripe, visor]);                                                   // 풀페이스 헬멧
    if (kind === 1) return helmet.concat([{ geo: S(0.2, 10, 8), color: skin, m: M(0, hy - 0.08, hz + 0.18, 0, 0, 0, 1, 0.9, 0.8) },          // 고글 헬멧: 얼굴이 보임
      { geo: B(0.62, 0.12, 0.1), color: 0x23262E, m: M(0, hy + 0.1, hz + 0.3) }, { geo: Cy(0.09, 0.09, 0.06, 10), color: 0x9DE9FF, m: M(-0.12, hy + 0.1, hz + 0.35, Math.PI / 2), gl: 2 }, { geo: Cy(0.09, 0.09, 0.06, 10), color: 0x9DE9FF, m: M(0.12, hy + 0.1, hz + 0.35, Math.PI / 2), gl: 2 }]);
    if (kind === 2) return [{ geo: S(0.3), color: skin, m: M(0, hy - 0.03, hz) }, { geo: new T.SphereGeometry(0.31, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color: C, m: M(0, hy + 0.02, hz) },   // 야구 모자
      { geo: B(0.36, 0.05, 0.28), color: C, m: M(0, hy + 0.04, hz + 0.34, 0.12) }, { geo: B(0.5, 0.12, 0.3), color: hair, m: M(0, hy - 0.02, hz - 0.2) }, { geo: B(0.08, 0.05, 0.03), color: 0x1B1B2F, m: M(-0.1, hy - 0.02, hz + 0.28) }, { geo: B(0.08, 0.05, 0.03), color: 0x1B1B2F, m: M(0.1, hy - 0.02, hz + 0.28) }];
    if (kind === 3) return helmet.concat([visor, { geo: Cy(0.07, 0.09, 0.45, 8), color: C, m: M(-0.14, hy + 0.48, hz - 0.05, 0, 0, 0.18), gl: 1 }, { geo: Cy(0.07, 0.09, 0.45, 8), color: C, m: M(0.14, hy + 0.48, hz - 0.05, 0, 0, -0.18), gl: 1 },   // 토끼 귀
      { geo: Cy(0.035, 0.05, 0.36, 6), color: 0xFFC2D6, m: M(-0.14, hy + 0.48, hz - 0.0, 0, 0, 0.18) }, { geo: Cy(0.035, 0.05, 0.36, 6), color: 0xFFC2D6, m: M(0.14, hy + 0.48, hz - 0.0, 0, 0, -0.18) }]);
    if (kind === 4) return helmet.concat([visor, { geo: new T.ConeGeometry(0.08, 0.34, 7), color: 0xF5F0E0, m: M(-0.34, hy + 0.14, hz, 0, 0, 1.05) }, { geo: new T.ConeGeometry(0.08, 0.34, 7), color: 0xF5F0E0, m: M(0.34, hy + 0.14, hz, 0, 0, -1.05) }]);   // 뿔
    return helmet.concat([stripe, visor, { geo: Cy(0.02, 0.02, 0.42, 5), color: 0x8A93A6, m: M(0.1, hy + 0.5, hz - 0.08), gl: 2 }, { geo: S(0.08, 8, 6), color: 0xFF5C7A, m: M(0.1, hy + 0.72, hz - 0.08), gl: 1 }]);   // 안테나
  };

  // ── 트랙 연출 ──
  P.buildStyle = function () {
    const T = THREE, tr = this.track, S = this.S, n = tr.n, hw = tr.halfW, lin = true, far = tr.theme.far || 'hills';
    const at = (i, off, lift) => { const j = ((i % n) + n) % n, c = tr.center[j], [tx, ty] = tr.tangent[j]; const v = this.P(c[0] + -ty * hw * off, c[1] + tx * hw * off, tr.elev[j]); v.y += lift || 0; return v; };
    const heading = i => { const [tx, ty] = tr.tangent[((i % n) + n) % n]; return Math.PI / 2 - Math.atan2(ty, tx); };   // 모델 앞(+z)을 진행 방향으로

    // 1) 도로: 골재 무늬 아스팔트 + 흰 가장자리선 + 노란 중앙 점선 + 흰 차선 점선 + 타이어 마모 띠 · 균열 (실감 묶음의 roadCanvas)
    if (this.roadMat) {
      const tex = new T.CanvasTexture(roadCanvas(this.hq === 'high' ? 1024 : 512, this.night, far)); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4; tex.encoding = T.sRGBEncoding;
      this.roadMat.map = tex; this.roadMat.color.set(0xffffff); this.roadMat.needsUpdate = true;
    }

    // 2) 광고판 띠: 도로 양옆(가드레일 바깥)을 따라 이어지는 판 — 글자 판 6가지가 반복
    { const c = document.createElement('canvas'); c.width = 1536; c.height = 128; const g = c.getContext('2d');
      const panels = [['KART RALLY', '#E63946', '#fff'], ['TURBO', '#1D7FA6', '#FFD23F'], ['GO! ★', '#FFD23F', '#1B1B2F'], ['과학 GP', '#2A9D5C', '#fff'], ['SPEED', '#7B2FF7', '#fff'], ['DRIFT', '#FF7A1A', '#fff']];
      panels.forEach(([t, bg, fg], k) => { g.fillStyle = bg; g.fillRect(k * 256, 0, 256, 128); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(k * 256, 0, 256, 12);
        g.fillStyle = fg; g.font = '900 54px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, k * 256 + 128, 70); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(k * 256 + 252, 0, 4, 128); });
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 118, 1536, 10); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 1536, 3);   // 판 위·아래 테두리
      const tex = new T.CanvasTexture(c); tex.wrapS = T.RepeatWrapping; tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
      const mat = new T.MeshLambertMaterial({ map: tex, side: T.DoubleSide, emissive: this.night ? 0xffffff : 0x000000, emissiveMap: this.night ? tex : null, emissiveIntensity: 0.35 }); mat.userData.lin = true;   // 밤: 조명을 받은 광고판
      [1.16, -1.16].forEach(off => { const pos = [], uv = [], idx = []; let dist = 0, q = 0, prev = null;
        for (let i = 0; i <= n; i++) { const j = i % n; const a = at(j, off, 0.25), b = at(j, off, 1.55);
          if (prev) dist += a.distanceTo(prev); prev = a; pos.push(a.x, a.y, a.z, b.x, b.y, b.z); const u = dist / 16; uv.push(u, 0, u, 1);
          if (i < n && !(tr.gapSeg[j] || tr.gapSeg[(j + 1) % n]) && !(tr.driftZone && tr.driftZone[j]) && !(tr.scCut && (tr.scCut[j * 2 + (off > 0 ? 1 : 0)] || tr.scCut[((j + 1) % n) * 2 + (off > 0 ? 1 : 0)]))) { idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } q += 2; }   // (지름길 입구는 비움)
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
        const m = new T.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); }); }

    // 3) 출발선 양쪽 관람석 + 관중 (계단 · 지붕 · 사람: 인스턴스 몇 개)
    { const steps = [], roofs = [], bodies = [], heads = [], rows = 5, seg = tr.stepLen * S, per = Math.max(2, Math.round(seg / 1.15));
      const skipP = this.hq === 'high' ? 0.12 : 0.5;   // 보통 화질(태블릿)은 관중을 절반 정도만 — 출발선에 30명이 몰릴 때 삼각형 수만 개를 덜 그림
      for (let k = -40; k <= 40; k++) { if (tr.gapSeg[((k % n) + n) % n]) continue;
        [1, -1].forEach(side => { const h = heading(k), fwd = new T.Vector3(Math.sin(h), 0, Math.cos(h));
          for (let r = 0; r < rows; r++) { const hgt = 0.8 + r * 1.6, p = at(k, side * (1.42 + r * 0.075), hgt / 2); steps.push({ p, h, s: [1.5, hgt, seg * 1.03] });   // 계단 한 칸: 가로 = 깊이 · 세로 = 트랙 방향
            const top = p.y + hgt / 2;
            for (let q = 0; q < per; q++) { if (Math.random() < skipP) continue; const pp = p.clone().addScaledVector(fwd, (q - (per - 1) / 2) * (seg / per)); pp.y = top;   // 트랙 방향으로 나란히
              bodies.push({ p: pp.clone().setY(top + 0.4), h }); heads.push({ p: pp.clone().setY(top + 1.05), h }); } }
          roofs.push({ p: at(k, side * (1.42 + (rows - 1) * 0.0375), 0.8 + (rows - 1) * 1.6 + 3.4), h, s: [rows * 1.5 + 1.2, 0.25, seg * 1.03] }); }); }
      const inst = (geo, list, color, eachColor, noShadow) => { const mat = new T.MeshLambertMaterial({ color }); mat.userData.lin = false; const im = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), cc = new T.Color();
        list.forEach((o, i) => { q.setFromAxisAngle(new T.Vector3(0, 1, 0), o.h); sc.set(...(o.s || [1, 1, 1])); m4.compose(o.p, q, sc); im.setMatrixAt(i, m4); if (eachColor) { cc.set(eachColor(i)).convertSRGBToLinear(); im.setColorAt(i, cc); } });
        // 관중석은 출발선 근처에만 있음: 전체를 감싸는 구로 화면(·그림자 범위) 밖이면 건너뜀 — r128 인스턴스 메시는 기본이 '항상 그림'이라 코스 어디서나 수만 개 삼각형을 그렸음
        if (list.length) { const bx = new T.Box3(); list.forEach(o => bx.expandByPoint(o.p)); const bs = new T.Sphere(); bx.getBoundingSphere(bs); bs.radius += 6; geo.boundingSphere = bs; im.frustumCulled = true; }
        im.castShadow = !noShadow; im.receiveShadow = true; this.scene.add(im); return im; };
      const crowdCols = ['#E63946', '#1D7FA6', '#FFD23F', '#2A9D5C', '#7B2FF7', '#FF7A1A', '#FFFFFF', '#F28FB5'];
      inst(new T.BoxGeometry(1, 1, 1), steps, 0xB8BFCC); inst(new T.BoxGeometry(1, 1, 1), roofs, 0xFFFFFF, i => ['#E63946', '#FFFFFF'][i % 2]);
      // 관중은 수천 명이라 단순한 모양(몸 6각 기둥 · 머리 20면체)으로 — 삼각형을 절반 이하로
      this.crowdBody = inst(new T.CylinderGeometry(0.28, 0.34, 0.8, 6, 1, true), bodies, 0xFFFFFF, i => crowdCols[(i * 7 + (i >> 3)) % crowdCols.length], true);
      inst(new T.IcosahedronGeometry(0.27, 0), heads, 0xFFFFFF, i => ['#F2C9A0', '#D9A77A', '#A8765A', '#F5D7B8'][i % 4], true); }

    // 4) 출발 아치: 빨강·흰 줄무늬 기둥 · 이름판 · 체크 깃발 · 출발 신호등(카운트다운에 맞춰 켜짐)
    { this.scene.children.filter(o => o.userData.startArch).forEach(o => this.scene.remove(o));
      const g = new T.Group(), w = hw * 2 * S + 5, c0 = at(0, 0, 0);
      const sc = document.createElement('canvas'); sc.width = 64; sc.height = 256; const sg = sc.getContext('2d'); for (let y = 0; y < 256; y += 32) { sg.fillStyle = (y / 32) % 2 ? '#FFFFFF' : '#E63946'; sg.fillRect(0, y, 64, 32); }
      const stripe = new T.CanvasTexture(sc); stripe.encoding = T.sRGBEncoding; const pm = new T.MeshLambertMaterial({ map: stripe }); pm.userData.lin = true;
      [-1, 1].forEach(sd => { const p = new T.Mesh(new T.CylinderGeometry(0.55, 0.65, 10, 14), pm); p.position.set(sd * w / 2, 5, 0); p.castShadow = true; g.add(p);
        const fc = document.createElement('canvas'); fc.width = 64; fc.height = 48; const fg = fc.getContext('2d'); for (let x = 0; x < 8; x++) for (let y = 0; y < 6; y++) { fg.fillStyle = (x + y) % 2 ? '#111' : '#fff'; fg.fillRect(x * 8, y * 8, 8, 8); }
        const ft = new T.CanvasTexture(fc); ft.encoding = T.sRGBEncoding; const fm = new T.MeshBasicMaterial({ map: ft, side: T.DoubleSide }); fm.userData.lin = true;
        const flag = new T.Mesh(new T.PlaneGeometry(2.4, 1.6, 6, 1), fm); flag.position.set(sd * w / 2 + sd * 1.3, 11.6, 0); g.add(flag); (this._flags = this._flags || []).push(flag);
        const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.6, 6), new T.MeshLambertMaterial({ color: 0xDDDDDD })); pole.position.set(sd * w / 2, 11.2, 0); g.add(pole); });
      const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 128; const bg = bc.getContext('2d'); bg.fillStyle = '#C62828'; bg.fillRect(0, 0, 1024, 128); bg.fillStyle = '#8E1C1C'; bg.fillRect(0, 108, 1024, 20);
      bg.fillStyle = '#FFFFFF'; bg.font = '900 78px Pretendard, sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.fillText('KART RALLY · 과학 GP', 512, 60);
      const bt = new T.CanvasTexture(bc); bt.encoding = T.sRGBEncoding; const bmat = new T.MeshLambertMaterial({ map: bt }); bmat.userData.lin = true;
      const banner = new T.Mesh(new T.BoxGeometry(w, 2.4, 0.5), bmat); banner.position.y = 9.4; banner.castShadow = true; g.add(banner);
      const box = new T.Mesh(new T.BoxGeometry(4.2, 1.3, 0.4), new T.MeshLambertMaterial({ color: 0x1B1B2F })); box.position.set(0, 7.6, 0.1); g.add(box);
      this.startLamps = [-1.3, 0, 1.3].map(x => { const l = new T.Mesh(new T.SphereGeometry(0.42, 12, 10), new T.MeshBasicMaterial({ color: 0x3A2020 })); l.position.set(x, 7.6, 0.35); g.add(l); return l; });
      g.position.copy(c0); g.rotation.y = heading(0) + Math.PI; this.lin(g); this.scene.add(g); }

    // 5) 눈 덮인 봉우리 (초원 · 사막 뒤쪽) · 6) 둥근 나무
    const b = tr.bounds, cx = (b.minX + b.maxX) / 2 * S, cz = (b.minY + b.maxY) / 2 * S, R0 = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) * S * 0.5 + 60;
    if (far === 'hills' || far === 'mesa') {
      const parts = []; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + (i % 3) * 0.12, r = R0 + 820 + (i % 4) * 90, h = 260 + (i * 53 % 5) * 55, rr = 170 + (i % 3) * 50;
        parts.push({ geo: new T.ConeGeometry(rr, h, 6), color: far === 'mesa' ? '#B97A55' : '#8D97AA', m: M(cx + Math.cos(a) * r, this.groundY + h / 2, cz + Math.sin(a) * r, 0, i) });
        parts.push({ geo: new T.ConeGeometry(rr * 0.36, h * 0.36, 6), color: '#F4F7FB', m: M(cx + Math.cos(a) * r, this.groundY + h * 0.82, cz + Math.sin(a) * r, 0, i) }); }
      const mm = new T.Mesh(merge(parts, true), this.flatMat()); mm.userData.far = true; mm.userData.peaks = true; this.scene.add(mm);
    }
    if (this.decoObjs && this.decoObjs.tree && this.decoObjs.tree.length) {                     // 둥근 나무: 줄기 + 잎 덩어리 셋 (한 덩어리로 합쳐 인스턴스) · 나무마다 잎 색을 조금씩 다르게
      (this.decoMeshes.tree || []).forEach(m => this.scene.remove(m)); this.decoMeshes.tree = [];
      const tg = merge([{ geo: new T.CylinderGeometry(0.35, 0.5, 3, 7), color: '#7A5230', m: M(0, 1.5, 0) },
        { geo: new T.IcosahedronGeometry(2.3, 0), color: '#4CAF50', m: M(0, 4.4, 0) }, { geo: new T.IcosahedronGeometry(1.7, 0), color: '#5DC262', m: M(1.2, 3.8, 0.4) }, { geo: new T.IcosahedronGeometry(1.6, 0), color: '#43A047', m: M(-1.1, 4.0, -0.5) }], true);
      const objs = this.decoObjs.tree, im = new T.InstancedMesh(tg, this.flatMat(), objs.length), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), tc = new T.Color();
      objs.forEach((o, i) => { const s2 = 0.9 + (o.r || 0.5) * 0.6; q.setFromAxisAngle(new T.Vector3(0, 1, 0), (o.r2 || o.r || 0) * 6.28); sc.set(s2, s2, s2); m4.compose(this.P(o.x, o.y, o.e), q, sc); im.setMatrixAt(i, m4);
        const v = ((o.r2 || o.r || 0.5) * 7.3) % 1; tc.setRGB(0.82 + v * 0.3, 0.88 + ((v * 3.1) % 1) * 0.2, 0.75 + ((v * 5.7) % 1) * 0.2); im.setColorAt(i, tc); });
      im.castShadow = true; im.receiveShadow = true; this.scene.add(im); this.decoMeshes.tree.push(im);
    }
    // 7) 실감 묶음: 하늘·조명 · 땅·옹벽·연석·가드레일 · 노면 자국 · 물 · 입자 · 스키드 · 밤 조명
    this.buildReal10();
  };

  // 출발 신호등: 카운트다운 3·2·1 에 빨간불이 하나씩, 출발하면 모두 초록 (2초 뒤 꺼짐)
  P.updateStyle = function (now) {
    if (this.startLamps) { const cd = this.countdown, lit = cd > 0 ? Math.min(3, Math.max(0, 4 - Math.ceil(cd))) : 0;
      if (this._goAtLamp == null && cd <= 0) this._goAtLamp = now;
      this.startLamps.forEach((l, i) => { const on = cd > 0 ? i < lit : (now - this._goAtLamp < 2000);
        l.material.color.set(cd > 0 ? (on ? 0xFF2A2A : 0x3A2020) : (on ? 0x2BFF6A : 0x203A28)); if (this.hq !== 'low') l.material.color.convertSRGBToLinear(); }); }
    if (this._r10) this.updateReal10(now);
  };

  /* ═══════════════════════ 실감 묶음 (10라운드) ═══════════════════════ */
  // 맵 분위기: 해 높이(°)·방위(출발 방향 기준 °)·햇빛 색·세기 · 하늘빛/땅빛(반구광) · 노출 · 구름 양
  const LOOK = {
    hills: { el: 40, az: 35, sun: '#FFEFD0', si: 1.45, sky: '#D5E7FF', gnd: '#6F8C48', hi: 0.8, exp: 1.0, cloud: 0.9, dry: 0.35, dryCol: [1.18, 1.06, 0.62] },
    mesa:  { el: 17, az: 18, sun: '#FFB06A', si: 1.75, sky: '#F5C4A0', gnd: '#8A5A3A', hi: 0.72, exp: 1.02, cloud: 0.65, dry: 0.25, dryCol: [1.1, 0.92, 0.8] },
    peaks: { el: 30, az: -32, sun: '#FFF0DC', si: 1.4, sky: '#DCE6FF', gnd: '#C8D2E2', hi: 0.8, exp: 0.94, cloud: 0.75, dry: 0.15, dryCol: [0.92, 0.96, 1.08] },
    ocean: { el: 55, az: 40, sun: '#FFF8E4', si: 1.5, sky: '#D2EAFF', gnd: '#D8C79C', hi: 0.8, exp: 1.0, cloud: 0.95, dry: 0.25, dryCol: [1.08, 1.02, 0.86] },
    city:  { el: 42, az: 30, sun: '#FFF4DE', si: 1.35, sky: '#D8E2F2', gnd: '#5A6070', hi: 0.8, exp: 1.0, cloud: 0.7, dry: 0.2, dryCol: [1, 1, 1] },
    night: { el: 38, az: -25, sun: '#B9CCFF', si: 0.55, sky: '#7A8CD0', gnd: '#1E2236', hi: 0.8, exp: 1.18, cloud: 0.22, dry: 0.15, dryCol: [1, 1, 1] }
  };
  const QP = { high: { pN: 560, pA: 340, skid: 720, rate: 1 }, mid: { pN: 260, pA: 170, skid: 380, rate: 0.6 } };
  const lc = hex => new THREE.Color(hex).convertSRGBToLinear();

  // ── 절차적 무늬 (외부 파일 없음 · 한 번 만든 그림은 다음 판에도 다시 씀) ──
  const CANV = {};
  const rng = seed => { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; };
  // 이어 붙여도 끊김 없는 값 노이즈 (가로 cx · 세로 cy 칸)
  function pnoise(W, H, cx, cy, seed) {
    const r = rng(seed), g = new Float32Array(cx * cy); for (let i = 0; i < g.length; i++) g[i] = r();
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { const fy = y / H * cy, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
      for (let x = 0; x < W; x++) { const fx = x / W * cx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % cx, xa = x0 % cx;
        const a = g[r0 + xa] + (g[r0 + x1] - g[r0 + xa]) * sx, b = g[r1 + xa] + (g[r1 + x1] - g[r1 + xa]) * sx; out[y * W + x] = a + (b - a) * sy; } }
    return out;
  }
  function fbm(W, H, c, oct, seed, cyK) {
    const out = new Float32Array(W * H); let amp = 0.5, tot = 0;
    for (let o = 0; o < oct; o++) { const cc = c << o, nz = pnoise(W, H, cc, Math.max(1, Math.round(cc * (cyK || 1))), seed + o * 101); for (let i = 0; i < out.length; i++) out[i] += nz[i] * amp; tot += amp; amp *= 0.5; }
    for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
  }
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v, sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hexRGB = h => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
  function canvasOf(N, H) { const c = document.createElement('canvas'); c.width = N; c.height = H || N; return c; }

  // 아스팔트 (가로 = 도로 폭 · 세로 = 진행 방향 1칸). 차선 자리는 예전 그대로 (256 기준 가장자리 6~11 · 245~250 / 노란 중앙 125~131 / 흰 차선 62~66 · 190~194)
  function roadCanvas(N, night, far) {
    const key = 'road' + N + night + far; if (CANV[key]) return CANV[key];
    const c = canvasOf(N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, r = rng(7 + N);
    const tone = fbm(N, N, 4, 4, 11), fine = pnoise(N, N, N >> 2, N >> 2, 23), k = N / 256;
    const base = night ? [58, 62, 80] : far === 'peaks' ? [86, 90, 100] : [72, 76, 86];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, u = x / N;
      let v = 0.86 + (tone[i] - 0.5) * 0.28 + (fine[i] - 0.5) * 0.16;
      const rr = r(); if (rr < 0.05) v *= 0.72; else if (rr > 0.965) v *= 1.28;                         // 골재 알갱이 (검은 돌 · 밝은 돌)
      const wear = Math.exp(-Math.pow((u - 0.29) / 0.05, 2)) + Math.exp(-Math.pow((u - 0.71) / 0.05, 2)) + 0.5 * Math.exp(-Math.pow((u - 0.5) / 0.035, 2));   // 타이어가 많이 지나는 띠: 고무가 묻어 조금 짙게
      v *= 1 - wear * 0.13;
      const o = i * 4; d[o] = base[0] * v; d[o + 1] = base[1] * v; d[o + 2] = base[2] * v; d[o + 3] = 255; }
    g.putImageData(img, 0, 0);
    // 메운 균열 · 보수 자국
    g.strokeStyle = 'rgba(28,30,36,0.22)'; g.lineWidth = 0.9 * k;
    for (let q = 0; q < 3; q++) { let x = N * (0.12 + r() * 0.76), y = r() * N; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 9; s++) { x += (r() - 0.5) * 8 * k; y += r() * 7 * k; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(30,32,40,0.14)'; g.fillRect(N * (0.36 + r() * 0.2), N * r() * 0.6, N * 0.07, N * 0.22);
    // 차선 (조금 닳은 칠)
    const paint = (col, x, w, y0, y1) => { g.fillStyle = col; g.fillRect(x * k, y0 * k, w * k, (y1 - y0) * k); };
    paint('#EEEEEE', 6, 5, 0, 256); paint('#EEEEEE', 245, 5, 0, 256);
    paint('#FFD23F', 125, 6, 0, 150);
    paint('rgba(255,255,255,0.88)', 62, 4, 0, 110); paint('rgba(255,255,255,0.88)', 190, 4, 0, 110);
    const wi = g.getImageData(0, 0, N, N), wd = wi.data;                                                // 칠 위에 아스팔트가 비치게 (닳음)
    for (let i = 0; i < N * N; i++) { const o = i * 4; if (wd[o] > 150 || wd[o + 1] > 150) { const t = fine[i] * 0.5 + tone[i] * 0.5; if (t < 0.38) { const m = 0.55 + t; wd[o] *= m; wd[o + 1] *= m; wd[o + 2] *= m; } } }
    g.putImageData(wi, 0, 0);
    CANV[key] = c; return c;
  }
  // 노면 굴곡(노멀) · 거칠기 (고화질 사진 조명에서만) — 아스팔트 알갱이와 같은 자리
  function roadDetail(N) {
    const key = 'roadN' + N; if (CANV[key]) return CANV[key];
    const h = pnoise(N, N, N >> 2, N >> 2, 23), r = rng(77), hh = new Float32Array(N * N);
    for (let i = 0; i < hh.length; i++) { const rr = r(); hh[i] = h[i] * 0.6 + (rr < 0.05 ? -0.5 : rr > 0.965 ? 0.6 : 0) + (rr - 0.5) * 0.25; }
    const nc = canvasOf(N), ni = nc.getContext('2d').createImageData(N, N), rc = canvasOf(N), ri = rc.getContext('2d').createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, u = x / N, l = hh[y * N + (x + N - 1) % N], rt = hh[y * N + (x + 1) % N], up = hh[((y + N - 1) % N) * N + x], dn = hh[((y + 1) % N) * N + x];
      const dx = (l - rt) * 1.6, dy = (up - dn) * 1.6, inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), o = i * 4;
      ni.data[o] = (dx * inv * 0.5 + 0.5) * 255; ni.data[o + 1] = (dy * inv * 0.5 + 0.5) * 255; ni.data[o + 2] = (inv * 0.5 + 0.5) * 255; ni.data[o + 3] = 255;
      const wear = Math.exp(-Math.pow((u - 0.29) / 0.05, 2)) + Math.exp(-Math.pow((u - 0.71) / 0.05, 2)), lane = (Math.abs(u - 0.033) < 0.012 || Math.abs(u - 0.967) < 0.012) ? 1 : 0;
      const rv = clamp01(0.94 - wear * 0.14 - lane * 0.2 + (hh[i] - 0.3) * 0.06) * 255; ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = rv; ri.data[o + 3] = 255; }
    nc.getContext('2d').putImageData(ni, 0, 0); rc.getContext('2d').putImageData(ri, 0, 0);
    return (CANV[key] = { n: nc, r: rc });
  }
  // 땅 (맵마다): 잔디 · 눈 · 모래(사막) · 해변 모래 · 도시 포장 — 투명도 칸에 큰 얼룩(셰이더가 멀리서 색을 흔듦)
  function groundCanvas(far, night, N) {
    const key = 'gnd' + far + night + N; if (CANV[key]) return CANV[key];
    const PAL = { hills: ['#3F7D2E', '#77B548', '#9CCB5A'], peaks: ['#D9E3EF', '#F6F9FC', '#BCC9DA'], mesa: ['#B9824E', '#DDAA6E', '#8E5A36'], ocean: ['#D2BC8A', '#EBDDB4', '#B9A274'], city: night ? ['#262A3A', '#363B4F', '#1C1F2C'] : ['#6A7080', '#868C9A', '#555A66'] };
    const pal = (PAL[far] || PAL.hills).map(hexRGB), c = canvasOf(N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, r = rng(31 + N);
    const t1 = fbm(N, N, 4, 4, 41), t2 = pnoise(N, N, N >> 3, N >> 3, 43), mac = fbm(N, N, 2, 3, 47), col = new Float32Array(N * N * 3);
    for (let i = 0; i < N * N; i++) { let t = clamp01(t1[i] * 0.75 + t2[i] * 0.45 - 0.1); const a = pal[0], b = pal[1];
      let R = a[0] + (b[0] - a[0]) * t, G = a[1] + (b[1] - a[1]) * t, B = a[2] + (b[2] - a[2]) * t; const s = 0.92 + r() * 0.16; col[i * 3] = R * s; col[i * 3 + 1] = G * s; col[i * 3 + 2] = B * s; }
    const put = (x, y, m, mix) => { x = ((x % N) + N) % N; y = ((y % N) + N) % N; const o = (y * N + x) * 3; if (mix) { col[o] += (mix[0] - col[o]) * m; col[o + 1] += (mix[1] - col[o + 1]) * m; col[o + 2] += (mix[2] - col[o + 2]) * m; } else { col[o] *= m; col[o + 1] *= m; col[o + 2] *= m; } };
    if (far === 'hills') {                                                                            // 풀잎 (짧은 세로 획 · 밝은/어두운) · 클로버 · 작은 꽃
      for (let q = 0; q < N * N * 0.09; q++) { const x = Math.floor(r() * N), y = Math.floor(r() * N), L = 2 + Math.floor(r() * 4), lt = r() < 0.5; for (let s = 0; s < L; s++) put(x + (s >> 1) * (lt ? 1 : 0), y - s, lt ? 1.18 : 0.78); }
      for (let q = 0; q < N * N * 0.0008; q++) { const x = Math.floor(r() * N), y = Math.floor(r() * N), fc = [[255, 255, 255], [255, 220, 90], [250, 160, 200]][q % 3]; put(x, y, 0.85, fc); put(x + 1, y, 0.6, fc); }
    } else if (far === 'peaks') {                                                                     // 눈: 바람 결 · 반짝이
      for (let q = 0; q < N * N * 0.02; q++) { const x = Math.floor(r() * N), y = Math.floor(r() * N), L = 3 + Math.floor(r() * 8); for (let s = 0; s < L; s++) put(x + s, y, 0.95); }
      for (let q = 0; q < N * N * 0.003; q++) put(Math.floor(r() * N), Math.floor(r() * N), 0.9, [255, 255, 255]);
    } else if (far === 'mesa' || far === 'ocean') {                                                   // 모래: 잔물결 · 자갈
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const w = Math.sin((y + t1[y * N + x] * 40) * (far === 'ocean' ? 0.35 : 0.22) * 256 / N); if (w > 0.75) put(x, y, far === 'ocean' ? 1.05 : 0.93); }
      for (let q = 0; q < N * N * 0.004; q++) { const x = Math.floor(r() * N), y = Math.floor(r() * N), m = r() < 0.5 ? 0.6 : 1.25; put(x, y, m); put(x + 1, y, m); put(x, y + 1, m); }
    } else {                                                                                          // 도시: 보도블록 줄눈
      const cell = N / 8; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (x % cell < 1.2 || y % cell < 1.2) put(x, y, 0.7);
    }
    for (let i = 0; i < N * N; i++) { const o = i * 4; d[o] = Math.min(255, col[i * 3]); d[o + 1] = Math.min(255, col[i * 3 + 1]); d[o + 2] = Math.min(255, col[i * 3 + 2]); d[o + 3] = 150 + mac[i] * 105; }
    g.putImageData(img, 0, 0); return (CANV[key] = c);
  }
  // 옹벽 (도로 가장자리에서 땅까지): 돌쌓기 · 붉은 지층 · 바위 · 콘크리트
  function wallCanvas(far, night) {
    const key = 'wall' + far + night; if (CANV[key]) return CANV[key];
    const N = 128, c = canvasOf(N), g = c.getContext('2d'), r = rng(91), nz = fbm(N, N, 4, 3, 93);
    const pal = night ? ['#3A3F55', '#2C3044'] : far === 'mesa' ? ['#B5683E', '#94502E'] : far === 'peaks' ? ['#8A93A3', '#6E7686'] : far === 'ocean' ? ['#CFC6B2', '#B0A68E'] : far === 'city' ? ['#8C93A2', '#767D8C'] : ['#A89676', '#8C7A5C'];
    g.fillStyle = pal[0]; g.fillRect(0, 0, N, N);
    if (far === 'mesa') { for (let y = 0; y < N; y += 8 + Math.floor(r() * 10)) { g.fillStyle = r() < 0.5 ? pal[1] : '#D08A55'; g.fillRect(0, y, N, 3 + r() * 5); } }   // 지층
    else if (far === 'city' || far === 'ocean' || night) { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < N; x += 32) g.fillRect(x, 0, 2, N); g.fillRect(0, 0, N, 2); g.fillRect(0, 64, N, 2); }   // 콘크리트 판
    else { for (let y = 0; y < N; y += 16) for (let x = ((y / 16) % 2) * 12; x < N + 24; x += 24) { g.fillStyle = 'rgba(0,0,0,' + (0.12 + r() * 0.18) + ')'; g.fillRect(x - 24, y, 22, 14); g.fillStyle = 'rgba(255,255,255,' + (r() * 0.12) + ')'; g.fillRect(x - 23, y + 1, 20, 3); } }   // 돌쌓기
    const id = g.getImageData(0, 0, N, N); for (let i = 0; i < N * N; i++) { const m = 0.85 + nz[i] * 0.3; id.data[i * 4] *= m; id.data[i * 4 + 1] *= m; id.data[i * 4 + 2] *= m; } g.putImageData(id, 0, 0);
    return (CANV[key] = c);
  }
  // 지름길 흙길: 바퀴 자국 두 줄 · 자갈 · 젖은 얼룩 + 진행 방향 화살표(예전 그림과 같은 자리)
  function dirtCanvas() {
    if (CANV.dirt) return CANV.dirt; const W = 256, H = 512, c = canvasOf(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, r = rng(71);
    const t1 = fbm(W, H, 4, 4, 73, 2), t2 = pnoise(W, H, 64, 128, 79);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, u = x / W, rut = Math.exp(-Math.pow((u - 0.3) / 0.06, 2)) + Math.exp(-Math.pow((u - 0.7) / 0.06, 2));
      let v = 0.8 + (t1[i] - 0.5) * 0.45 + (t2[i] - 0.5) * 0.2 - rut * 0.16; const rr = r(); if (rr < 0.03) v *= 0.7; else if (rr > 0.975) v *= 1.3;
      const o = i * 4; d[o] = 150 * v; d[o + 1] = 112 * v; d[o + 2] = 76 * v; d[o + 3] = 255; }
    g.putImageData(img, 0, 0);
    for (let q = 0; q < 160; q++) { const x = r() * W, y = r() * H, s = 1.5 + r() * 3; g.fillStyle = r() < 0.5 ? 'rgba(90,70,50,0.7)' : 'rgba(200,180,150,0.7)'; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); }   // 자갈
    g.fillStyle = 'rgba(255,240,200,0.7)'; g.beginPath(); g.moveTo(128, 80); g.lineTo(200, 176); g.lineTo(168, 176); g.lineTo(128, 128); g.lineTo(88, 176); g.lineTo(56, 176); g.closePath(); g.fill();   // 화살표 (예전 64×128 그림의 4배)
    return (CANV.dirt = c);
  }
  // 연석: 두 색 블록 + 둥근 윗면(밝게) · 바깥 홈(어둡게) · 때
  function kerbCanvas(kerb) {
    const key = 'kerb' + kerb.join(); if (CANV[key]) return CANV[key];
    const c = canvasOf(32, 64), g = c.getContext('2d'); g.fillStyle = kerb[0]; g.fillRect(0, 0, 32, 32); g.fillStyle = kerb[1] || '#fff'; g.fillRect(0, 32, 32, 32);
    const gr = g.createLinearGradient(0, 0, 32, 0); gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(0.9, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.4)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 64); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 31, 32, 2); g.fillRect(0, 63, 32, 1);
    const r = rng(5); for (let q = 0; q < 70; q++) { g.fillStyle = 'rgba(40,36,30,' + (r() * 0.2) + ')'; g.fillRect(r() * 32, r() * 64, 2, 2); }
    return (CANV[key] = c);
  }
  // 가드레일 (W형 단면: 밝은 띠 둘 · 어두운 골 · 위아래 테두리)
  function railCanvas() {
    if (CANV.rail) return CANV.rail; const c = canvasOf(8, 64), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    [[0, '#6D7480'], [0.08, '#E8ECF2'], [0.22, '#C4CAD4'], [0.36, '#7C8390'], [0.5, '#5E6470'], [0.64, '#7C8390'], [0.78, '#E2E7EE'], [0.92, '#B8BFCA'], [1, '#5E6470']].forEach(([s, col]) => gr.addColorStop(s, col));
    g.fillStyle = gr; g.fillRect(0, 0, 8, 64); return (CANV.rail = c);
  }
  // 구름 띠 (가로 = 하늘 한 바퀴, 이어짐) — 빨강 = 구름 양 · 초록 = 윗면 밝기
  function cloudCanvas(W, H) {
    const key = 'cloud' + W; if (CANV[key]) return CANV[key];
    const nz = fbm(W, H, 6, 5, 131, 0.5), c = canvasOf(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, dens = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { const v = 1 - y / H, prof = Math.sin(Math.PI * clamp01((v - 0.03) / 0.8)); for (let x = 0; x < W; x++) dens[y * W + x] = sstep(0.5, 0.78, nz[y * W + x] * (0.75 + 0.35 * prof)) * prof; }
    const k = Math.max(1, H >> 5);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, below = dens[Math.min(H - 1, y + k) * W + x], above = dens[Math.max(0, y - k) * W + x];
      d[i * 4] = dens[i] * 255; d[i * 4 + 1] = clamp01(0.62 + (below - above) * 1.6 - dens[i] * 0.15) * 255; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); return (CANV[key] = c);
  }
  // 물결 노멀 (이어짐)
  function waterNormalCanvas() {
    if (CANV.wn) return CANV.wn; const N = 256, h = fbm(N, N, 8, 4, 151), c = canvasOf(N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = (h[y * N + (x + N - 1) % N] - h[y * N + (x + 1) % N]) * 9, dy = (h[((y + N - 1) % N) * N + x] - h[((y + 1) % N) * N + x]) * 9, inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), o = (y * N + x) * 4;
      d[o] = (dx * inv * 0.5 + 0.5) * 255; d[o + 1] = (dy * inv * 0.5 + 0.5) * 255; d[o + 2] = (inv * 0.5 + 0.5) * 255; d[o + 3] = 255; }
    g.putImageData(img, 0, 0); return (CANV.wn = c);
  }
  // 입자 그림 4칸: 연기 덩어리 · 빛 점 · 불꽃(세로로 긴) · 물방울/흙덩이
  function particleCanvas() {
    if (CANV.part) return CANV.part; const c = canvasOf(512, 128), g = c.getContext('2d'), r = rng(17);
    const blob = (x, y, rad, a, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); };
    for (let q = 0; q < 16; q++) { const a = r() * 6.28, d = r() * 26; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 22 + r() * 18, 0.32, '255,255,255'); }   // 연기
    blob(64, 64, 58, 0.25, '255,255,255');
    blob(192, 64, 60, 0.45, '255,255,255'); blob(192, 64, 22, 1, '255,255,255');                       // 빛 점
    g.save(); g.translate(320, 64); g.scale(0.42, 1); blob(0, 10, 54, 0.9, '255,255,255'); blob(0, 26, 26, 1, '255,255,255'); g.restore();   // 불꽃
    for (let q = 0; q < 7; q++) blob(448 + (r() - 0.5) * 50, 64 + (r() - 0.5) * 50, 8 + r() * 10, 0.95, '255,255,255');   // 물방울·흙덩이
    return (CANV.part = c);
  }
  // 노면 자국 그림: 왼쪽 = 타이어 자국 두 줄(세로로 이어짐) · 오른쪽 위 = 출발 격자 꺾쇠 · 오른쪽 아래 = 빛 웅덩이
  function decalCanvas() {
    if (CANV.decal) return CANV.decal; const c = canvasOf(256, 256), g = c.getContext('2d'), r = rng(61);
    for (let L = 0; L < 2; L++) { const x0 = 18 + L * 64; for (let x = 0; x < 24; x++) { const edge = Math.sin(Math.PI * (x + 0.5) / 24); for (let y = 0; y < 256; y += 2) { g.fillStyle = 'rgba(14,14,16,' + clamp01(0.26 * Math.pow(edge, 0.6) + (r() - 0.5) * 0.08) + ')'; g.fillRect(x0 + x, y, 1, 2); } } }   // 타이어 자국 두 줄 (세로로 이어 붙여도 끊김 없음)
    g.fillStyle = '#F2F2F2'; g.fillRect(140, 20, 100, 9); g.fillRect(140, 20, 9, 60); g.fillRect(231, 20, 9, 60);   // 격자 꺾쇠 (앞쪽이 위)
    const gr = g.createRadialGradient(192, 192, 2, 192, 192, 62); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(128, 128, 128, 128);
    return (CANV.decal = c);
  }

  // ── 셰이더 조각: 하늘색 (하늘·물 반사가 같이 씀) ──
  const SKY_FN = `
    uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHaze; uniform vec3 uSunCol; uniform vec3 uSunDir; uniform float uNight;
    vec3 skyCol( vec3 d ) {
      float h = d.y; vec3 c = mix( uHaze, uMid, smoothstep( -0.02, 0.24, h ) ); c = mix( c, uTop, smoothstep( 0.24, 0.95, h ) );
      float sd = max( dot( d, uSunDir ), 0.0 );
      c += uSunCol * ( pow( sd, 5.0 ) * 0.22 * ( 1.0 - uNight * 0.75 ) * ( 1.0 - clamp( h, 0.0, 1.0 ) ) + pow( sd, 48.0 ) * 0.35 );
      return c; }`;
  const SKY_VS = `varying vec3 vDir; void main() { vec4 wp = modelMatrix * vec4( position, 1.0 ); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const SKY_FS = SKY_FN + `
    uniform sampler2D uCloud; uniform float uTime; uniform float uCloudA; varying vec3 vDir;
    float hash3( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
    void main() {
      vec3 d = normalize( vDir ); vec3 c = skyCol( d ); float sd = dot( d, uSunDir );
      c += uSunCol * smoothstep( 0.99935, 0.99965, sd ) * ( uNight > 0.5 ? 1.6 : 9.0 );
      if ( d.y > -0.01 ) {
        vec2 uv = vec2( atan( d.z, d.x ) * 0.1591549 + 0.5 + uTime * 0.0025, clamp( d.y * 2.3, 0.0, 1.0 ) );
        vec4 cl = texture2D( uCloud, uv ); float a = cl.r * uCloudA * smoothstep( 0.0, 0.07, d.y );
        float sl = pow( max( sd, 0.0 ), 3.0 );
        vec3 lit = mix( mix( uHaze, uMid, 0.35 ) * 0.85, vec3( 1.0 ) + uSunCol * 0.35 * sl, cl.g ) * ( 1.0 - uNight * 0.82 );
        c = mix( c, lit, a ); }
      if ( uNight > 0.5 && d.y > 0.0 ) { vec3 p = d * 170.0; vec3 cell = floor( p ); float r = hash3( cell ); vec3 f = fract( p ) - 0.5;
        c += vec3( 0.85, 0.92, 1.0 ) * step( 0.991, r ) * smoothstep( 0.3, 0.06, length( f ) ) * smoothstep( 0.02, 0.3, d.y ) * ( 0.4 + 0.8 * hash3( cell + 3.1 ) ); }
      gl_FragColor = vec4( c, 1.0 );
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`;
  // 물: 바다(섬 가장자리 얕은 물 · 거품) / 물웅덩이(둥근 가장자리)
  const WATER_VS = `varying vec3 vW; varying vec2 vUv;
    #include <fog_pars_vertex>
    void main() { vUv = uv; vec4 wp = modelMatrix * vec4( position, 1.0 ); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const WATER_FS = SKY_FN + `
    uniform sampler2D uNrm; uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec4 uIsle; uniform float uPuddle; uniform float uScale;
    varying vec3 vW; varying vec2 vUv;
    #include <fog_pars_fragment>
    void main() {
      vec3 V = normalize( cameraPosition - vW ); vec2 p = vW.xz * uScale;
      vec3 n1 = texture2D( uNrm, p * 0.045 + vec2( uTime * 0.021, uTime * 0.013 ) ).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D( uNrm, p * 0.11 - vec2( uTime * 0.017, -uTime * 0.026 ) ).xyz * 2.0 - 1.0;
      vec3 N = normalize( vec3( n1.x + n2.x, 2.4 + uPuddle * 2.0, n1.y + n2.y ) );
      float fr = 0.04 + 0.96 * pow( 1.0 - max( dot( N, V ), 0.0 ), 5.0 );
      vec3 R = reflect( -V, N ); R.y = abs( R.y );
      vec3 sky = skyCol( R );
      float de = uPuddle > 0.5 ? 1e4 : max( abs( vW.x - uIsle.x ), abs( vW.z - uIsle.y ) ) - uIsle.z;
      float sh = 1.0 - smoothstep( 0.0, 70.0, de );
      vec3 base = mix( uDeep, uShallow, sh * 0.85 );
      vec3 c = mix( base, sky, clamp( fr * ( 0.85 + uPuddle * 0.3 ) + 0.08 + uPuddle * 0.22, 0.0, 1.0 ) );
      c += uSunCol * pow( max( dot( R, uSunDir ), 0.0 ), 260.0 ) * ( 5.0 - uNight * 4.0 );
      float a = 1.0;
      if ( uPuddle > 0.5 ) { float r = length( vUv - 0.5 ) * 2.0; a = smoothstep( 1.0, 0.78, r ) * 0.9; c = mix( c, c * 0.75, smoothstep( 0.5, 1.0, r ) ); }
      else { float fo = ( 1.0 - smoothstep( 0.0, 7.0, de ) ) * ( 0.55 + 0.45 * sin( de * 1.4 - uTime * 2.2 ) ); c = mix( c, vec3( 0.92, 0.96, 1.0 ), clamp( fo, 0.0, 1.0 ) * 0.7 ); }
      gl_FragColor = vec4( c, a );
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`;
  // 입자: 화면을 향한 사각형 (인스턴스 · 그림 4칸 중 하나 · 크기 가로세로 · 회전)
  const PART_VS = `attribute vec3 iOff; attribute vec4 iCol; attribute vec4 iSz; varying vec2 vUv; varying vec4 vCol;
    #include <fog_pars_vertex>
    void main() { vec4 mvPosition = modelViewMatrix * vec4( iOff, 1.0 ); float c = cos( iSz.z ), s = sin( iSz.z ); vec2 q = position.xy * iSz.xy;
      mvPosition.xy += vec2( c * q.x - s * q.y, s * q.x + c * q.y ); gl_Position = projectionMatrix * mvPosition; vUv = vec2( ( uv.x + iSz.w ) * 0.25, uv.y ); vCol = iCol;
      #include <fog_vertex>
    }`;
  const PART_FS = `uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
    #include <fog_pars_fragment>
    void main() { vec4 t = texture2D( map, vUv ); gl_FragColor = vec4( vCol.rgb * t.rgb, vCol.a * t.a );
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`;
  // 스키드 자국: 정점마다 색·투명도
  const SKID_VS = `attribute vec4 skc; varying vec4 vC;
    #include <fog_pars_vertex>
    void main() { vC = skc; vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 ); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const SKID_FS = `varying vec4 vC;
    #include <fog_pars_fragment>
    void main() { gl_FragColor = vC;
      #include <encodings_fragment>
      #include <fog_fragment>
    }`;
  const skyUniforms = (lk) => ({ uTop: { value: lk.top }, uMid: { value: lk.mid }, uHaze: { value: lk.haze }, uSunCol: { value: lk.sunCol }, uSunDir: { value: lk.sunDir }, uNight: { value: lk.night } });

  P.buildReal10 = function () {
    const T = THREE, tr = this.track, S = this.S, n = tr.n, hw = tr.halfW, far = tr.theme.far || 'hills', d = tr.def, sky = d.sky || {}, hi = this.hq === 'high', q = QP[hi ? 'high' : 'mid'];
    const L = LOOK[this.night ? 'night' : far] || LOOK.hills; this._q10 = q; this._look = L;
    // 해 방향: 출발 직선을 바라볼 때 앞쪽 비스듬히 (그림자가 카메라 쪽으로 · 해가 하늘에 보임)
    const [tx0, ty0] = tr.tangent[0], fwd = new T.Vector3(tx0, 0, ty0).normalize(), side = new T.Vector3(-fwd.z, 0, fwd.x), el = L.el * Math.PI / 180, az = L.az * Math.PI / 180;
    const sunDir = fwd.clone().multiplyScalar(Math.cos(el) * Math.cos(az)).addScaledVector(side, Math.cos(el) * Math.sin(az)).setY(Math.sin(el)).normalize();
    this.sunDir = sunDir; this.sunOff = sunDir.clone().multiplyScalar(110);
    if (this.sun) { this.sun.color.copy(lc(L.sun)); this.sun.intensity = L.si; this.sun.position.copy(this.sun.target.position).add(this.sunOff); }
    if (this.hemi) { this.hemi.color.copy(lc(L.sky)); this.hemi.groundColor.copy(lc(L.gnd)); this.hemi.intensity = L.hi; }
    this.renderer.toneMappingExposure = L.exp;
    const haze = new T.Color(sky.haze || sky.low || '#BFE0F5');
    const look = { top: lc(sky.top || '#1E3A5F'), mid: lc(sky.mid || '#4E8FC7'), haze: haze.clone().convertSRGBToLinear(), sunCol: lc(this.night ? '#DDE6FF' : (sky.sun || L.sun)).multiplyScalar(1).lerp(lc(L.sun), 0.5), sunDir, night: this.night ? 1 : 0 };
    this._skyLook = look;
    // 1) 하늘 (예전 그라데이션 공 → 셰이더) · 그린 구름 덩어리는 치움
    const skyM = this.scene.children.find(o => o.userData.sky);
    this.scene.children.filter(o => o.userData.clouds).forEach(o => this.scene.remove(o));
    if (skyM) { const ct = new T.CanvasTexture(cloudCanvas(hi ? 1024 : 512, hi ? 256 : 128)); ct.wrapS = T.RepeatWrapping; ct.minFilter = T.LinearFilter; ct.generateMipmaps = false;
      const mat = new T.ShaderMaterial({ uniforms: Object.assign(skyUniforms(look), { uCloud: { value: ct }, uTime: { value: 0 }, uCloudA: { value: L.cloud } }), vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, fog: false });
      skyM.material.dispose(); if (skyM.material.map) skyM.material.map.dispose(); skyM.material = mat; skyM.renderOrder = -10; skyM.frustumCulled = false; this._sky = skyM; }
    // 환경 반사(카트 도색): 하늘 셰이더를 작은 큐브에 한 번 그려 쓰기 (고화질 사진 하늘이 오면 그것으로 바뀜)
    if (skyM) try { const es = new T.Scene(), sm = new T.Mesh(skyM.geometry, skyM.material); es.add(sm);
      const gnd = new T.Mesh(new T.CircleGeometry(1300, 24), new T.MeshBasicMaterial({ color: lc(L.gnd).multiplyScalar(0.8) })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -12; es.add(gnd);
      const rt = new T.WebGLCubeRenderTarget(hi ? 128 : 64, { generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter }), cam = new T.CubeCamera(1, 2000, rt); cam.update(this.renderer, es);
      const pm = new T.PMREMGenerator(this.renderer); this._envRT = pm.fromCubemap(rt.texture); this.scene.environment = this._envRT.texture; pm.dispose(); rt.dispose(); gnd.geometry.dispose(); gnd.material.dispose();
    } catch (e) {}
    // 2) 땅 재질 (맵마다) — 잔디·눈·모래·포장 + 멀리서 큰 얼룩(같은 그림의 투명도 칸을 크게 한 번 더)
    if (this.ground) { const N = hi ? 512 : 256, gt = new T.CanvasTexture(groundCanvas(far, this.night, N)); gt.wrapS = gt.wrapT = T.RepeatWrapping; gt.encoding = T.sRGBEncoding;
      const span = this.ground.geometry.parameters.width * this.ground.scale.x, rep = Math.round(span / 14); gt.repeat.set(rep, rep);
      const gm = this.ground.material; gm.map = gt; gm.color.set(0xffffff); gm.userData.lin = true;
      const dry = L.dry, dryCol = new T.Vector3(...L.dryCol), scl = 1 / rep;   // (큰 얼룩: 땅 전체에 몇 번 반복)
      gm.onBeforeCompile = sh => { sh.uniforms.uDry = { value: dry }; sh.uniforms.uDryCol = { value: dryCol };
        sh.fragmentShader = 'uniform float uDry; uniform vec3 uDryCol;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float gm1 = texture2D( map, vUv * ${(scl * 9.7).toFixed(5)} ).a, gm2 = texture2D( map, vUv * ${(scl * 31.3).toFixed(5)} + 0.37 ).a;
          diffuseColor.rgb *= mix( 0.7, 1.2, clamp( ( gm1 * 0.6 + gm2 * 0.4 - 0.588 ) / 0.412, 0.0, 1.0 ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * uDryCol, clamp( ( 1.0 - ( gm2 - 0.588 ) / 0.412 ) * uDry, 0.0, 1.0 ) ); diffuseColor.a = 1.0;`); };
      gm.customProgramCacheKey = () => 'kart3d-ground'; gm.needsUpdate = true; }
    // 3) 옹벽 · 연석 · 가드레일(W형 + 기둥)
    if (this.skirtMat) { const wt = new T.CanvasTexture(wallCanvas(far, this.night)); wt.wrapS = wt.wrapT = T.RepeatWrapping; wt.encoding = T.sRGBEncoding; this.skirtMat.map = wt; this.skirtMat.color.set(0xffffff); this.skirtMat.userData.lin = true; this.skirtMat.needsUpdate = true; }
    if (this.dirtMat) { const dt = new T.CanvasTexture(dirtCanvas()); dt.wrapS = dt.wrapT = T.RepeatWrapping; dt.encoding = T.sRGBEncoding; this.dirtMat.map = dt; this.dirtMat.needsUpdate = true; }
    if (this.kerbMat) { const kt = new T.CanvasTexture(kerbCanvas((tr.theme.kerb && tr.theme.kerb.length) ? tr.theme.kerb : ['#E63946', '#F5F5F5'])); kt.wrapS = kt.wrapT = T.RepeatWrapping; kt.encoding = T.sRGBEncoding; this.kerbMat.map = kt; this.kerbMat.needsUpdate = true; }
    if (this.railMesh) { const rt2 = new T.CanvasTexture(railCanvas()); rt2.encoding = T.sRGBEncoding; const rm = this.railMesh.material; rm.map = rt2; rm.color.set(this.night ? 0xA8B0CC : 0xffffff); rm.userData.lin = true; rm.userData.rough = 0.4; rm.userData.metal = 0.7; rm.needsUpdate = true;
      this.railMesh.castShadow = this.hq === 'high';   // (가드레일 그림자는 고화질만 — 보통은 그림자 그리기 1번·삼각형 수천 개를 아낌)
      const list = this.railList || [], posts = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.95, 0.16), new T.MeshLambertMaterial({ color: this.night ? 0x5A6080 : 0x8A919E }), Math.max(1, list.length)), m4 = new T.Matrix4(), one = new T.Vector3(1, 1, 1), qi = new T.Quaternion();
      list.forEach((o, k) => { const a = this.P(o.x, o.y, o.e); a.y += 0.47; m4.compose(a, qi, one); posts.setMatrixAt(k, m4); }); posts.count = list.length; posts.receiveShadow = true; this.scene.add(posts); }
    // 4) 노면 자국 (한 덩어리): 코너의 고무 자국 · 출발 격자 꺾쇠 · 출발 자국
    this.buildDecals10();
    // 5) 물: 바다 · 물웅덩이 (하늘 반사)
    const wn = new T.CanvasTexture(waterNormalCanvas()); wn.wrapS = wn.wrapT = T.RepeatWrapping; this._wn = wn;
    const waterMat = (puddle, deep, shallow, isle) => { const m = new T.ShaderMaterial({ uniforms: Object.assign(T.UniformsUtils.merge([T.UniformsLib.fog]), skyUniforms(look), { uNrm: { value: wn }, uTime: { value: 0 }, uDeep: { value: lc(deep) }, uShallow: { value: lc(shallow) }, uIsle: { value: isle || new T.Vector4(0, 0, 1e5, 0) }, uPuddle: { value: puddle ? 1 : 0 }, uScale: { value: puddle ? 3.2 : 1 } }),
      vertexShader: WATER_VS, fragmentShader: WATER_FS, fog: true, transparent: !!puddle, depthWrite: !puddle });
      (this._waterMats = this._waterMats || []).push(m); return m; };
    if (this.sea) { const g0 = this.ground, half = g0.geometry.parameters.width * g0.scale.x / 2; this.sea.material.dispose(); this.sea.material = waterMat(false, '#0E4F86', '#3FC1C9', new T.Vector4(g0.position.x, g0.position.z, half, 0)); this.sea.receiveShadow = false; }
    (this.obsMeshes || []).forEach(({ o, m }) => { if (o.kind !== 'puddle') return; m.material.dispose(); m.material = waterMat(true, this.night ? '#202A44' : '#4E5E72', '#6A7C8E'); m.renderOrder = 2; m.receiveShadow = false; });
    // 6) 아이템 상자: 은은히 빛나게 · 부스터 발판: 화살표가 흐름
    if (this.boxMesh) { const bm = this.boxMesh.material; bm.emissive = new T.Color(0xffffff); bm.emissiveMap = bm.map; bm.emissiveIntensity = 0.35; bm.needsUpdate = true; }
    if (this.padTex) { this.padTex.wrapS = this.padTex.wrapT = T.RepeatWrapping; this.padTex.needsUpdate = true; }
    // 7) 입자 (연기·먼지·물보라 = 보통 섞기 · 불꽃·스파크·빛 = 더하기) · 스키드 자국 · 멀리 카트 그림자 · 밤 조명
    const pt = new T.CanvasTexture(particleCanvas());
    this._pN = this.makeBatch10(q.pN, false, pt); this._pA = this.makeBatch10(q.pA, true, pt);
    this._parts = []; this._free = []; this._imm = []; this._em = {}; this._nN10 = 0; this._nA10 = 0;
    if (this.partMesh) this.partMesh.visible = false;
    this.buildSkids10(q.skid);
    { const bg = new T.PlaneGeometry(2.2, 3.4); bg.rotateX(-Math.PI / 2); this._blob = new T.InstancedMesh(bg, new T.MeshBasicMaterial({ map: this.contactMat().map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 80); this._blob.count = 0; this._blob.frustumCulled = false; this._blob.renderOrder = 1; this.scene.add(this._blob); }
    if (this.night) this.buildNight10();
    this.buildScatter10();
    this._r10 = true;
  };

  // 풀 덤불 (땅 위 · 인스턴스 1번 · 엇갈린 판 두 장) — 초원: 풀·꽃 · 사막: 마른 덤불 · 해변: 갯풀 · 설산: 눈 덮인 덤불 · 도시는 없음
  P.buildScatter10 = function () {
    const T = THREE, tr = this.track, S = this.S, far = tr.theme.far || 'hills'; if (far === 'city' || this.night) return;
    const N = this.hq === 'high' ? 2600 : 1100, key = 'scat' + far;
    const c = CANV[key] || (CANV[key] = (() => { const cv = canvasOf(256, 128), g = cv.getContext('2d'), r = rng(far.length * 7 + 3);
      const PAL = { hills: [['#3E7F2C', '#6DB443', '#94CF5A'], ['#FF6BA8', '#FFD84A', '#FFFFFF']], mesa: [['#7A6A3A', '#A8925A', '#C9B27A'], ['#6E7A3A', '#8E9A4A', '#B4A060']], ocean: [['#8FA84A', '#B9C46A', '#D8D48A'], ['#7E9A44', '#A7B860', '#E8DCA0']], peaks: [['#2F5A3A', '#3F6E48', '#E8F0FA'], ['#5A6270', '#7A8290', '#F4F8FC']] }[far] || [['#3E7F2C', '#6DB443', '#94CF5A'], ['#FF6BA8', '#FFD84A', '#FFFFFF']];
      for (let t = 0; t < 2; t++) { const x0 = t * 128;
        for (let q = 0; q < 34; q++) { const bx = x0 + 18 + r() * 92, h = 40 + r() * 80, lean = (r() - 0.5) * 30; g.strokeStyle = PAL[0][Math.floor(r() * 3) % 2 + (r() < 0.25 ? 1 : 0)]; g.lineWidth = 3 + r() * 3; g.lineCap = 'round';
          g.beginPath(); g.moveTo(bx, 128); g.quadraticCurveTo(bx + lean * 0.3, 128 - h * 0.6, bx + lean, 128 - h); g.stroke(); }
        if (t === 1) for (let q = 0; q < 7; q++) { const fx = x0 + 24 + r() * 80, fy = 30 + r() * 50; g.fillStyle = PAL[1][q % 3]; g.beginPath(); g.arc(fx, fy, far === 'hills' ? 6 + r() * 4 : 3 + r() * 3, 0, Math.PI * 2); g.fill(); } }
      return cv; })());
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
    const geo = new T.BufferGeometry(), pos = [], uv = [], nor = [], idx = [];
    [0, Math.PI / 2].forEach((a, k) => { const dx = Math.cos(a) * 0.9, dz = Math.sin(a) * 0.9, b = pos.length / 3; pos.push(-dx, 0, -dz, dx, 0, dz, dx, 1.1, dz, -dx, 1.1, -dz); uv.push(0, 0, 0.5, 0, 0.5, 1, 0, 1); for (let i = 0; i < 4; i++) nor.push(0, 1, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); });
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
    const geo2 = geo.clone(); const u2 = geo2.attributes.uv; for (let i = 0; i < u2.count; i++) u2.setX(i, u2.getX(i) + 0.5);
    const mat = new T.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: T.DoubleSide }); mat.userData.lin = true;
    const r = rng(tr.n * 13 + 5), g0 = this.ground, half = g0 ? g0.geometry.parameters.width * g0.scale.x / 2 : 1e9, gx = g0 ? g0.position.x : 0, gz = g0 ? g0.position.z : 0;
    const list = [];
    for (let t = 0; t < N * 3 && list.length < N; t++) { const i = Math.floor(r() * tr.n), side = r() < 0.5 ? -1 : 1, off = side * (1.3 + Math.pow(r(), 1.6) * 5.5), c0 = tr.center[i], tg = tr.tangent[i];
      const x = c0[0] - tg[1] * tr.halfW * off, y = c0[1] + tg[0] * tr.halfW * off;
      { let near = false; const lim = (tr.halfW * 1.25) * (tr.halfW * 1.25), C = tr.center; for (let k = 0; k < tr.n; k += 2) { const ddx = C[k][0] - x, ddy = C[k][1] - y; if (ddx * ddx + ddy * ddy < lim) { near = true; break; } } if (near) continue; }   // (코스의 다른 부분 위에도 놓지 않게) if (tr.shortcuts.length) { const sc = tr.scAt(x, y); if (sc && sc.d < sc.w * 1.6) continue; }
      const wx = x * S, wz = y * S; if (Math.abs(wx - gx) > half - 3 || Math.abs(wz - gz) > half - 3) continue;
      list.push([wx, wz, r(), r()]); }
    const mk = (g, sub) => { const im = new T.InstancedMesh(g, mat, Math.max(1, sub.length)), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), cc = new T.Color(), up = new T.Vector3(0, 1, 0), p = new T.Vector3();
      sub.forEach((o, k) => { const s2 = 0.8 + o[2] * 1.1; q.setFromAxisAngle(up, o[3] * 6.28); sc.set(s2, s2 * (0.8 + o[3] * 0.5), s2); p.set(o[0], this.groundY, o[1]); m4.compose(p, q, sc); im.setMatrixAt(k, m4); cc.setRGB(0.8 + o[3] * 0.35, 0.85 + o[2] * 0.25, 0.8 + o[2] * 0.2); im.setColorAt(k, cc); });
      im.count = sub.length; im.receiveShadow = true; this.scene.add(im); return im; };
    const cut = this.hq === 'high' ? Math.floor(list.length * (far === 'hills' ? 0.7 : 0.6)) : list.length; this._scatter = [mk(geo, list.slice(0, cut))]; if (cut < list.length) this._scatter.push(mk(geo2, list.slice(cut)));   // (보통 화질은 한 종류만 — 그리기 1번)
  };
  // 노면 자국 한 덩어리 (그리기 1번): 드리프트 구간의 고무 자국(바깥 → 안쪽 꼭짓점 → 바깥) · 출발 격자 · 출발할 때 남은 자국
  P.buildDecals10 = function () {
    const T = THREE, tr = this.track, S = this.S, n = tr.n, hw = tr.halfW, pos = [], uv = [], idx = [];
    const ptAt = (i, off, f) => { const j = ((i % n) + n) % n, j2 = (j + 1) % n, c = tr.center[j], c2 = tr.center[j2], t = tr.tangent[j]; const x = c[0] + (c2[0] - c[0]) * (f || 0), y = c[1] + (c2[1] - c[1]) * (f || 0); return [(x - t[1] * hw * off) * S, (tr.elev[j] + (tr.elev[j2] - tr.elev[j]) * (f || 0)) * S + 0.045, (y + t[0] * hw * off) * S]; };
    const quad = (a, b, c, d2, u0, u1, v0, v1) => { const q = pos.length / 3; pos.push(...a, ...b, ...c, ...d2); uv.push(u0, v0, u1, v0, u0, v1, u1, v1); idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); };
    // 고무 자국 띠: i 를 따라 lateral(t) 로 휘는 폭 w(m) 띠 — 구간마다 v 0→1 (자국 그림이 세로로 이어짐)
    const streak = (i0, i1, latF, wM, u0) => { const len = ((i1 - i0) % n + n) % n; if (len < 3) return; const wo = wM / 2 / (hw * S);
      for (let k = 0; k < len; k++) { const t0 = k / len, t1 = (k + 1) / len, i = i0 + k; if (tr.gapSeg[((i % n) + n) % n]) continue; const l0 = latF(t0), l1 = latF(t1), al = Math.min(1, Math.min(t0, 1 - t1) * 6);
        if (al <= 0.05) continue; quad(ptAt(i, l0 - wo), ptAt(i, l0 + wo), ptAt(i + 1, l1 - wo), ptAt(i + 1, l1 + wo), u0, u0 + 0.47, 0, 1); } };
    (tr.driftZones || []).forEach(z => { const dir = z.dir || 1, from = z.from - 4, to = z.to + 4;
      streak(from, to, t => dir * (-0.55 + 1.15 * Math.sin(Math.PI * t)), 2.2, 0.02);
      streak(from + 2, to - 1, t => dir * (-0.42 + 0.98 * Math.sin(Math.PI * t)) + 0.09, 2.2, 0.02); });
    // 출발 격자 꺾쇠 (출발 자리마다) + 앞쪽으로 짧은 출발 자국
    const slots = Math.min(30, tr.perRow * 6);
    for (let s = 0; s < slots; s++) { const st = tr.startPos(s), a = st.angle, fx = Math.cos(a), fy = Math.sin(a), nx = -fy, ny = fx, e = tr.elev[st.index] * S + 0.05;
      const P2 = (f, l) => [(st.x + fx * f + nx * l) * S, e, (st.y + fy * f + ny * l) * S], cl = tr.carLen, hwK = cl * 0.42;
      quad(P2(cl * 0.55, hwK), P2(cl * 0.55, -hwK), P2(cl * 0.05, hwK), P2(cl * 0.05, -hwK), 0.547, 0.938, 0.92, 0.69);   // (그림의 꺾쇠: 위가 앞)
      if (s < 12) [-1, 1].forEach(sd => { const l = sd * cl * 0.33; quad(P2(cl * 0.4 + cl * 2.2, l - cl * 0.05), P2(cl * 0.4 + cl * 2.2, l + cl * 0.05), P2(cl * 0.4, l - cl * 0.05), P2(cl * 0.4, l + cl * 0.05), 0.08, 0.16, 1, 0); }); }
    if (!pos.length) return;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const t = new T.CanvasTexture(decalCanvas()); t.encoding = T.sRGBEncoding;
    const m = new T.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); m.userData.lin = true;
    const mesh = new T.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = 1; this.scene.add(mesh);
  };

  // 입자 묶음 하나 (그리기 1번)
  P.makeBatch10 = function (max, add, tex) {
    const T = THREE, g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = (k, w) => { const a = new T.InstancedBufferAttribute(new Float32Array(max * w), w); a.setUsage(T.DynamicDrawUsage); g.setAttribute(k, a); return a; };
    const off = A('iOff', 3), col = A('iCol', 4), sz = A('iSz', 4); g.instanceCount = 0;
    const mat = new T.ShaderMaterial({ uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { map: { value: null } }]), vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, fog: !add, blending: add ? T.AdditiveBlending : T.NormalBlending });
    mat.uniforms.map.value = tex;
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = add ? 6 : 5; this.scene.add(mesh);
    return { mesh, g, off: off.array, col: col.array, sz: sz.array, aOff: off, aCol: col, aSz: sz, max, n: 0 };
  };
  // 입자 하나 내보내기 (움직이며 사라짐) — o: {x,y,z, vx,vy,vz, life, s0, s1, asp, c:[r,g,b], a, tile, add, drag, grav, rot, vr}
  P.emit10 = function (o) {
    const add = !!o.add; if ((add ? this._nA10 : this._nN10) >= (add ? this._q10.pA : this._q10.pN)) return; if (add) this._nA10++; else this._nN10++;
    const p = this._free.pop() || {};
    p.x = o.x; p.y = o.y; p.z = o.z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.t = 0; p.life = o.life || 1; p.s0 = o.s0 || 0.5; p.s1 = o.s1 != null ? o.s1 : p.s0; p.asp = o.asp || 1;
    p.c = o.c || WHITE; p.a = o.a != null ? o.a : 1; p.tile = o.tile || 0; p.add = !!o.add; p.drag = o.drag || 0; p.grav = o.grav || 0; p.rot = o.rot != null ? o.rot : Math.random() * 6.28; p.vr = o.vr || 0; p.fade = o.fade || 0;
    this._parts.push(p);
  };
  // 이번 프레임만 그리는 빛 (헤드라이트·상자 빛·배기구 빛)
  P.imm10 = function (x, y, z, s, c, a, tile, add, asp, rot) { this._imm.push(x, y, z, s, c, a, tile, add ? 1 : 0, asp || 1, rot || 0); };
  const WHITE = [1, 1, 1];
  const COL = {}; const cl = h => COL[h] || (COL[h] = (() => { const c = new THREE.Color(h).convertSRGBToLinear(); return [c.r, c.g, c.b]; })());

  // 스키드 자국 (한 덩어리 · 오래된 것부터 덮어씀 · 25초에 걸쳐 옅어짐)
  P.buildSkids10 = function (max) {
    const T = THREE, g = new T.BufferGeometry(), pos = new Float32Array(max * 6 * 3), col = new Float32Array(max * 6 * 4);   // (사각형마다 삼각형 둘 = 정점 6개, 색인 없이)
    g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('skc', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
    const m = new T.ShaderMaterial({ uniforms: T.UniformsUtils.merge([T.UniformsLib.fog]), vertexShader: SKID_VS, fragmentShader: SKID_FS, fog: true, transparent: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 });
    const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2; this.scene.add(mesh);
    this._sk = { mesh, pos, col, max, head: 0, born: new Float32Array(max).fill(-1e9), base: new Float32Array(max), rgb: new Float32Array(max * 3), track: {}, dirty: false, fadeT: 0 };
  };
  P.skid10 = function (key, x, y, z, yaw, w, alpha, rgb, now) {
    const sk = this._sk; if (!sk) return; const tk = sk.track[key];
    if (!tk || now - tk.t > 120) { sk.track[key] = { x, y, z, t: now }; return; }
    const dx = x - tk.x, dz = z - tk.z, dd = Math.hypot(dx, dz); if (dd < 0.3) return; if (dd > 6) { sk.track[key] = { x, y, z, t: now }; return; }
    const i = sk.head; sk.head = (sk.head + 1) % sk.max; const nx = -dz / dd * w / 2, nz = dx / dd * w / 2, o = i * 18;
    const a0 = [tk.x - nx, tk.y, tk.z - nz], a1 = [tk.x + nx, tk.y, tk.z + nz], b0 = [x - nx, y, z - nz], b1 = [x + nx, y, z + nz];
    sk.pos.set(a0, o); sk.pos.set(b0, o + 3); sk.pos.set(a1, o + 6); sk.pos.set(a1, o + 9); sk.pos.set(b0, o + 12); sk.pos.set(b1, o + 15);
    sk.born[i] = now; sk.base[i] = alpha; sk.rgb[i * 3] = rgb[0]; sk.rgb[i * 3 + 1] = rgb[1]; sk.rgb[i * 3 + 2] = rgb[2]; this.skidCol10(i, now);
    tk.x = x; tk.y = y; tk.z = z; tk.t = now; sk.dirty = true;
  };
  P.skidCol10 = function (i, now) { const sk = this._sk, a = sk.base[i] * Math.max(0, 1 - (now - sk.born[i]) / 25000), o = i * 24, c = sk.col; for (let v = 0; v < 6; v++) { const q = o + v * 4; c[q] = sk.rgb[i * 3]; c[q + 1] = sk.rgb[i * 3 + 1]; c[q + 2] = sk.rgb[i * 3 + 2]; c[q + 3] = a; } };

  // 밤: 가로등 아래 빛 웅덩이 (한 덩어리 · 더하기) · 카트 헤드라이트 빛(인스턴스)
  P.buildNight10 = function () {
    const T = THREE, lamps = (this.decoObjs && this.decoObjs.lamp) || [], pos = [], uv = [], idx = [];
    lamps.forEach(o => { const p = this.P(o.x, o.y, o.e), r = 7.5, q = pos.length / 3; p.y += 0.07; pos.push(p.x - r, p.y, p.z - r, p.x + r, p.y, p.z - r, p.x - r, p.y, p.z + r, p.x + r, p.y, p.z + r); uv.push(0.5, 0.5, 1, 0.5, 0.5, 0, 1, 0); idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); });
    const t = new T.CanvasTexture(decalCanvas());
    if (pos.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      const m = new T.MeshBasicMaterial({ map: t, color: lc('#FFC873').multiplyScalar(0.55), transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); m.userData.lin = true;
      const mesh = new T.Mesh(g, m); mesh.renderOrder = 3; this.scene.add(mesh); }
    const hg = new T.PlaneGeometry(6, 11); hg.rotateX(-Math.PI / 2); hg.translate(0, 0.09, 7.2);
    const uvA = hg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, 0.5 + uvA.getX(i) * 0.5, uvA.getY(i) * 0.5);   // 빛 웅덩이 칸
    const hm = new T.MeshBasicMaterial({ map: t, color: lc('#DDE8FF').multiplyScalar(0.11), transparent: true, depthWrite: false, blending: T.AdditiveBlending }); hm.userData.lin = true;
    this._hl = new T.InstancedMesh(hg, hm, 16); this._hl.count = 0; this._hl.frustumCulled = false; this._hl.renderOrder = 3; this.scene.add(this._hl);
  };

  // ── 매 프레임 ──
  P.updateReal10 = function (now) {
    const T = THREE, dt = Math.min(0.05, Math.max(0, (now - (this._t10 || now)) / 1000)), cam = this.camera, tr = this.track, S = this.S, q = this._q10, rate = q.rate; this._t10 = now;
    const tsec = now / 1000;
    if (this._sky) { this._sky.position.copy(cam.position); this._sky.material.uniforms.uTime.value = tsec; }
    (this._waterMats || []).forEach(m => { m.uniforms.uTime.value = tsec; });
    if (this.padTex) this.padTex.offset.y = -((now / 450) % 1);
    if (this.boxMesh) this.boxMesh.material.emissiveIntensity = 0.3 + 0.18 * Math.sin(now / 260);
    if (this._flags) this._flags.forEach((f, k) => { const pa = f.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, Math.sin(x * 2.2 + now / 180 + k) * 0.12 * (x + 1.2)); } pa.needsUpdate = true; });
    if (this.crowdBody && this.countdown <= 0 && this._goAtLamp != null && now - this._goAtLamp < 4000) {}   // (관중 환호: 인스턴스를 매 프레임 바꾸면 무거워 생략)
    const sky = this._skyLook, sunCol = sky.sunCol;
    // 카트들: 나 + 가까운 자세한 모델
    const ids = Object.keys(this.karts), me = this.karts.__me, lights = this.night ? [] : null;
    for (let i = 0; i < ids.length; i++) { const id = ids[i], k = this.karts[id]; if (!k || !k.g.visible) continue; this.kartFx10(id, k, now, dt, lights); }
    for (const id in this._em) if (!this.karts[id]) delete this._em[id];
    // 아이템 상자 아래 빛
    if (this.boxMesh && this.boxBase && me) { const mp = me.g.position; let nb = 0;
      tr.itemSpots.forEach((sp, k) => { if (nb >= 24 || sp.takenUntil > now) return; const b = this.boxBase[k]; if (Math.abs(b.x - mp.x) + Math.abs(b.z - mp.z) > 160) return; nb++; this.imm10(b.x, b.y, b.z, 3.4 + Math.sin(now / 200 + k) * 0.3, cl('#FFE7A8'), 0.32, 1, true); }); }
    // 2D 입자(벽 충돌 불꽃·드리프트 충전 불꽃·부스터 반짝이·물보라)를 부드러운 빛·물방울로
    (this.parts || []).forEach(pt => { if (pt.x == null) return; const col = pt.color || pt.c || '#FFD166'; if (col === '#E6E6E6' || col === '#C9C9C9') return;   // (회색 연기는 아래 연기 입자가 대신)
      if (pt.e3 == null) pt.e3 = this.elevAtXY(pt.x, pt.y, this.segIdx).e;
      const wet = col === '#9BD3FF' || col === '#E6F4FF' || col === '#4C9BE8', life = pt.life != null ? pt.life : 1, s = Math.max(0.12, life) * Math.min(1.2, (pt.size || 6) / 12) * (wet ? 0.7 : 0.55);
      this.imm10(pt.x * S, pt.e3 * S + (pt.h || 0) * S + 0.3, pt.y * S, s, cl(col), wet ? 0.8 * life : Math.min(1, life * 1.4), wet ? 3 : 1, !wet); });
    // 벽 충돌·피격 흔들림 (2D 판의 shakeT) · 착지 쿵
    if (!this.spectator) { const sh = (this.shakeT || 0) * 0.9 + (this._land10 || 0); if (sh > 0.01) { cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh * 0.6; } this._land10 = Math.max(0, (this._land10 || 0) - dt * 2.2);
      const sp = Math.max(0, this.speed / this.maxSpeed - 0.92); if (sp > 0 && !this.finished) { cam.position.y += (Math.random() - 0.5) * sp * 0.12; } }
    // 입자 움직이기 · 버퍼 쓰기
    this.stepParts10(dt, now);
    // 스키드 자국 옅어짐 (0.5초마다)
    const sk = this._sk; if (sk && now - sk.fadeT > 500) { sk.fadeT = now; for (let i = 0; i < sk.max; i++) if (sk.born[i] > -1e8) this.skidCol10(i, now); sk.dirty = true; }
    if (sk && sk.dirty) { sk.dirty = false; sk.mesh.geometry.attributes.position.needsUpdate = true; sk.mesh.geometry.attributes.skc.needsUpdate = true; }
    // 접지 그림자 (모든 카트 한 번에): 자세한 카트 + 멀리 그리는 카트 (인스턴스 위치 그대로)
    const fm = this._farK, bl = this._blob; if (bl) { const m4 = this._m4b || (this._m4b = new T.Matrix4()), v = this._vb || (this._vb = new T.Vector3()), qq = this._qb || (this._qb = new T.Quaternion()), sc = this._sb || (this._sb = new T.Vector3()), up = this._upb || (this._upb = new T.Vector3(0, 1, 0));
      let c = 0; sc.set(1, 1, 1);
      for (let i = 0; i < ids.length && c < 80; i++) { const k = this.karts[ids[i]]; if (!k || !k.g.visible) continue; const ct = k.g.userData.contact; if (!ct || !ct.visible) continue; const gp = k.g.position;
        v.set(gp.x, gp.y + ct.position.y, gp.z); qq.setFromAxisAngle(up, k.g.rotation.y); m4.compose(v, qq, sc); bl.setMatrixAt(c++, m4); }
      if (fm) for (let i = 0; i < fm.count && c < 80; i++) { fm.getMatrixAt(i, m4); m4.decompose(v, qq, sc); v.y += 0.06; m4.compose(v, qq, sc); bl.setMatrixAt(c++, m4); }
      bl.count = c; bl.instanceMatrix.needsUpdate = true; }
    // 밤: 헤드라이트 빛
    if (this._hl && lights) { const m4 = this._m4h || (this._m4h = new T.Matrix4()), qq = this._qh || (this._qh = new T.Quaternion()), one = new T.Vector3(1, 1, 1), up = new T.Vector3(0, 1, 0); let c = 0;
      lights.forEach(L2 => { if (c >= 16) return; qq.setFromAxisAngle(up, L2.yaw); m4.compose(L2.p, qq, one); this._hl.setMatrixAt(c++, m4); }); this._hl.count = c; this._hl.instanceMatrix.needsUpdate = true; }
  };
  // 카트 한 대의 연출: 바퀴·서스펜션·고개(나) · 연기·먼지·물보라·불꽃 · 스키드 자국
  P.kartFx10 = function (id, k, now, dt, lights) {
    const T = THREE, g = k.g, ud = g.userData, p = g.position, isMe = id === '__me', S = this.S, rate = this._q10.rate;
    const em = this._em[id] || (this._em[id] = { x: p.x, z: p.z, y: p.y, yaw: g.rotation.y, v: 0, yr: 0, air: 0, st: 0, spin: 0, cy: 0, cv: 0, pitch: 0, lastV: 0 });
    const dx = p.x - em.x, dz = p.z - em.z, dist = Math.hypot(dx, dz), inv = dt > 0 ? 1 / dt : 0;
    let dyaw = g.rotation.y - em.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const tele = dist > 12; const v = tele ? em.v : dist * inv;                        // 순간이동(위치 교환)은 속도로 보지 않음
    em.v += (v - em.v) * Math.min(1, dt * 10); em.yr += ((tele ? 0 : dyaw * inv) - em.yr) * Math.min(1, dt * 8);
    const yaw = g.rotation.y, cy = Math.cos(yaw), sy = Math.sin(yaw), W = (lx, ly, lz) => [p.x + lx * cy + lz * sy, p.y + ly, p.z - lx * sy + lz * cy];
    const fwdX = sy, fwdZ = cy;
    // 미끄러짐: 나는 물리 값, 다른 카트는 움직이는 방향과 차체 방향의 차이
    let slip; if (isMe && !this.spectator) slip = this.slip || 0;
    else { slip = 0; if (dist > 0.05 && !tele) { const mv = Math.atan2(dx, dz); slip = yaw - mv; while (slip > Math.PI) slip -= Math.PI * 2; while (slip < -Math.PI) slip += Math.PI * 2; if (Math.abs(slip) > 1.2) slip = 0; } }
    em.slip = (em.slip || 0) + (slip - (em.slip || 0)) * Math.min(1, dt * (isMe ? 12 : 6)); slip = em.slip;   // (다른 카트는 신호 흔들림에 자국이 생기지 않게 천천히)
    const pr = isMe ? null : this.peers[id];
    const air = isMe ? (this.airZ || 0) > 0.05 : (pr && pr.z > 0.05);
    const spin = isMe ? (now < this.spinUntil || now < this.stunUntil) : !!(pr && pr.spin);
    const boost = isMe ? (now < this.boostUntil || now < this.starUntil) : !!(pr && pr.boost);
    const sliding = isMe && !this.spectator && now < (this.slideUntil || 0);
    const onDirt = isMe ? !!this.scNow : !!k.onSc;
    const spd = em.v, fast = Math.min(1, spd / 30);
    // 착지: 공중 → 땅 (먼지 고리 · 흔들림)
    if (em.air > 0 && !air && em.airT > 0.25) { for (let i = 0; i < 14 * rate + 4; i++) { const a = i / 10 * 6.28; this.emit10({ x: p.x + Math.cos(a) * 1.2, y: p.y + 0.2, z: p.z + Math.sin(a) * 1.2, vx: Math.cos(a) * 5, vy: 0.8, vz: Math.sin(a) * 5, life: 0.9, s0: 1, s1: 3.2, c: onDirt || this.track.theme.far === 'mesa' ? cl('#C8A57A') : cl('#D6D6D6'), a: 0.35, drag: 3 }); } if (isMe) this._land10 = 0.45; if (ud.chassis) em.cv -= 2.2; }
    em.airT = air ? (em.airT || 0) + dt : 0; em.air = air ? 1 : 0;
    // 내 카트: 바퀴 굴림·조향 · 서스펜션 · 고개
    if (ud.wheels4) { const ws = ud.wheels4, rf = 0.3, rr = 0.38, roll = tele ? 0 : dist;
      let st = Math.atan(2.05 * em.yr / Math.max(4, spd)) + slip * 0.85; if (spin) st = 0; st = Math.max(-0.55, Math.min(0.55, st)); em.st += (st - em.st) * Math.min(1, dt * 12);
      ws[0].rotation.x += roll / rf; ws[1].rotation.x += roll / rf; ws[2].rotation.x += roll / rr; ws[0].rotation.y = ws[1].rotation.y = em.st; }
    if (ud.chassis) { const acc = (em.v - em.lastV) * (dt > 0 ? 1 / dt : 0); em.lastV = em.v;
      em.pitch += (Math.max(-0.05, Math.min(0.045, -acc * 0.0035)) - em.pitch) * Math.min(1, dt * 6);
      const bump = air ? 0 : Math.sin(now / 47 + p.x) * Math.sin(now / 83 + p.z) * 0.014 * fast;
      em.cv += (-em.cy * 160 - em.cv * 11) * dt; em.cy += em.cv * dt; if (em.cy < -0.12) { em.cy = -0.12; em.cv = 0; }
      ud.chassis.position.y = em.cy + bump; ud.chassis.rotation.x = em.pitch + (boost ? -0.025 : 0);
      if (ud.head) { ud.head.rotation.y += (em.st * 0.9 - ud.head.rotation.y) * Math.min(1, dt * 6); ud.head.rotation.z = -em.st * 0.25; } }
    else if (ud.bodyMesh) { ud.bodyMesh.position.y = air ? 0 : Math.sin(now / 53 + p.x * 3) * 0.012 * fast; }
    em.x = p.x; em.z = p.z; em.y = p.y; em.yaw = yaw;
    if (tele) return;
    // 드리프트 연기 (흙길이면 흙먼지) · 스키드 자국
    const sa = Math.abs(slip), skidOn = !air && !sliding && (sa > (isMe ? 0.1 : 0.17) || spin) && spd > (isMe ? 4 : 8);
    const smk = onDirt ? cl('#B58E62') : (this.track.theme.far === 'peaks' ? cl('#F2F6FF') : cl('#D9D9D9'));
    [-1, 1].forEach(sd => { const w = W(sd * 0.86, 0.06, -1.0);
      if (skidOn) { const inten = spin ? 0.8 : Math.min(1, (sa - 0.08) * 3), tr = this.track, wx = w[0] / S, wy = w[2] / S, loc = tr.locate(wx, wy, k.hint), wyE = tr.surfaceE(loc, wx, wy) * S + 0.09;   // (자국 높이는 그 바퀴 자리의 노면 높이 — 언덕에서 뜨거나 묻히지 않게)
        this.skid10(id + sd, w[0], wyE, w[2], yaw, 0.3, (onDirt ? 0.45 : 0.82) * (0.45 + 0.55 * inten), onDirt ? cl('#4A3420') : [0.02, 0.02, 0.025], now);
        if (Math.random() < (0.3 + inten) * 45 * rate * dt * (isMe ? 1 : 0.6)) this.emit10({ x: w[0], y: w[1] + 0.25, z: w[2], vx: fwdX * spd * 0.5 + cy * sd * 1.2 + (Math.random() - 0.5) * 1.2, vy: 0.5 + Math.random() * 0.6, vz: fwdZ * spd * 0.5 - sy * sd * 1.2 + (Math.random() - 0.5) * 1.2, life: 1.0 + Math.random() * 0.6, s0: 0.9, s1: 3.8, c: smk, a: onDirt ? 0.5 : 0.48, drag: 2.4, grav: -0.3, vr: (Math.random() - 0.5) * 1.5 }); }   // (바퀴에 끌려 잠깐 카트를 따라오다 뒤에 남음)
      else if (this._sk && this._sk.track[id + sd]) this._sk.track[id + sd].t = -1e9;
      // 흙길 먼지 (미끄러지지 않아도)
      if (onDirt && !air && spd > 5 && Math.random() < 22 * rate * dt * fast) this.emit10({ x: w[0], y: w[1] + 0.25, z: w[2], vx: -fwdX * spd * 0.2 + (Math.random() - 0.5) * 1.5, vy: 0.7 + Math.random(), vz: -fwdZ * spd * 0.2 + (Math.random() - 0.5) * 1.5, life: 1.3, s0: 0.8, s1: 3.6, c: cl('#C29A6B'), a: 0.33, drag: 1.4, grav: -0.15 });
    });
    // 물보라: 물웅덩이를 지날 때 (판정 반지름과 같은 2.3m 안)
    let wet = sliding; if (!wet && spd > 5 && !air) { const obs = this.obsMeshes || []; for (let i = 0; i < obs.length; i++) { const o = obs[i]; if (o.o.kind !== 'puddle') continue; const m = o.m.position; if (Math.abs(m.x - p.x) < 2.6 && Math.abs(m.z - p.z) < 2.6 && Math.hypot(m.x - p.x, m.z - p.z) < 2.5) { wet = true; break; } } }
    if (wet) { const nn = (isMe ? 26 : 12) * rate * dt * 4; for (let i = 0; i < nn; i++) { const sd = Math.random() < 0.5 ? -1 : 1, w = W(sd * 0.9, 0.1, -0.8 + Math.random() * 1.6);
        this.emit10({ x: w[0], y: w[1] + 0.1, z: w[2], vx: cy * sd * (3 + Math.random() * 4) - fwdX * spd * 0.1, vy: 2.5 + Math.random() * 3, vz: -sy * sd * (3 + Math.random() * 4) - fwdZ * spd * 0.1, life: 0.55, s0: 0.22, s1: 0.12, c: cl('#E6F4FF'), a: 0.85, tile: 3, grav: 12, drag: 0.5 }); }
      if (Math.random() < 0.5) { const w = W(0, 0.3, -1.4); this.emit10({ x: w[0], y: w[1], z: w[2], vx: -fwdX * spd * 0.1, vy: 0.6, vz: -fwdZ * spd * 0.1, life: 0.8, s0: 1, s1: 3, c: cl('#F4FAFF'), a: 0.28, drag: 2 }); } }
    // 배기: 평소엔 옅은 연기(나만) · 부스터면 불꽃 + 배기구 빛
    [-0.22, 0.22].forEach(ex => { const e = W(ex, 0.75, -1.68);
      if (boost) { for (let r2 = 0; r2 < (isMe ? 2 : 1); r2++) this.emit10({ x: e[0], y: e[1], z: e[2], vx: -fwdX * (6 + Math.random() * 4), vy: 0.3, vz: -fwdZ * (6 + Math.random() * 4), life: 0.13 + Math.random() * 0.08, s0: 0.5, s1: 0.15, asp: 2.2, rot: 0, c: Math.random() < 0.4 ? cl('#7FD3FF') : cl('#FF9A3C'), a: 1, tile: 2, add: true });
        this.imm10(e[0], e[1], e[2], 0.75, cl('#FFB45A'), 0.7, 1, true); }
      else if (isMe && Math.random() < 5 * dt) this.emit10({ x: e[0], y: e[1], z: e[2], vx: -fwdX * 1.5, vy: 0.4, vz: -fwdZ * 1.5, life: 0.9, s0: 0.25, s1: 0.9, c: cl('#BFC4CC'), a: 0.16, drag: 1 }); });
    // 스타(나): 무지개 반짝이
    if (isMe && now < this.starUntil && Math.random() < 30 * dt) { const a = Math.random() * 6.28; this.emit10({ x: p.x + Math.cos(a) * 1.3, y: p.y + 0.4 + Math.random() * 1.4, z: p.z + Math.sin(a) * 1.3, vy: 1.2, life: 0.5, s0: 0.45, s1: 0.05, c: cl(['#FF5C7A', '#FFD166', '#06D6A0', '#4CC9F0', '#B15DFF'][Math.floor(Math.random() * 5)]), a: 1, tile: 1, add: true }); }
    // 드리프트 충전 불꽃 (나) — 파랑 → 주황
    if (isMe && !this.spectator && this.drifting && this.driftCharge >= 0.25 && Math.random() < 34 * rate * dt) { const sd = Math.random() < 0.5 ? -1 : 1, w = W(sd * 0.86, 0.1, -1.05), hot = this.driftCharge >= 0.7;
      this.emit10({ x: w[0], y: w[1], z: w[2], vx: (Math.random() - 0.5) * 4 - fwdX * 2, vy: 1.5 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 4 - fwdZ * 2, life: 0.35, s0: 0.28, s1: 0.06, c: hot ? cl('#FFB347') : cl('#6FD0FF'), a: 1, tile: 1, add: true, grav: 9 }); }
    // 밤: 전조등·후미등 빛 · 길 위 빛
    if (lights) { const f1 = W(0.45, 0.45, 1.6), f2 = W(-0.45, 0.45, 1.6), b1 = W(0.5, 0.45, -1.6), b2 = W(-0.5, 0.45, -1.6);
      this.imm10(f1[0], f1[1], f1[2], 0.9, cl('#EAF2FF'), 0.9, 1, true); this.imm10(f2[0], f2[1], f2[2], 0.9, cl('#EAF2FF'), 0.9, 1, true);
      this.imm10(b1[0], b1[1], b1[2], 0.6, cl('#FF3048'), 0.8, 1, true); this.imm10(b2[0], b2[1], b2[2], 0.6, cl('#FF3048'), 0.8, 1, true);
      if (!air) lights.push({ p: new T.Vector3(p.x, p.y, p.z), yaw }); }
  };
  P.stepParts10 = function (dt, now) {
    const A = this._parts, bN = this._pN, bA = this._pA; let nN = 0, nA = 0;
    for (let i = A.length - 1; i >= 0; i--) { const p = A[i]; p.t += dt; if (p.t >= p.life) { A[i] = A[A.length - 1]; A.pop(); this._free.push(p); if (p.add) this._nA10--; else this._nN10--; continue; }
      const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt; }
    const put = (b, n, x, y, z, s, asp, rot, tile, c, a) => { const o3 = n * 3, o4 = n * 4; b.off[o3] = x; b.off[o3 + 1] = y; b.off[o3 + 2] = z; b.col[o4] = c[0]; b.col[o4 + 1] = c[1]; b.col[o4 + 2] = c[2]; b.col[o4 + 3] = a; b.sz[o4] = s; b.sz[o4 + 1] = s * asp; b.sz[o4 + 2] = rot; b.sz[o4 + 3] = tile; };
    for (let i = 0; i < A.length; i++) { const p = A[i], k = p.t / p.life, s = p.s0 + (p.s1 - p.s0) * k, a = p.a * (p.add ? (1 - k) : Math.min(1, k * 6) * (1 - k));
      if (p.add) { if (nA < bA.max) put(bA, nA++, p.x, p.y, p.z, s, p.asp, p.rot, p.tile, p.c, a); } else if (nN < bN.max) put(bN, nN++, p.x, p.y, p.z, s, p.asp, p.rot, p.tile, p.c, a); }
    const I = this._imm; for (let i = 0; i < I.length; i += 10) { const add = I[i + 7]; if (add) { if (nA < bA.max) put(bA, nA++, I[i], I[i + 1], I[i + 2], I[i + 3], I[i + 8], I[i + 9], I[i + 6], I[i + 4], I[i + 5]); } else if (nN < bN.max) put(bN, nN++, I[i], I[i + 1], I[i + 2], I[i + 3], I[i + 8], I[i + 9], I[i + 6], I[i + 4], I[i + 5]); }
    I.length = 0;
    [[bN, nN], [bA, nA]].forEach(([b, c]) => { b.g.instanceCount = c; b.mesh.visible = c > 0; if (c) { [b.aOff, b.aCol, b.aSz].forEach(a => { a.updateRange.offset = 0; a.updateRange.count = c * a.itemSize; a.needsUpdate = true; }); } });
  };

  // 폭발 (미사일·거북·폭탄·번개): 불덩이·연기·불티 입자 + 충격파 고리 (가벼움 모드는 예전 그대로)
  const baseExplode = P.fxExplode;
  P.fxExplode = function (pos, color, size) {
    if (!this._r10 || !pos) return baseExplode.call(this, pos, color, size);
    const T = THREE, sz = size || 1, c = new T.Color(color).convertSRGBToLinear(), cc = [c.r, c.g, c.b], y = pos.y + 1;
    for (let i = 0; i < 18 * sz; i++) { const a = Math.random() * 6.28, u = Math.random(), sp = 3 + Math.random() * 6; this.emit10({ x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp * (1 - u * 0.5), vy: 2 + u * 6, vz: Math.sin(a) * sp * (1 - u * 0.5), life: 0.45 + Math.random() * 0.25, s0: 1.6 * sz, s1: 3.6 * sz, c: i % 3 ? cl('#FF9A3C') : cc, a: 1, tile: 1, add: true, drag: 3 }); }
    for (let i = 0; i < 12 * sz; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 4; this.emit10({ x: pos.x, y: y + 0.5, z: pos.z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 3, vz: Math.sin(a) * sp, life: 1.4 + Math.random() * 0.8, s0: 1.5 * sz, s1: 5 * sz, c: cl('#4A4A50'), a: 0.5, drag: 1.8, grav: -0.6, vr: (Math.random() - 0.5) * 2 }); }
    for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, sp = 6 + Math.random() * 10; this.emit10({ x: pos.x, y, z: pos.z, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 8, vz: Math.sin(a) * sp, life: 0.7, s0: 0.3, s1: 0.1, c: cl('#FFE7A0'), a: 1, tile: 1, add: true, grav: 18 }); }
    const G = this._fxG || (this._fxG = { ball: new T.SphereGeometry(1, 14, 10), ring: new T.RingGeometry(0.8, 1.2, 24), cube: new T.BoxGeometry(0.4, 0.4, 0.4) }); Object.values(G).forEach(g => { g.userData.shared = true; });
    const ring = new T.Mesh(G.ring, new T.MeshBasicMaterial({ color: 0xFFE7A8, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.copy(pos); ring.position.y += 0.25;
    this.addFx3d(ring, 0.45, (m, k) => { m.scale.setScalar(sz * (1 + k * 8)); m.material.opacity = 0.7 * (1 - k); });
    if (this.karts.__me) { const d2 = this.karts.__me.g.position.distanceTo(pos); if (d2 < 30) this._land10 = Math.max(this._land10 || 0, 0.5 * (1 - d2 / 30)); }
    if (window.Sound && Sound.explosion) Sound.explosion();
  };
  // 미사일 연기 꼬리: 부드러운 연기 입자로 (가벼움 모드는 예전 공)
  const basePuff = P.fxPuff;
  P.fxPuff = function (pos, color) { if (!this._r10 || !pos) return basePuff.call(this, pos, color); const c = new THREE.Color(color).convertSRGBToLinear();
    this.emit10({ x: pos.x, y: pos.y, z: pos.z, vy: 0.6, life: 0.7, s0: 0.5, s1: 1.8, c: [c.r, c.g, c.b], a: 0.5, drag: 1.5 }); };
  // 번개: 내리꽂는 자리에 번쩍이는 빛
  const baseBolt = P.fxLightning;
  P.fxLightning = function (pos) { baseBolt.call(this, pos); if (!this._r10 || !pos) return; for (let i = 0; i < 6; i++) this.emit10({ x: pos.x, y: pos.y + 1 + i * 3, z: pos.z, life: 0.25, s0: 3.5 - i * 0.3, s1: 1, c: cl('#FFF6C8'), a: 1, tile: 1, add: true }); };
  // 고화질 사진 조명용 아스팔트 굴곡·거칠기 (kart3d-real 이 부름)
  P.roadDetail10 = function () { const T = THREE, d = roadDetail(512), mk = c => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = this.aniso || 8; return t; }; return { n: mk(d.n), r: mk(d.r) }; };
  // 판이 끝날 때: 환경 반사 큐브(렌더 타깃)도 정리 — freeGL 은 텍스처만 지워 판마다 남았음
  const baseDestroy = P.destroy;
  P.destroy = function () { try { if (this._envRT) { this._envRT.dispose(); this._envRT = null; } } catch (e) {} return baseDestroy.apply(this, arguments); };
  // 화면이 느려 자동으로 낮출 때: 입자·스키드 수를 줄임 (그림자를 끄는 단계에서 한 번 더)
  P.onDowngrade = function (lv) { if (!this._q10) return; if (lv !== 'mid' && this._scatter) this._scatter.forEach(m => { m.visible = false; }); this._q10 = Object.assign({}, this._q10, lv === 'mid' ? QP.mid : { pN: 140, pA: 90, rate: 0.35 }); };
})();
