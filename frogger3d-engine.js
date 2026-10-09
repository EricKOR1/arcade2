// 길 건너기 3D (크로시 로드 스타일) — 규칙은 FroggerGame 그대로, 그리기만 Three.js
//   · 블록 느낌: 잔디 줄 · 도로(흰 점선) · 강(흐르는 물) · 목적지 둥지 5곳
//   · 비스듬한 정사영 카메라가 개구리를 따라 앞으로 올라감
//   · 화면을 톡 = 앞으로 한 칸, 쓸기 = 그 방향으로 (방향 버튼도 그대로)
//   · 가볍게: 바닥·둥지는 한 덩어리, 한 줄의 차(통나무)는 인스턴스 하나, 개구리는 한 덩어리 (정점 색)
//     — 예전: 부품마다 메시라 그리기 약 160회 · 단계가 오를 때마다 지오메트리 100여 개를 새로 만들고 지우지 않음

// 상자 여러 개를 지오메트리 하나로 합침 (정점 색) — parts: [{ geo(자리 옮긴 BufferGeometry), color(16진 또는 i => 16진) }]
function f3dMerge(parts) {
  const T = THREE; let nv = 0, ni = 0;
  parts.forEach(p => { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), c = new T.Color();
  let ov = 0, oi = 0;
  parts.forEach(p => { const g = p.geo, n = g.attributes.position.count;
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
    for (let i = 0; i < n; i++) { c.set(typeof p.color === 'function' ? p.color(i) : p.color); col[(ov + i) * 3] = c.r; col[(ov + i) * 3 + 1] = c.g; col[(ov + i) * 3 + 2] = c.b; }
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[oi + i] = a[i] + ov; oi += a.length; } else { for (let i = 0; i < n; i++) idx[oi + i] = ov + i; oi += n; }
    ov += n; g.dispose(); });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3)); out.setIndex(new T.BufferAttribute(idx, 1));
  out.computeBoundingSphere(); return out;
}

