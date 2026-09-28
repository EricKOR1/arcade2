// 울산 환경 수사대 3D — 실사풍 화면 (보통·고화질 기기) · 가벼운 화질은 예전 모습 그대로
//   · 물리 하늘(해 위치 → 하늘빛·노을) + 하늘로 만든 환경광(반사) + 대기 안개 + ACES 색 보정
//   · 땅: 위성사진풍 색 사진(land_*.jpg) + 가까이 세부 무늬(숲 수관·풀·콘크리트) + 흘러가는 구름 그림자
//   · 물: 반사하는 물결(강은 하류 쪽으로 흐름) · 도시·공단·마을·숲은 ulsan-world.js 자료로
(function () {
  if (typeof UlsanRpgGame === 'undefined') return;
  const P = UlsanRpgGame.prototype, T = () => THREE;
  const lin = (c, on) => { const x = new THREE.Color(c); if (on) x.convertSRGBToLinear(); return x; };
  const loadScript = src => new Promise((res, rej) => { if (document.querySelector('script[data-src="' + src + '"]')) return res(); const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  UlsanRpgGame.realLibs = () => (UlsanRpgGame._libsP = UlsanRpgGame._libsP || loadScript('lib/Sky.js'));
  // 후처리 (PC 고화질만): 빛 번짐(Bloom) + 색감(채도 조금 낮춤 · 그늘에 푸른 기 · 가장자리 살짝 어둡게) — 켤 때만 도구를 불러옴
  const POST = ['lib/CopyShader.js', 'lib/LuminosityHighPassShader.js', 'lib/EffectComposer.js', 'lib/RenderPass.js', 'lib/ShaderPass.js', 'lib/UnrealBloomPass.js'];
  let postP = null; const loadPost = () => postP || (postP = POST.reduce((p, s) => p.then(() => loadScript(s)), Promise.resolve()));
  const GRADE = { uniforms: { tDiffuse: { value: null }, uSat: { value: 0.92 }, uVig: { value: 0.34 }, uLift: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uVig; uniform vec3 uLift; varying vec2 vUv;
      void main() { vec3 col = texture2D(tDiffuse, vUv).rgb; float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat) + uLift * (1.0 - smoothstep(0.0, 0.35, l));
        col = LinearTosRGB(vec4(max(col, vec3(0.0)), 1.0)).rgb; vec2 d = vUv - 0.5; col *= 1.0 - uVig * dot(d, d) * 1.5; gl_FragColor = vec4(col, 1.0); }` };
  P.realPost = function () {
    if (this.hq !== 'high' || this.composer || (this.qLevel != null && this.qLevel < 2)) return;
    loadPost().then(() => { if (!this.renderer || this.composer || !THREE.EffectComposer || (this.qLevel != null && this.qLevel < 2)) return;
      const T3 = T(), r = this.renderer, size = r.getSize(new T3.Vector2()), dpr = r.getPixelRatio();
      const rt = r.capabilities.isWebGL2 ? new T3.WebGLMultisampleRenderTarget(size.x * dpr, size.y * dpr, { format: T3.RGBAFormat }) : undefined;   // 계단 현상 방지(다중 샘플)
      const C = new T3.EffectComposer(r, rt); C.setPixelRatio(dpr); C.setSize(size.x, size.y); C.addPass(new T3.RenderPass(this.scene, this.camera));
      this.bloom = new T3.UnrealBloomPass(new T3.Vector2(size.x, size.y), 0.2, 0.5, 0.9); C.addPass(this.bloom);
      GRADE.uniforms.uLift.value = new T3.Vector3(0.004, 0.007, 0.014); C.addPass(new T3.ShaderPass(GRADE)); this.composer = C; this._dayKey = null;
    }).catch(() => {});
  };
  P.realPostOff = function () { if (!this.composer) return; try { this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose(); if (this.bloom) this.bloom.dispose(); } catch (e) {} this.composer = null; this.bloom = null; };

  // ── 잘 이어지는 잡음 무늬 (256칸) — R: 나무 머리 · G: 풀·흙 · B: 콘크리트 · A: 큰 얼룩(구름 그림자) ──
  function detailTexture(size) {
    const N = size, d = new Uint8Array(N * N * 4), h = (i, j, s) => { let v = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967295; };
    const pn = (x, y, P, s) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), m = k => ((k % P) + P) % P, a = h(m(i), m(j), s), b = h(m(i + 1), m(j), s), c = h(m(i), m(j + 1), s), e = h(m(i + 1), m(j + 1), s); return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v; };
    const fb = (x, y, P, s, o) => { let t = 0, a = 0.5, n = 0; for (let k = 0; k < o; k++) { t += a * pn(x * (1 << k), y * (1 << k), P << k, s + k); n += a; a *= 0.5; } return t / n; };
    const C = 6, pts = []; for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + 0.15 + 0.7 * h(i, j, 7)) / C, (j + 0.15 + 0.7 * h(i, j, 8)) / C, 0.55 + 0.45 * h(i, j, 9)]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N; let best = 9, br = 1;
      for (const p of pts) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const dx = (p[0] + a - u) * C, dy = (p[1] + b - v) * C, dd = Math.sqrt(dx * dx + dy * dy) / p[2]; if (dd < best) { best = dd; br = p[2]; } }
      const crown = Math.max(0, 1 - best * best * 1.25) * (0.75 + 0.25 * br), k = (y * N + x) * 4;
      d[k] = Math.round(255 * Math.min(1, 0.18 + crown * 0.9 * (0.8 + 0.2 * fb(u * 16, v * 16, 16, 3, 2))));
      d[k + 1] = Math.round(255 * fb(u * 24, v * 24, 24, 11, 3));
      d[k + 2] = Math.round(255 * (0.55 * fb(u * 48, v * 48, 48, 21, 2) + 0.45 * fb(u * 6, v * 6, 6, 23, 3)));
      d[k + 3] = Math.round(255 * fb(u * 4, v * 4, 4, 31, 4)); }
    const t = new (T().DataTexture)(d, N, N, T().RGBAFormat); t.wrapS = t.wrapT = T().RepeatWrapping; t.magFilter = T().LinearFilter; t.minFilter = T().LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
  }

  // ── 처음 한 번: 색 보정 · 하늘 · 별 · 안개 ──
  P.realInit = function () {
    const T3 = T(), r = this.renderer, S = this.scene, hi = this.hq === 'high';
    r.outputEncoding = T3.sRGBEncoding; r.toneMapping = T3.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    this.camera.far = 2400; this.camera.updateProjectionMatrix();
    S.background = lin('#9DB8D2', true); S.fog = new T3.FogExp2(lin('#B7C8D8', true), 0.0036); this.fogBase = 0.0036;
    this.detailTex = detailTexture(hi ? 256 : 192);
    this.realU = { uTime: { value: 0 }, uNight: { value: 0 }, uCloud: { value: 0.65 }, uCloudOff: { value: new T3.Vector2() }, uCam: { value: new T3.Vector3() }, uPlayer: { value: new T3.Vector3() } };
    if (T3.Sky) {   // 물리 하늘 (Preetham) — 밝기만 우리 조명에 맞게 줄임
      const sky = new T3.Sky(); sky.scale.setScalar(1800); sky.material.uniforms.turbidity.value = 7; sky.material.uniforms.rayleigh.value = 1.6; sky.material.uniforms.mieCoefficient.value = 0.006; sky.material.uniforms.mieDirectionalG.value = 0.82;
      sky.material.uniforms.skyGain = { value: 0.62 }; sky.material.fragmentShader = sky.material.fragmentShader.replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float skyGain;').replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
      sky.userData.noShadow = true; sky.frustumCulled = false; sky.renderOrder = 1000; S.add(sky); this.sky = sky;   // 하늘은 먼 쪽 끝(깊이 1)에 그려지므로, 불투명한 것들 다음에 그리면 가려진 곳을 건너뜀
      this.skyScene = new T3.Scene(); const sky2 = new T3.Sky(); sky2.scale.setScalar(900); sky2.material = sky.material; this.skyScene.add(sky2); this.pmrem = new T3.PMREMGenerator(r); }
    // 별 (밤)
    const n = 1400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u); pos.set([q * Math.cos(a) * 1500, Math.abs(u) * 1500 + 40, q * Math.sin(a) * 1500], i * 3); }
    const sg = new T3.BufferGeometry(); sg.setAttribute('position', new T3.BufferAttribute(pos, 3));
    this.stars = new T3.Points(sg, new T3.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); this.stars.frustumCulled = false; this.stars.userData.noShadow = true; this.stars.renderOrder = -9; S.add(this.stars);
    this.hemi.intensity = 0.5;
    // 구름층: 땅에 드리우는 구름 그림자와 같은 무늬 · 해 쪽은 밝고 밑은 회색 · 멀면 하늘빛에 묻힘 (카메라를 따라다니는 넓은 판)
    { const cg = new T3.PlaneGeometry(7000, 7000, 1, 1); cg.rotateX(Math.PI / 2);
      const cm = new T3.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, side: T3.DoubleSide,
        uniforms: { tDetail: { value: this.detailTex }, uCloudOff: this.realU.uCloudOff, uCloud: this.realU.uCloud, uNight: this.realU.uNight, uCam: this.realU.uCam, uSun: { value: new T3.Vector3(0, 1, 0) }, uSunCol: { value: new T3.Color(1, 1, 1) } },
        vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform sampler2D tDetail; uniform vec2 uCloudOff; uniform float uCloud; uniform float uNight; uniform vec3 uCam; uniform vec3 uSun; uniform vec3 uSunCol; varying vec3 vW;
          float dens(vec2 p) { float a = texture2D(tDetail, (p + uCloudOff) * 0.0031).a, b = texture2D(tDetail, p * 0.00093 + vec2(0.31, 0.77)).a; return smoothstep(0.5, 0.8, a * 0.8 + b * 0.3); }
          void main() { float d = dens(vW.xz); if (d < 0.01) discard;
            vec2 ts = normalize(uSun.xz + vec2(1e-4)) * 70.0; float lit = clamp(1.0 - (dens(vW.xz + ts) - d) * 1.7, 0.3, 1.0);
            vec3 col = mix(vec3(0.56, 0.61, 0.69), vec3(1.0), lit) * mix(vec3(1.0), uSunCol, 0.4); col = mix(col, vec3(0.05, 0.06, 0.1), uNight);
            float fade = smoothstep(3300.0, 800.0, length(vW.xz - uCam.xz)); gl_FragColor = vec4(col, d * fade * min(1.0, uCloud * 1.45));
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }` });
      const cl = new T3.Mesh(cg, cm); cl.frustumCulled = false; cl.renderOrder = -8; cl.userData.noShadow = true; S.add(cl); this.clouds = cl; }
    if (hi) this.realPost();
  };
  // 해 위치: 울산 9월 말 (해돋이 약 6시 15분 · 해넘이 약 18시 25분 · 한낮 높이 약 53°)
  P.sunDir = function (hour) { const rise = 6.25, set = 18.4, f = (hour - rise) / (set - rise), el = f >= 0 && f <= 1 ? Math.sin(Math.PI * f) * 53 : -Math.min(Math.abs(hour - rise), Math.abs(hour - set - (hour < rise ? -24 : 0))) * 12, az = 92 + 176 * Math.max(-0.2, Math.min(1.2, f));
    const e = el * Math.PI / 180, a = az * Math.PI / 180; return { el, v: new (T().Vector3)(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)) }; };
  // 낮과 밤 (setDayTime 이 부름)
  P.realDay = function (h) {
    const T3 = T(), hour = ((h % 24) + 24) % 24, sd = this.sunDir(hour), el = sd.el, day = Math.max(0, Math.min(1, (el + 2) / 10)), low = Math.max(0, 1 - Math.max(0, el) / 18), night = 1 - day;
    if (this.sky) { const u = this.sky.material.uniforms; u.sunPosition.value.copy(sd.v); u.turbidity.value = 6 + low * 4; u.rayleigh.value = 1.4 + low * 1.4; u.skyGain.value = 0.55 + 0.1 * low; }
    // 태양(밤엔 달빛): 방향 · 세기 · 색
    const moon = new T3.Vector3(-0.35, 0.72, 0.6).normalize(), dir = el > -1 ? sd.v.clone().setY(Math.max(0.1, sd.v.y)).normalize() : moon;
    const off = dir.clone().multiplyScalar(140); if (this.sunOffset) this.sunOffset.copy(off); else this.sun.position.copy(off);
    const sunCol = new T3.Color().setHSL(0.09 - low * 0.05, 0.25 + low * 0.55, 0.72 + (1 - low) * 0.2);
    this.sun.color.copy(night > 0.9 ? lin('#9FB3FF', true) : sunCol.convertSRGBToLinear()); if (this.clouds) { const cu = this.clouds.material.uniforms; cu.uSun.value.copy(sd.v); cu.uSunCol.value.copy(sunCol); } this.sun.intensity = el > -1 ? (0.25 + 2.5 * Math.pow(day, 1.4)) * (1 - low * 0.35) : 0.2;   // 구름: 해 방향 · 노을빛
    this.hemi.intensity = 0.08 + 0.2 * day; this.hemi.color.copy(lin(night > 0.8 ? '#55618A' : '#DCE8F5', true)); this.hemi.groundColor.copy(lin(night > 0.8 ? '#1A1D26' : '#6B6452', true));   // 햇빛은 세게 · 하늘빛(그늘 밝기)은 약하게 → 그늘이 또렷
    // 안개(대기) 색: 낮 푸른 회색 · 노을 주황 · 밤 짙은 남색
    const fc = new T3.Color('#B9CADB').lerp(new T3.Color('#E9B38E'), Math.max(0, low - 0.35) * 1.4 * day).lerp(new T3.Color('#0D1424'), night); fc.convertSRGBToLinear(); this.scene.fog.color.copy(fc);
    if (!this.sky) this.scene.background.copy(fc);
    this.renderer.toneMappingExposure = 0.88 + night * 0.62;
    this._night = night; this.realU.uNight.value = Math.max(0, Math.min(1, (night - 0.15) * 1.3)); if (this.stars) { this.stars.material.opacity = Math.max(0, night - 0.35) * 1.2; this.stars.visible = this.stars.material.opacity > 0.01; }   // 낮엔 별을 아예 그리지 않음
    // 환경광(반사·은은한 빛)을 하늘에서 다시 만듦 — 해가 조금 움직였을 때만
    const envNow = performance.now(), envOld = this._envEl == null || ((Math.abs(this._envEl - el) > 3 || Math.abs((this._envH || 0) - hour) > 0.75) && !(el < -6 && this._envEl < -6));   // 해가 꽤 움직였을 때만 · 깊은 밤엔 그대로
    if (this.pmrem && (this._envEl == null || (envOld && !this.replay && envNow - (this._envT || 0) > 1500))) { this._envEl = el; this._envH = hour; this._envT = envNow;   // 사건 재현 중엔 다시 만들지 않음 (끝나면 한 번)
      const rt = this.pmrem.fromScene(this.skyScene, 0, 0.1, 1000); if (this.envRT) this.envRT.dispose(); this.envRT = rt; this.scene.environment = rt.texture; }
    if (this.bloom) { this.bloom.strength = 0.12 + 0.5 * night; this.bloom.threshold = 0.93 - 0.23 * night; }   // 낮엔 아주 조금 (햇빛 반사) · 밤엔 불빛이 번짐
    if (this.lamps) this._lampsOn = night > 0.3; (this.glows || []).forEach(p => { p.material.opacity = Math.max(0, Math.min(1, (night - 0.25) * 1.6)); p.visible = night > 0.25; });
  };

  // ── 땅: 위성사진풍 색 + 가까이 세부 무늬 + 구름 그림자 ──
  P.realTerrain = function () {
    const T3 = T(), hi = this.hq === 'high', S = this.scene, seg = hi ? [262, 252] : [175, 168];
    const geo = new T3.PlaneGeometry(524, 504, seg[0], seg[1]); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, lc = this.landcover(), mat = new Float32Array(pos.count * 4);
    const wOf = c => c === 1 || c === 2 ? [1, 0, 0, 0] : c === 3 || c === 4 || c === 5 || c === 10 || c === 12 ? [0, 1, 0, 0] : c === 6 || c === 7 ? [0, 0, 1, 0] : [0, 0, 0, 1];
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, this.groundH(x, z)); const acc = [0, 0, 0, 0];
      for (const [a, b] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) { const w = wOf(lc(x + a, z + b)); for (let k = 0; k < 4; k++) acc[k] += w[k] / 4; } mat.set(acc, i * 4); }
    geo.setAttribute('aMat', new T3.BufferAttribute(mat, 4)); geo.computeVertexNormals(); this.setMeshH(geo, seg[0], seg[1]);   // 걷기 높이 = 그려진 땅
    const tex = new T3.TextureLoader().load('assets/ulsan/' + (hi ? 'land_2k.jpg' : 'land_1k.jpg')); tex.encoding = T3.sRGBEncoding; tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()); tex.userData = {};
    const m = new T3.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0, envMapIntensity: 0.34 }); m.userData.lin = true;
    const U = this.realU, D = this.detailTex;
    m.onBeforeCompile = sh => { sh.uniforms.tDetail = { value: D }; Object.assign(sh.uniforms, { uCloud: U.uCloud, uCloudOff: U.uCloudOff });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vWp = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDetail;\nuniform float uCloud;\nuniform vec2 uCloudOff;\nvarying vec4 vMat;\nvarying vec3 vWp;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec4 dA = texture2D(tDetail, vWp.xz * 0.23); vec4 dB = texture2D(tDetail, vWp.xz * 0.061 + vec2(0.37, 0.11));
          float det = dot(vMat, vec4(dA.r, dA.g, dA.b, dB.g)) / max(0.001, vMat.x + vMat.y + vMat.z + vMat.w);
          float fade = clamp(1.0 - length(vViewPosition) / 170.0, 0.0, 1.0);
          diffuseColor.rgb *= mix(1.0, 0.7 + 0.6 * det, fade) * (0.93 + 0.14 * dB.a);
          float cl = smoothstep(0.52, 0.76, texture2D(tDetail, (vWp.xz + uCloudOff) * 0.0031).a);
          diffuseColor.rgb *= 1.0 - uCloud * 0.34 * cl;`); };
    const ground = new T3.Mesh(geo, m); ground.receiveShadow = true; ground.userData.flat = true; S.add(ground); this.ground = ground;
  };
  // 땅 덮개 (2칸 격자): 0 바다 1 활엽수 2 침엽수 3 논 4 밭 5 풀밭 6 도심 7 공단 8 모래 9 바위 10 억새 11 강변 12 비닐하우스
  P.landcover = function () {
    if (!this._lc) { const b = atob(UWORLD.lc), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); this._lc = a; }
    const G = UG.grid, A = this._lc; return (x, z) => { const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell); return (i < 0 || j < 0 || i >= G.w || j >= G.h) ? 1 : A[j * G.w + i]; };
  };

  // ── 물: 강(하류로 흐르는 물결) · 바다(잔물결) — 하늘을 비춤 ──
  P.realWater = function () {
    const T3 = T(), S = this.scene, U = this.realU, nrm = new T3.TextureLoader().load('assets/ulsan/water_n.jpg'); nrm.wrapS = nrm.wrapT = T3.RepeatWrapping;
    const mk = (color, flowAttr) => { const m = new T3.MeshStandardMaterial({ color, roughness: 0.07, metalness: 0.15, normalMap: nrm, normalScale: new T3.Vector2(0.55, 0.55), envMapIntensity: 1.25 });
      m.onBeforeCompile = sh => { sh.uniforms.uTime = U.uTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + (flowAttr ? 'attribute float aFlow;\n' : '') + 'varying float vFlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = ' + (flowAttr ? 'aFlow' : '0.0') + ';');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vFlow;')
          .replace('#include <normal_fragment_maps>', T3.ShaderChunk.normal_fragment_maps).replace('vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;', `vec2 fo = vec2(0.0, -uTime * vFlow * 0.22); vec2 dr = vec2(uTime * 0.011, uTime * 0.006);
            vec3 n1 = texture2D(normalMap, vUv + fo + dr).xyz * 2.0 - 1.0; vec3 n2 = texture2D(normalMap, vUv * 1.9 + fo * 1.35 - dr * 0.8 + vec2(0.37, 0.61)).xyz * 2.0 - 1.0;
            vec3 mapN = normalize(vec3(n1.xy + n2.xy, n1.z * n2.z));`); };
      m.customProgramCacheKey = () => 'ulwater' + (flowAttr ? 1 : 0); m.userData.lin = false; return m; };   // 강(흐름 있음)·바다 셰이더를 따로
    const riverM = mk(lin('#294F55', true), true), seaM = mk(lin('#1B4262', true), false); riverM.userData.lin = true; seaM.userData.lin = true;
    const vs = [], uv = [], fl = [], idx = []; let base = 0;
    Object.keys(UC_RIVERS).forEach(rid => { const R = UC_RIVERS[rid], L = ucLen(R.pts); let k = 0;
      for (let s = 0; s <= L; s += 1.5) { const a = ucAt(R.pts, s), b = ucAt(R.pts, Math.min(L, s + 1)), dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d, wy = this.waterY(rid, s) - 0.1, hw = R.w / 2 + 0.25;
        vs.push(a[0] + nx * hw, wy, a[1] + nz * hw, a[0] - nx * hw, wy, a[1] - nz * hw); uv.push(0, s / 7, R.w / 7, s / 7); fl.push(R.speed, R.speed); if (k) idx.push(base + (k - 1) * 2, base + k * 2, base + (k - 1) * 2 + 1, base + (k - 1) * 2 + 1, base + k * 2, base + k * 2 + 1); k++; }
      base += k * 2; });
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(vs, 3)); g.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2)); g.setAttribute('aFlow', new T3.Float32BufferAttribute(fl, 1)); g.setIndex(idx); g.computeVertexNormals();
    const rv = new T3.Mesh(g, riverM); rv.receiveShadow = true; rv.userData.flat = true; S.add(rv);
    const sg = new T3.PlaneGeometry(1400, 1400, 1, 1); const suv = sg.attributes.uv; for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i) * 140, suv.getY(i) * 140);
    const sea = new T3.Mesh(sg, seaM); sea.rotation.x = -Math.PI / 2; sea.position.set(300, -0.3, 30); sea.receiveShadow = true; sea.userData.flat = true; S.add(sea); this.sea = sea;
  };

  // ── 도시: 도로 · 다리 · 건물(창문 무늬 셰이더) · 탱크·굴뚝·공정탑 · 구형 탱크 · 지붕 · 비닐하우스 · 차 · 크레인 · 배 · 가로등 ──
  const PAL = ['#EEEBE4', '#E9E1CF', '#DADCDD', '#E3D6BF', '#EADAC9', '#D5DCE3', '#9A5B45', '#7D5A45', '#CDB99A', '#A7A7A2', '#E4E1DA', '#B06B4B', '#6E6F72',
    '#7F93A8', '#D8DADB', '#B9BDC1', '#6E9C9A', '#C9C0AE', '#5D7F99', '#5F8A83', '#6C7580', '#E8DDC0', '#4E8C5A', '#8C8F93', '#B23B2E', '#2C5E9E', '#D9A23A', '#3F7F4F', '#8A8F96',
    '#B7B3AA', '#8A5A3C', '#50555C', '#F0F0EC', '#2F5E9E', '#7A5A3A', '#E86FA8', '#E8C84A', '#9A6CC8', '#F2F0EA', '#D8453A', '#5B8EC7'];   // 29 콘크리트 30 녹슨 철 31 짙은 철 32 흰 공장 33 파랑 34 나무 35~39 꽃 40 크레인 파랑
  const GLSL_HASH = 'float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n';
  // 가려진 주인공 보이게: 카메라와 주인공 사이 건물은 체크무늬로 비움
  //   v2026-10-18a: 카메라에서 주인공까지 원뿔(카메라 쪽은 가늘게) → 화면에선 주인공 둘레의 일정한 동그라미만 · 네 칸 중 한 칸만 남겨 더 투명하게
  //   (예전: 카메라 앞 2.2칸부터 넓게 · 절반만 비워 화면 아래쪽이 크게 체크무늬로 덮였음)
  const GLSL_SEE = `vec3 abS = uPlayer - uCam; float tS = clamp(dot(vWpB - uCam, abS) / dot(abS, abS), 0.0, 1.0); float dS = length(vWpB - (uCam + abS * tS));
    if (tS < 0.97 && dS < 0.35 + 4.6 * tS && vWpB.y > uPlayer.y - 1.8) { vec2 fcS = mod(floor(gl_FragCoord.xy), 2.0); if (fcS.x + fcS.y > 0.5) discard; }`;
  // three.js 는 onBeforeCompile 함수의 글자가 같으면 같은 셰이더로 여겨 먼저 만든 것을 다시 씀 → 끼운 코드마다 다른 이름표를 붙임
  //   (예전: 탱크·굴뚝·차가 건물 셰이더로 그려져 창문 무늬가 생겼음)
  const codeKey = (...parts) => { let h = 2166136261; const t = parts.join('|'); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return 'ul' + (h >>> 0).toString(36) + '_' + t.length; };
  function patchStd(m, U, vDecl, vBody, fDecl, fColor, fRough, fEmis) {   // MeshStandardMaterial 에 코드 끼우기
    const key = codeKey(vDecl, vBody, fDecl, fColor, fRough || '', fEmis || ''); m.customProgramCacheKey = () => key;
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uNight: U.uNight, uCam: U.uCam, uPlayer: U.uPlayer, uTime: U.uTime });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + vDecl).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vBody);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; uniform vec3 uCam; uniform vec3 uPlayer; uniform float uTime;\n' + GLSL_HASH + fDecl)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + fColor)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + (fRough || ''))
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + (fRough ? 'metalnessFactor = mix(metalnessFactor, 0.55, gls * 0.8); metalnessFactor *= 1.0 - max(conc, wat);' : ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (fEmis || '')); };
    m.userData.lin = true; return m;
  }
  const VB = 'attribute vec4 aB;\nvarying vec3 vLoc; varying vec3 vSz; varying vec3 vNl; varying vec4 vBv; varying vec3 vWpB;';
  const VBODY = 'vec3 szB = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)); vSz = szB; vLoc = position * szB; vNl = normal; vBv = aB; vWpB = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;';
  const FDECL = 'varying vec3 vLoc; varying vec3 vSz; varying vec3 vNl; varying vec4 vBv; varying vec3 vWpB; float gls = 0.0; float wat = 0.0; float conc = 0.0; float litW = 0.0; vec3 litC = vec3(1.0, 0.82, 0.55);\n';   // gls 유리 · wat 물 · conc 콘크리트
  const FBOX = `{ float st = vBv.x, sd = vBv.y; vec3 wall = diffuseColor.rgb * 0.84, col = wall; float y = vLoc.y + vSz.y * 0.5;
    bool roof = vNl.y > 0.5; float along = abs(vNl.x) > 0.5 ? vLoc.z : vLoc.x; float wl = abs(vNl.x) > 0.5 ? vSz.z : vSz.x; float a0 = along + wl * 0.5;
    float fl = floor(y / 0.5), fy = fract(y / 0.5);
    if (roof) { float r = hsh(vec3(sd, 3.1, 7.7)); vec3 rc = vec3(0.30, 0.32, 0.31);
      if (st < 0.5) rc = r < 0.3 ? vec3(0.13, 0.24, 0.15) : vec3(0.27, 0.29, 0.29); else if (st < 1.5) rc = vec3(0.10, 0.11, 0.12);
      else if (st < 2.5 || (st > 5.5 && st < 6.5)) rc = r < 0.45 ? vec3(0.10, 0.25, 0.13) : vec3(0.30, 0.30, 0.28);
      else if (st < 3.5) rc = r < 0.3 ? vec3(0.08, 0.16, 0.33) : r < 0.5 ? vec3(0.07, 0.22, 0.2) : r < 0.75 ? vec3(0.42, 0.44, 0.45) : vec3(0.25, 0.27, 0.29);
      else if (st < 4.5) rc = vec3(0.26, 0.26, 0.25); else if (st < 5.5) rc = vec3(0.12, 0.24, 0.14); else rc = wall * 0.9;
      float ex = min(min(vLoc.x + vSz.x * 0.5, vSz.x * 0.5 - vLoc.x), min(vLoc.z + vSz.z * 0.5, vSz.z * 0.5 - vLoc.z)); col = ex < 0.12 ? wall * 0.85 : rc;
      if (st > 7.5) { float ln = fract((vLoc.z + vSz.z * 0.5) / 1.6); bool lip = ex < 0.28 || (ln < 0.09 && vSz.z > 2.5);   // 네모 수조: 콘크리트 테두리·칸막이 + 물(거품이 천천히 움직임)
        float fo = sin(vWpB.x * 5.3 + sin(vWpB.z * 3.1 + uTime * 0.9) * 1.6) * sin(vWpB.z * 4.1 - uTime * 0.7);
        col = lip ? wall * 0.92 : mix(vec3(0.07, 0.11, 0.1), vec3(0.42, 0.44, 0.38), smoothstep(0.35, 1.0, fo) * 0.45); wat = lip ? 0.0 : 1.0; conc = lip ? 1.0 : 0.0; } }
    else if (st < 0.5) { if (wl > 3.0) { float cx = fract(a0 / 0.46); float win = step(0.3, fy) * step(fy, 0.86) * step(0.08, cx) * step(cx, 0.92); gls = win * step(0.55, y) * step(y, vSz.y - 0.3); col = mix(wall, wall * 0.74, step(fy, 0.13) * 0.8); }
      else { col = wall * (0.9 + 0.07 * step(0.5, fract(a0 * 0.6))); if (y > vSz.y - 1.1) col = mix(col, mix(vec3(0.5, 0.12, 0.1), vec3(0.1, 0.25, 0.5), step(0.5, hsh(vec3(sd, 1.0, 2.0)))), 0.55); } }
    else if (st < 1.5) { float cx = fract(a0 / 0.55); gls = step(0.06, cx) * step(cx, 0.94) * step(0.1, fy) * step(fy, 0.93) * step(0.3, y); }
    else if (st < 2.5 || (st > 3.5 && st < 4.5)) { float cx = fract(a0 / 0.9 + sd); gls = step(0.32, fy) * step(fy, 0.78) * step(0.25, cx) * step(cx, 0.7) * step(0.3, y) * step(y, vSz.y - 0.12); }
    else if (st < 3.5) { col = wall * (0.88 + 0.12 * step(0.5, fract(along * 3.0))); gls = step(vSz.y - 1.0, y) * step(y, vSz.y - 0.45) * step(0.1, fract(a0 / 1.2)) * step(fract(a0 / 1.2), 0.9) * step(1.6, vSz.y);
      if (y < 1.5 && abs(fract(a0 / 6.0) - 0.5) < 0.12) col = vec3(0.18, 0.19, 0.2); }
    else if (st < 5.5) { float cx = fract(a0 / 0.7); gls = step(0.25, fy) * step(fy, 0.85) * step(0.1, cx) * step(cx, 0.9) * step(0.4, y); if (fy < 0.12) col = mix(col, vec3(0.45, 0.16, 0.1), 0.5); }
    else if (st < 6.5) { if (y < 0.5) gls = step(0.12, fract(a0 / 1.3)); else { float cx = fract(a0 / 0.8); gls = step(0.3, fy) * step(fy, 0.8) * step(0.2, cx) * step(cx, 0.8); }
      if (y > 0.5 && fy > 0.2 && fy < 0.78 && hsh(vec3(fl, sd, floor(a0 / 2.2))) > 0.62) { float hh = hsh(vec3(fl * 7.0, sd, 3.0)); col = hh < 0.25 ? vec3(0.6, 0.05, 0.05) : hh < 0.5 ? vec3(0.05, 0.2, 0.55) : hh < 0.7 ? vec3(0.7, 0.55, 0.05) : hh < 0.85 ? vec3(0.05, 0.4, 0.15) : vec3(0.85, 0.85, 0.85); gls = 0.0; litW = 1.0; litC = col * 2.0 + 0.2; } }
    else if (st < 7.5) { col = wall * (0.82 + 0.18 * step(0.5, fract(along * 4.0))); }
    else { col = wall * 0.95; conc = 1.0; }
    if (!roof) { col *= mix(0.6, 1.0, smoothstep(0.0, 1.3, y)); col *= 1.0 - 0.08 * hsh(vec3(floor(a0 * 2.3), sd, 11.0)) * smoothstep(vSz.y, 0.0, y); }   // 땅 가까이 어둡게 · 세로 빗물 얼룩
    vec3 gc = mix(vec3(0.06, 0.08, 0.11), vec3(0.16, 0.2, 0.25), hsh(vec3(floor(a0 / 0.46), fl, sd)));
    diffuseColor.rgb = mix(col, gc, gls);
    if (gls > 0.5 && hsh(vec3(floor(a0 / 0.46), fl, sd + 5.0)) > (st < 0.5 ? 0.42 : st < 1.5 ? 0.6 : 0.55)) { litW = 1.0; litC = hsh(vec3(fl, sd, 9.0)) > 0.3 ? vec3(1.0, 0.8, 0.52) : vec3(0.75, 0.85, 1.0); }
    ${GLSL_SEE} }`;
  const cylFrag = `{ float st = vBv.x, sd = vBv.y; vec3 wall = diffuseColor.rgb, col = wall; float y = vLoc.y + vSz.y * 0.5; bool top = vNl.y > 0.5; float an = atan(vLoc.z, vLoc.x);
    if (st < 0.5) { col = top ? wall * 0.82 : wall * (0.93 + 0.07 * step(0.5, fract(y / 0.8))); if (!top && fract(an / 6.2832 + y * 0.06) < 0.025) col = vec3(0.2, 0.21, 0.22); }
    else if (st < 1.5) { col = mod(floor(y / 2.2), 2.0) < 1.0 ? vec3(0.62, 0.08, 0.06) : vec3(0.86, 0.86, 0.85); if (y > vSz.y - 0.6 || top) col = vec3(0.08, 0.08, 0.08); }
    else if (st < 2.5) { col = vec3(0.6, 0.62, 0.64) * (0.9 + 0.1 * hsh(vec3(sd))); if (fract(y / 2.2) < 0.06) col = vec3(0.26, 0.25, 0.23); else if (fract(y / 0.45) < 0.05) col *= 0.88;   // 공정탑: 알루미늄 보온 외피 · 2.2칸마다 작업 발판 · 사다리 한 줄
      if (abs(fract(an / 6.2832 + sd * 0.1) - 0.5) < 0.012) col *= 0.5; if (top) col = vec3(0.38, 0.39, 0.41); gls = 0.35; }
    else if (st < 3.5) { col = wall * (0.85 + 0.15 * fract(y * 0.5)); }
    else if (st < 4.5) { float rr = length(vLoc.xz);   // 둥근 침전지: 콘크리트 벽 + 물 + 가운데 기둥 + 한쪽으로 뻗은 회전 다리
      if (top) { bool bridge = abs(vLoc.z) < 0.22 && vLoc.x > 0.0; bool lip = vSz.x - rr < 0.3 || rr < 0.35; float fo = sin(an * 9.0 + rr * 3.0 - uTime * 0.6) * 0.5 + 0.5;
        col = bridge && !lip ? vec3(0.5, 0.52, 0.55) : lip ? wall : mix(vec3(0.08, 0.12, 0.11), vec3(0.3, 0.33, 0.3), fo * 0.25); wat = lip || bridge ? 0.0 : 1.0; conc = lip ? 1.0 : 0.0; }
      else { col = wall * 0.95; conc = 1.0; } }
    else if (st < 5.5) { col = wall * (0.9 + 0.1 * step(0.5, fract(y / 1.2))); if (abs(fract(an / 6.2832 * 8.0) - 0.5) < 0.015) col *= 0.8; if (top) col = wall * 0.72; conc = 1.0; }   // 사일로·소화조
    else { col = wall; if (fract(y / 1.1) < 0.1) col = mix(col, vec3(0.9), 0.5); if (y > vSz.y - 0.6 || top) { col = vec3(0.1, 0.12, 0.14); gls = 1.0; } }   // 등대
    if (!top) col *= mix(0.6, 1.0, smoothstep(0.0, 1.0, y)); diffuseColor.rgb = col;
    if (st > 0.5 && st < 2.5 && fract(y / 2.2) < 0.07 && hsh(vec3(floor(an * 2.0), floor(y / 2.2), sd)) > 0.5) { litW = 1.0; litC = vec3(1.0, 0.85, 0.6); }
    ${GLSL_SEE} }`;   // 밤: 발판 조명 · 카메라와 주인공 사이 탱크·탑도 체크무늬로 비움

  P.realCity = function () {
    const T3 = T(), S = this.scene, U = this.realU, W = UWORLD, hi = this.hq === 'high', L = c => lin(c, true);
    const groundMin = (x, z, w, d, ang) => { const c = Math.cos(ang), s = Math.sin(ang); let m = 1e9; for (const [a, b] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) m = Math.min(m, this.groundH(x + c * a - s * b, z + s * a + c * b)); return m; };
    // 도로 차지 격자 (나무·가로등이 길을 피함)
    const occ = this.roadOcc = new Uint8Array(524 * 504), om = (x, z) => { const i = Math.floor(x + 262), j = Math.floor(z + 252); if (i >= 0 && j >= 0 && i < 524 && j < 504) occ[j * 524 + i] = 1; };
    // ── 도로: 아스팔트 띠 + 차선(가운데 노란 두 줄 · 흰 차선 · 가장자리 선) ──
    { const vs = [], uv = [], cl = [], idx = []; let n = 0; const RW = [1.25, 2.1, 1.8, 1.55];
      W.roads.forEach(r => { const cls = r[0], w = RW[cls], pts = []; for (let i = 1; i < r.length; i += 2) pts.push([r[i], r[i + 1]]);
        const sm = []; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], Lg = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(Lg / 1.2)); for (let t = i === 1 ? 0 : 1; t <= k; t++) sm.push([a[0] + (b[0] - a[0]) * t / k, a[1] + (b[1] - a[1]) * t / k]); }
        let v = 0, first = true; const path = [];
        for (let i = 0; i < sm.length; i++) { const p = sm[i], q = sm[Math.min(sm.length - 1, i + 1)], o = sm[Math.max(0, i - 1)], dx = q[0] - o[0], dz = q[1] - o[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d;
          if (i) v += Math.hypot(p[0] - sm[i - 1][0], p[1] - sm[i - 1][1]);
          const rn = this.riverNear(p[0], p[1]), y = rn.d < 1.2 ? this.waterY(rn.rid, rn.s) + 0.95 : Math.max(this.groundH(p[0] + nx * w / 2, p[1] + nz * w / 2), this.groundH(p[0] - nx * w / 2, p[1] - nz * w / 2), this.groundH(p[0], p[1])) + 0.06 + cls * 0.01;
          vs.push(p[0] + nx * w / 2, y, p[1] + nz * w / 2, p[0] - nx * w / 2, y, p[1] - nz * w / 2); uv.push(0, v, 1, v); cl.push(cls, cls); path.push([p[0], y, p[1]]);
          if (!first) idx.push(n - 2, n, n - 1, n - 1, n, n + 1); first = false; n += 2;
          for (let o2 = -w / 2; o2 <= w / 2; o2 += 0.5) om(p[0] + nx * o2, p[1] + nz * o2); }
        if (path.length > 3) { path.cls = cls; path.w = w; (this.roadPaths = this.roadPaths || []).push(path); } });
      const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(vs, 3)); g.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2)); g.setAttribute('aCls', new T3.Float32BufferAttribute(cl, 1)); g.setIndex(idx); g.computeVertexNormals();
      const m = new T3.MeshStandardMaterial({ color: L('#3E4044'), roughness: 0.88, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0.3 }); m.userData.lin = true;
      const D = this.detailTex; m.onBeforeCompile = sh => { sh.uniforms.tDetail = { value: D };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCls; varying float vCls; varying vec2 vRu; varying vec3 vWr;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCls = aCls; vRu = uv; vWr = (modelMatrix * vec4(position, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDetail; varying float vCls; varying vec2 vRu; varying vec3 vWr;').replace('#include <color_fragment>', `#include <color_fragment>
          float u = vRu.x, v = vRu.y; vec3 c = diffuseColor.rgb * (0.85 + 0.3 * texture2D(tDetail, vWr.xz * 0.35).b) * (1.0 - 0.08 * smoothstep(0.35, 0.0, abs(u - 0.5)));
          vec3 yel = vec3(0.75, 0.52, 0.05), wht = vec3(0.8, 0.8, 0.78);
          if (vCls > 0.5) { float e = step(u, 0.035) + step(0.965, u); c = mix(c, wht, e * 0.9);
            if (vCls < 1.5 || vCls > 2.5) { float cd = abs(u - 0.5); c = mix(c, yel, (step(cd, 0.028) * step(0.008, cd)) * (vCls > 2.5 ? step(0.45, fract(v / 2.4)) : 1.0)); }
            else c = mix(c, yel, step(abs(u - 0.5), 0.014));
            if (vCls < 1.5) { float l = step(abs(u - 0.26), 0.012) + step(abs(u - 0.74), 0.012); c = mix(c, wht, l * step(0.5, fract(v / 2.0)) * 0.9); } }
          diffuseColor.rgb = c;`); };
      const mesh = new T3.Mesh(g, m); mesh.receiveShadow = true; mesh.userData.flat = true; S.add(mesh); this.roadMesh = mesh; this._roadCount = W.roads.length; }
    // ── 다리: 상판 · 난간 · 교각 ──
    { const g = new T3.Group(), dm = new T3.MeshStandardMaterial({ color: '#B8BCC0', roughness: 0.8 }), rm = new T3.MeshStandardMaterial({ color: '#E2E4E6', roughness: 0.6 });
      const list = W.bridges.slice();
      list.forEach(([x0, z0, x1, z1, rid, s0, w]) => { const R = UC_RIVERS[rid], dx = x1 - x0, dz = z1 - z0, Lg = Math.hypot(dx, dz) + R.w * 0.4 + 1.2, w2 = w * 0.8, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = this.waterY(rid, s0) + 0.9, ang = Math.atan2(dz, dx);
        w = w2; const deck = new T3.Mesh(new T3.BoxGeometry(Lg, 0.32, w + 0.5), dm); deck.position.set(cx, y - 0.1, cz); deck.rotation.y = -ang; g.add(deck);
        [-1, 1].forEach(sd => { const rail = new T3.Mesh(new T3.BoxGeometry(Lg, 0.28, 0.08), rm); rail.position.set(cx - Math.sin(ang) * sd * (w / 2 + 0.3), y + 0.2, cz + Math.cos(ang) * sd * (w / 2 + 0.3)); rail.rotation.y = -ang; g.add(rail); });
        for (let t = -Lg / 2 + 1.2; t < Lg / 2 - 1; t += 2.2) { const pr = new T3.Mesh(new T3.BoxGeometry(0.4, 1.6, w * 0.6), dm); pr.position.set(cx + Math.cos(ang) * t, y - 1.0, cz + Math.sin(ang) * t); pr.rotation.y = -ang; g.add(pr); } });
      S.add(g); }
    // ── 건물 (상자 하나로 모든 건물 · 스타일은 셰이더가) ──
    const B = W.b, nb = B.length / 9, box = new T3.BoxGeometry(1, 1, 1);
    const bm = patchStd(new T3.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, envMapIntensity: 0.5 }), U, VB, VBODY, FDECL, FBOX,
      'roughnessFactor = mix(roughnessFactor, 0.12, gls); roughnessFactor = mix(roughnessFactor, 0.06, wat);', 'totalEmissiveRadiance += litC * litW * uNight * 1.35;');
    const im = new T3.InstancedMesh(box, bm, nb), ab = new Float32Array(nb * 4), m4 = new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Euler(), v3 = new T3.Vector3(), sc = new T3.Vector3(), col = new T3.Color();
    this.bldPts = [];   // 밤 불빛용 (공장·탱크 꼭대기)
    for (let i = 0; i < nb; i++) { const [t, x, z, w, d, h, ang, c, y0] = B.slice(i * 9, i * 9 + 9), a = ang * Math.PI / 180, g0 = groundMin(x, z, w, d, a) - 0.15, top = (t === 7 && y0 ? this.groundH(x, z) + y0 + h : this.groundH(x, z) + (y0 || 0) + h), bot = t === 7 && y0 ? this.groundH(x, z) + y0 : t === 3 && y0 ? this.groundH(x, z) + y0 : g0;
      const hh = Math.max(0.2, (t === 3 && y0 ? this.groundH(x, z) + y0 + h : top) - bot); e.set(0, -a, 0); q.setFromEuler(e); m4.compose(v3.set(x, bot + hh / 2, z), q, sc.set(w, hh, d)); im.setMatrixAt(i, m4);
      col.set(PAL[c] || '#CCCCCC').convertSRGBToLinear(); if (t === 0 || t === 1) col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.04); im.setColorAt(i, col); ab.set([t, (x * 13.1 + z * 7.3) % 97, 0, 0], i * 4);
      if ((t === 3 && hh > 2) || (t === 1 && hh > 8)) this.bldPts.push([x, bot + hh + 0.2, z]);
      { const c2 = Math.cos(a), s2 = Math.sin(a); for (let u = -w / 2; u <= w / 2; u += 0.7) for (let v = -d / 2; v <= d / 2; v += 0.7) { const i2 = Math.floor(x + c2 * u - s2 * v + 262), j2 = Math.floor(z + s2 * u + c2 * v + 252); if (i2 >= 0 && j2 >= 0 && i2 < 524 && j2 < 504) occ[j2 * 524 + i2] = 2; } } }   // 나무가 건물을 피하게
    box.setAttribute('aB', new T3.InstancedBufferAttribute(ab, 4)); im.castShadow = true; im.receiveShadow = true; S.add(im); this.bldMesh = im;
    Object.values(UC_FAC).forEach(F => { const Y = ucYard(F); for (let x = Y[0]; x <= Y[2]; x += 0.7) for (let z = Y[1]; z <= Y[3]; z += 0.7) { const i2 = Math.floor(x + 262), j2 = Math.floor(z + 252); if (i2 >= 0 && j2 >= 0 && i2 < 524 && j2 < 504) occ[j2 * 524 + i2] = 2; } });   // 시설 마당 안엔 숲이 자라지 않음
    // ── 원통: 저장 탱크 · 굴뚝 · 공정탑 · 구형 탱크 다리 ──
    const C = W.cyl.slice(), SP = W.sph; for (let i = 0; i < SP.length; i += 3) { const [x, z, r] = SP.slice(i, i + 3); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; C.push(x + Math.cos(a) * r * 0.75, z + Math.sin(a) * r * 0.75, 0.12, r * 1.05, 3, 0); } }
    const ncl = C.length / 6, cg = new T3.CylinderGeometry(1, 1, 1, hi ? 24 : 16, 1), cm = patchStd(new T3.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.6 }), U, VB, VBODY, FDECL, cylFrag, 'roughnessFactor = mix(roughnessFactor, 0.9, conc); roughnessFactor = mix(roughnessFactor, 0.06, wat); roughnessFactor = mix(roughnessFactor, 0.15, gls);', 'totalEmissiveRadiance += litC * litW * uNight * 1.6;');
    const ci = new T3.InstancedMesh(cg, cm, ncl), ca = new Float32Array(ncl * 4);
    for (let i = 0; i < ncl; i++) { const [x, z, r, h, st, c] = C.slice(i * 6, i * 6 + 6), y = this.groundH(x, z) - 0.1; m4.compose(v3.set(x, y + h / 2, z), q.identity(), sc.set(r, h, r)); ci.setMatrixAt(i, m4);
      col.set(st === 0 ? ['#E9EAEA', '#D9DCDF', '#C9CFD4'][c] || '#E9EAEA' : st === 3 ? '#8C9096' : st === 4 || st === 5 ? '#B9B5AC' : st === 6 ? (c ? '#F2F2EF' : '#C8352C') : '#FFFFFF').convertSRGBToLinear(); ci.setColorAt(i, col); ca.set([st, (x * 3.7 + z * 1.3) % 53, 0, 0], i * 4); if (st === 1 || st === 2) this.bldPts.push([x, y + h + 0.2, z]); }
    cg.setAttribute('aB', new T3.InstancedBufferAttribute(ca, 4)); ci.castShadow = true; ci.receiveShadow = true; S.add(ci); this.cylMesh = ci;
    if (SP.length) { const sg = new T3.SphereGeometry(1, hi ? 20 : 14, hi ? 14 : 10), si = new T3.InstancedMesh(sg, new T3.MeshStandardMaterial({ color: L('#E8EAEB'), roughness: 0.35, metalness: 0.45 }), SP.length / 3); si.material.userData.lin = true;
      for (let i = 0; i < SP.length / 3; i++) { const [x, z, r] = SP.slice(i * 3, i * 3 + 3); m4.compose(v3.set(x, this.groundH(x, z) + r * 1.05, z), q.identity(), sc.set(r, r, r)); si.setMatrixAt(i, m4); this.bldPts.push([x, this.groundH(x, z) + r * 2.1, z]); }
      si.castShadow = si.receiveShadow = true; S.add(si); }
    // ── 박공지붕 (시골집 · 옛 주택: 빨강·파랑·초록·주황·회색 지붕) ──
    { const RF = W.roof, nr = RF.length / 7, pg = new T3.BufferGeometry(), V = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, 0.5, 0.5, 0, 0.5];
      pg.setAttribute('position', new T3.Float32BufferAttribute(V, 3)); pg.setIndex([0, 3, 2, 0, 2, 1, 4, 5, 2, 4, 2, 3, 0, 4, 3, 1, 2, 5]); pg.computeVertexNormals();
      const rm = new T3.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.05, flatShading: true }), ri = new T3.InstancedMesh(pg, rm, Math.max(1, nr)); rm.userData.lin = true; const RC = ['#A8453A', '#3E6CA3', '#4E7B56', '#C06B3A', '#6B6E72'];
      for (let i = 0; i < nr; i++) { const [x, z, w, d, h, ang] = RF.slice(i * 7, i * 7 + 6), c = RF[i * 7 + 6], a = ang * Math.PI / 180; e.set(0, -a, 0); q.setFromEuler(e); m4.compose(v3.set(x, this.groundH(x, z) + h - 0.02, z), q, sc.set(w, 0.55, d)); ri.setMatrixAt(i, m4); col.set(RC[c] || RC[0]).convertSRGBToLinear(); ri.setColorAt(i, col); }
      ri.count = nr; ri.castShadow = ri.receiveShadow = true; S.add(ri); }
    // ── 비닐하우스 (반원 터널) ──
    { const GHd = W.gh, ng = GHd.length / 4, hg = new T3.BufferGeometry(), V = [], I = [], seg = 8;
      for (let k = 0; k <= seg; k++) { const a = Math.PI * k / seg, y = Math.sin(a) * 0.62, zz = Math.cos(a) * 0.62; V.push(-0.5, y, zz, 0.5, y, zz); if (k) I.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, (k - 1) * 2 + 1, k * 2, k * 2 + 1); }
      hg.setAttribute('position', new T3.Float32BufferAttribute(V, 3)); hg.setIndex(I); hg.computeVertexNormals();
      const hm = new T3.MeshStandardMaterial({ color: L('#E4E9EC'), roughness: 0.35, metalness: 0, side: T3.DoubleSide, transparent: true, opacity: 0.88 }), hi2 = new T3.InstancedMesh(hg, hm, Math.max(1, ng)); hm.userData.lin = true;
      for (let i = 0; i < ng; i++) { const [x, z, Lg, ang] = GHd.slice(i * 4, i * 4 + 4), a = ang * Math.PI / 180; e.set(0, -a, 0); q.setFromEuler(e); m4.compose(v3.set(x, this.groundH(x, z) - 0.05, z), q, sc.set(Lg, 1.3, 1)); hi2.setMatrixAt(i, m4); }
      hi2.count = ng; hi2.receiveShadow = true; S.add(hi2); }
    // ── 주차된 차 ──
    this.carGeo = this.hq === 'high' ? (() => {   // 고화질: 옆모습(범퍼·보닛·앞유리·지붕·뒷유리·트렁크)을 모서리 둥글게 뽑은 차 + 바퀴 4개 (창문·등·바퀴 색은 셰이더)
      const sh = new T3.Shape(), pr = [[-0.46, 0.08], [0.46, 0.08], [0.465, 0.19], [0.44, 0.245], [0.16, 0.27], [0.03, 0.4], [-0.2, 0.41], [-0.33, 0.29], [-0.45, 0.27], [-0.465, 0.19]];
      sh.moveTo(pr[0][0], pr[0][1]); pr.slice(1).forEach(p => sh.lineTo(p[0], p[1])); sh.closePath();
      const body = new T3.ExtrudeGeometry(sh, { depth: 0.4, steps: 1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelSegments: 2, curveSegments: 1 }); body.rotateY(-Math.PI / 2); body.translate(0.2, 0, 0);
      const parts = [body]; [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => { const w = new T3.CylinderGeometry(0.075, 0.075, 0.07, 8, 1); w.rotateZ(Math.PI / 2); w.translate(sx * 0.2, 0.075, sz * 0.29); parts.push(w); });
      const pos = [], nor = []; parts.forEach(g0 => { const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); } });
      const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); return g; })() : (() => { const b1 = new T3.BoxGeometry(0.46, 0.2, 0.9), b2 = new T3.BoxGeometry(0.42, 0.17, 0.48); b1.translate(0, 0.16, 0); b2.translate(0, 0.33, -0.04); const g = new T3.BufferGeometry(), P1 = b1.attributes.position.array, P2 = b2.attributes.position.array, N1 = b1.attributes.normal.array, N2 = b2.attributes.normal.array;
      g.setAttribute('position', new T3.Float32BufferAttribute([...P1, ...P2], 3)); g.setAttribute('normal', new T3.Float32BufferAttribute([...N1, ...N2], 3)); const i1 = Array.from(b1.index.array), o = b1.attributes.position.count; g.setIndex(i1.concat(Array.from(b2.index.array).map(k => k + o))); return g; })();
    const CARC = ['#F2F2F0', '#F2F2F0', '#151618', '#9EA3A8', '#9EA3A8', '#5C6168', '#2B4C7E', '#8E2B2B'];
    this.carMat = patchStd(new T3.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.55, envMapIntensity: 0.8 }), U, 'varying vec3 vCl;', 'vCl = position;', 'varying vec3 vCl; float gls = 0.0; float wat = 0.0; float conc = 0.0; float litW = 0.0; vec3 litC = vec3(1.0);\n',
      // 창문 띠(지붕은 차 색) · 바퀴와 바퀴집(검게, 무광) · 전조등 두 개 · 미등 두 개 (밤에 켜짐)
      'float tyre = step(0.16, abs(vCl.x)) * step(vCl.y, 0.155) * step(abs(abs(vCl.z) - 0.29), 0.085); if (vCl.y > 0.3 && vCl.y < 0.395) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.05, 0.06), 0.85); gls = 1.0; } if (tyre > 0.5) diffuseColor.rgb = vec3(0.025);'
      + ' if (vCl.z > 0.44 && vCl.y > 0.12 && vCl.y < 0.235) { if (abs(vCl.x) > 0.09) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.92, 0.86), 0.7); litW = 1.0; litC = vec3(1.0, 0.95, 0.8) * 2.0; } else diffuseColor.rgb *= 0.35; }'
      + ' if (vCl.z < -0.44 && vCl.y > 0.16 && vCl.y < 0.25 && abs(vCl.x) > 0.09) { diffuseColor.rgb = vec3(0.45, 0.03, 0.02); litW = 1.0; litC = vec3(1.0, 0.1, 0.05); }',
      'roughnessFactor = mix(roughnessFactor, 0.06, gls); if (tyre > 0.5) roughnessFactor = 0.92; conc = tyre;', 'totalEmissiveRadiance += litC * litW * uNight * 1.2;');
    { const CR = W.cars, nc = CR.length / 4, ciM = new T3.InstancedMesh(this.carGeo, this.carMat, Math.max(1, nc));
      for (let i = 0; i < nc; i++) { const [x, z, ang, c] = CR.slice(i * 4, i * 4 + 4), a = ang * Math.PI / 180; e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e); m4.compose(v3.set(x, this.groundH(x, z), z), q, sc.set(1, 1, 1)); ciM.setMatrixAt(i, m4); col.set(CARC[c] || CARC[0]).convertSRGBToLinear(); ciM.setColorAt(i, col); }
      ciM.count = nc; ciM.castShadow = true; S.add(ciM); }
    // ── 골리앗 크레인 (조선소) · 배 ──
    const redM = new T3.MeshStandardMaterial({ color: '#C8352C', roughness: 0.55, metalness: 0.3 }), yelM = new T3.MeshStandardMaterial({ color: '#E0B02E', roughness: 0.55, metalness: 0.3 });
    for (let i = 0; i < W.cranes.length; i += 5) { const [x, z, span, ang, h] = W.cranes.slice(i, i + 5), a = ang * Math.PI / 180, g = new T3.Group(), y = this.groundH(x, z);
      [-1, 1].forEach(sd => { const leg = new T3.Mesh(new T3.BoxGeometry(0.9, h, 1.6), redM); leg.position.set(sd * span / 2, h / 2, 0); g.add(leg); }); const beam = new T3.Mesh(new T3.BoxGeometry(span + 1.2, 1.4, 2.2), redM); beam.position.y = h + 0.5; g.add(beam);
      const tr = new T3.Mesh(new T3.BoxGeometry(2.2, 1.1, 2.6), yelM); tr.position.set(span * 0.15, h - 0.5, 0); g.add(tr); g.position.set(x, y, z); g.rotation.y = -a; S.add(g); this.bldPts.push([x, y + h + 1.3, z]); }
    const hullM = [new T3.MeshStandardMaterial({ color: '#7A2A22', roughness: 0.6 }), new T3.MeshStandardMaterial({ color: '#2A2F36', roughness: 0.6 }), new T3.MeshStandardMaterial({ color: '#E9ECEE', roughness: 0.5 }), new T3.MeshStandardMaterial({ color: '#F4F4F2', roughness: 0.4 })], deckM = new T3.MeshStandardMaterial({ color: '#8A6E52', roughness: 0.8 }), bridgeM = new T3.MeshStandardMaterial({ color: '#F2F2EF', roughness: 0.5 });
    const contM = [redM, yelM, new T3.MeshStandardMaterial({ color: '#2C5E9E', roughness: 0.6 }), new T3.MeshStandardMaterial({ color: '#3F7F4F', roughness: 0.6 })];
    for (let i = 0; i < W.ships.length; i += 5) { const [x, z, Lg, ang, kind] = W.ships.slice(i, i + 5), a = ang * Math.PI / 180, g = new T3.Group(), w = kind === 3 ? Lg * 0.32 : Lg * 0.16;
      const hullG = new T3.CylinderGeometry(w / 2, w / 2 * 0.85, Lg, kind === 3 ? 8 : 12, 1); hullG.rotateZ(Math.PI / 2); hullG.scale(1, 0.55, 1); const hull = new T3.Mesh(hullG, kind === 2 ? hullM[2] : kind === 3 ? hullM[3] : hullM[kind]); hull.position.y = 0.05; g.add(hull);
      if (kind === 2) { const bx = new T3.Mesh(new T3.BoxGeometry(Lg * 0.92, w * 0.9, w * 0.95), hullM[2]); bx.position.y = w * 0.5; g.add(bx); }
      else if (kind === 3) { const cab = new T3.Mesh(new T3.BoxGeometry(Lg * 0.28, w * 0.5, w * 0.6), bridgeM); cab.position.set(-Lg * 0.1, w * 0.4, 0); g.add(cab); }
      else { const dk = new T3.Mesh(new T3.BoxGeometry(Lg * 0.92, 0.12, w * 0.92), deckM); dk.position.y = w * 0.28; g.add(dk); const br = new T3.Mesh(new T3.BoxGeometry(Lg * 0.1, w * 0.9, w * 0.8), bridgeM); br.position.set(-Lg * 0.4, w * 0.75, 0); g.add(br);
        if (kind === 0) for (let k = 0; k < 6; k++) { const ct = new T3.Mesh(new T3.BoxGeometry(Lg * 0.1, w * 0.3, w * 0.8), contM[k % 4]); ct.position.set(-Lg * 0.22 + k * Lg * 0.11, w * 0.45, 0); g.add(ct); } }
      g.position.set(x, -0.3, z); g.rotation.y = -a; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); S.add(g); this.bldPts.push([x - Math.cos(a) * Lg * 0.4, w * 1.3, z - Math.sin(a) * Lg * 0.4]); }
    // ── 가로등 (큰길 · 강변로) — 밤에 켜짐 ──
    { const pts = [], pg = new T3.BoxGeometry(0.07, 2.2, 0.07); pg.translate(0, 1.1, 0); const arm = new T3.BoxGeometry(0.55, 0.06, 0.06); arm.translate(0.27, 2.18, 0); const head = new T3.BoxGeometry(0.28, 0.07, 0.14); head.translate(0.52, 2.12, 0);
      const mg = new T3.BufferGeometry(), parts = [pg, arm, head], pos = [], nor = [], ids = [], em = []; let o = 0; parts.forEach((g, k) => { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); ids.push(...Array.from(g.index.array).map(i => i + o)); for (let i = 0; i < g.attributes.position.count; i++) em.push(k === 2 ? 1 : 0); o += g.attributes.position.count; });
      mg.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); mg.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); mg.setAttribute('aEm', new T3.Float32BufferAttribute(em, 1)); mg.setIndex(ids);
      W.roads.forEach(r => { if (r[0] !== 1 && r[0] !== 2) return; let acc = 0, side = 1; const w = r[0] === 1 ? 2.6 : 2.2; for (let i = 3; i < r.length; i += 2) { const x0 = r[i - 2], z0 = r[i - 1], x1 = r[i], z1 = r[i + 1], Lg = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / (Lg || 1), dz = (z1 - z0) / (Lg || 1);
        for (let t = 7 - acc; t < Lg; t += 7) { const x = x0 + dx * t, z = z0 + dz * t, ox = -dz * (w / 2 + 0.35) * side, oz = dx * (w / 2 + 0.35) * side; if (this.riverDist(x + ox, z + oz) > 0.6) pts.push([x + ox, z + oz, Math.atan2(-oz, -ox)]); side = -side; } acc = (acc + Lg) % 7; } });
      const lm = patchStd(new T3.MeshStandardMaterial({ color: L('#7B8087'), roughness: 0.5, metalness: 0.6 }), U, 'attribute float aEm; varying float vEm;', 'vEm = aEm;', 'varying float vEm; float gls = 0.0; float litW = 0.0; vec3 litC = vec3(1.0, 0.78, 0.45);\n', 'litW = vEm; if (vEm > 0.5) diffuseColor.rgb = vec3(0.9);', null, 'totalEmissiveRadiance += litC * litW * uNight * 2.2;');
      const li = new T3.InstancedMesh(mg, lm, Math.max(1, pts.length)); pts.forEach(([x, z, a], i) => { e.set(0, -a, 0); q.setFromEuler(e); m4.compose(v3.set(x, this.groundH(x, z), z), q, sc.set(1, 1, 1)); li.setMatrixAt(i, m4); }); li.count = pts.length; li.castShadow = true; S.add(li);
      this.lightPts = pts.map(([x, z, a]) => [x + Math.cos(a) * 0.52, this.groundH(x, z) + 2.1, z + Math.sin(a) * 0.52]); }
    this.realSpecial(W.site || { pile: [], dome: [], flare: [], spec: [] }); this.realTraffic();
    this.realGlow();
  };
  // 시설·장소의 특별한 모양 (몇 개뿐): 광석 더미 · 소화조 돔 · 플레어 불꽃 · 레이더 돔 · 적십자 판 · 정자 지붕 · 등대 불
  P.realSpecial = function (site) {
    const T3 = T(), S = this.scene, L = c => lin(c, true), m4 = new T3.Matrix4();
    if (site.pile.length) { const im = new T3.InstancedMesh(new T3.ConeGeometry(1, 1, 16, 1), new T3.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 }), site.pile.length), c = new T3.Color(); im.material.userData.lin = true;
      site.pile.forEach(([x, z, r, h, k], i) => { m4.makeScale(r, h, r).setPosition(x, this.groundH(x, z) + h / 2 - 0.05, z); im.setMatrixAt(i, m4); c.set(k ? '#5A4A3E' : '#3E3E40').convertSRGBToLinear(); im.setColorAt(i, c); }); im.castShadow = im.receiveShadow = true; S.add(im); }
    if (site.dome.length) { const im = new T3.InstancedMesh(new T3.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T3.MeshStandardMaterial({ color: L('#A9A59C'), roughness: 0.75 }), site.dome.length); im.material.userData.lin = true;
      site.dome.forEach(([x, z, r, h], i) => { m4.makeScale(r, r * 0.45, r).setPosition(x, this.groundH(x, z) + h - 0.12, z); im.setMatrixAt(i, m4); }); im.castShadow = true; S.add(im); }
    const fc = document.createElement('canvas'); fc.width = 64; fc.height = 128; { const g = fc.getContext('2d'), gr = g.createRadialGradient(32, 92, 2, 32, 80, 62); gr.addColorStop(0, 'rgba(255,255,225,1)'); gr.addColorStop(0.22, 'rgba(255,200,80,0.95)'); gr.addColorStop(0.55, 'rgba(255,110,20,0.6)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(32, 80, 26, 48, 0, 0, 7); g.fill(); }
    const ftex = new T3.CanvasTexture(fc); this.flames = site.flare.map(([x, z, h]) => { const sp = new T3.Sprite(new T3.SpriteMaterial({ map: ftex, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, fog: false })); sp.position.set(x, this.groundH(x, z) + h + 1.3, z); sp.scale.set(1.5, 3, 1); sp.userData.noShadow = true; S.add(sp); (this.bldPts = this.bldPts || []).push([x, this.groundH(x, z) + h + 1, z]); return sp; });
    site.spec.forEach(([k, x, z, h, c]) => { const y = this.groundH(x, z);
      if (k === 'radar') { const d = new T3.Mesh(new T3.SphereGeometry(1.9, 28, 18), new T3.MeshStandardMaterial({ color: L('#F4F5F6'), roughness: 0.35 })); d.material.userData.lin = true; d.position.set(x, y + h + 1.45, z); d.castShadow = true; S.add(d); }
      else if (k === 'cross') { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#D62828'; g.fillRect(24, 8, 16, 48); g.fillRect(8, 24, 48, 16);
        const tx = new T3.CanvasTexture(cv); tx.encoding = T3.sRGBEncoding; const m = new T3.Mesh(new T3.PlaneGeometry(h, h), new T3.MeshStandardMaterial({ map: tx, roughness: 0.6 })); m.material.userData.lin = true; m.position.set(x, y + 1.55, z + 0.03); S.add(m); }
      else if (k === 'pavilion') { const r = new T3.Mesh(new T3.ConeGeometry(1.5, 0.9, 4, 1), new T3.MeshStandardMaterial({ color: L('#3B434A'), roughness: 0.7, flatShading: true })); r.material.userData.lin = true; r.position.set(x, y + h + 0.42, z); r.rotation.y = Math.PI / 4; r.castShadow = true; S.add(r); }
      else if (k === 'light') { const m = new T3.Mesh(new T3.SphereGeometry(0.3, 12, 8), new T3.MeshBasicMaterial({ color: c ? '#40FF70' : '#FF3A30' })); m.position.set(x, y + h, z); m.userData.noShadow = true; m.visible = false; S.add(m); (this.lamps = this.lamps || []).push(m); } });   // 등대 불: 밤에 깜박 (굴뚝 경고등과 함께)
  };
  // ── 달리는 차: 주인공 둘레 도로(오른쪽 차로)를 오가는 차 · 밤엔 전조등 (주차된 차와 같은 모양·재질) ──
  P.realTraffic = function () {
    const T3 = T(), N = this.hq === 'high' ? 64 : 36, R = this.roadPaths || [], CARC = ['#F2F2F0', '#F2F2F0', '#151618', '#9EA3A8', '#9EA3A8', '#5C6168', '#2B4C7E', '#8E2B2B', '#D9D2C3', '#1F4E3D'];
    R.forEach(p => { let L = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; p.cum = [0]; p.forEach((q, i) => { if (i) { L += Math.hypot(q[0] - p[i - 1][0], q[2] - p[i - 1][2]); p.cum.push(L); } x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }); p.L = L; p.bb = [x0, x1, z0, z1]; });
    const im = new T3.InstancedMesh(this.carGeo, this.carMat, N), cols = CARC.map(h => new T3.Color(h).convertSRGBToLinear()); im.instanceMatrix.setUsage(T3.DynamicDrawUsage); for (let i = 0; i < N; i++) im.setColorAt(i, cols[0]);   // 색 버퍼는 개수를 줄이기 전에
    im.count = 0; im.castShadow = false; im.userData.flat = true; im.frustumCulled = false; this.scene.add(im); this.traffic = { im, cols, cars: [], N, near: [], nearT: -1e9, m4: new T3.Matrix4(), q: new T3.Quaternion(), e: new T3.Euler(), v: new T3.Vector3(), one: new T3.Vector3(1, 1, 1) };
  };
  P.stepTraffic = function (dt, now) {
    const tr = this.traffic; if (!tr || !this.roadPaths) return; const cx = this.ov ? this.ov.cx : this.px, cz = this.ov ? this.ov.cz : this.pz, RAD = this.ov ? 140 : 95;
    if (now - tr.nearT > 1500) { tr.nearT = now; tr.near = this.roadPaths.filter(p => p.L > 8 && p.cls !== 3 && p.bb[0] < cx + RAD && p.bb[1] > cx - RAD && p.bb[2] < cz + RAD && p.bb[3] > cz - RAD); }
    const want = Math.min(tr.N, Math.round(tr.near.length * 1.6)); let tries = 8;
    while (tr.cars.length < want && tr.near.length && tries--) { const p = tr.near[Math.floor(Math.random() * tr.near.length)], dir = Math.random() < 0.5 ? 1 : -1, s0 = Math.random() * p.L;
      tr.cars.push({ p, s: s0, dir, i: 0, col: Math.floor(Math.random() * tr.cols.length), v: (p.cls === 1 ? 4.6 : p.cls === 2 ? 4 : 2.8) * (0.8 + Math.random() * 0.4), lane: p.w * (p.cls === 1 ? 0.3 : 0.24) }); }
    const { im, m4, q, e, v, one } = tr; let n = 0;
    tr.cars = tr.cars.filter(c => { c.s += c.v * dt * c.dir; const p = c.p; if (c.s < 0 || c.s > p.L) return false;
      while (c.i < p.cum.length - 2 && p.cum[c.i + 1] < c.s) c.i++; while (c.i > 0 && p.cum[c.i] > c.s) c.i--;
      const a = p[c.i], b = p[c.i + 1], seg = (p.cum[c.i + 1] - p.cum[c.i]) || 1, t = (c.s - p.cum[c.i]) / seg, fx = (b[0] - a[0]) / seg * c.dir, fz = (b[2] - a[2]) / seg * c.dir;
      const x = a[0] + (b[0] - a[0]) * t - fz * c.lane, z = a[2] + (b[2] - a[2]) * t + fx * c.lane, y = a[1] + (b[1] - a[1]) * t;   // 오른쪽 차로 (진행 방향의 오른쪽)
      if (Math.abs(x - cx) > RAD + 20 || Math.abs(z - cz) > RAD + 20) return false;
      if (n < tr.N) { e.set(0, Math.atan2(fx, fz), 0); q.setFromEuler(e); m4.compose(v.set(x, y, z), q, one); im.setMatrixAt(n, m4); im.setColorAt(n, tr.cols[c.col]); n++; } return true; });   // 차마다 색 고정 (번호가 바뀌어도)
    im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  };
  // 밤 불빛 번짐(점 스프라이트): 가로등 · 공장·탱크 꼭대기 · 배
  P.realGlow = function () {
    const T3 = T(), c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,235,200,0.55)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const tex = new T3.CanvasTexture(c), mk = (pts, col, size) => { const pos = new Float32Array(pts.length * 3); pts.forEach((p, i) => pos.set(p, i * 3)); const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.BufferAttribute(pos, 3));
      const m = new T3.PointsMaterial({ map: tex, color: col, size, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: T3.AdditiveBlending }); const p = new T3.Points(geo, m); p.userData.noShadow = true; this.scene.add(p); return p; };
    const ind = []; (this.bldPts || []).forEach(p => { ind.push(p); if (Math.random() < 0.6) ind.push([p[0] + (Math.random() - 0.5) * 3, p[1] * (0.4 + Math.random() * 0.5), p[2] + (Math.random() - 0.5) * 3]); });
    this.glows = [mk(this.lightPts || [], 0xFFD49A, 2.0), mk(ind, 0xFFE6B8, 1.35)];   // 가까이 시점에서 너무 커 보이지 않게
  };
  // ── 숲 · 공원 · 가로수: 주인공 둘레만 진짜 3D 나무 (멀리는 땅 사진의 숲 무늬) ──
  // 잎 그림 (고화질) — 색 · 모양(알파) 두 장씩 (알파를 따로 두어 잎 가장자리가 검게 번지지 않음)
  //   잎 뭉치: 왼쪽 절반 = 뭉치 4가지 · 오른쪽 절반 = 불투명 흰 칸(줄기·속 덩이용)
  function leafTex() {
    const T3 = T(), cc = document.createElement('canvas'), ac = document.createElement('canvas'); cc.width = ac.width = 512; cc.height = ac.height = 256;
    const g = cc.getContext('2d'), a = ac.getContext('2d'), rnd = ucRng(777);
    g.fillStyle = '#b4b4aa'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#fff'; g.fillRect(256, 0, 256, 256);
    a.fillStyle = '#000'; a.fillRect(0, 0, 512, 256); a.fillStyle = '#fff'; a.fillRect(256, 0, 256, 256);
    for (let c = 0; c < 4; c++) { const ox = (c % 2) * 128 + 64, oy = Math.floor(c / 2) * 128 + 64, ph = rnd() * 6.28;
      for (let i = 0; i < 200; i++) { const an = rnd() * 6.28, rr = Math.sqrt(rnd()) * 52 * (0.8 + 0.2 * Math.sin(an * 3 + ph) * Math.sin(an * 5 - ph)), x = ox + Math.cos(an) * rr, y = oy + Math.sin(an) * rr;
        const L = 5 + rnd() * 4, Wd = L * (0.4 + rnd() * 0.16), rot = rnd() * 6.28, v = Math.round(Math.min(255, 140 + rnd() * 90 + (i / 200) * 30));   // 나중에 그린(위쪽) 잎일수록 밝게
        [g, a].forEach((ctx, k) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = k ? '#fff' : 'rgb(' + v + ',' + v + ',' + Math.round(v * 0.88) + ')'; ctx.beginPath(); ctx.ellipse(0, 0, L, Wd, 0, 0, 6.2832); ctx.fill(); ctx.restore(); }); } }
    const map = new T3.CanvasTexture(cc), am = new T3.CanvasTexture(ac); map.anisotropy = am.anisotropy = 4; return { map, am };
  }
  //   침엽수 치마: 위쪽은 빽빽한 바늘잎 결 · 아래 가장자리는 늘어진 가지 끝(들쭉날쭉) · 가로로 이어짐
  function skirtTex() {
    const T3 = T(), cc = document.createElement('canvas'), ac = document.createElement('canvas'); cc.width = cc.height = ac.width = ac.height = 256;
    const g = cc.getContext('2d'), a = ac.getContext('2d'), rnd = ucRng(4321), wrap = (x, w, f) => { f(x); if (x - w < 0) f(x + 256); if (x + w > 256) f(x - 256); };
    g.fillStyle = '#8e8e86'; g.fillRect(0, 0, 256, 256); a.fillStyle = '#000'; a.fillRect(0, 0, 256, 256); a.fillStyle = '#fff'; a.fillRect(0, 0, 256, 150);
    for (let i = 0; i < 64; i++) { const x0 = rnd() * 256, w = 7 + rnd() * 9, L = 36 + rnd() * 66, dx = (rnd() - 0.5) * 10; wrap(x0, w + 6, x => { a.beginPath(); a.moveTo(x - w, 146); a.lineTo(x + w, 146); a.lineTo(x + dx, 146 + L); a.closePath(); a.fill(); }); }
    for (let i = 0; i < 1100; i++) { const x0 = rnd() * 256, y = rnd() * 246, L = 7 + rnd() * 13, an = Math.PI / 2 + (rnd() - 0.5) * 1.1, v = Math.round(Math.min(255, 95 + rnd() * 120 + y * 0.16)), lw = 1 + rnd() * 1.6;
      wrap(x0, L, x => { g.strokeStyle = 'rgb(' + v + ',' + v + ',' + Math.round(v * 0.9) + ')'; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke(); }); }
    const map = new T3.CanvasTexture(cc), am = new T3.CanvasTexture(ac); map.anisotropy = am.anisotropy = 4; return { map, am };
  }
  // 점·법선·색·UV 모으기 (나무 모양 만들 때). uv0 = 줄기처럼 그림 없이 칠할 곳이 쓰는 불투명 자리
  function geoBuf(uv0) {
    const T3 = T(), G = { pos: [], nor: [], col: [], uv: [], idx: [] };
    G.add = (g, cf) => { const P = g.attributes.position, N = g.attributes.normal, o = G.pos.length / 3; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), c = cf(x, y, z); G.pos.push(x, y, z); G.nor.push(N.getX(i), N.getY(i), N.getZ(i)); G.col.push(c[0], c[1], c[2]); G.uv.push(uv0[0], uv0[1]); }
      (g.index ? Array.from(g.index.array) : [...Array(P.count).keys()]).forEach(k => G.idx.push(k + o)); };
    G.v = (p, n, c, t) => { G.pos.push(p[0], p[1], p[2]); G.nor.push(n[0], n[1], n[2]); G.col.push(c[0], c[1], c[2]); G.uv.push(t[0], t[1]); return G.pos.length / 3 - 1; };
    G.build = () => { const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(G.pos, 3)); g.setAttribute('normal', new T3.Float32BufferAttribute(G.nor, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(G.col, 3)); g.setAttribute('uv', new T3.Float32BufferAttribute(G.uv, 2)); g.setIndex(G.idx); return g; };
    return G;
  }
  // 잎 카드 활엽수: 줄기 · 굵은 가지 · 작고 어두운 속 덩이(틈 메움) + 잎 뭉치 카드 28장 (빛은 둥근 수관처럼 받게 — 판 티 안 나게)
  function leafyBroad(trunkG, bark, blob, leaf) {
    const T3 = T(), V = T3.Vector3, G = geoBuf([0.75, 0.5]), rnd = ucRng(99);
    G.add(trunkG, bark);
    for (let i = 0; i < 3; i++) { const b = new T3.CylinderGeometry(0.022, 0.04, 0.6, 4, 1); b.translate(0, 0.3, 0); b.rotateZ(0.7); b.rotateY(i * 2.1 + 0.4); b.translate(0, 0.9, 0); G.add(b, bark); }   // 굵은 가지 (잎 틈으로 보임)
    const B = [[0.72, 0, 1.55, 0, 1.3], [0.5, 0.35, 1.3, 0.2, 2.1], [0.48, -0.3, 1.35, -0.25, 3.7]];
    B.forEach(([r, x, y, z, s]) => G.add(blob(r * 0.6, x, y, z, s, 0), (x2, y2, z2) => leaf(1.0)(x2, y2, z2).map(v => v * 0.42)));
    const C = new V(0, 1.45, 0), n = new V(), q = new V(), u = new V(), w = new V(), up = new V(), sn = new V();
    for (let i = 0; i < 28; i++) { const b = B[i < 14 ? 0 : i < 21 ? 1 : 2], rr = b[0] * (0.5 + rnd() * 0.45);
      n.set(rnd() * 2 - 1, rnd() * 2 - 1 + 0.25, rnd() * 2 - 1).normalize(); const px = b[1] + n.x * rr, py = b[2] + n.y * rr * 0.86, pz = b[3] + n.z * rr;
      q.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.1).add(n).normalize(); up.set(0, 1, 0); if (Math.abs(q.y) > 0.9) up.set(1, 0, 0); u.crossVectors(up, q).normalize(); w.crossVectors(q, u);
      const ro = rnd() * 6.28, cr = Math.cos(ro), sr = Math.sin(ro), U2 = [u.x * cr + w.x * sr, u.y * cr + w.y * sr, u.z * cr + w.z * sr], W2 = [w.x * cr - u.x * sr, w.y * cr - u.y * sr, w.z * cr - u.z * sr];
      const h = (0.32 + rnd() * 0.12) * (0.65 + 0.35 * b[0] / 0.72), cell = Math.floor(rnd() * 4), u0 = (cell % 2) * 0.25, v0 = Math.floor(cell / 2) * 0.5;
      const k = (0.55 + 0.6 * Math.max(0, Math.min(1, (py - 1.0) / 1.2))) * (0.8 + 0.35 * rr / b[0]) * (0.88 + rnd() * 0.24) * 1.35, c = [0.085 * k, 0.15 * k, 0.05 * k];   // 아래·속은 그늘, 위·바깥은 밝게
      const vi = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s1, s2]) => { const p = [px + (U2[0] * s1 + W2[0] * s2) * h, py + (U2[1] * s1 + W2[1] * s2) * h, pz + (U2[2] * s1 + W2[2] * s2) * h];
        sn.set(p[0] - C.x, (p[1] - C.y) * 1.2, p[2] - C.z).normalize().multiplyScalar(0.8).addScaledVector(q, 0.2).normalize(); return G.v(p, [sn.x, sn.y, sn.z], c, [u0 + (s1 + 1) * 0.125, v0 + (s2 + 1) * 0.25]); });
      G.idx.push(vi[0], vi[1], vi[2], vi[0], vi[2], vi[3]); }   // 앞면 = 바깥쪽
    return G.build();
  }
  // 바늘잎 침엽수: 줄기 + 층층이 늘어진 치마 4겹 (가운데가 볼록 → 가장자리로 처짐, 끝은 들쭉날쭉한 가지 끝)
  function leafyConifer(trunkG, bark) {
    const G = geoBuf([0.5, 0.8]), rnd = ucRng(77), SEG = 12, REP = 4;   // 한 바퀴에 그림 3번
    G.add(trunkG, bark);
    [[0.8, 1.2, 1.1], [0.64, 1.05, 1.7], [0.47, 0.95, 2.25], [0.27, 0.75, 2.72]].forEach(([r, h, y], ti) => {
      const ph = rnd() * 6.28, yt = y + h / 2, yb = y - h / 2, J = []; for (let i = 0; i < SEG; i++) J.push([0.88 + rnd() * 0.24, (rnd() - 0.5) * 0.1]); J.push(J[0]);
      const P = (i, t) => { const a = ph + i / SEG * 6.2832, R = t === 0 ? r * 0.05 : r * J[i][0] * (t === 1 ? 1 : 0.55), Y = t === 0 ? yt : t === 1 ? yb + J[i][1] : yt - h * 0.42; return [Math.cos(a) * R, Y, Math.sin(a) * R]; };
      const N = i => { const a = ph + i / SEG * 6.2832, nx = Math.cos(a) * h, ny = r * 1.4, nz = Math.sin(a) * h, l = Math.hypot(nx, ny, nz); return [nx / l, ny / l, nz / l]; };   // 원뿔 법선 (조금 위로 — 부드럽게)
      const hk = 0.62 + 0.5 * ti / 3, col = t => { const k = hk * (t === 0 ? 0.7 : t === 1 ? 1.08 : 0.95) * 1.3; return [0.05 * k, 0.105 * k, 0.058 * k]; };   // 아래 층·안쪽은 그늘
      for (let i = 0; i < SEG; i++) { const uA = (i % REP) / REP, uB = uA + 1 / REP;
        const vs = [[0, 1], [0.5, 0.56], [1, 0]].map(([t, v]) => [G.v(P(i, t), N(i), col(t), [uA, v]), G.v(P(i + 1, t), N(i + 1), col(t), [uB, v])]);   // [자리(0 꼭대기 · 0.5 중간 · 1 가장자리), 그림 v]
        for (let k = 0; k < 2; k++) { const [a0, a1] = vs[k], [b0, b1] = vs[k + 1]; G.idx.push(a0, b1, b0, a0, a1, b1); } }   // 앞면 = 바깥쪽
    });
    return G.build();
  }
  function treeGeos(hi, leafy) {
    const T3 = T(), merge = (parts) => { const pos = [], nor = [], col = [], idx = []; let o = 0; parts.forEach(([g, cf]) => { const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); const c = cf(P.getX(i), P.getY(i), P.getZ(i)); col.push(c[0], c[1], c[2]); }
      const I = g.index ? Array.from(g.index.array) : [...Array(P.count).keys()]; I.forEach(k => idx.push(k + o)); o += P.count; });
      const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g; };
    const bark = () => [0.13, 0.09, 0.06], trunk = h => { const g = new T3.CylinderGeometry(0.07, 0.11, h, 5, 1); g.translate(0, h / 2, 0); return g; };
    // 활엽수: 울퉁불퉁한 둥근 수관 세 덩이 (아래는 그늘져 어둡게)
    const blob = (r, x, y, z, seed, det) => { const g = new T3.IcosahedronGeometry(r, det === undefined ? (hi ? 1 : 0) : det), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const vx = P.getX(i), vy = P.getY(i), vz = P.getZ(i), n = 0.82 + 0.3 * Math.abs(Math.sin(vx * 5.1 + seed) * Math.cos(vz * 4.3 - seed) + Math.sin(vy * 6.7)) * 0.5; P.setXYZ(i, vx * n + x, vy * n * 0.86 + y, vz * n + z); } g.computeVertexNormals(); const N = g.attributes.normal, v = new (T().Vector3)(); for (let i = 0; i < P.count; i++) { v.set(P.getX(i) - x, (P.getY(i) - y) * 1.15, P.getZ(i) - z).normalize(); v.x = v.x * 0.7 + N.getX(i) * 0.3; v.y = v.y * 0.7 + N.getY(i) * 0.3; v.z = v.z * 0.7 + N.getZ(i) * 0.3; v.normalize(); N.setXYZ(i, v.x, v.y, v.z); } return g; };   // 둥글게 보이는 빛
    const leaf = (base) => (x, y, z) => { const k = 0.5 + 0.7 * Math.max(0, Math.min(1, (y - base) / 1.4)); return [0.085 * k, 0.15 * k, 0.05 * k]; };
    const broad = leafy ? leafyBroad(trunk(1.0), bark, blob, leaf) : merge([[trunk(1.0), bark], [blob(0.72, 0, 1.55, 0, 1.3), leaf(1.0)], [blob(0.5, 0.35, 1.3, 0.2, 2.1), leaf(0.9)], [blob(0.48, -0.3, 1.35, -0.25, 3.7), leaf(0.9)]]);   // 고화질: 잎 카드 나무
    // 침엽수(소나무·잣나무): 층진 원뿔
    const cone = (r, h, y) => { const g = new T3.ConeGeometry(r, h, hi ? 8 : 6, 1); g.translate(0, y, 0); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const a = Math.atan2(P.getZ(i), P.getX(i)), n = 1 + 0.12 * Math.sin(a * 3 + y * 4); P.setX(i, P.getX(i) * n); P.setZ(i, P.getZ(i) * n); } g.computeVertexNormals(); return g; };
    const nd = (x, y, z) => { const k = 0.5 + 0.55 * Math.max(0, Math.min(1, (y - 0.6) / 2)); return [0.045 * k, 0.1 * k, 0.055 * k]; };
    const coni = leafy ? leafyConifer(trunk(1.3), bark) : merge([[trunk(1.3), bark], [cone(0.78, 1.25, 1.1), nd], [cone(0.6, 1.1, 1.75), nd], [cone(0.38, 0.95, 2.35), nd]]);   // 고화질: 바늘잎 치마
    return [broad, coni];
  }
  P.realTrees = function () {
    const T3 = T(), hi = this.hq === 'high', U = this.realU, S = this.scene;
    this.treeCfg = { R: hi ? 66 : 50, step: hi ? 1.55 : 1.9, CH: 16, max: hi ? 7000 : 3200, lod: 24 };   // lod: 이 거리 안쪽만 잎 카드·바늘잎 나무 (바깥은 가벼운 둥근 덩이·원뿔)
    const [bg, cg] = treeGeos(hi, hi), D = this.detailTex, LT = hi ? leafTex() : null, ST = hi ? skirtTex() : null;
    const mkMat = kind => { const mat = new T3.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.36 }), X = kind === 1 ? LT : kind === 2 ? ST : null;   // 0 둥근 덩이 · 1 잎 카드 · 2 바늘잎 치마
      if (X) { mat.map = X.map; mat.alphaMap = X.am; mat.alphaTest = 0.4; mat.side = kind === 1 ? T3.DoubleSide : T3.FrontSide; }   // 잎 모양대로 뚫림 · 잎 카드는 양면 (침엽수 치마는 바깥 면만 — 가볍게)
      mat.onBeforeCompile = sh => { sh.uniforms.uTime = U.uTime; sh.uniforms.tDetail = { value: D };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vTw; varying float vTy;').replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]); float sw = sin(uTime * 1.4 + ip.x * 0.37 + ip.z * 0.21) * 0.035 * max(0.0, position.y - 0.6); transformed.x += sw; transformed.z += sw * 0.6;
        vTw = position * 1.7 + ip * 0.31; vTy = position.y;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDetail; varying vec3 vTw; varying float vTy;').replace('#include <color_fragment>', `#include <color_fragment>
          float lf = texture2D(tDetail, vTw.xz * 0.9 + vTw.y * 0.45).r * 0.6 + texture2D(tDetail, vTw.xy * 1.3).g * 0.4; if (vTy > 0.75) diffuseColor.rgb *= ${X ? '0.8 + 0.4 * lf' : '0.62 + 0.7 * lf'}; else diffuseColor.rgb *= 0.9;`);   // 잎 무늬
        if (X) sh.fragmentShader = sh.fragmentShader
          .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
          { vec2 ts = vUv * ${kind === 1 ? 'vec2(512.0, 256.0)' : 'vec2(256.0)'}; float md = max(dot(dFdx(ts), dFdx(ts)), dot(dFdy(ts), dFdy(ts))); diffuseColor.a *= 1.0 + max(0.0, 0.5 * log2(md)) * 0.3; }`)   // 멀어져도 잎이 성기게 사라지지 않게 (밉맵 보정)
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal ); geometryNormal = normal;')   // 뒷면도 바깥쪽 빛 (뒤집지 않음)
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= gl_FrontFacing ? 1.0 : ' + (kind === 1 ? '0.72;' : '0.5;')); };   // 안쪽(뒷면)은 그늘
      mat.customProgramCacheKey = () => 'ultree' + kind; mat.userData.lin = true; return mat; };
    const mat = mkMat(0);
    this.treeMesh = [new T3.InstancedMesh(bg, hi ? mkMat(1) : mat, this.treeCfg.max), new T3.InstancedMesh(cg, hi ? mkMat(2) : mat, this.treeCfg.max)];
    if (hi) { this.treeMesh[0].customDepthMaterial = new T3.MeshDepthMaterial({ depthPacking: T3.RGBADepthPacking, alphaMap: LT.am, alphaTest: 0.4 });   // 활엽수 그림자도 잎 모양으로
      const [fb, fc] = treeGeos(false, false); this.treeMesh.push(new T3.InstancedMesh(fb, mat, this.treeCfg.max), new T3.InstancedMesh(fc, mat, this.treeCfg.max)); }   // 먼 나무 (2·3번)
    this.treeMesh.forEach(m => { m.setColorAt(0, new T3.Color(1, 1, 1)); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(T3.DynamicDrawUsage); S.add(m); });   // 색 버퍼는 개수를 0으로 줄이기 전에 (setColorAt 이 지금 개수로 만듦)
    this.treeChunks = new Map(); this._treeC = null;
    // 사람(NPC)·시설 입구·센서 자리에는 나무를 두지 않음 (나무에 가려 안 보이지 않게)
    this.noTree = []; try { Object.keys(UC_NPC_AT).forEach(id => this.noTree.push(ucNpcAt(id))); Object.keys(UC_FAC).forEach(k => { const F = UC_FAC[k]; this.noTree.push(ucGate(F, 2, -3), ucGate(F, 2, 4), ucGate(F, 1)); }); (Array.isArray(UC_BIO) ? UC_BIO : Object.values(UC_BIO)).forEach(b => this.noTree.push(ucBioAt(b))); } catch (e) {}
    // 도시 나무: 공원 · 단지 안 · 가로수(동네 길·큰길) · 강변 · 국가정원 십리대숲 → 칸(청크)별로 나눠 둠
    const W = UWORLD, list = [], occ = this.roadOcc, free = (x, z) => { const i = Math.floor(x + 262), j = Math.floor(z + 252); return !(i < 0 || j < 0 || i >= 524 || j >= 504) && !occ[j * 524 + i]; };
    const rnd = ucRng(4242);
    for (let i = 0; i < W.parks.length; i += 5) { const [x, z, w, d, ang] = W.parks.slice(i, i + 5), a = ang * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a); for (let u = -w / 2 + 0.8; u < w / 2; u += 1.5) for (let v = -d / 2 + 0.8; v < d / 2; v += 1.5) { if (rnd() < 0.25) continue; const px = x + c * u - s2 * v + (rnd() - 0.5) * 0.8, pz = z + s2 * u + c * v + (rnd() - 0.5) * 0.8; if (free(px, pz)) list.push([px, pz, 0.8 + rnd() * 0.35, rnd() < 0.2 ? 1 : 0, 0]); } }
    for (let i = 0; i < W.lots.length; i += 6) { if (W.lots[i + 5] !== 3) continue; const [x, z, w, d, ang] = W.lots.slice(i, i + 5), a = ang * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a); for (let k = 0; k < 10; k++) { const u = (rnd() - 0.5) * w, v = (rnd() - 0.5) * d, px = x + c * u - s2 * v, pz = z + s2 * u + c * v; if (free(px, pz)) list.push([px, pz, 0.65 + rnd() * 0.3, 0, 1]); } }
    W.roads.forEach(r => { if (r[0] > 2) return; const w = [1.25, 2.1, 1.8][r[0]]; for (let i = 3; i < r.length; i += 2) { const x0 = r[i - 2], z0 = r[i - 1], x1 = r[i], z1 = r[i + 1], Lg = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / (Lg || 1), dz = (z1 - z0) / (Lg || 1);
      for (let t = 1.5; t < Lg; t += r[0] === 0 ? 3.6 : 3.0) [-1, 1].forEach(sd => { const px = x0 + dx * t - dz * sd * (w / 2 + 0.42), pz = z0 + dz * t + dx * sd * (w / 2 + 0.42); if (free(px, pz) && this.riverDist(px, pz) > 0.6) list.push([px, pz, 0.55 + rnd() * 0.15, 0, 2]); }); } });
    { const R = UC_RIVERS.taehwa, Lr = ucLen(R.pts); for (let s2 = 200; s2 < Lr; s2 += 1.3) [-1, 1].forEach(sd => { const a = ucAt(R.pts, s2), b = ucAt(R.pts, s2 + 1), dx = b[0] - a[0], dz = b[1] - a[1], dd = Math.hypot(dx, dz) || 1, off = R.w / 2 + 1 + rnd() * 1.2, px = a[0] - dz / dd * off * sd, pz = a[1] + dx / dd * off * sd;
      const g = UC_PLACES.garden.at, bamboo = Math.hypot(px - g[0], pz - g[1]) < 26; if (free(px, pz) && (bamboo || rnd() < 0.55)) list.push([px, pz, bamboo ? 0.9 : 0.75 + rnd() * 0.3, bamboo ? 1 : 0, bamboo ? 3 : 0]); }); }
    this.urbanTrees = new Map(); const CH = this.treeCfg.CH; list.forEach(t => { const k = Math.floor(t[0] / CH) + ',' + Math.floor(t[1] / CH); if (!this.urbanTrees.has(k)) this.urbanTrees.set(k, []); this.urbanTrees.get(k).push(t); });
  };
  // 칸 하나의 나무 (같은 칸은 늘 같은 나무)
  P.treeChunk = function (ci, cj) {
    const key = ci + ',' + cj; let L = this.treeChunks.get(key); if (L) return L; L = [];
    const cfg = this.treeCfg, lc = this.landcover(), occ = this.roadOcc, rnd = ucRng(Math.abs((ci * 73856093) ^ (cj * 19349663)) + 7), st = cfg.step;
    for (let z = cj * cfg.CH; z < (cj + 1) * cfg.CH; z += st) for (let x = ci * cfg.CH; x < (ci + 1) * cfg.CH; x += st) { const px = x + rnd() * st, pz = z + rnd() * st, c = lc(px + (rnd() - 0.5) * 1.2, pz + (rnd() - 0.5) * 1.2);
      let type = -1; if (c === 1) type = rnd() < 0.85 ? 0 : 1; else if (c === 2) type = rnd() < 0.8 ? 1 : 0; else if ((c === 3 || c === 4 || c === 5 || c === 11) && rnd() < (c === 5 ? 0.12 : 0.025)) type = 0; if (type < 0) continue;   // 논밭 사이에도 가끔 한 그루
      const i = Math.floor(px + 262), j = Math.floor(pz + 252); if (i < 0 || j < 0 || i >= 524 || j >= 504 || occ[j * 524 + i] || this.riverDist(px, pz) < 0.7) continue;
      const y = this.groundH(px, pz); if (y < 0.1) continue; L.push([px, y, pz, (type ? 0.95 : 0.85) + rnd() * 0.55, type, rnd(), rnd() * 6.28, -1]); }
    (this.urbanTrees.get(key) || []).forEach(t => L.push([t[0], this.groundH(t[0], t[1]), t[1], t[2] + rnd() * 0.12, t[3], rnd(), rnd() * 6.28, t[4]]));
    if (this.noTree && this.noTree.length) L = L.filter(t => !this.noTree.some(q => Math.abs(t[0] - q[0]) < 2.2 && Math.abs(t[2] - q[1]) < 2.2));
    this.treeChunks.set(key, L); if (this.treeChunks.size > 900) this.treeChunks.delete(this.treeChunks.keys().next().value); return L;
  };
  // 둘레가 바뀌면 나무 목록 다시 (멀어질수록 작아지며 숲 무늬 속으로 사라짐)
  P.stepTrees = function (force) {
    if (!this.treeMesh) return; const cfg = this.treeCfg, ov = this.ov, cx = ov ? ov.cx : this.px, cz = ov ? ov.cz : this.pz, R = ov ? Math.min(150, 40 + ov.h * 0.45) : cfg.R * (this._treeK || 1), stride = ov ? (ov.h > 200 ? 3 : 2) : 1;
    if (!force && this._treeC && Math.hypot(cx - this._treeC[0], cz - this._treeC[1]) < 5 && this._treeC[2] === R) return; this._treeC = [cx, cz, R];
    const T3 = T(), m4 = this._tm4 = this._tm4 || new T3.Matrix4(), q = new T3.Quaternion(), e = new T3.Euler(), v = new T3.Vector3(), sc = new T3.Vector3(), col = new T3.Color(), n = [0, 0, 0, 0], M = this.treeMesh, CH = cfg.CH, far = M.length > 2, tk = this._treeK || 1, lod = cfg.lod * (tk >= 0.99 ? 1 : tk > 0.6 ? 0.62 : 0);   // 느린 기기면 잎 카드 나무 범위도 줄임 (가장 낮으면 없음)
    const c0 = Math.floor((cx - R) / CH), c1 = Math.floor((cx + R) / CH), r0 = Math.floor((cz - R) / CH), r1 = Math.floor((cz + R) / CH);
    const tints = [[0.9, 1.0, 0.9], [1.15, 1.08, 0.78], [0.8, 0.9, 0.85], [1.0, 1.1, 1.0], [1.35, 1.12, 0.62]];
    for (let cj = r0; cj <= r1; cj++) for (let ci = c0; ci <= c1; ci++) { const L = this.treeChunk(ci, cj);
      for (let k = 0; k < L.length; k += stride) { const t = L[k], d = Math.hypot(t[0] - cx, t[2] - cz); if (d > R) continue; const ty = t[4] + (far && (ov || d > lod) ? 2 : 0); if (n[ty] >= cfg.max) continue;   // 가까운 나무만 잎 카드
        const f = Math.min(1, (R - d) / 12), s = t[3] * (0.35 + 0.65 * f) * (t[7] === 2 ? 0.75 : 1), sy = s * (t[7] === 3 ? 1.9 : 0.82 + t[5] * 0.45); e.set(0, t[6], 0); q.setFromEuler(e); m4.compose(v.set(t[0], t[1] - 0.05, t[2]), q, sc.set(s, sy, s)); M[ty].setMatrixAt(n[ty], m4);
        const tn = t[7] === 2 ? [1.05, 1.15, 0.7] : tints[Math.floor(t[5] * 4.99)]; col.setRGB(tn[0], tn[1], tn[2]); M[ty].setColorAt(n[ty], col); n[ty]++; } }
    M.forEach((m, i) => { m.count = n[i]; if (!n[i]) return; m.instanceMatrix.updateRange.offset = 0; m.instanceMatrix.updateRange.count = n[i] * 16; m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) { m.instanceColor.updateRange.offset = 0; m.instanceColor.updateRange.count = n[i] * 3; m.instanceColor.needsUpdate = true; } });
    this._shDirty = true;   // 그림자도 한 번 새로
  };

  // ── 매 프레임 ──
  P.realFrame = function (dt, now) {
    const U = this.realU, cam = this.camera; U.uTime.value = now / 1000; U.uCloudOff.value.set((now * 0.0021) % 322.58, (now * 0.0009) % 322.58);   // 구름 무늬 반복 주기(1/0.0031)로 되감음 — 오래 켜 두면 숫자가 커져 정밀도가 떨어지던 것
    if (this.sky) this.sky.position.copy(cam.position); if (this.stars) this.stars.position.copy(cam.position); if (this.clouds) this.clouds.position.set(cam.position.x, 520, cam.position.z);
    this.stepTraffic(dt, now);
    const fo = this.ui.modalOpen && this.focus; U.uCam.value.copy(cam.position); U.uPlayer.value.set(fo ? fo.x : this.px, (this.player ? this.player.position.y : this.groundH(this.px, this.pz)) + 1.2, fo ? fo.z : this.pz);   // 대화 중엔 두 사람 사이를 비움
    this.stepTrees();
    (this.flames || []).forEach((f, i) => { const t = now / 1000 + i * 1.7, k = 1 + 0.12 * Math.sin(t * 9.1) + 0.08 * Math.sin(t * 23.7); f.scale.set(1.5 * (2 - k), 3 * k, 1); });   // 플레어 불꽃 일렁임
  };
})();
