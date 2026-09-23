// 효과음 엔진 — Web Audio API 로 직접 합성 (음원 파일 없음 · 저작권 문제 없음)
//   · 모든 소리는 master → 압축기(리미터) → 스피커. 소리가 여러 개 겹쳐도 찢어지지 않게
//   · 같은 소리는 너무 촘촘히 겹치지 않게 간격 제한, 동시에 울리는 소리 수도 제한
//   · 학생 음소거(setEnabled) 와 교사 전체 음소거(setForcedMute) 를 따로 둡니다
const Sound = (function () {
  let ctx = null, master = null, comp = null, noiseBuf = null;
  let enabled = true, forced = false, volume = 0.32;
  const lastAt = {};            // 소리별 마지막 재생 시각 (간격 제한)
  let voices = 0;               // 지금 울리는 소리 수
  const MAX_VOICES = 14;

  function wire(c) {
    ctx = c;
    comp = ctx.createDynamicsCompressor();                     // 리미터 역할: 큰 소리가 겹쳐도 깨지지 않게
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.15;
    master = ctx.createGain(); master.gain.value = volume;
    master.connect(comp); comp.connect(ctx.destination);
    // 잡음 버퍼는 한 번만 만들어 모든 소리가 나눠 씀 (소리마다 새로 만들면 느려집니다)
    const len = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    wire(new AC());
  }
  function resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  const on = () => enabled && !forced && ctx;

  // 재생 허가: 같은 소리 최소 간격(ms) · 전체 동시 소리 수
  function allow(name, gapMs, dur) {
    if (!on()) return false;
    const now = ctx.currentTime * 1000;
    if (gapMs && lastAt[name] != null && now - lastAt[name] < gapMs) return false;
    if (voices >= MAX_VOICES) return false;
    lastAt[name] = now; voices++;
    setTimeout(() => { voices = Math.max(0, voices - 1); }, Math.max(50, (dur || 0.3) * 1000));
    return true;
  }

  // ── 재료 ──
  function env(g, t0, a, peak, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function tone(freq, dur, type, vol, delay, toFreq) {
    if (!on()) return;
    const t0 = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), t0 + dur);
    env(g, t0, 0.006, vol || 0.3, dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // 잡음: filter = {type, freq, to, q} · 볼륨 곡선은 빠른 어택 + 지수 감쇠
  function burst(dur, vol, filter, delay, attack) {
    if (!on()) return;
    const t0 = ctx.currentTime + (delay || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = (filter && filter.type) || 'lowpass'; f.frequency.setValueAtTime((filter && filter.freq) || 1200, t0); f.Q.value = (filter && filter.q) || 0.7;
    if (filter && filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
    env(g, t0, attack || 0.002, vol || 0.3, dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }
  // 낮은 '쿵' (주파수가 빠르게 떨어지는 사인파)
  function thump(from, to, dur, vol, delay) { tone(from, dur, 'sine', vol, delay, to); }

  // ── 무기 · 동작 ──
  const W = {
    rifle() {        // 라이플: 날카로운 파열음 + 가운데 탕 + 낮은 쿵
      if (!allow('rifle', 55, 0.25)) return;
      burst(0.05, 0.55, { type: 'highpass', freq: 1800 });
      burst(0.12, 0.5, { type: 'bandpass', freq: 1400, to: 500, q: 0.9 });
      thump(160, 45, 0.12, 0.6);
    },
    sniper() {       // 스나이퍼: 큰 '탕' + 쿵 + 멀리 퍼지는 울림(메아리 두 번)
      if (!allow('sniper', 200, 1.2)) return;
      burst(0.06, 0.8, { type: 'highpass', freq: 2200 });
      burst(0.45, 0.65, { type: 'lowpass', freq: 5000, to: 350 });
      thump(120, 32, 0.35, 0.85);
      burst(0.5, 0.16, { type: 'lowpass', freq: 1200, to: 200 }, 0.18, 0.02);
      burst(0.6, 0.08, { type: 'lowpass', freq: 900, to: 150 }, 0.42, 0.03);
    },
    bolt(delay) {    // 볼트액션: 철컥(뒤로) … 철컥(앞으로)
      if (!allow('bolt', 300, 0.8)) return;
      const d = delay || 0;
      burst(0.03, 0.35, { type: 'bandpass', freq: 3200, q: 3 }, d); tone(1900, 0.03, 'square', 0.12, d);
      burst(0.03, 0.4, { type: 'bandpass', freq: 2600, q: 3 }, d + 0.2); tone(1500, 0.035, 'square', 0.14, d + 0.2);
    },
    reload(dur) {    // 재장전: 탄창 빠짐(딸깍) → 끼움(철컥) → 노리쇠(착)
      if (!allow('reload', 400, 1.5)) return;
      const T = Math.max(0.8, (dur || 1400) / 1000);
      burst(0.04, 0.3, { type: 'bandpass', freq: 2200, q: 2 }, 0.05);
      burst(0.06, 0.4, { type: 'bandpass', freq: 900, q: 1.5 }, T * 0.55); thump(200, 90, 0.06, 0.25, T * 0.55);
      burst(0.04, 0.45, { type: 'bandpass', freq: 2800, q: 2.5 }, T * 0.85); tone(1600, 0.03, 'square', 0.12, T * 0.85);
    },
    empty() { if (!allow('empty', 150, 0.1)) return; tone(2400, 0.02, 'square', 0.12); },   // 탄약 없음 딸깍
    hitmark() { if (!allow('hitmark', 45, 0.1)) return; tone(1900, 0.045, 'triangle', 0.22); tone(2850, 0.03, 'sine', 0.12, 0.005); },
    headshot() { if (!allow('headshot', 80, 0.4)) return; tone(1320, 0.12, 'triangle', 0.3); tone(2640, 0.25, 'sine', 0.2, 0.03); },
    hurt() { if (!allow('hurt', 90, 0.25)) return; thump(140, 55, 0.18, 0.55); burst(0.1, 0.25, { type: 'lowpass', freq: 700 }); },
    death() { if (!allow('death', 300, 0.9)) return; thump(180, 40, 0.6, 0.6); burst(0.5, 0.3, { type: 'lowpass', freq: 900, to: 120 }); },
    jump() { if (!allow('jump', 150, 0.2)) return; tone(260, 0.14, 'sine', 0.2, 0, 520); burst(0.08, 0.1, { type: 'highpass', freq: 3000 }); },
    land(h) { if (!allow('land', 120, 0.2)) return; thump(110, 45, 0.14, 0.25 + Math.min(0.35, (h || 0.3))); burst(0.07, 0.18, { type: 'lowpass', freq: 600 }); },
    roll() { if (!allow('roll', 250, 0.5)) return; burst(0.45, 0.3, { type: 'bandpass', freq: 500, to: 2200, q: 1.2 }, 0, 0.12); },
    // 젬 아레나 · 탑다운 무기
    pistol() { if (!allow('pistol', 60, 0.2)) return; burst(0.04, 0.45, { type: 'highpass', freq: 1500 }); burst(0.09, 0.35, { type: 'bandpass', freq: 1700, to: 700 }); thump(200, 70, 0.08, 0.35); },
    shotgun() { if (!allow('shotgun', 120, 0.5)) return; burst(0.08, 0.7, { type: 'lowpass', freq: 3500, to: 600 }); thump(110, 35, 0.25, 0.8); burst(0.3, 0.15, { type: 'lowpass', freq: 800, to: 150 }, 0.1, 0.02); },
    smg() { if (!allow('smg', 40, 0.15)) return; burst(0.035, 0.4, { type: 'highpass', freq: 2000 }); burst(0.06, 0.3, { type: 'bandpass', freq: 1800, to: 900 }); thump(180, 80, 0.05, 0.3); },
    throwBomb() { if (!allow('throw', 120, 0.4)) return; burst(0.3, 0.25, { type: 'bandpass', freq: 700, to: 1800, q: 1.4 }, 0, 0.05); },
    explosion() { if (!allow('explosion', 90, 1.0)) return; thump(90, 25, 0.6, 0.9); burst(0.7, 0.6, { type: 'lowpass', freq: 2500, to: 120 }, 0, 0.004); burst(0.25, 0.3, { type: 'highpass', freq: 3000 }); },
    dash() { if (!allow('dash', 200, 0.5)) return; burst(0.4, 0.4, { type: 'bandpass', freq: 400, to: 3000, q: 1 }, 0, 0.03); tone(180, 0.35, 'sawtooth', 0.12, 0, 600); },
    heal() { if (!allow('heal', 300, 0.8)) return; [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.25, 'sine', 0.2, i * 0.07)); },
    gem() { if (!allow('gem', 70, 0.4)) return; tone(1568, 0.1, 'triangle', 0.25); tone(2093, 0.22, 'sine', 0.2, 0.06); },
    kill() { if (!allow('kill', 150, 0.6)) return; tone(784, 0.1, 'square', 0.2); tone(1175, 0.25, 'square', 0.22, 0.09); },
    superReady() { if (!allow('superReady', 1000, 0.6)) return; [523, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, i * 0.06)); },
    nom() { if (!allow('nom', 60, 0.1)) return; tone(520 + Math.random() * 120, 0.06, 'sine', 0.3, 0, 900); }     // 뱀 먹이
  };

  // ── 카트 엔진음: 3단 기어 (속도가 오르면 음이 올라가다 기어가 바뀌면 살짝 떨어짐) ──
  let eng = null;
  function engineStart() {
    if (!on() || eng) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator();
    const rum = ctx.createBufferSource(), rumF = ctx.createBiquadFilter(), rumG = ctx.createGain();
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; sub.type = 'sine';
    o1.frequency.value = 60; o2.frequency.value = 60; o2.detune.value = 14; sub.frequency.value = 30;
    rum.buffer = noiseBuf; rum.loop = true; rumF.type = 'bandpass'; rumF.frequency.value = 120; rumF.Q.value = 1.2; rumG.gain.value = 0.25;
    lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2.5;                // 공명을 살짝 줘 '부릉' 느낌
    g.gain.value = 0.0001;
    o1.connect(lp); o2.connect(lp); sub.connect(lp); rum.connect(rumF); rumF.connect(rumG); rumG.connect(lp); lp.connect(g); g.connect(master);
    [o1, o2, sub, rum].forEach(n => n.start());
    eng = { o1, o2, sub, rum, rumF, lp, g };
  }
  // level 0~1 (속도 비율), boost true 면 더 높고 큰 소리
  function engineSet(level, boost) {
    if (!eng || !ctx) return;
    if (!on()) { eng.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); return; }
    const t = ctx.currentTime, L = Math.max(0, Math.min(1, level || 0));
    const gear = Math.min(2, Math.floor(L * 3)), rpm = L * 3 - gear;                 // 기어 안에서 0~1
    const f = 48 + gear * 14 + rpm * 70 + (boost ? 35 : 0);
    eng.o1.frequency.setTargetAtTime(f, t, 0.06); eng.o2.frequency.setTargetAtTime(f, t, 0.06); eng.sub.frequency.setTargetAtTime(f / 2, t, 0.06);
    eng.rumF.frequency.setTargetAtTime(90 + L * 160, t, 0.1);
    eng.lp.frequency.setTargetAtTime(420 + L * 1400 + (boost ? 900 : 0), t, 0.08);
    eng.g.gain.setTargetAtTime(0.04 + L * 0.05 + (boost ? 0.03 : 0), t, 0.1);   // 계속 울리니 총·충돌음보다 작게
  }
  function engineStop() {
    if (!eng) return;
    const t = ctx.currentTime; eng.g.gain.setTargetAtTime(0.0001, t, 0.12);
    const e = eng; eng = null; setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.sub.stop(); e.rum.stop(); } catch (x) {} }, 600);
  }
  // 드리프트 끼익: 켜 둔 채 세기(0~1)만 바꿉니다
  let skid = null;
  function skidSet(amount) {
    if (!ctx) return;
    const a = on() ? Math.max(0, Math.min(1, amount || 0)) : 0;
    if (!skid && a > 0.05) {
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 6; g.gain.value = 0.0001;
      src.connect(bp); bp.connect(g); g.connect(master); src.start(); skid = { src, bp, g };
    }
    if (!skid) return;
    const t = ctx.currentTime;
    skid.g.gain.setTargetAtTime(a * 0.22 + 0.0001, t, 0.05); skid.bp.frequency.setTargetAtTime(2000 + a * 900, t, 0.08);
    if (a <= 0.05) { const s = skid; setTimeout(() => { if (skid === s && s.g.gain.value < 0.01) { try { s.src.stop(); } catch (x) {} skid = null; } }, 400); }
  }
  const K = {
    countdown(n) { if (!on()) return; if (n > 0) tone(660, 0.16, 'square', 0.28); else { tone(1320, 0.45, 'square', 0.3); tone(1980, 0.45, 'triangle', 0.15); } },
    item() { if (!allow('item', 150, 0.5)) return; [880, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.09, 'triangle', 0.2, i * 0.04)); },
    boost() { if (!allow('boost', 200, 0.8)) return; burst(0.6, 0.35, { type: 'bandpass', freq: 400, to: 2600, q: 0.9 }, 0, 0.05); tone(160, 0.5, 'sawtooth', 0.14, 0, 520); },
    crash() { if (!allow('crash', 200, 0.7)) return; thump(150, 38, 0.3, 0.8); burst(0.35, 0.55, { type: 'lowpass', freq: 3500, to: 300 }); burst(0.12, 0.3, { type: 'bandpass', freq: 3200, q: 2 }, 0.03); },
    bump() { if (!allow('bump', 150, 0.2)) return; thump(120, 60, 0.1, 0.4); },
    kartJump() { if (!allow('kartJump', 300, 0.4)) return; tone(220, 0.3, 'sine', 0.2, 0, 440); },
    kartLand(air) { if (!allow('kartLand', 250, 0.3)) return; thump(100, 40, 0.18, 0.35 + Math.min(0.4, (air || 0) / 2000)); burst(0.12, 0.25, { type: 'lowpass', freq: 800 }); },
    pass() { if (!allow('pass', 150, 0.1)) return; tone(760, 0.05, 'triangle', 0.14); tone(1140, 0.08, 'triangle', 0.12, 0.05); },
    finish() { if (!allow('finish', 1000, 0.8)) return; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.22, i * 0.09)); }
  };

  return Object.assign({
    resume: resume,
    engineStart: engineStart, engineSet: engineSet, engineStop: engineStop, skidSet: skidSet,
    setEnabled: function (v) { enabled = v; if (!v) { engineStop(); skidSet(0); } },
    isEnabled: function () { return enabled; },
    setForcedMute: function (v) { forced = !!v; if (forced) { engineStop(); skidSet(0); } },   // 교사 전체 음소거
    isForcedMute: function () { return forced; },
    setVolume: function (v) { volume = v; if (master) master.gain.value = v; },
    _attach: function (c) { wire(c); voices = 0; Object.keys(lastAt).forEach(k => delete lastAt[k]); eng = null; skid = null; },   // 검사용: 오프라인 오디오에 연결

    // ── 기존 이름 (다른 게임 호환) ──
    move:      function () { if (allow('move', 30, 0.06)) tone(180, 0.05, 'square', 0.16); },
    rotate:    function () { if (allow('rotate', 30, 0.07)) tone(420, 0.06, 'triangle', 0.22); },
    softDrop:  function () { if (allow('softDrop', 30, 0.05)) tone(140, 0.04, 'square', 0.12); },
    hardDrop:  function () { if (!allow('hardDrop', 40, 0.1)) return; burst(0.09, 0.35, { type: 'lowpass', freq: 900 }); tone(90, 0.09, 'square', 0.2); },
    lock:      function () { if (allow('lock', 30, 0.08)) tone(110, 0.07, 'square', 0.18); },
    clear:     function (n) { if (!allow('clear', 60, 0.6)) return; for (let i = 0; i < n; i++) tone(520 * Math.pow(1.26, i), 0.13, 'square', 0.26, i * 0.06); if (n >= 4) tone(1568, 0.4, 'triangle', 0.3, 0.26); },
    levelUp:   function () { if (allow('levelUp', 200, 0.5)) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.26, i * 0.07)); },
    gameOver:  function () { if (allow('gameOver', 500, 0.8)) [440, 370, 294, 220].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.26, i * 0.13)); },
    start:     function () { if (allow('start', 300, 0.4)) [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'square', 0.24, i * 0.08)); }
  }, W, K);
})();

// 모든 게임이 window.Sound 로 확인하고 소리를 냅니다. const 는 window 에 자동으로 붙지 않아
// 예전엔 게임 속 효과음이 한 번도 나지 않았습니다 (조건이 늘 거짓). 명시적으로 등록합니다.
if (typeof window !== "undefined") window.Sound = Sound;