class FroggerGame3D extends FroggerGame {
  constructor(canvas, opts) {
    // 부모는 2D 캔버스를 잡으므로 겹친 HUD 캔버스를 넘기고, 원래 캔버스는 WebGL 로 씁니다
    const host = canvas.parentElement, hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    host.appendChild(hud);
    super(hud, (opts && opts.cellSize) || 20);
    this.opts = opts || {}; this.glCanvas = canvas; this.host = host; this.hudCanvas = hud;
    this.initThree(); this.bindTouch(); this.resize();
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(this.renderer, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; if (this.hq !== 'low') ThreeQuality.apply(this, { half: 16, exposure: 0.92, sun: 1.3, hemi: 0.6 }); }   // 색 보정 · 태양 그림자(three-quality.js)
    this.vcLin(this.scene);
    if (this.shadow) { this.shadow.userData.noShadow = true; this.shadow.userData.blobShadow = true; if (this.hq && this.hq !== 'low' && this.renderer.shadowMap.enabled) this.shadow.userData.hideBlob = true; }
  }
  resize() {
    const W = this.host.clientWidth || 400, H = this.host.clientHeight || 700; if (W < 10 || H < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); this.hudDpr = dpr;
    this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.vw = W; this.vh = H;
    if (this.renderer) { this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%'; this.fitCamera(); }
  }
  captureTo(g, w, h) {
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);                 // 그린 직후 같은 순간에 복사해야 빈 화면이 아님
    g.drawImage(this.glCanvas, 0, 0, w, h);
    if (this.hudCanvas && this.hudCanvas.width) g.drawImage(this.hudCanvas, 0, 0, w, h);
  }
  // 판이 끝나면(교사가 대기실로 돌림) 이벤트 처리기 · GPU 자원을 모두 풀어 둠 — 예전: 판마다 처리기와 옛 장면이 남아 쌓였음
  destroy() {
    try { (this._touchH || []).forEach(([type, fn, o]) => this.host.removeEventListener(type, fn, o)); this._touchH = []; } catch (e) {}
    try { this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); (o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []).forEach(m => m.dispose()); if (o.isInstancedMesh && o.dispose) o.dispose(); });
      if (this.sun && this.sun.shadow && this.sun.shadow.map) this.sun.shadow.map.dispose(); } catch (e) {}
    try { this.renderer.dispose(); this.hudCanvas.remove(); } catch (e) {}
  }

  // 화면 톡 = 앞으로 · 쓸기 = 그 방향 (방향 버튼 외에 크로시 로드식 조작)
  //   틀(canvas-wrap)에서 먼저 받아 멈춤 — 캔버스에 붙은 페이지 공용 '쓸기' 처리기까지 가면 손가락이 움직이는 동안 계속 뛰어 한 번 쓸 때 여러 칸(측정 6칸) 갔음
  bindTouch() {
    let sx = 0, sy = 0, st = 0;   // 시각은 이벤트가 생긴 때(e.timeStamp) — 그리기가 느린 기기에서 처리 시각으로 재면 짧게 쓸어도 '오래 누름'으로 버려짐
    const down = (x, y, ts) => { sx = x; sy = y; st = ts; };
    const up = (x, y, ts) => { const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy); if (ts - st > 600) return;
      if (d < 18) this.up(); else if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 1 : -1); else if (dy < 0) this.up(); else this.down(); };
    const mine = e => e.target === this.glCanvas;
    this._touchH = [
      ['touchstart', e => { if (!mine(e)) return; e.stopPropagation(); const t = e.changedTouches[0]; down(t.clientX, t.clientY, e.timeStamp); }, { capture: true, passive: true }],
      ['touchmove', e => { if (mine(e)) e.stopPropagation(); }, { capture: true, passive: true }],
      ['touchend', e => { if (!mine(e)) return; e.stopPropagation(); const t = e.changedTouches[0]; up(t.clientX, t.clientY, e.timeStamp); if (e.cancelable) e.preventDefault(); }, { capture: true, passive: false }],
      ['touchcancel', e => { if (mine(e)) e.stopPropagation(); }, { capture: true, passive: true }],
      ['mousedown', e => { if (mine(e)) down(e.clientX, e.clientY, e.timeStamp); }, { capture: true }],
      ['mouseup', e => { if (mine(e)) up(e.clientX, e.clientY, e.timeStamp); }, { capture: true }]
    ];
    this._touchH.forEach(([type, fn, o]) => this.host.addEventListener(type, fn, o));
  }

  // 정점 색도 재질 색처럼 선형으로 (화질 mid·high 의 sRGB 출력에서 원래 색이 나오게) — 지오메트리마다 한 번만
  vcLin(root) {
    if (!this.hq || this.hq === 'low' || !root) return;
    const col = new THREE.Color();
    root.traverse(o => { const g = o.geometry, c = g && g.attributes.color; if (!c || g.userData.vcLin) return; g.userData.vcLin = true;
      for (let i = 0; i < c.count; i++) { col.setRGB(c.getX(i), c.getY(i), c.getZ(i)).convertSRGBToLinear(); c.setXYZ(i, col.r, col.g, col.b); } c.needsUpdate = true; });
  }

  initThree() {
    const T = THREE, C = FROG_COLS, R = FROG_ROWS;
    this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2 });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new T.Scene(); this.scene.background = new T.Color(0x9AD6FF);
    this.camera = new T.OrthographicCamera(-8, 8, 8, -8, 0.1, 200);
    this.hemi = new T.HemisphereLight(0xFFFFFF, 0x7A9A6A, 0.9); this.scene.add(this.hemi);
    const sun = new T.DirectionalLight(0xFFF1D6, 0.65); sun.position.set(-8, 20, 10); this.scene.add(sun); this.sun = sun;
    this.vcMat = new T.MeshLambertMaterial({ vertexColors: true });   // 정점 색 재질 하나를 바닥·개구리·차·통나무가 함께 씀
    // 줄 바닥 (게임 판 밖으로 좌우 6칸씩 더 넓게 — 끝이 잘려 보이지 않게) · 둥지 연잎 — 움직이지 않으므로 한 덩어리로
    const EXT = 6, wide = C + EXT * 2, dashes = [], ground = [], box = (w, h, d, color, x, y, z) => ground.push({ geo: new T.BoxGeometry(w, h, d).translate(x, y, z), color });
    FROG_LANES.forEach((kind, y) => {
      if (kind === 'river') { box(wide, 0.2, 1, 0x3FA9F5, C / 2, -0.25, y + 0.5); return; }
      if (kind === 'road') { box(wide, 0.3, 1, 0x4A4E57, C / 2, -0.15, y + 0.5);
        if (FROG_LANES[y + 1] === 'road') for (let x = -EXT; x < C + EXT; x += 2) dashes.push([x + 0.5, y + 1]);   // 차선 점선 (아래서 한 번에)
        return; }
      const g = kind === 'home' ? 0x5DBB63 : (y % 2 ? 0x8ED16B : 0x7DC45C); box(wide, 0.5, 1, g, C / 2, -0.05, y + 0.5);
      box(wide, 0.5, 0.06, 0x5E9E45, C / 2, -0.05, y + 0.97);                                   // 줄 가장자리
    });
    for (let i = 0; i < 5; i++) box(0.9, 0.08, 0.9, 0x2E8B57, (i / 4) * (C - 1) + 0.5, 0.24, 0.5);   // 목적지 연잎 5곳
    this.scene.add(new T.Mesh(f3dMerge(ground), this.vcMat));
    { const dm = new T.InstancedMesh(new T.BoxGeometry(0.9, 0.02, 0.07), new T.MeshBasicMaterial({ color: 0xF2F2F2 }), dashes.length), mm = new T.Matrix4(); dashes.forEach(([x, z], i) => { mm.makeTranslation(x, 0.01, z); dm.setMatrixAt(i, mm); }); this.scene.add(dm); }
    // 판 밖(좌우)은 어둡게 — 플레이 영역을 알 수 있게
    [-EXT / 2 - 0.02, C + EXT / 2 + 0.02].forEach(x => { const m = new T.Mesh(new T.PlaneGeometry(EXT, R), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.23, R / 2); m.userData.noShadow = true; this.scene.add(m); });
    // 나무 · 바위 (잔디 줄의 판 밖, 인스턴스)
    const spots = []; FROG_LANES.forEach((kind, y) => { if (kind === 'river' || kind === 'road') return; for (let x = -EXT; x < C + EXT; x++) if ((x < 0 || x >= C) && ((x * 7 + y * 3) % 4 === 0)) spots.push([x + 0.5, y + 0.5]); });
    const trunk = new T.InstancedMesh(new T.BoxGeometry(0.3, 0.5, 0.3), new T.MeshLambertMaterial({ color: 0x7A5230 }), spots.length);
    const leaf = new T.InstancedMesh(new T.BoxGeometry(0.8, 0.9, 0.8), new T.MeshLambertMaterial({ color: 0x2F9E44 }), spots.length);
    const m4 = new T.Matrix4(); spots.forEach(([x, z], i) => { m4.makeTranslation(x, 0.45, z); trunk.setMatrixAt(i, m4); m4.makeTranslation(x, 1.1, z); leaf.setMatrixAt(i, m4); }); this.scene.add(trunk, leaf);
    // 목적지 둥지 5곳 (채우면 개구리가 앉아 있음)
    this.nests = [];
    for (let i = 0; i < 5; i++) { const x = (i / 4) * (C - 1) + 0.5, frog = this.makeFrog(); frog.position.set(x, 0.28, 0.5); frog.scale.setScalar(0.8); frog.visible = false; this.nests.push({ frog }); }
    // 개구리
    this.frog = this.makeFrog(); this.scene.add(this.frog);
    this.shadow = new T.Mesh(new T.CircleGeometry(0.34, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    this.laneMeshes = []; this.builtLanes = null; this.parts = []; this.camZ = null;
  }
  // 블록 개구리: 몸통 · 배 · 눈 두 개 · 뒷다리 — 한 덩어리 (모양은 개구리 여섯 마리가 함께 씀)
  makeFrog() {
    const T = THREE, g = new T.Group();
    if (!this._frogGeo) { const P = [], box = (w, h, d, c, x, y, z) => P.push({ geo: new T.BoxGeometry(w, h, d).translate(x, y, z), color: c });
      box(0.62, 0.38, 0.6, 0x3DBB4A, 0, 0.22, 0); box(0.5, 0.06, 0.45, 0xC8F07A, 0, 0.04, 0.02);
      [-0.18, 0.18].forEach(x => { box(0.18, 0.18, 0.18, 0xFFFFFF, x, 0.46, -0.16); box(0.08, 0.1, 0.06, 0x1B1B2F, x, 0.47, -0.26); box(0.16, 0.12, 0.36, 0x2E9E3C, x * 1.9, 0.08, 0.1); });
      this._frogGeo = f3dMerge(P); }
    g.add(new T.Mesh(this._frogGeo, this.vcMat));
    this.scene.add(g); return g;
  }
  // 한 줄의 움직이는 것 모양: 도로 = 자동차(1칸)·트럭(2칸), 강 = 통나무 (한 줄은 길이·색·방향이 모두 같음)
  laneGeo(lane) {
    const T = THREE, L = lane.items[0].len, P = [], box = (w, h, d, c, x, y, z) => P.push({ geo: new T.BoxGeometry(w, h, d).translate(x, y, z), color: c });
    if (lane.kind === 'river') {   // 옆면 나무껍질 · 양끝 나이테
      const cg = new T.CylinderGeometry(0.36, 0.36, L - 0.1, 10).rotateZ(Math.PI / 2).translate(L / 2, 0.02, 0), vc = new Array(cg.attributes.position.count).fill(0x8B5A2B);
      cg.groups.forEach(gr => { if (gr.materialIndex) for (let i = gr.start; i < gr.start + gr.count; i++) vc[cg.index.array[i]] = 0xD9A066; });
      P.push({ geo: cg, color: i => vc[i] });
    } else {
      const col = new T.Color(lane.color).getHex(), front = lane.dir > 0 ? 1 : -1;
      if (L >= 2) { box(L - 0.15, 0.55, 0.72, 0xE9ECF2, L / 2 - front * 0.3, 0.42, 0); box(0.62, 0.5, 0.72, col, L / 2 + front * (L / 2 - 0.4), 0.4, 0); box(0.2, 0.26, 0.66, 0x9DE9FF, L / 2 + front * (L / 2 - 0.2), 0.52, 0); }   // 트럭
      else { box(0.86, 0.34, 0.66, col, 0.5, 0.3, 0); box(0.52, 0.26, 0.6, 0x9DE9FF, 0.45 - front * 0.05, 0.58, 0); }      // 승용차 (몸통 · 유리 지붕)
      [0.22, L - 0.22].forEach(x => box(0.26, 0.26, 0.8, 0x23262E, x, 0.12, 0));      // 바퀴 (앞뒤 축)
      box(0.05, 0.08, 0.56, 0xFFF3B0, (front > 0 ? L - 0.01 : 0.01), 0.34, 0);          // 전조등
    }
    return f3dMerge(P);
  }
  syncItems() {
    if (this.builtLanes !== this.lanes) {                 // 새 단계(레벨)로 줄이 새로 만들어지면 모델도 새로 — 옛 모델은 GPU 에서 지움
      this.laneMeshes.forEach(({ mesh }) => { this.scene.remove(mesh); mesh.geometry.dispose(); if (mesh.dispose) mesh.dispose(); });
      this.laneMeshes = []; this.builtLanes = this.lanes;
      this.lanes.forEach(l => { if (!l.items.length) return;
        const mesh = new THREE.InstancedMesh(this.laneGeo(l), this.vcMat, l.items.length); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;   // 인스턴스는 줄 전체에 흩어져 있어 한 덩어리 기준 잘라내기를 끔
        if (window.ThreeQuality) ThreeQuality.prep(this, mesh);   // 그림자 · 색 보정
        this.vcLin(mesh); this.scene.add(mesh); this.laneMeshes.push({ lane: l, mesh }); });
    }
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4());
    this.laneMeshes.forEach(({ lane, mesh }) => { const n = Math.min(lane.items.length, mesh.count); for (let i = 0; i < n; i++) { m4.makeTranslation(lane.items[i].x, 0, lane.y + 0.5); mesh.setMatrixAt(i, m4); } mesh.instanceMatrix.needsUpdate = true; });
  }
  fitCamera() {
    const aspect = (this.vw || 400) / (this.vh || 700), cam = this.camera;
    // 세로 화면: 가로 15칸이 들어가게 / 가로 화면: 세로 10줄 정도
    let halfW, halfH; if (aspect < 1) { halfW = 6.4; halfH = halfW / aspect; } else { halfH = 6.2; halfW = halfH * aspect; }   // 세로 폰은 조금 당겨 개구리가 잘 보이게
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH; cam.updateProjectionMatrix();
  }

  draw() {
    if (!this.renderer) return;
    const now = this.now || 0;
    this.syncItems();
    // 개구리: 뛸 때 포물선 · 착지 때 눌림 · 죽으면 납작(도로)·가라앉음(강)
    const hop = Math.sin(this.hopT * Math.PI), dying = this.deathT > 0, lane = this.lanes[this.fy];
    const fx = this.fx + 0.5, fz = this.fy + 0.5;
    this.frog.position.set(fx, 0.22 + hop * 0.55 - (dying && lane.kind === 'river' ? (1 - this.deathT) * 0.8 : 0), fz);
    const squash = dying && lane.kind === 'road' ? Math.max(0.15, this.deathT) : 1 - hop * 0.15 + (this.hopT > 0 && this.hopT < 0.2 ? 0.1 : 0);
    this.frog.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.3);
    this.frog.rotation.y = this.faceDir || 0; this.frog.visible = !this.gameOver;
    this.shadow.position.set(fx, 0.24, fz); this.shadow.scale.setScalar(1 - hop * 0.35); this.shadow.visible = !dying && lane.kind !== 'river';
    this.nests.forEach((n, i) => { n.frog.visible = !!this.homes[i]; });
    // 카메라: 개구리 줄을 따라 부드럽게 (비스듬히 · 살짝 옆에서)
    const targetZ = Math.min(FROG_ROWS - 4.5, Math.max(3.5, fz - 1.2));
    this.camZ = this.camZ == null ? targetZ : this.camZ + (targetZ - this.camZ) * 0.12;
    const cx = FROG_COLS / 2 + (fx - FROG_COLS / 2) * 0.25;
    this.camera.position.set(cx + 5, 17, this.camZ + 12); this.camera.lookAt(cx, 0, this.camZ);
    if (window.ThreeQuality) ThreeQuality.frame(this, fx, 0, fz, now);
    if (this.shadow && this.shadow.userData.hideBlob) this.shadow.visible = !this.renderer.shadowMap.enabled ? this.shadow.visible : false;
    this.renderer.render(this.scene, this.camera);
    this.drawHud();
  }
  // 몸 방향: 뛰는 쪽을 봄
  hop(dx, dy) { const before = this.hopT; super.hop(dx, dy); if (this.hopT > 0 && before === 0) this.faceDir = dx ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2) : (dy > 0 ? Math.PI : 0); }

  drawHud() {
    const c = this.ctx, W = this.vw, H = this.vh, dpr = this.hudDpr || 1; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const txt = (s, x, y, size, col, align) => { c.font = '900 ' + size + 'px Pretendard, sans-serif'; c.textAlign = align || 'left'; c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * 0.2); c.strokeStyle = '#1B1B2F'; c.strokeText(s, x, y); c.fillStyle = col || '#fff'; c.fillText(s, x, y); };
    txt('❤'.repeat(Math.max(0, this.lives)), 14, 34, 22, '#FF5C7A');
    txt('단계 ' + this.level, W - 14, 34, 20, '#fff', 'right');
    // 목적지 5칸 채움 표시
    for (let i = 0; i < 5; i++) { c.fillStyle = this.homes[i] ? '#5EE05E' : 'rgba(255,255,255,0.35)'; c.strokeStyle = '#1B1B2F'; c.lineWidth = 2; c.beginPath(); c.arc(W / 2 - 40 + i * 20, 28, 7, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (this.deathT > 0) txt(this.lanes[this.fy].kind === 'river' ? '풍덩!' : '앗!', W / 2, H * 0.35, 44, '#FFD166', 'center');
  }
}
if (typeof window !== 'undefined') window.FroggerGame3D = FroggerGame3D;
