// 젬 아레나 3D — 규칙·캐릭터·맵·네트워크·HUD 는 ArenaGame 그대로, 월드만 Three.js 로 그립니다
//   · 브롤스타즈처럼 비스듬히 내려다보는 카메라, 내 팀 진영이 항상 화면 아래 (레드 팀은 카메라가 반대편에서 봄)
//   · 벽 = 입체 상자(윗면 나무/금속 상자 그림), 덤불 = 캐릭터를 가리는 둥근 수풀, 물 = 파란 바닥
//   · 이름·체력·탄약·피해 숫자는 3D 위치를 화면 좌표로 바꿔 HUD 캔버스에 그립니다
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
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(this.renderer, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; if (this.hq !== 'low') ThreeQuality.apply(this, { half: 17, tone: 'none', sun: 0.72, hemi: 0.74 }); }   // 색 보정 · 태양 그림자(three-quality.js)
    this.resize();
  }
  // 조이스틱·마우스 방향: 카메라를 돌렸으면 반대로
  setMove(x, y) { super.setMove(this.flip ? -x : x, this.flip ? -y : y); }
  setAim(dx, dy) { if (dx == null) return super.setAim(null); super.setAim(this.flip ? -dx : dx, this.flip ? -dy : dy); }
  releaseAim(dx, dy) { super.releaseAim(this.flip ? -(dx || 0) : dx, this.flip ? -(dy || 0) : dy); }

  resize() {
    const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (W < 10 || H < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.hudDpr = dpr;
    if (this.renderer) { this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%'; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
    this.vw = W; this.vh = H;
  }
  captureTo(g, w, h) {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);                 // 그린 직후 같은 순간에 복사해야 빈 화면이 아님
    g.drawImage(this.glCanvas, 0, 0, w, h);
    if (this.hudCanvas && this.hudCanvas.width) g.drawImage(this.hudCanvas, 0, 0, w, h);
  }
  destroy() { try { this.renderer.dispose(); if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas); } catch (e) {} }

  initThree() {
    const T = THREE, th = AR_THEMES[this.mapId] || AR_THEMES.mine;
    this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2 });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr || 1.25));
    this.scene = new T.Scene(); this.scene.background = new T.Color(th.wallFront);
    this.camera = new T.PerspectiveCamera(42, 1, 0.5, 400);
    this.hemi = new T.HemisphereLight(0xFFFFFF, 0x8C7A5A, 0.95); this.scene.add(this.hemi);
    const sun = new T.DirectionalLight(0xFFF3DD, 0.6); sun.position.set(-20, 40, 25); this.scene.add(sun); this.sun = sun;
    // 바닥: 한 장의 그림(칸마다 타일·물)
    const PX = 16, fc = document.createElement('canvas'); fc.width = this.W * PX; fc.height = this.H * PX; const g = fc.getContext('2d');
    const tA = typeof arImg === 'function' ? arImg(this.mapId === 'jungle' ? 'grass1' : 'sand1') : null;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { g.fillStyle = (x + y) % 2 ? th.floorA : th.floorB; g.fillRect(x * PX, y * PX, PX, PX); }
    if (tA) { for (let y = 0; y < this.H; y += 2) for (let x = 0; x < this.W; x += 2) g.drawImage(tA, x * PX, y * PX, PX * 2, PX * 2); if (this.mapId === 'ice') { g.fillStyle = 'rgba(214,236,250,0.72)'; g.fillRect(0, 0, fc.width, fc.height); } }
    g.strokeStyle = th.grout; g.lineWidth = 1; for (let x = 0; x <= this.W; x += 2) { g.beginPath(); g.moveTo(x * PX, 0); g.lineTo(x * PX, fc.height); g.stroke(); } for (let y = 0; y <= this.H; y += 2) { g.beginPath(); g.moveTo(0, y * PX); g.lineTo(fc.width, y * PX); g.stroke(); }
    // 팀 진영 색 (위 5줄 레드 · 아래 5줄 블루 → 내 진영은 파랑)
    const myTop = this.team === 'r'; g.fillStyle = myTop ? 'rgba(63,169,245,0.16)' : 'rgba(242,78,78,0.16)'; g.fillRect(0, 0, fc.width, PX * 6); g.fillStyle = myTop ? 'rgba(242,78,78,0.16)' : 'rgba(63,169,245,0.16)'; g.fillRect(0, fc.height - PX * 6, fc.width, PX * 6);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.map[y][x] === 'w') { g.fillStyle = th.water; g.fillRect(x * PX, y * PX, PX, PX); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x * PX + 3, y * PX + 6, 6, 1.5); }
    const ft = new T.CanvasTexture(fc); ft.anisotropy = 4;
    const floor = new T.Mesh(new T.PlaneGeometry(this.W, this.H), new T.MeshLambertMaterial({ map: ft })); floor.rotation.x = -Math.PI / 2; floor.position.set(this.W / 2, 0, this.H / 2); this.scene.add(floor);
    // 벽: 칸마다 상자 (윗면은 상자 그림, 옆면은 테마 앞면색) — 인스턴스로 한 번에
    const cells = k => { const out = []; for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.map[y][x] === k) out.push([x, y]); return out; };
    const crateImg = typeof arImg === 'function' ? arImg(this.mapId === 'ice' ? 'crateMetal' : 'crateWood') : null;
    const topMat = crateImg ? new T.MeshLambertMaterial({ map: new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 56; c.getContext('2d').drawImage(crateImg, 0, 0, 56, 56); return c; })()) }) : new T.MeshLambertMaterial({ color: new T.Color(th.wallTop) });
    const sideMat = new T.MeshLambertMaterial({ color: new T.Color(th.wallFront) });
    const place = (mesh, list, h, y0) => { const m = new T.Matrix4(); list.forEach(([x, y], i) => { m.makeTranslation(x + 0.5, (y0 || 0) + h / 2, y + 0.5); mesh.setMatrixAt(i, m); }); this.scene.add(mesh); };
    const walls = cells('#'); if (walls.length) place(new T.InstancedMesh(new T.BoxGeometry(1, 1.1, 1), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat], walls.length), walls, 1.1);
    const mine = cells('G'); if (mine.length) { place(new T.InstancedMesh(new T.BoxGeometry(1, 0.35, 1), new T.MeshLambertMaterial({ color: 0x5B3AAF }), mine.length), mine, 0.35);
      const cry = new T.InstancedMesh(new T.OctahedronGeometry(0.28, 0), new T.MeshLambertMaterial({ color: 0xC9A7FF, emissive: 0x5B2FA8 }), mine.length); place(cry, mine, 0.5, 0.35); }
    // 덤불: 칸마다 둥근 덩어리 셋 (높이 1.2 — 캐릭터를 가림)
    const bush = cells('b'); if (bush.length) {
      const bm = new T.InstancedMesh(new T.IcosahedronGeometry(0.55, 0), new T.MeshLambertMaterial({ color: new T.Color(th.bushA) }), bush.length * 3);
      const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(); let k = 0;
      bush.forEach(([x, y]) => [[0.3, 0.35, 0.55], [0.7, 0.6, 0.6], [0.45, 0.72, 0.5]].forEach(([ox, oz, s]) => { q.setFromEuler(new T.Euler(x, y * 0.7, 0)); sc.set(s * 1.25, s * 1.6, s * 1.25); m.compose(new T.Vector3(x + ox, 0.55 * s * 1.6, y + oz), q, sc); bm.setMatrixAt(k++, m); }));
      this.scene.add(bm); this.bushMesh = bm; }
    // 젬 · 탄 · 조각: 인스턴스 (그리기 호출 1번씩)
    const MAXG = 60, MAXB = 160, MAXP = 200;
    this.gemMesh = new T.InstancedMesh(new T.OctahedronGeometry(0.28, 0), new T.MeshLambertMaterial({ color: 0xB15DFF, emissive: 0x6A2BC8 }), MAXG); this.gemMesh.count = 0; this.scene.add(this.gemMesh);
    this.bulMesh = new T.InstancedMesh(new T.SphereGeometry(0.14, 8, 6), new T.MeshBasicMaterial({ color: 0xFFE38A }), MAXB); this.bulMesh.count = 0; this.scene.add(this.bulMesh);
    this.bigMesh = new T.InstancedMesh(new T.SphereGeometry(0.34, 10, 8), new T.MeshBasicMaterial({ color: 0xFFB347 }), 40); this.bigMesh.count = 0; this.scene.add(this.bigMesh);
    this.partMesh = new T.InstancedMesh(new T.BoxGeometry(0.12, 0.12, 0.12), new T.MeshBasicMaterial({ color: 0xFFFFFF }), MAXP); this.partMesh.count = 0; this.scene.add(this.partMesh);
    this.models = {};
    this.tmpM = new T.Matrix4(); this.tmpV = new T.Vector3(); this.camPos = null;
  }

  // 캐릭터 모델: 몸통(팀색) · 머리 · 캐릭터별 표식 · 무기 · 발밑 고리 · 그림자
  makeModel(chId, ally, isMe) {
    const T = THREE, g = new T.Group(), ch = AR_CHARS[chId] || AR_CHARS.bolt;
    const C = ally ? 0x3FA9F5 : 0xF24E4E, CD = ally ? 0x1C6FB5 : 0xA92430;
    const body = new T.MeshLambertMaterial({ color: C }), dark = new T.MeshLambertMaterial({ color: CD }), skin = new T.MeshLambertMaterial({ color: 0xF2C9A0 }), metal = new T.MeshLambertMaterial({ color: 0x3A3F55 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const big = ch.hp >= 150, small = ch.hp <= 85, s = big ? 1.25 : small ? 0.88 : 1;
    const torso = add(big ? new T.BoxGeometry(0.8, 0.6, 0.6) : new T.CylinderGeometry(0.28, 0.34, 0.6, 10), body, 0, 0.55 * s, 0); torso.scale.setScalar(s);
    add(new T.BoxGeometry(0.5 * s, 0.1, 0.4 * s), dark, 0, 0.3 * s, 0);                                   // 허리띠
    const head = add(new T.SphereGeometry(0.26 * s, 12, 10), skin, 0, 1.02 * s, 0);
    // 캐릭터 표식 (머리 위)
    if (chId === 'bolt') add(new T.CylinderGeometry(0.27 * s, 0.27 * s, 0.1, 12), dark, 0, 1.2 * s, 0);                       // 모자
    if (chId === 'rock') add(new T.BoxGeometry(0.5, 0.18, 0.5), metal, 0, 1.3 * s, 0);                                           // 헬멧
    if (chId === 'hawk') { const b = add(new T.BoxGeometry(0.56 * s, 0.08, 0.2), dark, 0, 1.05 * s, 0.2); }                      // 머리띠
    if (chId === 'sprout') { const l = add(new T.ConeGeometry(0.12, 0.35, 6), new T.MeshLambertMaterial({ color: 0x5EE05E }), 0, 1.38 * s, 0); l.rotation.z = 0.4; }   // 새싹
    if (chId === 'owl') { add(new T.SphereGeometry(0.2, 10, 8), metal, 0.34, 0.6, 0.25); add(new T.CylinderGeometry(0.03, 0.03, 0.14, 5), new T.MeshLambertMaterial({ color: 0xFFD166 }), 0.34, 0.83, 0.25); }   // 폭탄
    if (chId === 'spark') [-0.12, 0, 0.12].forEach((o, i) => { const c = add(new T.ConeGeometry(0.08, 0.3, 5), new T.MeshLambertMaterial({ color: 0xFF9F1C }), o, 1.3 * s, -0.05); c.rotation.z = (i - 1) * 0.5; });   // 불꽃 머리
    // 무기 (앞쪽 = +z 방향으로 뻗음)
    const gunLen = chId === 'hawk' ? 0.95 : chId === 'rock' ? 0.55 : 0.5;
    const gun = add(new T.BoxGeometry(0.12, 0.12, gunLen), metal, 0.22 * s, 0.62 * s, 0.25 + gunLen / 2);
    // 눈 (앞쪽)
    [-0.09, 0.09].forEach(o => add(new T.SphereGeometry(0.045, 6, 5), new T.MeshBasicMaterial({ color: 0x1B1B2F }), o * s, 1.05 * s, 0.23 * s));
    // 발밑 고리 · 그림자
    const ring = new T.Mesh(new T.RingGeometry(0.46, 0.56, 24), new T.MeshBasicMaterial({ color: isMe ? 0xFFFFFF : C, transparent: true, opacity: 0.9, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.userData.noShadow = true; g.add(ring);
    const sh = this._blob = new T.Mesh(new T.CircleGeometry(0.45, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);
    g.userData = { chId, ally, head, torso };
    if (this._blob) { this._blob.userData.noShadow = true; this._blob.userData.blobShadow = true; this._blob.visible = !(this.hq && this.hq !== 'low' && this.renderer.shadowMap.enabled); }   // 실제 그림자가 있으면 둥근 그림자 숨김
    if (window.ThreeQuality) ThreeQuality.prep(this, g);
    this.scene.add(g); return g;
  }
  modelFor(id, chId, ally, isMe) {
    let m = this.models[id];
    if (m && (m.userData.chId !== chId || m.userData.ally !== ally)) { this.scene.remove(m); m = null; }
    if (!m) m = this.models[id] = this.makeModel(chId, ally, isMe);
    return m;
  }

  draw() {
    if (!this.renderer) return super.draw();
    const T = THREE, now = this.now;
    // ── 캐릭터 ──
    const seen = {};
    const put = (id, x, y, ang, chId, ally, isMe, visible, alpha) => {
      const m = this.modelFor(id, chId, ally, isMe); seen[id] = 1; m.visible = visible;
      if (!visible) return;
      m.position.set(x, 0, y); m.rotation.y = Math.PI / 2 - ang;        // 2D 각도(x,y 평면) → 3D 회전 (모델 앞쪽이 +z)
      const bob = Math.sin(now / 120 + x) * 0.03; m.userData.torso.position.y = 0.55 * m.userData.torso.scale.x + bob;   // 걸을 때 살짝 들썩
      m.traverse(o => { if (o.material && o.material.transparent !== undefined && o.type === 'Mesh') { o.material.transparent = alpha < 1 || o.material.transparent; if (o.geometry && o.geometry.type !== 'RingGeometry' && o.geometry.type !== 'CircleGeometry') o.material.opacity = alpha; } });
    };
    Object.keys(this.peers).forEach(id => { const p = this.peers[id];
      const hidden = p.hidden && p.team !== this.team && Math.hypot(p.x - this.x, p.y - this.y) > 2.2;
      put(id, p.x, p.y, p.angle || 0, p.ch || 'bolt', p.team === this.team, false, !p.dead && !hidden, p.hidden ? 0.55 : 1); });
    put('__me', this.x, this.y, this.angle, this.charId, true, true, !this.isDead, this.hidden ? 0.6 : 1);
    Object.keys(this.models).forEach(id => { if (!seen[id]) { this.scene.remove(this.models[id]); delete this.models[id]; } });
    // ── 젬 ──
    const M = this.tmpM, q = new T.Quaternion(), sc = new T.Vector3(1, 1, 1); let n = 0;
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (!gm || gm.by || n >= 60) return; q.setFromEuler(new T.Euler(0, now / 500 + gm.x, 0)); M.compose(new T.Vector3(gm.x, 0.45 + Math.sin(now / 260 + gm.x) * 0.08, gm.y), q, sc); this.gemMesh.setMatrixAt(n++, M); });
    this.gemMesh.count = n; this.gemMesh.instanceMatrix.needsUpdate = true;
    // ── 탄 (폭탄은 포물선) ──
    let nb = 0, nB = 0; q.set(0, 0, 0, 1);
    this.bullets.forEach(b => { const h = b.lob ? 0.6 + Math.sin((1 - b.life / b.t0) * Math.PI) * 1.8 : 0.62; M.compose(new T.Vector3(b.x, h, b.y), q, sc);
      if (b.big || b.lob) { if (nB < 40) this.bigMesh.setMatrixAt(nB++, M); } else if (nb < 160) this.bulMesh.setMatrixAt(nb++, M); });
    this.bulMesh.count = nb; this.bigMesh.count = nB; this.bulMesh.instanceMatrix.needsUpdate = true; this.bigMesh.instanceMatrix.needsUpdate = true;
    // ── 조각 ──
    let np = 0; this.parts.forEach(pt => { if (np >= 200) return; const s2 = Math.max(0.2, pt.l); sc.set(s2, s2, s2); M.compose(new T.Vector3(pt.x, 0.5 + (1 - pt.l) * 0.8, pt.y), q, sc); this.partMesh.setMatrixAt(np++, M); });
    this.partMesh.count = np; this.partMesh.instanceMatrix.needsUpdate = true;
    // ── 카메라: 비스듬히 내려다봄 (내 진영이 아래). 화면에 가로 약 11칸(세로 폰)~20칸(가로 태블릿) ──
    const aspect = (this.vw || 800) / (this.vh || 600), wantW = aspect < 1 ? 8.5 : Math.min(20, 11 * aspect * 0.9);   // 세로 폰은 가로 8.5칸 (캐릭터가 너무 작지 않게)
    const fovR = this.camera.fov * Math.PI / 180, dist = wantW / (2 * Math.tan(fovR / 2) * aspect);
    const dir = new T.Vector3(0, 1.35, this.flip ? -1 : 1).normalize();
    const target = new T.Vector3(this.x, 0, this.y + (this.flip ? 1.2 : -1.2));
    const want = target.clone().addScaledVector(dir, dist);
    if (!this.camPos) this.camPos = want.clone(); else this.camPos.lerp(want, 0.18);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camPos.clone().addScaledVector(dir, -dist));
    // 덤불: 내가 들어가 있으면 반투명
    if (this.bushMesh) { this.bushMesh.material.transparent = this.hidden; this.bushMesh.material.opacity = this.hidden ? 0.55 : 1; }
    if (window.ThreeQuality) ThreeQuality.frame(this, this.x, 0, this.y, now);   // 그림자 범위가 나를 따라옴 · 느리면 그림자 끔
    this.renderer.render(this.scene, this.camera);
    // ── HUD (부모 draw 가 월드는 건너뛰고 HUD 만 그림) ──
    const ctx = this.ctx; ctx.setTransform(this.hudDpr || 1, 0, 0, this.hudDpr || 1, 0, 0);
    super.draw();
  }

  // 3D 위치 → 화면 좌표
  toScreen(x, h, y) { const v = this.tmpV.set(x, h, y).project(this.camera); if (v.z > 1) return null; return [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh]; }
  drawLabels3D(ctx) {
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
if (typeof window !== 'undefined') window.ArenaGame3D = ArenaGame3D;
