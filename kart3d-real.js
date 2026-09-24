// 카트 레이싱 3D — 사실적 분위기 (PC 고화질 전용 · 낮 트랙)
//   · 실제 하늘 사진(HDRI, Poly Haven CC0)을 배경과 조명으로 — 하늘·구름·햇빛이 사진처럼, 카트 도색에 하늘이 비침
//   · 물리 기반 재질(광택 · 거칠기) · 빛 번짐(Bloom)
//   · 트랙을 켤 때 그 테마의 HDRI 한 장(약 1.5MB)과 후처리 도구만 불러옴 — 태블릿(보통 화질)은 받지도 않음
(function () {
  if (typeof KartGame3D === 'undefined') return;
  const P = KartGame3D.prototype;
  const LIBS = ['lib/RGBELoader.js', 'lib/CopyShader.js', 'lib/LuminosityHighPassShader.js', 'lib/GammaCorrectionShader.js', 'lib/EffectComposer.js', 'lib/RenderPass.js', 'lib/ShaderPass.js', 'lib/UnrealBloomPass.js'];
  const HDR = { hills: 'spruit_sunrise_1k', peaks: 'quarry_01_1k', mesa: 'venice_sunset_1k', ocean: 'blouberg_sunrise_2_1k' };
  const loadScript = src => new Promise((res, rej) => { if (document.querySelector('script[data-src="' + src + '"]')) return res(); const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  let libsP = null; const loadLibs = () => libsP || (libsP = LIBS.reduce((p, s) => p.then(() => loadScript(s)), Promise.resolve()));
  const hdrCache = {};

  P.enableReal = function () {
    if (this.hq !== 'high' || this.night || this.spectator) return;
    const name = HDR[this.track.theme.far || 'hills']; if (!name) return;
    loadLibs().then(() => {
      if (!this.renderer || this.hq !== 'high') return;
      const get = hdrCache[name] || (hdrCache[name] = new Promise(res => new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/' + name + '.hdr', t => res(t), undefined, () => res(null))));
      return get.then(tex => { if (tex && this.renderer && this.hq === 'high') this.applyReal(tex); });
    }).catch(() => {});
  };

  P.applyReal = function (tex) {
    const T = THREE, r = this.renderer;
    tex.mapping = T.EquirectangularReflectionMapping;
    // 조명용(반사) 환경 · 배경 하늘
    const pm = new T.PMREMGenerator(r); this.scene.environment = pm.fromEquirectangular(tex).texture; pm.dispose();
    this.scene.background = new T.WebGLCubeRenderTarget(1024).fromEquirectangularTexture(r, tex).texture;
    this.scene.children.filter(o => o.userData.sky || o.userData.clouds || o.userData.peaks).forEach(o => this.scene.remove(o));   // 그린 하늘·구름·로우폴리 설봉 대신 사진 하늘(지평선 포함)
    if (this.scene.fog) { this.scene.fog.near = 260; this.scene.fog.far = 1500; }
    if (this.hemi) this.hemi.intensity = 0.35; if (this.sun) this.sun.intensity = 1.6;
    r.toneMappingExposure = 0.85;                                                     // 사진 하늘은 밝아 노출을 조금 낮춤 (안 그러면 바랜 느낌)
    // 재질 → 물리 기반 (같은 재질은 한 번만 바꿈). 카트·나무 로우폴리는 반들반들, 도로·땅은 거칠게
    const cache = new Map(), rough = m => m === this.roadMat ? 0.88 : m === this._flat ? 0.5 : (m.vertexColors ? 0.6 : 0.8);
    const conv = m => { if (!m || m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial || m.isLineBasicMaterial || m.isShaderMaterial) return m;
      if (cache.has(m)) return cache.get(m);
      const n = new T.MeshStandardMaterial({ color: m.color, map: m.map || null, vertexColors: !!m.vertexColors, emissive: m.emissive || new T.Color(0), emissiveMap: m.emissiveMap || null,
        transparent: !!m.transparent, opacity: m.opacity, side: m.side, flatShading: !!m.flatShading, depthWrite: m.depthWrite, roughness: rough(m), metalness: m === this._flat ? 0.15 : 0.02 });
      n.userData.lin = true; if (m === this.roadMat) this.roadMat = n; cache.set(m, n); return n; };
    this.scene.traverse(o => { if (!o.material || o.isSprite || o.isPoints || o.isLine) return; o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); });
    if (this._flat) this._flat = cache.get(this._flat) || this._flat;                                   // 새로 만드는 카트도 물리 재질로
    // 빛 번짐: 장면 → (다중 샘플 계단 방지) → 번짐 → 감마 보정
    const size = r.getSize(new T.Vector2()), dpr = r.getPixelRatio();
    const rt = r.capabilities.isWebGL2 ? new T.WebGLMultisampleRenderTarget(size.x * dpr, size.y * dpr, { format: T.RGBAFormat }) : undefined;
    this.composer = new T.EffectComposer(r, rt); this.composer.setPixelRatio(dpr); this.composer.setSize(size.x, size.y);
    this.composer.addPass(new T.RenderPass(this.scene, this.camera));
    this.bloom = new T.UnrealBloomPass(new T.Vector2(size.x, size.y), 0.24, 0.4, 0.9); this.composer.addPass(this.bloom);
    this.composer.addPass(new T.ShaderPass(T.GammaCorrectionShader));
    this.real = true;
  };
})();
