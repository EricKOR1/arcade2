// 카트 레이싱 3D — 2D 카트(KartGame)의 규칙·트랙 11개·아이템·장애물·네트워크·완주·관전 신호를 그대로 쓰고,
// 월드(도로·가드레일·장식물·아치·아이템 상자·부스터·위험물·카트)만 Three.js 로 세웁니다.
//   좌표: 2D 세계 (x, y) + 고도 e  →  3D (x·s, e·s, y·s),  s = 카트 길이 2.6 / 트랙의 카트 길이
//   오버레이(미니맵·순위·카운트다운·알림)는 2D 판의 그리기 함수를 HUD 캔버스에 그대로 사용
class KartGame3D extends KartGame {
  constructor(canvas, opts) {
    const host = canvas.parentElement, hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    host.appendChild(hud);
    super(hud, opts);
    this.glCanvas = canvas; this.host = host; this.hudCanvas = hud;
    this.S = 2.6 / this.track.carLen;
    this.fx3d = []; this.flash = 0; this.shake3d = 0;
    // 내가 공격을 보낼 때 3D 연출 (규칙은 그대로 원래 onAttack 으로)
    const orig = this.opts.onAttack; this.opts.onAttack = (type, target, data) => { try { this.fxAttack(type, target, data); } catch (e) {} return orig ? orig(type, target, data) : undefined; };
    this.initThree(); this.resize();
    this.hq = this.pickQuality(); this.applyQuality(); if (this.enableReal) this.enableReal();   // PC 고화질 낮 트랙: 사진 하늘·물리 재질·빛 번짐(kart3d-real.js)
    if (this.hq !== 'low' && window.Kart3DHQ) Kart3DHQ.loadAssets().then(a => { if (this.renderer) this.onAssets(a); });
  }

