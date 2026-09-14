// 효과음 엔진 — Web Audio API로 직접 생성 (외부 음원 파일 없음)

const Sound = (function () {
  let ctx = null;
  let master = null;
  let enabled = true;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, delay) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.3, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function sweep(from, to, dur, type, vol) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!enabled || !ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.3;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start();
  }

  // ── 엔진음: 속도에 따라 음이 올라가는 지속음 (카트) ──
  let eng = null;
  function engineStart() {
    if (!enabled || !ctx || eng) return;
    const osc = ctx.createOscillator(), osc2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = 'sawtooth'; osc2.type = 'square'; osc.frequency.value = 70; osc2.frequency.value = 35;
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.8;
    g.gain.value = 0.0001;
    osc.connect(lp); osc2.connect(lp); lp.connect(g); g.connect(master);
    osc.start(); osc2.start();
    eng = { osc, osc2, lp, g };
  }
  // level 0~1 (속도 비율), boost true 면 더 높고 큰 소리
  function engineSet(level, boost) {
    if (!eng || !ctx) return;
    const t = ctx.currentTime;
    const f = 62 + level * 150 + (boost ? 60 : 0);
    eng.osc.frequency.setTargetAtTime(f, t, 0.08);
    eng.osc2.frequency.setTargetAtTime(f / 2, t, 0.08);
    eng.lp.frequency.setTargetAtTime(380 + level * 900 + (boost ? 600 : 0), t, 0.1);
    eng.g.gain.setTargetAtTime(0.035 + level * 0.05 + (boost ? 0.03 : 0), t, 0.12);
  }
  function engineStop() {
    if (!eng) return;
    const t = ctx.currentTime; eng.g.gain.setTargetAtTime(0.0001, t, 0.15);
    const e = eng; eng = null; setTimeout(() => { try { e.osc.stop(); e.osc2.stop(); } catch (x) {} }, 500);
  }

  return {
    resume: resume,
    engineStart: engineStart, engineSet: engineSet, engineStop: engineStop,
    setEnabled: function (v) { enabled = v; if (!v) engineStop(); },
    isEnabled: function () { return enabled; },

    move:      function () { tone(180, 0.05, 'square', 0.16); },
    rotate:    function () { tone(420, 0.06, 'triangle', 0.22); },
    softDrop:  function () { tone(140, 0.04, 'square', 0.12); },
    hardDrop:  function () { noise(0.09, 0.35, 900); tone(90, 0.09, 'square', 0.2); },
    lock:      function () { tone(110, 0.07, 'square', 0.18); },
    clear:     function (n) {
      const base = 520;
      for (let i = 0; i < n; i++) tone(base * Math.pow(1.26, i), 0.13, 'square', 0.26, i * 0.06);
      if (n >= 4) tone(1568, 0.4, 'triangle', 0.3, 0.26);
    },
    levelUp:   function () { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.26, i * 0.07)); },
    gameOver:  function () { [440, 370, 294, 220].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.26, i * 0.13)); },
    start:     function () { [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'square', 0.24, i * 0.08)); },
    crash:     function () { noise(0.45, 0.5, 700); sweep(300, 40, 0.5, 'sawtooth', 0.3); },
    pass:      function () { tone(760, 0.05, 'triangle', 0.14); },
    boost:     function () { sweep(200, 700, 0.25, 'sawtooth', 0.2); }
  };
})();
