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

  return {
    resume: resume,
    setEnabled: function (v) { enabled = v; },
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