  // ── 화질 3단계: high(태양 그림자 2048 · 지형 · 구름) · mid(그림자 1024 — 태블릿 기본) · low(예전 모습, 효과 없음)
  //    주소에 ?q=high|mid|low 로 고정 가능. 느리면 자동으로 한 단계씩 낮춤(draw)
  pickQuality() {
    const m = (typeof location !== 'undefined' && location.search.match(/[?&]q=(high|mid|low)/)) || null; if (m) { this.hqLocked = true; return m[1]; }   // 주소로 고정하면 자동으로 낮추지 않음
    if (this.opts.quality) return this.opts.quality;
    let gpu = ''; try { const gl = this.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) {}
    if (/swiftshader|llvmpipe|software/i.test(gpu)) return 'low';
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'mid' : 'high';
  }
  // 색을 선형 공간으로 (sRGB 출력 + 톤 매핑에서 원래 색이 나오게) — 한 재질은 한 번만
  lin(root) {
    if (this.hq === 'low' || !root) return; const T = THREE;
    root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (!m || m.userData.lin) return; m.userData.lin = true;
      if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear();
      ['map', 'emissiveMap'].forEach(k => { if (m[k]) { m[k].encoding = T.sRGBEncoding; m[k].needsUpdate = true; } }); m.needsUpdate = true; }); });
  }
  applyQuality() {
    const T = THREE, r = this.renderer; if (this.hq === 'low') return;
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = this.night ? 1.2 : 1.0;
    this.scene.traverse(o => { if (o.isDirectionalLight) this.sun = o; if (o.isHemisphereLight) this.hemi = o; });
    // 조명 색도 선형으로 (안 하면 빛이 너무 밝고 흐려져 화면이 회색빛으로 바램)
    if (this.hemi) { this.hemi.intensity = this.night ? 0.8 : 0.9; this.hemi.color.convertSRGBToLinear(); this.hemi.groundColor.convertSRGBToLinear(); }
    if (this.sun) this.sun.color.convertSRGBToLinear();
    // 땅: 테마별 선명한 색 (Kenney 풍) — 원래 트랙 잔디색은 어두운 톤이라 밝히면 채도가 낮아 칙칙함
    const far = this.track.theme.far || 'hills', groundHex = { hills: '#6DBE45', peaks: '#E6EDF5', mesa: '#E0B77E', ocean: '#E9D8A6', city: '#4A5068' }[far];
    if (this.ground && groundHex) { this.ground.material.color.set(groundHex); this.ground.material.userData.lin = false; }
    if (this.roadMat) { this.roadMat.color.set(this.night ? '#8A90A8' : far === 'peaks' ? '#B4B9C6' : '#6A6F7C'); this.roadMat.userData.lin = false; }   // 설산은 눈밭과 어울리게 조금 밝게   // 도로: 짙은 아스팔트(도로 그림에 곱해짐) — 연회색 도로가 화면을 칙칙하게 만들던 것
    if (this.sun) { this.sun.intensity = this.night ? 0.45 : 1.25;
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; this.sun.castShadow = true; const sh = this.sun.shadow, sz = this.hq === 'high' ? 2048 : 1024;
      sh.mapSize.set(sz, sz); const c = sh.camera; c.left = -36; c.right = 36; c.top = 36; c.bottom = -36; c.near = 1; c.far = 420; sh.bias = -0.0006; sh.normalBias = 0.03; this.scene.add(this.sun.target); }
    this.scene.traverse(o => { if (o.isMesh && !o.userData.far && o.geometry && o.geometry.type !== 'SphereGeometry') o.receiveShadow = true; });
    this.buildTerrain(); if (this.buildStyle) this.buildStyle(); else this.buildClouds();   // 로우폴리 레이싱 연출(kart3d-style.js)
    this.lin(this.scene); if (this.scene.fog) this.scene.fog.color.convertSRGBToLinear();
    this.karts && Object.keys(this.karts).forEach(id => { this.scene.remove(this.karts[id].g); delete this.karts[id]; });
  }
  // Kenney 모델 도착: 카트를 차량 모델로, 나무를 숲 모델로
  onAssets(a) {
    const T = THREE; if (!a || !a['vehicle-truck-red']) return; this.assets = a; this.assetsVer = (this.assetsVer || 0) + 1;
    Object.values(a).forEach(sc => sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m) m.userData.lin = true; }); } }));
    const forest = a['decoration-forest'];
    if (forest && this.decoObjs && this.hq === 'high') {                // 소나무 숲 모델은 무거워(무리당 2천 삼각형) 고화질에서만 — 보통(태블릿)은 가벼운 나무 그대로
      forest.updateMatrixWorld(true); const meshes = []; forest.traverse(o => { if (o.isMesh) meshes.push(o); });
      const box = new T.Box3().setFromObject(forest), size = box.getSize(new T.Vector3()), k = 7.5 / Math.max(0.01, size.y);
      // 소나무만 Kenney 숲 (둥근 나무는 kart3d-style)
      ['pine'].forEach(kind => { const objs = this.decoObjs[kind]; if (!objs || !objs.length) return;
        (this.decoMeshes[kind] || []).forEach(m => this.scene.remove(m));
        meshes.forEach(src => { const im = new T.InstancedMesh(src.geometry, src.material, objs.length), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
          objs.forEach((o, i) => { const p = this.P(o.x, o.y, o.e); p.y -= box.min.y * k; const s2 = k * (0.8 + (o.r || 0.5) * 0.5); q.setFromAxisAngle(new T.Vector3(0, 1, 0), (o.r2 || o.r || 0) * 6.28); sc.set(s2, s2, s2);
            m4.compose(p, q, sc).multiply(src.matrixWorld); im.setMatrixAt(i, m4); });
          im.castShadow = this.hq === 'high'; im.receiveShadow = true; this.scene.add(im); }); });
    }
    Object.keys(this.karts).forEach(id => { this.scene.remove(this.karts[id].g); delete this.karts[id]; });
  }
  makeKartHQ(look, isMe) {
    const T = THREE, g = new T.Group(), col = new T.Color(look && look.color || '#3FA9F5'), hsl = {}; col.getHSL(hsl);
    const hue = hsl.h * 360, cands = [['red', 0], ['red', 360], ['yellow', 50], ['green', 130], ['purple', 275]];
    const pick = hsl.s < 0.15 ? 'yellow' : cands.reduce((b, o) => Math.abs(o[1] - hue) < Math.abs(b[1] - hue) ? o : b)[0];
    const m = this.assets['vehicle-truck-' + pick].clone(true);
    const box = new T.Box3().setFromObject(m), size = box.getSize(new T.Vector3()), sc = 3.4 / Math.max(size.x, size.z);   // 차량 길이 3.4 (예전 상자 카트보다 조금 크게 — 멀리서도 잘 보이게)
    m.scale.setScalar(sc); if (size.x > size.z) m.rotation.y = Math.PI / 2; m.rotation.y += (this.modelYaw || 0);
    m.position.y = -box.min.y * sc; g.add(m);
    const wheels = []; let body = null;
    m.traverse(o => { if (/wheel/i.test(o.name)) wheels.push(o); if (o.isMesh && /body/i.test(o.name)) { o.material = o.material.clone(); o.material.userData.lin = true; body = o.material; } });
    g.userData.wheels = wheels; g.userData.body = body || { color: new T.Color() };
    if (!this.shTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const s2 = c.getContext('2d'); const r = s2.createRadialGradient(32, 32, 4, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); s2.fillStyle = r; s2.fillRect(0, 0, 64, 64); this.shTex = new T.CanvasTexture(c); }
    const sh = new T.Mesh(new T.PlaneGeometry(3, 3.8), new T.MeshBasicMaterial({ map: this.shTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh); g.userData.shadow = sh;
    const shield = new T.Mesh(new T.SphereGeometry(2.1, 14, 10), new T.MeshBasicMaterial({ color: 0x9DE9FF, transparent: true, opacity: 0.25, depthWrite: false })); shield.position.y = 0.9; shield.visible = false; g.add(shield); g.userData.shield = shield;
    const flame = new T.Group(); [-0.5, 0.5].forEach(x => { const f = new T.Mesh(new T.ConeGeometry(0.28, 1.4, 8), new T.MeshBasicMaterial({ color: 0xFF9F1C, transparent: true, opacity: 0.9 })); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.55, -1.9); flame.add(f); });
    flame.visible = false; g.add(flame); g.userData.flame = flame;
    this.lin(g); this.scene.add(g); return g;
  }
  // 멀리 둘러싼 지형 (노이즈 산 · 평평한 색면 로우폴리) — 초원 언덕 · 설산 · 사막 메사
  buildTerrain() {
    const T = THREE, far = this.track.theme.far || 'hills'; if (far === 'city' || far === 'ocean' || far === 'peaks') return;   // 설산은 원래의 뾰족한 설봉이 더 보기 좋아 그대로
    this.scene.children.filter(o => o.userData.far).forEach(o => this.scene.remove(o));
    const b = this.track.bounds, S = this.S, cx = (b.minX + b.maxX) / 2 * S, cz = (b.minY + b.maxY) / 2 * S;
    const R0 = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) * S * 0.5 + 60, R1 = R0 + 1000, gY = this.groundY;
    const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v; };
    const fbm = (x, y) => vn(x, y) * 0.55 + vn(x * 2.1, y * 2.1) * 0.28 + vn(x * 4.3, y * 4.3) * 0.17;
    const amp = far === 'peaks' ? 420 : far === 'mesa' ? 150 : 110;
    const pal = far === 'peaks' ? [[0, '#5E7F4E'], [0.18, '#7D8BA3'], [0.42, '#98A4B6'], [0.55, '#F4F7FB']] : far === 'mesa' ? [[0, '#D9B27A'], [0.4, '#C97B45'], [0.75, '#A8502F']] : [[0, '#7FBF5A'], [0.45, '#5E9E47'], [0.8, '#8A8F78']];
    const colAt = t => { let c = pal[0][1]; pal.forEach(([k, v]) => { if (t >= k) c = v; }); return new T.Color(c).convertSRGBToLinear(); };
    const RINGS = 24, SEG = 128, pos = [], cols = [], idx = [];
    for (let ri = 0; ri <= RINGS; ri++) { const tt = Math.pow(ri / RINGS, 1.35), r = R0 + (R1 - R0) * tt;
      for (let si = 0; si <= SEG; si++) { const a = si / SEG * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        let n = fbm(x * 0.0045, z * 0.0045); if (far === 'mesa') n = Math.floor(n * 5) / 5 + n * 0.08;
        const rise = Math.min(1, tt * 3.2), h = (far === 'peaks' ? Math.pow(n, 1.7) * 1.9 : n) * amp * rise * (0.55 + 0.45 * tt);   // 설산: 뾰족하고 높게
        pos.push(x, gY + h, z); const c = colAt(h / amp); cols.push(c.r, c.g, c.b);
        if (ri < RINGS && si < SEG) { const q = ri * (SEG + 1) + si; idx.push(q, q + SEG + 1, q + 1, q + 1, q + SEG + 1, q + SEG + 2); } } }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const mat = new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0x000000 }); mat.userData.lin = true;   // 면마다 색이 또렷한 로우폴리 (Lambert 는 flatShading 미지원)
    const mesh = new T.Mesh(geo, mat); mesh.userData.far = true; this.scene.add(mesh);
  }
  // 구름 (낮 트랙)
  buildClouds() {
    if (this.night) return; const T = THREE, c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    for (let i = 0; i < 14; i++) { const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 22 + Math.random() * 30, gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    const tex = new T.CanvasTexture(c), b = this.track.bounds, S = this.S, cx = (b.minX + b.maxX) / 2 * S, cz = (b.minY + b.maxY) / 2 * S, R = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) * S * 0.5 + 300;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + Math.random() * 0.3, r = R * (0.6 + Math.random() * 0.9);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 })); sp.scale.set(260 + Math.random() * 160, 110 + Math.random() * 50, 1);
      sp.position.set(cx + Math.cos(a) * r, this.groundY + 230 + Math.random() * 120, cz + Math.sin(a) * r); sp.userData.far = true; sp.userData.clouds = true; this.scene.add(sp); }
  }

  resize() {
    if (!this.host) return;
    const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (W < 10 || H < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); this.hudDpr = dpr;
    this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.vw = W; this.vh = H;
    if (this.composer) { this.composer.setSize(W, H); if (this.bloom) this.bloom.setSize(W, H); }
    if (this.renderer) { this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%'; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
  }
  destroy() { super.destroy(); try { this.renderer.dispose(); this.hudCanvas.remove(); } catch (e) {} }

  // 맞는 쪽 연출 (규칙은 부모 그대로)
  hitByMissile(byId, kind) { const blocked = this.finished || this.guarded(); const r = super.hitByMissile(byId, kind); if (!blocked) { this.fxExplode(this.karts.__me && this.karts.__me.g.position, kind === 'turtle' ? 0x06D6A0 : 0xFF7A1A); this.shake3d = 0.5; } return r; }   // 방어막으로 막으면 폭발 없음
  hitByBolt(byId) { const r = super.hitByBolt(byId); this.fxLightning(this.karts.__me && this.karts.__me.g.position); this.flash = 0.8; return r; }
  hitByMagnet(byId) { const r = super.hitByMagnet(byId); const k = this.karts[byId]; if (k && this.karts.__me) this.fxBeam(k.g, this.karts.__me.g, 1200); return r; }
  explode(x, y) { const r = super.explode(x, y); const loc = this.elevAtXY(x, y, this.segIdx), p = this.P(x, y, loc.e); p.y += 1; this.fxExplode(p, 0xFF5C2A, 1.6); this.shake3d = Math.max(this.shake3d, 0.3); return r; }

  // 2D 세계 → 3D
  P(x, y, e) { return new THREE.Vector3(x * this.S, (e || 0) * this.S, y * this.S); }
  // (x, y) 에 가장 가까운 트랙 지점과 그 고도. hint 가 있으면 그 근처만 (빠름), 없으면 전체에서 찾음
  elevAtXY(x, y, hint) { const r = this.track.nearestIndex(x, y, hint), i = r.index; return { i, e: this.track.elev[i] }; }
  lighten(hex, k) { const c = new THREE.Color(hex); c.lerp(new THREE.Color(0xffffff), k); return c; }

  initThree() {
    const T = THREE, tr = this.track, d = tr.def, sky = d.sky || {}, night = (sky.stars || 0) >= 0.5;   // 별이 많은 하늘 = 야경 트랙
    this.night = night;
    this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2 });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr || 1.25));
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog(new T.Color(sky.haze || sky.low || '#BFE0F5'), 180, 820);   // 안개를 멀리 — 먼 도로가 보이게
    this.camera = new T.PerspectiveCamera(68, 1, 0.5, 1600);
    this.scene.add(new T.HemisphereLight(night ? 0x8090D0 : 0xEAF4FF, night ? 0x202030 : 0x6A7A4A, night ? 0.75 : 0.95));
    const sun = new T.DirectionalLight(new T.Color(sky.sun || '#FFF3C4'), night ? 0.35 : 0.7); sun.position.set(120, 260, 80); this.scene.add(sun);
    // 하늘: 트랙 정의의 하늘색 3단 그라데이션 (+ 밤이면 별)
    const sc = document.createElement('canvas'); sc.width = 16; sc.height = 256; const sg = sc.getContext('2d');
    const gr = sg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, sky.top || '#1E3A5F'); gr.addColorStop(0.5, sky.mid || '#4E8FC7'); gr.addColorStop(1, sky.low || '#BFE0F5'); sg.fillStyle = gr; sg.fillRect(0, 0, 16, 256);
    if (night) { sg.fillStyle = '#fff'; for (let i = 0; i < 40; i++) sg.fillRect(Math.random() * 16, Math.random() * 150, 0.6, 0.6); }
    { const skyM = new T.Mesh(new T.SphereGeometry(1400, 24, 12), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), side: T.BackSide, fog: false })); skyM.userData.sky = true; this.scene.add(skyM); }
    // 땅 (트랙 정의의 잔디색을 3D 조명에 맞게 밝게)
    let eMin = 1e9; tr.elev.forEach(e => { eMin = Math.min(eMin, e); }); this.groundY = (eMin - 30) * this.S;
    const b = tr.bounds, cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2, span = Math.max(b.maxX - b.minX, b.maxY - b.minY) * this.S * 2.2 + 600;
    const ground = new T.Mesh(new T.PlaneGeometry(span, span), new T.MeshLambertMaterial({ color: this.lighten(d.grass || '#1E3427', night ? 0.08 : 0.32), side: T.DoubleSide }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx * this.S, this.groundY, cy * this.S); this.scene.add(ground); this.ground = ground;
    this.buildRoad(); this.buildRails(); this.buildDeco(); this.buildArches(); this.buildTrackItems();
    { const before = this.scene.children.length; this.buildFar(cx, cy, span); this.scene.children.slice(before).forEach(o => { o.userData.far = true; }); }
    this.karts = {}; this.hazMeshes = {}; this.camPos = null;
    this.partMesh = new T.InstancedMesh(new T.BoxGeometry(0.25, 0.25, 0.25), new T.MeshBasicMaterial({ color: 0xffffff }), 160); this.partMesh.count = 0; this.scene.add(this.partMesh);
  }

  // ── 도로 · 연석 · 옆벽 (점프 구간은 도로가 끊김) ──
  buildRoad() {
    const T = THREE, tr = this.track, n = tr.n, S = this.S, hw = tr.halfW;
    const rc = document.createElement('canvas'); rc.width = 128; rc.height = 128; const r = rc.getContext('2d');
    r.fillStyle = this.lighten(tr.def.road || '#707479', this.night ? 0 : 0.05).getStyle(); r.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1500; i++) { r.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)'; r.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5); }
    r.fillStyle = '#EDEDED'; r.fillRect(3, 0, 3, 128); r.fillRect(122, 0, 3, 128); r.fillStyle = 'rgba(255,255,255,0.8)'; r.fillRect(62, 0, 4, 60);
    const rt = new T.CanvasTexture(rc); rt.wrapS = rt.wrapT = T.RepeatWrapping; rt.anisotropy = 4;
    const kerb = (tr.theme.kerb && tr.theme.kerb.length) ? tr.theme.kerb : ['#E63946', '#F5F5F5'];
    const kc = document.createElement('canvas'); kc.width = 8; kc.height = 32; const k = kc.getContext('2d'); k.fillStyle = kerb[0]; k.fillRect(0, 0, 8, 16); k.fillStyle = kerb[1] || '#fff'; k.fillRect(0, 16, 8, 16);
    const kt = new T.CanvasTexture(kc); kt.wrapS = kt.wrapT = T.RepeatWrapping;
    const lenUV = tr.stepLen * S;
    const strip = (a, b, yA, yB, vScale, mat, skipGap) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) { const j = i % n, c = tr.center[j], [tx, ty] = tr.tangent[j], nx = -ty, ny = tx, e = tr.elev[j];
        pos.push((c[0] + nx * hw * a) * S, e * S + yA, (c[1] + ny * hw * a) * S, (c[0] + nx * hw * b) * S, e * S + yB, (c[1] + ny * hw * b) * S);
        const v = i * lenUV / vScale; uv.push(0, v, 1, v);
        if (i < n && !(skipGap && (tr.gapSeg[j] || tr.gapSeg[(j + 1) % n]))) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, mat); this.scene.add(m); return m; };
    this.roadMat = new T.MeshLambertMaterial({ map: rt, side: T.DoubleSide }); strip(1, -1, 0.02, 0.02, hw * 2 * S, this.roadMat, true);
    const km = new T.MeshLambertMaterial({ map: kt, side: T.DoubleSide });
    strip(1.07, 1, 0.1, 0.02, 3, km, true); strip(-1, -1.07, 0.02, 0.1, 3, km, true);
    // 옆벽: 도로 가장자리에서 땅까지 (도로가 떠 보이지 않게). 점프 구간은 비워 둠
    const skirt = off => { const pos = [], idx = [];
      for (let i = 0; i <= n; i++) { const j = i % n, c = tr.center[j], [tx, ty] = tr.tangent[j], nx = -ty, ny = tx, e = tr.elev[j];
        const x = (c[0] + nx * hw * off) * S, z = (c[1] + ny * hw * off) * S; pos.push(x, e * S + 0.05, z, x, this.groundY, z);
        if (i < n && !(tr.gapSeg[j] || tr.gapSeg[(j + 1) % n])) { const q = i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      this.scene.add(new T.Mesh(g, new T.MeshLambertMaterial({ color: this.night ? 0x3A3F55 : 0x9C8A6A, side: T.DoubleSide }))); };
    skirt(1.07); skirt(-1.07);
  }
  // ── 가드레일: 2D 판의 레일 조각 목록을 그대로 (인스턴스 한 번) ──
  buildRails() {
    const T = THREE, rails = this.track.scenery.filter(o => o.kind === 'rail' && !this.track.gapSeg[o.i]);
    const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 0.55, 0.18), new T.MeshLambertMaterial({ color: this.night ? 0x8A93B8 : 0xE9ECF2 }), rails.length);
    const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    rails.forEach((o, k) => { const a = this.P(o.x, o.y, o.e), b = this.P(o.x2, o.y2, o.e2), mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 0.55;
      const len = a.distanceTo(b); q.setFromAxisAngle(up, -Math.atan2(b.z - a.z, b.x - a.x)); sc.set(len + 0.05, 1, 1); m.compose(mid, q, sc); mesh.setMatrixAt(k, m); });
    this.scene.add(mesh);
  }
  // ── 장식물 16종: 종류별 인스턴스 (2D 판과 같은 자리) ──
  buildDeco() {
    const T = THREE, list = this.track.scenery.filter(o => o.kind !== 'rail');
    const by = {}; list.forEach(o => { (by[o.kind] = by[o.kind] || []).push(o); });
    const M = (c, e) => new T.MeshLambertMaterial(e ? { color: c, emissive: e } : { color: c });
    // 종류마다 부품 [도형, 재질, 높이(바닥에서), 크기 배율 무작위?]
    const parts = {
      tree:     [[new T.CylinderGeometry(0.35, 0.5, 3, 6), M(0x7A5230), 1.5], [new T.IcosahedronGeometry(2.6, 0), M(0x3DAA56), 5]],
      pine:     [[new T.CylinderGeometry(0.3, 0.45, 2.4, 6), M(0x6B4A2B), 1.2], [new T.ConeGeometry(2.6, 5, 7), M(0x2F7D46), 4.4], [new T.ConeGeometry(1.8, 3.6, 7), M(0x3A9455), 6.6]],
      palm:     [[new T.CylinderGeometry(0.25, 0.4, 7, 6), M(0x9C7A55), 3.5], [new T.ConeGeometry(3.2, 1.4, 7), M(0x2FA65A), 7.2]],
      cactus:   [[new T.CylinderGeometry(0.55, 0.65, 4.2, 8), M(0x4F8A3A), 2.1], [new T.CylinderGeometry(0.35, 0.35, 1.8, 7), M(0x4F8A3A), 2.6, [0.9, 0, 0]]],
      rock:     [[new T.DodecahedronGeometry(2.2, 0), M(0x8A8F98), 1.2]],
      building: [[new T.BoxGeometry(8, 1, 8), (this.buildingMat = M(this.night ? 0x3B4466 : 0xC9CFD8, this.night ? 0x1A1F3A : 0)), 0.5, null, 'tall']],
      lamp:     [[new T.CylinderGeometry(0.15, 0.2, 6, 6), M(0x5A6272), 3], [new T.SphereGeometry(0.55, 8, 6), M(0xFFF3B0, 0xFFD166), 6.2]],
      billboard:[[new T.BoxGeometry(0.3, 5, 0.3), M(0x5A6272), 2.5], [new T.BoxGeometry(7, 3.2, 0.4), M(0xFF5C7A, this.night ? 0x7A1A3A : 0), 5.8]],
      stand:    [[new T.BoxGeometry(14, 2.2, 5), M(0x5B6C8C), 1.1], [new T.BoxGeometry(14, 2.2, 3), M(0x6E7FA0), 3.3, [0, 0, -1]]],
      windmill: [[new T.CylinderGeometry(0.8, 1.2, 10, 8), M(0xE9ECF2), 5], [new T.BoxGeometry(0.4, 9, 0.6), M(0xF5F5F5), 10, [0, 0, 1]], [new T.BoxGeometry(9, 0.4, 0.6), M(0xF5F5F5), 10, [0, 0, 1]]],
      balloon:  [[new T.SphereGeometry(1.6, 12, 10), M(0xFF6BD6), 9], [new T.CylinderGeometry(0.03, 0.03, 7, 3), M(0xDDDDDD), 4]],
      umbrella: [[new T.CylinderGeometry(0.1, 0.1, 3, 5), M(0xF5F5F5), 1.5], [new T.ConeGeometry(2.4, 1, 10), M(0xFF9F43), 3.2]],
      snowman:  [[new T.SphereGeometry(1.2, 10, 8), M(0xF5F8FF), 1.1], [new T.SphereGeometry(0.8, 10, 8), M(0xF5F8FF), 2.8], [new T.ConeGeometry(0.15, 0.6, 6), M(0xFF9F43), 2.9, [0, 0, 0.8]]],
      sign:     [[new T.BoxGeometry(0.25, 3, 0.25), M(0x5A6272), 1.5], [new T.BoxGeometry(3.2, 1.6, 0.25), M(0xFFD166), 3.4]],
      tire:     [[new T.TorusGeometry(0.9, 0.38, 6, 12), M(0x23262E), 0.4, null, 'flat'], [new T.TorusGeometry(0.9, 0.38, 6, 12), M(0x2D3140), 1.1, null, 'flat']],
      flower:   [[new T.SphereGeometry(0.7, 6, 5), M(0xFF6BD6), 0.5], [new T.SphereGeometry(0.6, 6, 5), M(0xFFD166), 0.5, [0.9, 0, 0.3]]]
    };
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), up = new T.Vector3(0, 1, 0), flat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2);
    Object.keys(by).forEach(kind => { const spec = parts[kind]; if (!spec) return; const objs = by[kind];
      this.decoMeshes = this.decoMeshes || {}; this.decoObjs = by;
      spec.forEach(([geo, mat, h, off, mode]) => { const mesh = new T.InstancedMesh(geo, mat, objs.length); (this.decoMeshes[kind] = this.decoMeshes[kind] || []).push(mesh);
        objs.forEach((o, k) => { const base = this.P(o.x, o.y, o.e), s = 0.8 + (o.r || 0.5) * 0.6, rot = (o.r2 || o.r || 0) * 6.28;
          q.setFromAxisAngle(up, rot); if (mode === 'flat') q.multiply(flat);
          let hh = h * s; sc.set(s, s, s);
          if (mode === 'tall') { const tall = 10 + (o.r || 0.5) * 28; sc.set(s, tall, s); hh = tall / 2; }
          const p = base.clone(); p.y += hh; if (off) { const v = new T.Vector3(off[0] * s, off[1] * s, off[2] * s).applyQuaternion(q); p.add(v); }
          m4.compose(p, q, sc); mesh.setMatrixAt(k, m4); });
        this.scene.add(mesh); }); });
    // 야경: 가로등 머리에 빛 번짐 (점 한 묶음 · 그리기 1번)
    if (this.night && by.lamp && by.lamp.length) {
      const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gg = gc.getContext('2d'), rg = gg.createRadialGradient(32, 32, 2, 32, 32, 32); rg.addColorStop(0, 'rgba(255,230,160,1)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); gg.fillStyle = rg; gg.fillRect(0, 0, 64, 64);
      const pos = []; by.lamp.forEach(o => { const p = this.P(o.x, o.y, o.e); pos.push(p.x, p.y + 6.2 * (0.8 + (o.r || 0.5) * 0.6), p.z); });
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      this.nightGlow = new T.Points(geo, new T.PointsMaterial({ size: 9, map: new T.CanvasTexture(gc), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); this.scene.add(this.nightGlow);
    }
  }
  // ── 아치 3개 + 출발 아치 ──
  buildArches() {
    const T = THREE, tr = this.track, list = tr.arches.map(a => ({ i: a.i, label: a.label, start: false })).concat([{ i: 0, label: 'START', start: true }]);
    list.forEach(a => { const c = tr.center[a.i], [tx, ty] = tr.tangent[a.i], e = tr.elev[a.i], g = new T.Group(), w = tr.halfW * 2 * this.S + 3;
      const post = new T.MeshLambertMaterial({ color: a.start ? 0xE9ECF2 : 0x5B6C8C });
      [-1, 1].forEach(sd => { const p = new T.Mesh(new T.BoxGeometry(1, 9, 1), post); p.position.set(sd * w / 2, 4.5, 0); g.add(p); });
      const bc = document.createElement('canvas'); bc.width = 256; bc.height = 40; const b = bc.getContext('2d'); b.fillStyle = a.start ? '#E63946' : '#1D7FA6'; b.fillRect(0, 0, 256, 40); b.fillStyle = '#fff'; b.font = '900 26px Pretendard, sans-serif'; b.textAlign = 'center'; b.fillText(a.label || '', 128, 29);
      const banner = new T.Mesh(new T.BoxGeometry(w, 2, 0.5), new T.MeshLambertMaterial({ map: new T.CanvasTexture(bc) })); banner.position.y = 9; g.add(banner);
      g.position.copy(this.P(c[0], c[1], e)); g.rotation.y = -Math.atan2(ty, tx) + Math.PI / 2; g.userData.startArch = a.start; this.scene.add(g); });
    // 체크무늬 출발선
    const fc = document.createElement('canvas'); fc.width = 64; fc.height = 8; const f = fc.getContext('2d'); for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { f.fillStyle = (x + y) % 2 ? '#111' : '#fff'; f.fillRect(x * 4, y * 4, 4, 4); }
    const c0 = tr.center[0], [tx, ty] = tr.tangent[0], line = new T.Mesh(new T.PlaneGeometry(tr.halfW * 2 * this.S, 1.6), new T.MeshBasicMaterial({ map: new T.CanvasTexture(fc) }));
    // 평면의 가로(X)가 도로의 옆 방향(-ty, tx)을 향하게: 눕힌(x=-90°) 뒤 z 회전 θ 는 atan2(-tx, -ty) (예전 식은 좌우가 뒤집혀 선이 비스듬했음)
    line.rotation.x = -Math.PI / 2; line.rotation.z = Math.atan2(-tx, -ty); line.position.copy(this.P(c0[0], c0[1], tr.elev[0])); line.position.y += 0.06; this.scene.add(line);
  }
  // ── 아이템 상자 · 부스터 발판 · 장애물 · 점프대 ──
  buildTrackItems() {
    const T = THREE, tr = this.track;
    if (!this.noItems && tr.itemSpots.length) {
      const qc = document.createElement('canvas'); qc.width = qc.height = 64; const q = qc.getContext('2d'); const gr = q.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#FFE066'); gr.addColorStop(0.5, '#FF6BD6'); gr.addColorStop(1, '#5BC8FF'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); q.fillStyle = '#fff'; q.font = '900 46px sans-serif'; q.textAlign = 'center'; q.fillText('?', 32, 48);
      this.boxMesh = new T.InstancedMesh(new T.BoxGeometry(1.9, 1.9, 1.9), new T.MeshLambertMaterial({ map: new T.CanvasTexture(qc), transparent: true, opacity: 0.92 }), tr.itemSpots.length); this.scene.add(this.boxMesh);
      this.boxBase = tr.itemSpots.map(sp => { const p = this.P(sp.x, sp.y, tr.elev[sp.i]); p.y += 1.5; return p; });
    }
    const ac = document.createElement('canvas'); ac.width = 64; ac.height = 64; const a = ac.getContext('2d'); a.fillStyle = '#FF8A00'; a.fillRect(0, 0, 64, 64);
    a.fillStyle = '#FFE066'; [0, 26].forEach(o => { a.beginPath(); a.moveTo(12, 30 + o - 10); a.lineTo(32, 10 + o); a.lineTo(52, 30 + o - 10); a.lineTo(52, 40 + o - 10); a.lineTo(32, 20 + o); a.lineTo(12, 40 + o - 10); a.fill(); });
    const aTex = new T.CanvasTexture(ac); this.pads = [];
    tr.boostPads.forEach(bp => { const m = new T.Mesh(new T.PlaneGeometry(tr.halfW * 0.3 * this.S, tr.halfW * 0.4 * this.S), new T.MeshBasicMaterial({ map: aTex, transparent: true }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-Math.cos(bp.angle), -Math.sin(bp.angle)); m.position.copy(this.P(bp.x, bp.y, tr.elev[bp.i])); m.position.y += 0.08; this.scene.add(m); this.pads.push(m); });
    // 장애물 (2D 판과 같은 자리 · 맞으면 잠시 사라짐)
    const OBS = { cone: [new T.ConeGeometry(0.55, 1.4, 10), 0xFF7A1A, 0.7], barrel: [new T.CylinderGeometry(0.7, 0.7, 1.5, 12), 0x4CC9F0, 0.75], rock: [new T.DodecahedronGeometry(1.2, 0), 0x8A8F98, 0.8], puddle: [new T.CircleGeometry(1.8, 16), 0x3B82F6, 0.05] };
    this.obsMeshes = tr.obstacles.map(o => { const spec = OBS[o.kind] || OBS.barrel; const m = new T.Mesh(spec[0], new T.MeshLambertMaterial(o.kind === 'puddle' ? { color: spec[1], transparent: true, opacity: 0.7 } : { color: spec[1] }));
      if (o.kind === 'puddle') m.rotation.x = -Math.PI / 2; m.position.copy(this.P(o.x, o.y, tr.elev[o.i])); m.position.y += spec[2]; this.scene.add(m); return { o, m }; });
    // 드리프트 구간: 노면에 주황·흰 줄무늬 띠 + 코너 바깥쪽에 화살표 표지판(도는 방향)
    if (tr.driftZones && tr.driftZones.length) {
      const zc = document.createElement('canvas'); zc.width = 16; zc.height = 32; const zg = zc.getContext('2d'); zg.fillStyle = 'rgba(255,140,30,0.55)'; zg.fillRect(0, 0, 16, 16); zg.fillStyle = 'rgba(255,255,255,0.28)'; zg.fillRect(0, 16, 16, 16);
      const zt = new T.CanvasTexture(zc); zt.wrapS = zt.wrapT = T.RepeatWrapping;
      const pos = [], uv = [], idx = []; let q = 0;
      for (let i = 0; i < tr.n; i++) { if (!tr.driftZone[i] || !tr.driftZone[(i + 1) % tr.n]) continue;
        [i, (i + 1) % tr.n].forEach((j, jj) => { const c = tr.center[j], [tx, ty] = tr.tangent[j], nx = -ty, ny = tx, e = tr.elev[j] * this.S + 0.05, hw = tr.halfW * 0.92;
          pos.push((c[0] + nx * hw) * this.S, e, (c[1] + ny * hw) * this.S, (c[0] - nx * hw) * this.S, e, (c[1] - ny * hw) * this.S); uv.push(0, (i + jj) * 0.5, 1, (i + jj) * 0.5); });
        idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); q += 4; }
      const zgeo = new T.BufferGeometry(); zgeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); zgeo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); zgeo.setIndex(idx);
      this.scene.add(new T.Mesh(zgeo, new T.MeshBasicMaterial({ map: zt, transparent: true, depthWrite: false, side: T.DoubleSide })));
      const ac2 = document.createElement('canvas'); ac2.width = 128; ac2.height = 64; const ag = ac2.getContext('2d');
      tr.driftZones.forEach(z => {
        ag.clearRect(0, 0, 128, 64); ag.fillStyle = '#1B1B2F'; ag.fillRect(0, 0, 128, 64); ag.fillStyle = '#FF9F1C'; ag.font = '900 40px sans-serif'; ag.textAlign = 'center'; ag.fillText(z.dir > 0 ? '》》' : '《《', 64, 48);
        const tex = new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; c.getContext('2d').drawImage(ac2, 0, 0); return c; })());
        const mat = new T.MeshLambertMaterial({ map: tex });
        for (let k = 0; k < 4; k++) { const i = (z.from + Math.round(k * ((z.to - z.from + tr.n) % tr.n) / 3)) % tr.n, c = tr.center[i], [tx, ty] = tr.tangent[i], nx = -ty, ny = tx, side = -z.dir;   // 코너 바깥쪽
          const b = new T.Mesh(new T.BoxGeometry(4.2, 2.1, 0.3), mat); b.position.copy(this.P(c[0] + nx * tr.halfW * 1.18 * side, c[1] + ny * tr.halfW * 1.18 * side, tr.elev[i])); b.position.y += 1.6;
          b.rotation.y = Math.PI / 2 - Math.atan2(-ny * side, -nx * side); this.scene.add(b); }
      });
    }
    // 점프대: 도로 끝의 경사로
    tr.jumps.forEach(j => { const c = tr.center[j.i], [tx, ty] = tr.tangent[j.i], w = tr.halfW * 2 * this.S;
      const ramp = new T.Mesh(new T.BoxGeometry(w, 0.4, 5), new T.MeshLambertMaterial({ color: 0xFFB347 })); ramp.position.copy(this.P(c[0], c[1], tr.elev[j.i])); ramp.position.y += 0.9;
      ramp.rotation.order = 'YXZ'; ramp.rotation.y = -Math.atan2(ty, tx) + Math.PI / 2; ramp.rotation.x = -0.3; this.scene.add(ramp); });
  }
  // ── 원경: 테마별 (언덕 · 도시 스카이라인 · 메사 · 바다와 섬 · 눈 덮인 봉우리) ──
  buildFar(cx, cy, span) {
    const T = THREE, far = this.track.theme.far || 'hills', R = span * 0.4, cxS = cx * this.S, cyS = cy * this.S, gY = this.groundY;
    const ring = (count, fn) => { for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + (i % 2) * 0.1, r = R * (0.92 + (i % 3) * 0.07); fn(cxS + Math.cos(a) * r, cyS + Math.sin(a) * r, i); } };
    if (far === 'ocean') {                                     // 바다: 땅 바깥은 물, 먼 섬
      const sea = new T.Mesh(new T.PlaneGeometry(span * 3, span * 3), new T.MeshLambertMaterial({ color: 0x2E9BD6 })); sea.rotation.x = -Math.PI / 2; sea.position.set(cxS, gY - 0.3, cyS); this.scene.add(sea);
      this.ground.scale.setScalar(0.55); this.ground.material.color.set(0xE9D8A6);          // 섬(모래 해변)
      ring(9, (x, z, i) => { const m = new T.Mesh(new T.SphereGeometry(40 + (i % 3) * 15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: 0x4F9E4F })); m.scale.y = 0.45; m.position.set(x * 1.3 - cxS * 0.3, gY - 0.3, z * 1.3 - cyS * 0.3); this.scene.add(m); });
      return; }
    if (far === 'city') {                                      // 도시: 창문 불빛 스카이라인
      const wc = document.createElement('canvas'); wc.width = 32; wc.height = 64; const w = wc.getContext('2d'); w.fillStyle = this.night ? '#1C2340' : '#8D9BB5'; w.fillRect(0, 0, 32, 64);
      for (let y = 2; y < 64; y += 6) for (let x = 2; x < 32; x += 6) { w.fillStyle = Math.random() < (this.night ? 0.55 : 0.2) ? (this.night ? '#FFD98A' : '#DDE6F5') : (this.night ? '#2A3355' : '#7C8AA6'); w.fillRect(x, y, 3, 3); }
      const tex = new T.CanvasTexture(wc); const mat = new T.MeshLambertMaterial({ map: tex, emissive: this.night ? 0xFFFFFF : 0x000000, emissiveMap: this.night ? tex : null, emissiveIntensity: 0.9 });
      ring(26, (x, z, i) => { const h = 50 + (i * 37 % 7) * 22, m = new T.Mesh(new T.BoxGeometry(28 + (i % 4) * 10, h, 28), mat); m.position.set(x, gY + h / 2, z); this.scene.add(m); });
      if (this.buildingMat && this.night) { this.buildingMat.map = tex; this.buildingMat.emissiveMap = tex; this.buildingMat.emissive.set(0xFFFFFF); this.buildingMat.emissiveIntensity = 0.8; this.buildingMat.needsUpdate = true; }
      return; }
    if (far === 'mesa') {                                      // 사막: 평평한 꼭대기의 붉은 바위산
      const mat = new T.MeshLambertMaterial({ color: 0xB5643B }), top = new T.MeshLambertMaterial({ color: 0xD9894F });
      ring(14, (x, z, i) => { const h = 40 + (i * 29 % 5) * 16, rr = 50 + (i % 3) * 20, m = new T.Mesh(new T.CylinderGeometry(rr * 0.8, rr, h, 7), mat); m.position.set(x, gY + h / 2, z); this.scene.add(m);
        const c = new T.Mesh(new T.CylinderGeometry(rr * 0.8, rr * 0.8, 3, 7), top); c.position.set(x, gY + h + 1.5, z); this.scene.add(c); }); return; }
    if (far === 'peaks') {                                     // 설산: 눈 덮인 봉우리
      const rock = new T.MeshPhongMaterial({ color: 0x7D8BA3, flatShading: true }), snow = new T.MeshPhongMaterial({ color: 0xF4F7FB, flatShading: true });
      ring(16, (x, z, i) => { const h = 110 + (i * 41 % 5) * 40, rr = 80 + (i % 4) * 25, m = new T.Mesh(new T.ConeGeometry(rr, h, 6), rock); m.position.set(x, gY + h / 2, z); m.rotation.y = i; this.scene.add(m);
        const c = new T.Mesh(new T.ConeGeometry(rr * 0.38, h * 0.38, 6), snow); c.position.set(x, gY + h * 0.81, z); c.rotation.y = i; this.scene.add(c); }); return; }
    // 기본(초원): 둥근 초록 언덕
    ring(16, (x, z, i) => { const rr = 70 + (i % 4) * 25, m = new T.Mesh(new T.SphereGeometry(rr, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: i % 2 ? 0x6FAE5A : 0x5E9E4D })); m.scale.y = 0.5; m.position.set(x, gY, z); this.scene.add(m); });
  }

  // ── 3D 연출 ──
  // (부모 KartGame 의 addFx(type) 와 이름이 겹치지 않게 addFx3d)
  addFx3d(mesh, life, update) { this.lin(mesh); this.scene.add(mesh); this.fx3d.push({ mesh, life, t: 0, update }); }
  fxExplode(pos, color, size) {
    if (!pos) return; const T = THREE, sz = size || 1;
    const ball = new T.Mesh(new T.SphereGeometry(1, 14, 10), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })); ball.position.copy(pos); ball.position.y += 1;
    this.addFx3d(ball, 0.55, (m, k) => { m.scale.setScalar(sz * (0.6 + k * 4)); m.material.opacity = 0.9 * (1 - k); });
    const ring = new T.Mesh(new T.RingGeometry(0.8, 1.2, 24), new T.MeshBasicMaterial({ color: 0xFFE066, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.copy(pos); ring.position.y += 0.2;
    this.addFx3d(ring, 0.5, (m, k) => { m.scale.setScalar(sz * (1 + k * 7)); m.material.opacity = 0.8 * (1 - k); });
    for (let i = 0; i < 10; i++) { const c = new T.Mesh(new T.BoxGeometry(0.4, 0.4, 0.4), new T.MeshBasicMaterial({ color: i % 2 ? 0x555555 : color })); c.position.copy(pos); c.position.y += 1;
      const v = new T.Vector3((Math.random() - 0.5) * 12, 5 + Math.random() * 7, (Math.random() - 0.5) * 12);
      this.addFx3d(c, 0.9, (m, k, dt) => { v.y -= 22 * dt; m.position.addScaledVector(v, dt); m.rotation.x += dt * 8; m.scale.setScalar(1 - k * 0.7); }); }
    if (window.Sound && Sound.explosion) Sound.explosion();
  }
  // 미사일(빨강)·거북 등껍질(초록)이 내 카트에서 상대에게 날아가 터짐
  fxProjectile(fromG, toG, kind) {
    const T = THREE, g = new T.Group();
    if (kind === 'turtle') { g.add(new T.Mesh(new T.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: 0x06D6A0 }))); }
    else { const body = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 1.6, 10), new T.MeshLambertMaterial({ color: 0xE63946 })); body.rotation.x = Math.PI / 2; g.add(body);
      const nose = new T.Mesh(new T.ConeGeometry(0.28, 0.6, 10), new T.MeshLambertMaterial({ color: 0xF5F5F5 })); nose.rotation.x = Math.PI / 2; nose.position.z = 1.1; g.add(nose); }
    const a = fromG.position.clone(); a.y += 1.2;
    this.addFx3d(g, 0.6, (m, k) => { const b = toG.position.clone(); b.y += 1; const p = a.clone().lerp(b, k); p.y += Math.sin(k * Math.PI) * 3; m.position.copy(p); m.lookAt(b);
      if (Math.random() < 0.8) this.fxPuff(p, 0xBBBBBB); if (k >= 0.99) this.fxExplode(b, kind === 'turtle' ? 0x06D6A0 : 0xFF7A1A); });
  }
  fxPuff(pos, color) { const T = THREE, m = new T.Mesh(this.puffGeo || (this.puffGeo = new T.SphereGeometry(0.35, 6, 5)), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })); m.position.copy(pos);
    this.addFx3d(m, 0.5, (mm, k) => { mm.scale.setScalar(1 + k * 2); mm.material.opacity = 0.6 * (1 - k); }); }
  // 자석 빔: 두 카트 사이를 잇는 떨리는 파란 빛줄기
  fxBeam(aG, bG, ms) {
    const T = THREE, m = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 1, 8, 1, true), new T.MeshBasicMaterial({ color: 0x4CC9F0, transparent: true, opacity: 0.8, depthWrite: false }));
    this.addFx3d(m, (ms || 1200) / 1000, (mm, k) => { const a = aG.position.clone(), b = bG.position.clone(); a.y += 1; b.y += 1; const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
      mm.position.copy(mid); mm.scale.set(1 + Math.sin(k * 60) * 0.5, len, 1 + Math.sin(k * 60) * 0.5); mm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); mm.material.opacity = 0.8 * (1 - k * 0.6); });
  }
  // 번개: 하늘에서 카트로 내리꽂는 지그재그 선
  fxLightning(pos) {
    if (!pos) return; const T = THREE, pts = []; let y = 40, x = pos.x, z = pos.z;
    while (y > pos.y + 1) { pts.push(new T.Vector3(x, y, z)); y -= 4 + Math.random() * 3; x += (Math.random() - 0.5) * 3; z += (Math.random() - 0.5) * 3; } pts.push(new T.Vector3(pos.x, pos.y + 1, pos.z));
    const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xFFF3B0, transparent: true }));
    this.addFx3d(line, 0.45, (m, k) => { m.material.opacity = (Math.floor(k * 12) % 2 ? 0.3 : 1) * (1 - k); });
    this.fxExplode(pos, 0xFFF3B0, 0.6);
  }
  fxSwirl(g) { const T = THREE, m = new T.Mesh(new T.TorusGeometry(2, 0.18, 8, 24), new T.MeshBasicMaterial({ color: 0xB15DFF, transparent: true }));
    this.addFx3d(m, 0.8, (mm, k) => { mm.position.copy(g.position); mm.position.y += 0.4 + k * 3; mm.rotation.x = Math.PI / 2; mm.rotation.z = k * 12; mm.material.opacity = 1 - k; }); }
  fxAttack(type, target, data) {
    const me = this.karts.__me; if (!me) return; const tk = target ? this.karts[target] : null;
    if ((type === 'missile' || type === 'turtle') && tk) this.fxProjectile(me.g, tk.g, type);
    else if (type === 'magnet' && tk) this.fxBeam(me.g, tk.g, 1500);
    else if (type === 'bolt') { Object.keys(this.peers).forEach(id => { const pr = this.peers[id], k = this.karts[id]; if (k && (pr.progress || 0) > this.progress) this.fxLightning(k.g.position); }); this.flash = 0.6; }
    else if (type === 'swap') { this.fxSwirl(me.g); if (tk) this.fxSwirl(tk.g); }
  }
  stepFx(dt) {
    for (let i = this.fx3d.length - 1; i >= 0; i--) { const f = this.fx3d[i]; f.t += dt; const k = Math.min(1, f.t / f.life);
      if (f.update) f.update(f.mesh, k, dt); if (k >= 1) { this.scene.remove(f.mesh); f.mesh.traverse(o => { if (o.material) o.material.dispose(); }); this.fx3d.splice(i, 1); } }
  }

  // 카트 모델 (2D 판의 카트 색 · 체형)
  makeKart(look, isMe) {
    if (this.hq !== 'low' && this.makeKartStyled) return this.makeKartStyled(look, isMe);   // 운전자가 탄 카트
    if (this.assets && this.hq !== 'low') return this.makeKartHQ(look, isMe);
    const T = THREE, g = new T.Group(), col = new T.Color(look && look.color || '#3FA9F5'), body = new T.MeshLambertMaterial({ color: col }), dark = new T.MeshLambertMaterial({ color: 0x23262E });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const truck = look && look.style === 'truck';
    add(new T.BoxGeometry(1.7, truck ? 0.7 : 0.45, 2.6), body, 0, truck ? 0.65 : 0.55, 0);
    add(new T.BoxGeometry(1.3, 0.35, 0.8), body, 0, 0.62, 1.55);
    add(new T.BoxGeometry(1.9, 0.1, 0.45), body, 0, 1.25, -1.25);
    add(new T.BoxGeometry(0.9, 0.5, 0.8), dark, 0, 0.95, -0.3);
    add(new T.SphereGeometry(0.45, 10, 8), body, 0, 1.55, -0.2);
    add(new T.BoxGeometry(0.6, 0.18, 0.1), new T.MeshLambertMaterial({ color: 0x9DE9FF }), 0, 1.58, 0.22);
    this.wheelGeo = this.wheelGeo || new T.CylinderGeometry(0.45, 0.45, 0.4, 10);
    [[-0.95, 0.9], [0.95, 0.9], [-0.95, -0.9], [0.95, -0.9]].forEach(([x, z]) => { add(this.wheelGeo, dark, x, 0.45, z).rotation.z = Math.PI / 2; });
    if (!this.shTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const s = c.getContext('2d'); const r = s.createRadialGradient(32, 32, 4, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); s.fillStyle = r; s.fillRect(0, 0, 64, 64); this.shTex = new T.CanvasTexture(c); }
    const sh = new T.Mesh(new T.PlaneGeometry(3, 3.8), new T.MeshBasicMaterial({ map: this.shTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh); g.userData.shadow = sh;
    const shield = new T.Mesh(new T.SphereGeometry(2.1, 14, 10), new T.MeshBasicMaterial({ color: 0x9DE9FF, transparent: true, opacity: 0.25, depthWrite: false })); shield.position.y = 0.9; shield.visible = false; g.add(shield); g.userData.shield = shield;
    const flame = new T.Group(); [-0.5, 0.5].forEach(x => { const f = new T.Mesh(new T.ConeGeometry(0.28, 1.4, 8), new T.MeshBasicMaterial({ color: 0xFF9F1C, transparent: true, opacity: 0.9 })); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.55, -1.9); flame.add(f); });
    flame.visible = false; g.add(flame); g.userData.flame = flame; g.userData.body = body;
    this.scene.add(g); return g;
  }
  makeHazard(kind) {
    const T = THREE, g = new T.Group();
    if (kind === 'banana') { const b = new T.Mesh(new T.TorusGeometry(0.7, 0.22, 8, 14, Math.PI * 1.1), new T.MeshLambertMaterial({ color: 0xFFD84A })); b.rotation.x = -Math.PI / 2; b.position.y = 0.25; g.add(b); }
    else if (kind === 'oil') { const o = new T.Mesh(new T.CircleGeometry(2.2, 18), new T.MeshLambertMaterial({ color: 0x14141C, transparent: true, opacity: 0.85 })); o.rotation.x = -Math.PI / 2; o.position.y = 0.03; g.add(o);
      const sh = new T.Mesh(new T.CircleGeometry(0.9, 12), new T.MeshBasicMaterial({ color: 0x6A4CFF, transparent: true, opacity: 0.35 })); sh.rotation.x = -Math.PI / 2; sh.position.set(0.5, 0.04, 0.3); g.add(sh); }
    else if (kind === 'bomb') { const bm = new T.Mesh(new T.SphereGeometry(0.8, 12, 10), new T.MeshLambertMaterial({ color: 0x23262E })); bm.position.y = 0.8; g.add(bm);
      const f = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ color: 0xFF3B3B })); f.position.y = 1.7; g.add(f); g.userData.blink = f; }
    else { const m = new T.Mesh(new T.SphereGeometry(0.8, 10, 8), new T.MeshLambertMaterial({ color: 0xFFD166 })); m.position.y = 0.8; g.add(m); }
    return g;
  }
  placeKart(id, x, y, a, air, look, isMe, opts) {
    let k = this.karts[id];
    const lk = (look ? look.color + look.style : '') + '|' + (this.assetsVer || 0);
    if (k && k.lk !== lk) { this.scene.remove(k.g); delete this.karts[id]; k = null; }          // 관전 학생이 바뀌면 카트 모양·색도 새로
    if (!k) k = this.karts[id] = { g: this.makeKart(look, isMe), hint: isMe ? this.segIdx : undefined, lk };
    const loc = this.elevAtXY(x, y, k.hint); k.hint = loc.i;
    // 점프 구간에서 떨어질 때도 땅 밑으로는 내려가지 않게 (카메라가 땅 밑으로 들어가 하늘만 보이던 문제)
    const p = this.P(x, y, loc.e); const lift = Math.max((air || 0) * this.S, this.groundY + 0.2 - p.y); k.g.position.set(p.x, p.y + lift, p.z);
    k.g.userData.shadow.position.y = 0.05 - lift; k.g.userData.shadow.visible = !this.track.gapSeg[loc.i];
    const spin = opts && opts.spin ? (this.clock() / 70) : 0;
    k.g.rotation.set(0, Math.PI / 2 - a + spin, 0); k.g.userData.shield.visible = !!(opts && opts.shield); k.seen = true;
    if (k.g.userData.wheels) { const d = k.lastP ? Math.hypot(p.x - k.lastP.x, p.z - k.lastP.z) : 0; k.lastP = { x: p.x, z: p.z }; k.g.userData.wheels.forEach(w => { w.rotation.x += Math.min(1.2, d * 1.4); }); }
    if (this.hq !== 'low' && this.renderer.shadowMap.enabled) k.g.userData.shadow.visible = false;
    const fl = k.g.userData.flame; fl.visible = !!(opts && opts.boost); if (fl.visible) fl.children.forEach(c => { c.scale.set(1, 0.7 + Math.random() * 0.6, 1); });
    const bm = k.g.userData.body.color; if (opts && opts.star) bm.setHSL((this.clock() / 400) % 1, 0.9, 0.55); else if (k.baseColor) bm.copy(k.baseColor); if (!k.baseColor) k.baseColor = bm.clone();
    return k;
  }

  draw() {
    if (!this.renderer) return;
    const T = THREE, now = this.clock(), tr = this.track;
    Object.keys(this.karts).forEach(id => { this.karts[id].seen = false; });
    // 나
    this.placeKart('__me', this.x, this.y, this.angle, this.airZ, this.look, true, { spin: now < this.spinUntil || now < this.stunUntil, shield: now < this.shieldUntil, boost: now < this.boostUntil || now < this.starUntil, star: now < this.starUntil });
    // 친구들 (2D 판과 같은 0.15초 보간)
    Object.keys(this.peers).forEach(id => { if (this.spectator && id === this.followId) return;   // 관전: 따라가는 학생은 '나' 자리에 그림
      const pr = this.peers[id], s = this.interpPeer(pr, now); pr.look = pr.look || kartLook(pr.name || id);
      this.placeKart(id, s.x, s.y, s.a, pr.z, pr.look, false, { spin: pr.spin, shield: pr.shield, boost: pr.boost }); });
    Object.keys(this.karts).forEach(id => { if (!this.karts[id].seen) { this.scene.remove(this.karts[id].g); delete this.karts[id]; } });
    // 아이템 상자 (먹으면 잠시 사라짐 · 회전)
    if (this.boxMesh) { const m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(now / 1400, now / 900, 0)), sc = new T.Vector3();
      tr.itemSpots.forEach((sp, k) => { const on = !(sp.takenUntil > now); sc.setScalar(on ? 1 : 0.001); m4.compose(this.boxBase[k], q, sc); this.boxMesh.setMatrixAt(k, m4); }); this.boxMesh.instanceMatrix.needsUpdate = true; }
    this.obsMeshes.forEach(({ o, m }) => { m.visible = !(o.hitUntil > now); });
    this.pads.forEach(p => { p.material.opacity = 0.75 + Math.sin(now / 150) * 0.2; });
    // 위험물 (다른 학생이 놓은 바나나·기름·폭탄 등)
    const seenH = {};
    Object.keys(this.hazards || {}).forEach(hid => { const h = this.hazards[hid]; if (!h) return; seenH[hid] = 1; let m = this.hazMeshes[hid];
      if (!m) { m = this.makeHazard(h.kind); this.lin(m); this.scene.add(m); this.hazMeshes[hid] = m; }
      const loc = this.elevAtXY(h.x, h.y, m.userData.hint); m.userData.hint = loc.i; m.position.copy(this.P(h.x, h.y, loc.e)); m.position.y += 0.06;
      if (m.userData.blink) m.userData.blink.visible = Math.floor(now / 250) % 2 === 0; if (h.kind === 'banana') m.rotation.y = (h.x + h.y) % 6; });
    Object.keys(this.hazMeshes).forEach(hid => { if (!seenH[hid]) { this.scene.remove(this.hazMeshes[hid]); delete this.hazMeshes[hid]; } });
    // 입자 (2D 판의 입자 목록: 세계 좌표 + 높이)
    let np = 0; const m4 = new T.Matrix4(), q0 = new T.Quaternion(), sc0 = new T.Vector3();
    const pc = this._pc || (this._pc = new T.Color());
    (this.parts || []).forEach(pt => { if (np >= 160 || pt.x == null) return; const loc = this.elevAtXY(pt.x, pt.y, this.segIdx), p = this.P(pt.x, pt.y, loc.e); p.y += ((pt.h || 0) * this.S) + 0.3;
      // 2D 판의 입자 크기(size, 화면 픽셀 기준)·색을 그대로 — 작게, 수명에 따라 줄어듦
      const s = Math.max(0.15, (pt.life != null ? pt.life : 1)) * Math.min(1.2, (pt.size || 6) / 12); sc0.setScalar(s); m4.compose(p, q0, sc0); this.partMesh.setMatrixAt(np, m4);
      pc.set(pt.color || pt.c || '#FFD166'); if (this.hq !== 'low') pc.convertSRGBToLinear(); this.partMesh.setColorAt(np, pc); np++; });
    if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true;
    this.partMesh.count = np; this.partMesh.instanceMatrix.needsUpdate = true;
    const dtf = Math.min(0.05, (now - (this._fxT || now)) / 1000); this._fxT = now; this.stepFx(dtf);
    if (this.nightGlow) this.nightGlow.material.opacity = 0.85 + Math.sin(now / 300) * 0.1;
    // 카메라: 뒤에서 따라감 · 빠를수록 시야 넓게 (2D 판처럼 코너에서 살짝 늦게 돔)
    const base = this.moveA != null && !this.spectator ? this.moveA : this.angle; let dca = this.angle - base; while (dca > Math.PI) dca -= Math.PI * 2; while (dca < -Math.PI) dca += Math.PI * 2;
    const me = this.karts.__me.g.position, ca = base + dca * 0.35, fwd = new T.Vector3(Math.cos(ca), 0, Math.sin(ca));   // 드리프트 중엔 미끄러져 가는 방향을 따라가 옆모습이 보임
    // 시점: 조금 더 높고 멀리서, 더 앞을 보게 (예전엔 도로에 붙어 앞이 잘 안 보임)
    // 내려다보는 각도 약 13° → 23° (카메라를 높이고 조금 더 앞을 봄) — 먼 도로까지 보이게
    const want = me.clone().addScaledVector(fwd, -8.4); want.y = Math.max(want.y + 8.6, this.groundY + 2.5); const look = me.clone().addScaledVector(fwd, 11); look.y += 0.6;
    if (!this.camPos) { this.camPos = want.clone(); this.camLook = look.clone(); }
    this.camPos.lerp(want, 0.15); this.camLook.lerp(look, 0.25); this.camera.position.copy(this.camPos);
    if (this.shake3d > 0) { this.camera.position.x += (Math.random() - 0.5) * this.shake3d; this.camera.position.y += (Math.random() - 0.5) * this.shake3d; this.shake3d = Math.max(0, this.shake3d - dtf * 1.5); }
    this.camera.lookAt(this.camLook);
    const fov = 66 + Math.min(1, Math.max(0, this.speed) / (this.maxSpeed * 1.4)) * 14 + (now < this.boostUntil ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.2) { this.camera.fov += (fov - this.camera.fov) * 0.1; this.camera.updateProjectionMatrix(); }
    if (this.updateStyle) this.updateStyle(now);
    if (this.sun && this.renderer.shadowMap.enabled) { const mp = this.karts.__me.g.position; this.sun.position.set(mp.x + 45, mp.y + 95, mp.z + 30); this.sun.target.position.copy(mp); this.sun.target.updateMatrixWorld(); }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    // 느리면 화질을 한 단계씩 자동으로 낮춤 (3초 평균 초당 26프레임 미만: high → mid, 22 미만: mid → 그림자 끔)
    if (this.hq !== 'low' && !this.spectator && !this.hqLocked) { this._fpsN = (this._fpsN || 0) + 1; if (!this._fpsT) this._fpsT = now;
      if (now - this._fpsT > 3000) { const fps = this._fpsN * 1000 / (now - this._fpsT); this._fpsN = 0; this._fpsT = now;
        if (fps < 26 && this.hq === 'high') { this.hq = 'mid'; this.composer = null; this.sun.shadow.mapSize.set(1024, 1024); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
        else if (fps < 22 && this.hq === 'mid' && this.renderer.shadowMap.enabled) { this.renderer.shadowMap.enabled = false; this.sun.castShadow = false; this.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.needsUpdate = true; }); } }); } } }
    // ── 오버레이: 2D 판의 미니맵·순위·카운트다운·알림을 그대로 ──
    const ctx = this.ctx, W = this.vw || 800, H = this.vh || 600; ctx.setTransform(this.hudDpr || 1, 0, 0, this.hudDpr || 1, 0, 0); ctx.clearRect(0, 0, W, H);
    const fast = Math.max(0, (this.speed / this.maxSpeed - 0.85) / 0.15);
    if (now < this.boostUntil) this.drawSpeedLines(ctx, W, H, 0.45); else if (fast > 0 && !this.finished) this.drawSpeedLines(ctx, W, H, fast * 0.2);
    this.drawParticles(ctx, W, H, now);                               // 테마 날씨(꽃잎·불꽃·먼지·눈) — 2D 판 그대로
    if (this.flash > 0) { ctx.fillStyle = 'rgba(255,250,220,' + Math.min(0.85, this.flash).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - dtf * 3); }   // 번개 번쩍임
    this.drawMinimap(ctx, W, H);
    // 겹친 조작 버튼이 있으면(학생 화면) 속도계·아이템 칸 등 아래쪽 요소를 버튼 위로: 아래 여백만큼 뺀 높이로 그림
    this.drawCanvasOverlay(ctx, W, H - this.k3Lift(H), now);
  }
}
if (typeof window !== 'undefined') window.KartGame3D = KartGame3D;
