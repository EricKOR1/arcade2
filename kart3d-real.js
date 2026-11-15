// 카트 레이싱 3D — 사실적 분위기 (PC 고화질 전용)
//   · 실제 하늘 사진(HDRI, Poly Haven CC0)을 조명·반사로 — 카트 도색·가드레일에 하늘이 비침 (배경 하늘은 kart3d-style 의 그린 하늘 그대로: 사진 하늘은 1k 라 흐릿하고 로우폴리 세상과 어긋났음)
//   · 물리 기반 재질(광택 · 거칠기) · 아스팔트 굴곡(노멀)·거칠기 그림 · 빛 번짐(Bloom) · 비네트
//   · 트랙을 켤 때 그 테마의 HDRI 한 장(약 1.5MB)과 후처리 도구만 불러옴 — 태블릿(보통 화질)은 받지도 않음
//   · 밤 트랙: 사진 하늘 없이 빛 번짐만 (가로등·네온·헤드라이트가 번져 보이게)
(function () {
  if (typeof KartGame3D === 'undefined') return;
  const P = KartGame3D.prototype;
  const LIBS = ['lib/RGBELoader.js', 'lib/CopyShader.js', 'lib/LuminosityHighPassShader.js', 'lib/EffectComposer.js', 'lib/RenderPass.js', 'lib/ShaderPass.js', 'lib/UnrealBloomPass.js'];
  const HDR = { hills: 'spruit_sunrise_1k', peaks: 'quarry_01_1k', mesa: 'venice_sunset_1k', ocean: 'blouberg_sunrise_2_1k' };
  const loadScript = src => new Promise((res, rej) => { if (document.querySelector('script[data-src="' + src + '"]')) return res(); const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  let libsP = null; const loadLibs = () => libsP || (libsP = LIBS.reduce((p, s) => p.then(() => loadScript(s)), Promise.resolve()));
  const hdrCache = {};
  // 마지막 패스: 선형 → sRGB + 가장자리 살짝 어둡게(비네트) — 감마 보정 패스 하나에 합쳐 추가 비용 없음
  const FINAL = { uniforms: { tDiffuse: { value: null }, uVig: { value: 0.22 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv; void main() { vec4 c = LinearTosRGB( texture2D( tDiffuse, vUv ) ); vec2 d = vUv - 0.5; c.rgb *= 1.0 - uVig * smoothstep( 0.18, 0.62, dot( d, d ) * 1.6 ); gl_FragColor = c; }' };

  P.enableReal = function () {
    if (this.hq !== 'high' || this.spectator) return;
    if (this.night) { loadLibs().then(() => { if (this.renderer && this.hq === 'high' && !this.composer) this.setupComposer(0.55, 0.5, 0.72); }).catch(() => {}); return; }
    const name = HDR[this.track.theme.far || 'hills']; if (!name) return;
    loadLibs().then(() => {
      if (!this.renderer || this.hq !== 'high') return;
      const get = hdrCache[name] || (hdrCache[name] = new Promise(res => new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/' + name + '.hdr', t => res(t), undefined, () => res(null))));
      return get.then(tex => { if (tex && this.renderer && this.hq === 'high') this.applyReal(tex); });
    }).catch(() => {});
  };

  P.setupComposer = function (strength, radius, threshold) {
    const T = THREE, r = this.renderer, size = r.getSize(new T.Vector2()), dpr = r.getPixelRatio();
    const rt = r.capabilities.isWebGL2 ? new T.WebGLMultisampleRenderTarget(size.x * dpr, size.y * dpr, { format: T.RGBAFormat }) : undefined;
    this.composer = new T.EffectComposer(r, rt); this.composer.setPixelRatio(dpr); this.composer.setSize(size.x, size.y);
    this.composer.addPass(new T.RenderPass(this.scene, this.camera));
    this.bloom = new T.UnrealBloomPass(new T.Vector2(size.x, size.y), strength, radius, threshold); this.composer.addPass(this.bloom);
    this.composer.addPass(new T.ShaderPass(FINAL));
  };

  P.applyReal = function (tex) {
    const T = THREE, r = this.renderer;
    tex.mapping = T.EquirectangularReflectionMapping;
    // 조명용(반사) 환경 — 배경은 그린 하늘 그대로 (사진 하늘이 없을 때를 위해 만들어 둔 환경맵은 버림)
    const pm = new T.PMREMGenerator(r); const env = pm.fromEquirectangular(tex); pm.dispose();
    if (this._envRT) { this._envRT.dispose(); } this._envRT = env; this.scene.environment = env.texture;
    if (!this._r10) {                                                                  // (실감 묶음이 없으면 예전처럼 사진 하늘을 배경으로)
      this.scene.background = new T.WebGLCubeRenderTarget(1024).fromEquirectangularTexture(r, tex).texture;
      this.scene.children.filter(o => o.userData.sky || o.userData.clouds || o.userData.peaks).forEach(o => this.scene.remove(o));
      if (this.scene.fog) { this.scene.fog.near = 260; this.scene.fog.far = 1500; }
    }
    if (this.hemi) this.hemi.intensity = 0.35; if (this.sun) this.sun.intensity = (this._look ? this._look.si : 1.4) * 1.12;
    r.toneMappingExposure = (this._look ? this._look.exp : 1) * 0.86;                // 환경광이 더해져 밝아지므로 노출을 조금 낮춤 (안 그러면 바랜 느낌)
    // 재질 → 물리 기반 (같은 재질은 한 번만 바꿈). 카트·나무 로우폴리는 반들반들, 도로·땅은 거칠게 · 가드레일은 금속
    const cache = new Map(), rough = m => m.userData.rough != null ? m.userData.rough : m === this.roadMat ? 0.88 : m === this._flat ? 0.5 : (m.vertexColors ? 0.6 : 0.8);
    const conv = m => { if (!m || m.userData.keep || m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isLineBasicMaterial || m.isShaderMaterial) return m;
      if (cache.has(m)) return cache.get(m);
      const n = new T.MeshStandardMaterial({ color: m.color, map: m.map || null, vertexColors: !!m.vertexColors, emissive: m.emissive || new T.Color(0), emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity != null ? m.emissiveIntensity : 1,
        transparent: !!m.transparent, opacity: m.opacity, side: m.side, flatShading: !!m.flatShading, depthWrite: m.depthWrite, roughness: rough(m), metalness: m.userData.metal != null ? m.userData.metal : m === this._flat ? 0.15 : 0.02,
        polygonOffset: !!m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor || 0, polygonOffsetUnits: m.polygonOffsetUnits || 0 });
      if (m.onBeforeCompile && m.hasOwnProperty('onBeforeCompile')) { n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; }   // (땅의 큰 얼룩 셰이더)
      n.userData.lin = true; if (m === this.roadMat) this.roadMat = n; if (m === this.skirtMat) this.skirtMat = n; cache.set(m, n); return n; };
    this.scene.traverse(o => { if (!o.material || o.isSprite || o.isPoints || o.isLine) return; o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); });
    if (this._flat) this._flat = cache.get(this._flat) || this._flat;                                   // 새로 만드는 카트도 물리 재질로
    // 아스팔트: 알갱이 굴곡 · 마모 띠는 매끈하게
    if (this.roadMat && this.roadMat.isMeshStandardMaterial && this.roadDetail10) { const dt = this.roadDetail10(); if (dt) { this.roadMat.normalMap = dt.n; this.roadMat.normalScale = new T.Vector2(0.55, 0.55); this.roadMat.roughnessMap = dt.r; this.roadMat.roughness = 1; this.roadMat.needsUpdate = true; } }
    if (this.composer == null) this.setupComposer(0.22, 0.4, 0.9);
    this.real = true;
  };
})();
