// 카트 레이싱 3D — 로우폴리 레이싱 연출 (고화질·보통 화질에서만. 가벼움 모드는 예전 모습)
//   · 운전자가 탄 카트(헬멧 · 카트 색) — 한 대를 한 덩어리로 합쳐 가볍게(몸체 1 + 바퀴 2)
//   · 출발선 양쪽 관람석과 관중(인스턴스) · 도로 옆 광고판 띠 · 출발 신호등 아치 · 차선
//   · 눈 덮인 봉우리 · 둥근 나무 · 입체 구름
(function () {
  if (typeof KartGame3D === 'undefined') return;
  const P = KartGame3D.prototype;

  // 여러 도형을 정점 색 한 덩어리로 합침 (그리기 호출 1번)
  function merge(parts, lin) {
    const T = THREE, pos = [], nor = [], col = [];
    parts.forEach(({ geo, color, m }) => {
      const g = (geo.index ? geo.toNonIndexed() : geo.clone()); g.applyMatrix4(m);
      const c = new T.Color(color); if (lin) c.convertSRGBToLinear();
      const pa = g.attributes.position.array, na = g.attributes.normal.array;
      for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
      for (let i = 0; i < pa.length / 3; i++) col.push(c.r, c.g, c.b);
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  }
  const M = (x, y, z, rx, ry, rz, sx, sy, sz) => { const T = THREE; return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx || 1, sy || 1, sz || 1)); };
  const shade = (hex, k) => { const c = new THREE.Color(hex); return k > 0 ? c.lerp(new THREE.Color(0xffffff), k).getHex() : c.multiplyScalar(1 + k).getHex(); };
  P.flatMat = function () { if (!this._flat) { this._flat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 12, specular: 0x151515 }); this._flat.userData.lin = true; } return this._flat; };

  // ── 운전자가 탄 카트 (앞 = +z, 길이 약 3.2) ──
  P.makeKartStyled = function (look, isMe) {
    const T = THREE, g = new T.Group(), C = new T.Color(look && look.color || '#3FA9F5').getHex(), dark = 0x2B2F3A, grey = 0x8A93A6, lin = this.hq !== 'low';
    const B = (w, h, d) => new T.BoxGeometry(w, h, d), Cy = (r1, r2, h, n) => new T.CylinderGeometry(r1, r2, h, n || 10), S = (r, a, b) => new T.SphereGeometry(r, a || 12, b || 9);
    const body = merge([
      { geo: B(1.5, 0.14, 2.9), color: dark, m: M(0, 0.26, 0) },                                  // 바닥 판
      { geo: B(0.34, 0.3, 1.5), color: C, m: M(0.72, 0.42, 0.1) }, { geo: B(0.34, 0.3, 1.5), color: C, m: M(-0.72, 0.42, 0.1) },   // 옆 포드
      { geo: B(1.2, 0.26, 0.75), color: C, m: M(0, 0.42, 1.2, -0.18) },                           // 앞 코
      { geo: Cy(0.09, 0.09, 1.7, 8), color: shade(C, -0.35), m: M(0, 0.32, 1.62, 0, 0, Math.PI / 2) },   // 앞 범퍼
      { geo: B(0.8, 0.14, 0.14), color: 0xFFFFFF, m: M(0, 0.57, 1.05) },                           // 코 줄무늬
      { geo: B(0.9, 0.5, 0.7), color: dark, m: M(0, 0.6, -0.35) },                                // 좌석
      { geo: B(0.8, 0.45, 0.6), color: grey, m: M(0, 0.62, -1.1) },                               // 엔진
      { geo: Cy(0.07, 0.07, 0.4, 6), color: 0xC9CED8, m: M(0.22, 0.75, -1.45, Math.PI / 2) }, { geo: Cy(0.07, 0.07, 0.4, 6), color: 0xC9CED8, m: M(-0.22, 0.75, -1.45, Math.PI / 2) },   // 배기관
      { geo: B(1.6, 0.12, 0.14), color: shade(C, -0.35), m: M(0, 0.36, -1.55) },                   // 뒤 범퍼
      { geo: Cy(0.05, 0.05, 0.5, 6), color: dark, m: M(0, 0.75, 0.5, -0.9) },                      // 운전대 기둥
      { geo: new T.TorusGeometry(0.2, 0.045, 6, 14), color: 0x1B1B2F, m: M(0, 0.95, 0.35, -0.5) },  // 운전대
      // 운전자: 몸 · 팔 · 헬멧(카트 색 + 흰 줄) · 얼굴 가리개
      { geo: Cy(0.26, 0.33, 0.62, 10), color: shade(C, -0.25), m: M(0, 1.05, -0.3, -0.12) },
      { geo: Cy(0.08, 0.08, 0.62, 6), color: shade(C, -0.25), m: M(0.3, 1.02, 0.02, -1.15) }, { geo: Cy(0.08, 0.08, 0.62, 6), color: shade(C, -0.25), m: M(-0.3, 1.02, 0.02, -1.15) },
    ].concat(this.driverHead(look, C, S, B, Cy)), lin);
    const mat = this.flatMat(), bm = new T.Mesh(body, mat); bm.castShadow = true; g.add(bm);
    // 바퀴: 앞(작게) · 뒤(크게) 두 묶음 — 축을 중심으로 굴림
    const wheelPair = (r, w, z, x) => { const wg = merge([
        { geo: Cy(r, r, w, 14), color: 0x23262E, m: M(x, 0, 0, 0, 0, Math.PI / 2) }, { geo: Cy(r * 0.5, r * 0.5, w + 0.02, 10), color: 0xB8C0CE, m: M(x, 0, 0, 0, 0, Math.PI / 2) },
        { geo: Cy(r, r, w, 14), color: 0x23262E, m: M(-x, 0, 0, 0, 0, Math.PI / 2) }, { geo: Cy(r * 0.5, r * 0.5, w + 0.02, 10), color: 0xB8C0CE, m: M(-x, 0, 0, 0, 0, Math.PI / 2) }], lin);
      const wm = new T.Mesh(wg, mat); wm.position.set(0, r, z); wm.castShadow = true; g.add(wm); return wm; };
    g.userData.wheels = [wheelPair(0.3, 0.26, 1.05, 0.82), wheelPair(0.38, 0.36, -1.0, 0.86)];
    g.userData.body = { color: new T.Color() };                                                       // (스타 무지개: 이 모델은 몸체 색이 정점 색이라 효과 대신 방어막·불꽃으로 표시)
    // 둥근 그림자 · 방어막 · 부스터 불꽃
    if (!this.shTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const s2 = c.getContext('2d'), rg = s2.createRadialGradient(32, 32, 4, 32, 32, 32); rg.addColorStop(0, 'rgba(0,0,0,0.45)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); s2.fillStyle = rg; s2.fillRect(0, 0, 64, 64); this.shTex = new T.CanvasTexture(c); }
    const sh = new T.Mesh(new T.PlaneGeometry(3, 3.8), new T.MeshBasicMaterial({ map: this.shTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh); g.userData.shadow = sh;
    const shield = new T.Mesh(new T.SphereGeometry(2.1, 14, 10), new T.MeshBasicMaterial({ color: 0x9DE9FF, transparent: true, opacity: 0.25, depthWrite: false })); shield.position.y = 0.9; shield.visible = false; g.add(shield); g.userData.shield = shield;
    const flame = new T.Group(); [-0.22, 0.22].forEach(x => { const f = new T.Mesh(new T.ConeGeometry(0.16, 0.9, 8), new T.MeshBasicMaterial({ color: 0xFF9F1C, transparent: true, opacity: 0.9 })); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.75, -1.9); flame.add(f); });
    flame.visible = false; g.add(flame); g.userData.flame = flame;
    this.lin(g); this.scene.add(g); return g;
  };

  // 운전자 머리 6종 (카트 색 기준 · 학생마다 다르게): 풀페이스 헬멧 · 고글 헬멧 · 야구 모자 · 토끼 귀 헬멧 · 뿔 헬멧 · 안테나 헬멧
  P.driverHead = function (look, C, S, B, Cy) {
    const T = THREE, key = String((look && look.color) || '') + String((look && look.style) || '') + String((look && look.name) || '');
    let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const kind = h % 6;
    const skin = [0xF2C9A0, 0xD9A77A, 0xF5D7B8, 0xA8765A][h % 4], hair = [0x3B2A20, 0x1B1B1B, 0x8B5A2B, 0xD9B45A][(h >> 3) % 4], hy = 1.55, hz = -0.25;
    const helmet = [{ geo: S(0.34), color: C, m: M(0, hy, hz) }], visor = { geo: B(0.5, 0.2, 0.12), color: 0x1B2A44, m: M(0, hy, hz + 0.31) }, stripe = { geo: B(0.12, 0.3, 0.62), color: 0xFFFFFF, m: M(0, hy + 0.07, hz) };
    if (kind === 0) return helmet.concat([stripe, visor]);                                                   // 풀페이스 헬멧
    if (kind === 1) return helmet.concat([{ geo: S(0.2, 10, 8), color: skin, m: M(0, hy - 0.08, hz + 0.18, 0, 0, 0, 1, 0.9, 0.8) },          // 고글 헬멧: 얼굴이 보임
      { geo: B(0.62, 0.12, 0.1), color: 0x23262E, m: M(0, hy + 0.1, hz + 0.3) }, { geo: Cy(0.09, 0.09, 0.06, 10), color: 0x9DE9FF, m: M(-0.12, hy + 0.1, hz + 0.35, Math.PI / 2) }, { geo: Cy(0.09, 0.09, 0.06, 10), color: 0x9DE9FF, m: M(0.12, hy + 0.1, hz + 0.35, Math.PI / 2) }]);
    if (kind === 2) return [{ geo: S(0.3), color: skin, m: M(0, hy - 0.03, hz) }, { geo: new T.SphereGeometry(0.31, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color: C, m: M(0, hy + 0.02, hz) },   // 야구 모자
      { geo: B(0.36, 0.05, 0.28), color: C, m: M(0, hy + 0.04, hz + 0.34, 0.12) }, { geo: B(0.5, 0.12, 0.3), color: hair, m: M(0, hy - 0.02, hz - 0.2) }, { geo: B(0.08, 0.05, 0.03), color: 0x1B1B2F, m: M(-0.1, hy - 0.02, hz + 0.28) }, { geo: B(0.08, 0.05, 0.03), color: 0x1B1B2F, m: M(0.1, hy - 0.02, hz + 0.28) }];
    if (kind === 3) return helmet.concat([visor, { geo: Cy(0.07, 0.09, 0.45, 8), color: C, m: M(-0.14, hy + 0.48, hz - 0.05, 0, 0, 0.18) }, { geo: Cy(0.07, 0.09, 0.45, 8), color: C, m: M(0.14, hy + 0.48, hz - 0.05, 0, 0, -0.18) },   // 토끼 귀
      { geo: Cy(0.035, 0.05, 0.36, 6), color: 0xFFC2D6, m: M(-0.14, hy + 0.48, hz - 0.0, 0, 0, 0.18) }, { geo: Cy(0.035, 0.05, 0.36, 6), color: 0xFFC2D6, m: M(0.14, hy + 0.48, hz - 0.0, 0, 0, -0.18) }]);
    if (kind === 4) return helmet.concat([visor, { geo: new T.ConeGeometry(0.08, 0.34, 7), color: 0xF5F0E0, m: M(-0.34, hy + 0.14, hz, 0, 0, 1.05) }, { geo: new T.ConeGeometry(0.08, 0.34, 7), color: 0xF5F0E0, m: M(0.34, hy + 0.14, hz, 0, 0, -1.05) }]);   // 뿔
    return helmet.concat([stripe, visor, { geo: Cy(0.02, 0.02, 0.42, 5), color: 0x8A93A6, m: M(0.1, hy + 0.5, hz - 0.08) }, { geo: S(0.08, 8, 6), color: 0xFF5C7A, m: M(0.1, hy + 0.72, hz - 0.08) }]);   // 안테나
  };

  // ── 트랙 연출 ──
  P.buildStyle = function () {
    const T = THREE, tr = this.track, S = this.S, n = tr.n, hw = tr.halfW, lin = true, far = tr.theme.far || 'hills';
    const at = (i, off, lift) => { const j = ((i % n) + n) % n, c = tr.center[j], [tx, ty] = tr.tangent[j]; const v = this.P(c[0] + -ty * hw * off, c[1] + tx * hw * off, tr.elev[j]); v.y += lift || 0; return v; };
    const heading = i => { const [tx, ty] = tr.tangent[((i % n) + n) % n]; return Math.PI / 2 - Math.atan2(ty, tx); };   // 모델 앞(+z)을 진행 방향으로

    // 1) 도로: 짙은 아스팔트 + 흰 가장자리선 + 노란 중앙 점선 + 흰 차선 점선
    if (this.roadMat) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = this.night ? '#3A3F55' : '#4A4F5C'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.07)'; g.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6); }
      g.fillStyle = '#F2F2F2'; g.fillRect(6, 0, 5, 256); g.fillRect(245, 0, 5, 256);
      g.fillStyle = '#FFD23F'; g.fillRect(125, 0, 6, 150);
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(62, 0, 4, 110); g.fillRect(190, 0, 4, 110);
      const tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4; tex.encoding = T.sRGBEncoding;
      this.roadMat.map = tex; this.roadMat.color.set(0xffffff); this.roadMat.needsUpdate = true;
    }

    // 2) 광고판 띠: 도로 양옆(가드레일 바깥)을 따라 이어지는 판 — 글자 판 6가지가 반복
    { const c = document.createElement('canvas'); c.width = 1536; c.height = 128; const g = c.getContext('2d');
      const panels = [['KART RALLY', '#E63946', '#fff'], ['TURBO', '#1D7FA6', '#FFD23F'], ['GO! ★', '#FFD23F', '#1B1B2F'], ['과학 GP', '#2A9D5C', '#fff'], ['SPEED', '#7B2FF7', '#fff'], ['DRIFT', '#FF7A1A', '#fff']];
      panels.forEach(([t, bg, fg], k) => { g.fillStyle = bg; g.fillRect(k * 256, 0, 256, 128); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(k * 256, 0, 256, 12);
        g.fillStyle = fg; g.font = '900 54px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, k * 256 + 128, 70); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(k * 256 + 252, 0, 4, 128); });
      const tex = new T.CanvasTexture(c); tex.wrapS = T.RepeatWrapping; tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
      const mat = new T.MeshLambertMaterial({ map: tex, side: T.DoubleSide }); mat.userData.lin = true;
      [1.16, -1.16].forEach(off => { const pos = [], uv = [], idx = []; let dist = 0, q = 0, prev = null;
        for (let i = 0; i <= n; i++) { const j = i % n; const a = at(j, off, 0.25), b = at(j, off, 1.55);
          if (prev) dist += a.distanceTo(prev); prev = a; pos.push(a.x, a.y, a.z, b.x, b.y, b.z); const u = dist / 16; uv.push(u, 0, u, 1);
          if (i < n && !(tr.gapSeg[j] || tr.gapSeg[(j + 1) % n]) && !(tr.driftZone && tr.driftZone[j])) { idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } q += 2; }
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
        const m = new T.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); }); }

    // 3) 출발선 양쪽 관람석 + 관중 (계단 · 지붕 · 사람: 인스턴스 몇 개)
    { const steps = [], roofs = [], bodies = [], heads = [], rows = 5, seg = tr.stepLen * S, per = Math.max(2, Math.round(seg / 1.15));
      for (let k = -40; k <= 40; k++) { if (tr.gapSeg[((k % n) + n) % n]) continue;
        [1, -1].forEach(side => { const h = heading(k), fwd = new T.Vector3(Math.sin(h), 0, Math.cos(h));
          for (let r = 0; r < rows; r++) { const hgt = 0.8 + r * 1.6, p = at(k, side * (1.42 + r * 0.075), hgt / 2); steps.push({ p, h, s: [1.5, hgt, seg * 1.03] });   // 계단 한 칸: 가로 = 깊이 · 세로 = 트랙 방향
            const top = p.y + hgt / 2;
            for (let q = 0; q < per; q++) { if (Math.random() < 0.12) continue; const pp = p.clone().addScaledVector(fwd, (q - (per - 1) / 2) * (seg / per)); pp.y = top;   // 트랙 방향으로 나란히
              bodies.push({ p: pp.clone().setY(top + 0.4), h }); heads.push({ p: pp.clone().setY(top + 1.05), h }); } }
          roofs.push({ p: at(k, side * (1.42 + (rows - 1) * 0.0375), 0.8 + (rows - 1) * 1.6 + 3.4), h, s: [rows * 1.5 + 1.2, 0.25, seg * 1.03] }); }); }
      const inst = (geo, list, color, eachColor) => { const mat = new T.MeshLambertMaterial({ color }); mat.userData.lin = false; const im = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), cc = new T.Color();
        list.forEach((o, i) => { q.setFromAxisAngle(new T.Vector3(0, 1, 0), o.h); sc.set(...(o.s || [1, 1, 1])); m4.compose(o.p, q, sc); im.setMatrixAt(i, m4); if (eachColor) { cc.set(eachColor(i)).convertSRGBToLinear(); im.setColorAt(i, cc); } });
        im.castShadow = true; im.receiveShadow = true; this.scene.add(im); return im; };
      const crowdCols = ['#E63946', '#1D7FA6', '#FFD23F', '#2A9D5C', '#7B2FF7', '#FF7A1A', '#FFFFFF', '#F28FB5'];
      inst(new T.BoxGeometry(1, 1, 1), steps, 0xB8BFCC); inst(new T.BoxGeometry(1, 1, 1), roofs, 0xFFFFFF, i => ['#E63946', '#FFFFFF'][i % 2]);
      // 관중은 수천 명이라 단순한 모양(몸 6각 기둥 · 머리 20면체)으로 — 삼각형을 절반 이하로
      inst(new T.CylinderGeometry(0.28, 0.34, 0.8, 6, 1, true), bodies, 0xFFFFFF, i => crowdCols[(i * 7 + (i >> 3)) % crowdCols.length]);
      inst(new T.IcosahedronGeometry(0.27, 0), heads, 0xFFFFFF, i => ['#F2C9A0', '#D9A77A', '#A8765A', '#F5D7B8'][i % 4]); }

    // 4) 출발 아치: 빨강·흰 줄무늬 기둥 · 이름판 · 체크 깃발 · 출발 신호등(카운트다운에 맞춰 켜짐)
    { this.scene.children.filter(o => o.userData.startArch).forEach(o => this.scene.remove(o));
      const g = new T.Group(), w = hw * 2 * S + 5, c0 = at(0, 0, 0);
      const sc = document.createElement('canvas'); sc.width = 64; sc.height = 256; const sg = sc.getContext('2d'); for (let y = 0; y < 256; y += 32) { sg.fillStyle = (y / 32) % 2 ? '#FFFFFF' : '#E63946'; sg.fillRect(0, y, 64, 32); }
      const stripe = new T.CanvasTexture(sc); stripe.encoding = T.sRGBEncoding; const pm = new T.MeshLambertMaterial({ map: stripe }); pm.userData.lin = true;
      [-1, 1].forEach(sd => { const p = new T.Mesh(new T.CylinderGeometry(0.55, 0.65, 10, 14), pm); p.position.set(sd * w / 2, 5, 0); p.castShadow = true; g.add(p);
        const fc = document.createElement('canvas'); fc.width = 64; fc.height = 48; const fg = fc.getContext('2d'); for (let x = 0; x < 8; x++) for (let y = 0; y < 6; y++) { fg.fillStyle = (x + y) % 2 ? '#111' : '#fff'; fg.fillRect(x * 8, y * 8, 8, 8); }
        const ft = new T.CanvasTexture(fc); ft.encoding = T.sRGBEncoding; const fm = new T.MeshBasicMaterial({ map: ft, side: T.DoubleSide }); fm.userData.lin = true;
        const flag = new T.Mesh(new T.PlaneGeometry(2.4, 1.6), fm); flag.position.set(sd * w / 2 + sd * 1.3, 11.6, 0); g.add(flag);
        const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.6, 6), new T.MeshLambertMaterial({ color: 0xDDDDDD })); pole.position.set(sd * w / 2, 11.2, 0); g.add(pole); });
      const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 128; const bg = bc.getContext('2d'); bg.fillStyle = '#C62828'; bg.fillRect(0, 0, 1024, 128); bg.fillStyle = '#8E1C1C'; bg.fillRect(0, 108, 1024, 20);
      bg.fillStyle = '#FFFFFF'; bg.font = '900 78px Pretendard, sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.fillText('KART RALLY · 과학 GP', 512, 60);
      const bt = new T.CanvasTexture(bc); bt.encoding = T.sRGBEncoding; const bmat = new T.MeshLambertMaterial({ map: bt }); bmat.userData.lin = true;
      const banner = new T.Mesh(new T.BoxGeometry(w, 2.4, 0.5), bmat); banner.position.y = 9.4; banner.castShadow = true; g.add(banner);
      const box = new T.Mesh(new T.BoxGeometry(4.2, 1.3, 0.4), new T.MeshLambertMaterial({ color: 0x1B1B2F })); box.position.set(0, 7.6, 0.1); g.add(box);
      this.startLamps = [-1.3, 0, 1.3].map(x => { const l = new T.Mesh(new T.SphereGeometry(0.42, 12, 10), new T.MeshBasicMaterial({ color: 0x3A2020 })); l.position.set(x, 7.6, 0.35); g.add(l); return l; });
      g.position.copy(c0); g.rotation.y = heading(0) + Math.PI; this.lin(g); this.scene.add(g); }

    // 5) 눈 덮인 봉우리 (초원 · 사막 뒤쪽) · 6) 둥근 나무 · 7) 입체 구름
    const b = tr.bounds, cx = (b.minX + b.maxX) / 2 * S, cz = (b.minY + b.maxY) / 2 * S, R0 = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) * S * 0.5 + 60;
    if (far === 'hills' || far === 'mesa') {
      const parts = []; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + (i % 3) * 0.12, r = R0 + 820 + (i % 4) * 90, h = 260 + (i * 53 % 5) * 55, rr = 170 + (i % 3) * 50;
        parts.push({ geo: new T.ConeGeometry(rr, h, 6), color: far === 'mesa' ? '#B97A55' : '#8D97AA', m: M(cx + Math.cos(a) * r, this.groundY + h / 2, cz + Math.sin(a) * r, 0, i) });
        parts.push({ geo: new T.ConeGeometry(rr * 0.36, h * 0.36, 6), color: '#F4F7FB', m: M(cx + Math.cos(a) * r, this.groundY + h * 0.82, cz + Math.sin(a) * r, 0, i) }); }
      const mm = new T.Mesh(merge(parts, true), this.flatMat()); mm.userData.far = true; mm.userData.peaks = true; this.scene.add(mm);
    }
    if (this.decoObjs && this.decoObjs.tree && this.decoObjs.tree.length) {                     // 둥근 나무: 줄기 + 잎 덩어리 셋 (한 덩어리로 합쳐 인스턴스)
      (this.decoMeshes.tree || []).forEach(m => this.scene.remove(m)); this.decoMeshes.tree = [];
      const tg = merge([{ geo: new T.CylinderGeometry(0.35, 0.5, 3, 7), color: '#7A5230', m: M(0, 1.5, 0) },
        { geo: new T.IcosahedronGeometry(2.3, 0), color: '#4CAF50', m: M(0, 4.4, 0) }, { geo: new T.IcosahedronGeometry(1.7, 0), color: '#5DC262', m: M(1.2, 3.8, 0.4) }, { geo: new T.IcosahedronGeometry(1.6, 0), color: '#43A047', m: M(-1.1, 4.0, -0.5) }], true);
      const objs = this.decoObjs.tree, im = new T.InstancedMesh(tg, this.flatMat(), objs.length), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
      objs.forEach((o, i) => { const s2 = 0.9 + (o.r || 0.5) * 0.6; q.setFromAxisAngle(new T.Vector3(0, 1, 0), (o.r2 || o.r || 0) * 6.28); sc.set(s2, s2, s2); m4.compose(this.P(o.x, o.y, o.e), q, sc); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.receiveShadow = true; this.scene.add(im); this.decoMeshes.tree.push(im);
    }
    if (!this.night) {                                                                           // 입체 구름: 흰 공 여러 개를 합친 덩어리
      const parts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + Math.random() * 0.3, r = R0 * (0.5 + Math.random() * 1.2) + 200, y = this.groundY + 210 + Math.random() * 120, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = 18 + Math.random() * 14;
        for (let k = 0; k < 5; k++) parts.push({ geo: new T.IcosahedronGeometry(s * (0.7 + Math.random() * 0.5), 1), color: '#FFFFFF', m: M(x + (k - 2) * s * 0.9, y + Math.random() * s * 0.4, z + (Math.random() - 0.5) * s, 0, 0, 0, 1, 0.62, 1) }); }
      const mat = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x9aa4b2 }); mat.userData.lin = true; mat.emissive.convertSRGBToLinear();
      const cm = new T.Mesh(merge(parts, true), mat); cm.userData.far = true; cm.userData.clouds = true; this.scene.add(cm);
    }
  };

  // 출발 신호등: 카운트다운 3·2·1 에 빨간불이 하나씩, 출발하면 모두 초록 (2초 뒤 꺼짐)
  P.updateStyle = function (now) {
    if (!this.startLamps) return; const cd = this.countdown, lit = cd > 0 ? Math.min(3, Math.max(0, 4 - Math.ceil(cd))) : 0;
    if (this._goAtLamp == null && cd <= 0) this._goAtLamp = now;
    this.startLamps.forEach((l, i) => { const on = cd > 0 ? i < lit : (now - this._goAtLamp < 2000);
      l.material.color.set(cd > 0 ? (on ? 0xFF2A2A : 0x3A2020) : (on ? 0x2BFF6A : 0x203A28)); if (this.hq !== 'low') l.material.color.convertSRGBToLinear(); });
  };
})();
