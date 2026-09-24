// 카트 레이싱 3D — 고화질 재료 불러오기 (Kenney CC0 3D 모델)
//   · 모델 읽는 도구(GLTFLoader)는 3D 카트를 켤 때만 불러와 다른 게임은 가볍게
//   · 한 번 불러오면 모든 카트·관전 화면이 같이 씀
(function () {
  const BASE = 'assets/kart3d/';
  const NAMES = ['vehicle-truck-red', 'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'decoration-forest', 'decoration-tents'];
  const loadScript = src => new Promise((res, rej) => {
    if (document.querySelector('script[data-src="' + src + '"]')) return res();
    const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
  let assetsP = null;
  function loadAssets() {
    if (assetsP) return assetsP;
    assetsP = (window.THREE && THREE.GLTFLoader ? Promise.resolve() : loadScript('lib/GLTFLoader.js')).then(() => new Promise(res => {
      const L = new THREE.GLTFLoader(), out = {}; let left = NAMES.length;
      NAMES.forEach(n => L.load(BASE + n + '.glb', g => { out[n] = g.scene; if (--left === 0) res(out); }, undefined, () => { if (--left === 0) res(out); }));
    })).catch(() => ({}));
    return assetsP;
  }
  window.Kart3DHQ = { loadAssets };
})();
