// 3D 게임 공용 화질 도우미 (젬 아레나 3D · 길 건너기 3D)
//   · 화질 3단계: high(PC · 그림자 2048) · mid(터치 기기 · 그림자 1024) · low(그래픽 가속 꺼짐 — 예전 모습)
//     주소에 ?q=high|mid|low 로 고정(자동 낮춤 없음)
//   · 색 보정: sRGB 출력 + ACES 톤 매핑, 재질·조명 색을 선형으로 (안 하면 회색빛으로 바램)
//   · 태양 그림자: 주인공을 따라다니는 좁은 범위만 (가볍게)
//   · 3초 평균 초당 24프레임 미만이면 그림자를 끔
(function () {
  const TQ = {};
  TQ.pick = function (renderer, opts) {
    const m = (typeof location !== 'undefined' && location.search.match(/[?&]q=(high|mid|low)/)) || null; if (m) return { q: m[1], locked: true };
    if (opts && opts.quality) return { q: opts.quality, locked: true };
    let gpu = ''; try { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) {}
    if (/swiftshader|llvmpipe|software/i.test(gpu)) return { q: 'low' };
    return { q: (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'mid' : 'high' };
  };
  TQ.lin = function (root) {
    const T = THREE; if (!root) return;
    root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (!m || m.userData.lin) return; m.userData.lin = true;
      if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear();
      ['map', 'emissiveMap'].forEach(k => { if (m[k]) { m[k].encoding = T.sRGBEncoding; m[k].needsUpdate = true; } }); m.needsUpdate = true; }); });
  };
  // 새로 만든 모델: 그림자 드리우기 + 색 보정
  TQ.prep = function (game, obj) { if (!game.hq || game.hq === 'low' || !obj) return obj; TQ.lin(obj); obj.traverse(o => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } }); return obj; };
  TQ.apply = function (game, o) {
    const T = THREE, r = game.renderer, sc = game.scene;
    // tone: 'none' 이면 원래 색 그대로(쨍한 색감 게임용) — ACES 는 밝고 채도 높은 색을 흰색 쪽으로 눌러 바래 보일 수 있음
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = o.tone === 'none' ? T.NoToneMapping : T.ACESFilmicToneMapping; r.toneMappingExposure = o.exposure || 1.05;
    if (game.hemi) { game.hemi.color.convertSRGBToLinear(); game.hemi.groundColor.convertSRGBToLinear(); game.hemi.intensity = o.hemi || 0.75; }
    if (game.sun) { const s = game.sun; s.color.convertSRGBToLinear(); s.intensity = o.sun || 1.35; s.castShadow = true;
      const sz = game.hq === 'high' ? 2048 : 1024; s.shadow.mapSize.set(sz, sz); const c = s.shadow.camera, h = o.half || 20; c.left = -h; c.right = h; c.top = h; c.bottom = -h; c.near = 0.5; c.far = o.far || 200;
      s.shadow.bias = -0.0008; s.shadow.normalBias = 0.02; sc.add(s.target); game.sunOffset = s.position.clone(); }
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    if (sc.background && sc.background.isColor) sc.background.convertSRGBToLinear();
    if (sc.fog) sc.fog.color.convertSRGBToLinear();
    sc.traverse(obj => { if (obj.isMesh && !obj.userData.noShadow) { obj.receiveShadow = true; if (!obj.userData.flat) obj.castShadow = true; } });
    TQ.lin(sc);
  };
  // 매 프레임: 태양이 주인공을 따라다님(그림자 범위) · 느리면 그림자 끔
  TQ.frame = function (game, x, y, z, now) {
    if (!game.hq || game.hq === 'low') return;
    if (game.sun && game.renderer.shadowMap.enabled) { const off = game.sunOffset; game.sun.position.set(x + off.x, y + off.y, z + off.z); game.sun.target.position.set(x, y, z); game.sun.target.updateMatrixWorld(); }
    if (game.hqLocked) return;
    game._fpsN = (game._fpsN || 0) + 1; if (!game._fpsT) game._fpsT = now;
    if (now - game._fpsT > 3000) { const fps = game._fpsN * 1000 / (now - game._fpsT); game._fpsN = 0; game._fpsT = now;
      if (fps < 24 && game.renderer.shadowMap.enabled) { game.renderer.shadowMap.enabled = false; if (game.sun) game.sun.castShadow = false;
        game.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); if (o.userData.blobShadow) o.visible = true; }); } }
  };
  window.ThreeQuality = TQ;
})();
