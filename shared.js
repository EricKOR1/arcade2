// 공용 색상표와 미니 보드 렌더링
// 학생 화면(index.html)과 교사 화면(admin.html)이 함께 사용합니다.

const CELL_COLORS = {
  0:  '#0B0D12', // 빈 칸
  1:  '#4CC9F0', // I
  2:  '#4361EE', // J
  3:  '#F79824', // L
  4:  '#FFD166', // O
  5:  '#06D6A0', // S
  6:  '#B15DFF', // T
  7:  '#EF476F', // Z
  8:  '#2B303C', // 고스트(착지 예상 위치)
  10: '#F5A524', // 레이싱 - 내 차
  11: '#EF476F', // 레이싱 - 상대 차
  12: '#2B303C', // 레이싱 - 도로 경계
  13: '#06D6A0', // 스네이크 - 몸통
  14: '#9BF6E0', // 스네이크 - 머리
  15: '#EF476F', // 스네이크 - 먹이
  16: '#EF476F', // 벽돌 1줄
  17: '#F79824', // 벽돌 2줄
  18: '#FFD166', // 벽돌 3줄
  19: '#06D6A0', // 벽돌 4줄
  20: '#4CC9F0', // 벽돌 5줄
  21: '#EAECF2', // 패들
  22: '#FFFFFF', // 공
  23: '#FFD166', // 새
  24: '#06D6A0', // 파이프
  25: '#4CC9F0', // 우주선
  26: '#EF476F', // 적
  27: '#FFD166', // 총알
  28: '#B15DFF', // 적 총알
  29: '#EEE4DA', 30: '#EDE0C8', 31: '#F2B179', 32: '#F59563', 33: '#F67C5F', 34: '#F65E3B',   // 2048: 2·4·8·16·32·64
  35: '#EDCF72', 36: '#EDCC61', 37: '#EDC850', 38: '#EDC53F', 39: '#EDC22E', 40: '#3C3A32',   // 128 … 4096
  41: '#1E5FA8', // 길건너기 - 강
  42: '#173D2A', // 길건너기 - 집
  43: '#8B5A2B', // 길건너기 - 통나무
  44: '#FF5C7A', // 길건너기 - 차
  45: '#7D8798', // 소행성
  46: '#3B82F6', // 미로 - 벽
  47: '#FFD166', // 미로 - 셀
  48: '#4CC9F0', // 미로 - 파워 셀 / 목표
  49: '#FF5C7A', // 미로 - 드론
  50: '#3B5BDB', // 미로 - 겁먹은 드론
  51: '#4CC9F0', // 미사일 - 도시
  52: '#E8A05A', // 지네 - 버섯
  53: '#FFD166', // 지네 - 머리
  54: '#A78BFA', // 지네 - 몸
  55: '#FF5C7A', // 타워 - 발판
  56: '#4CC9F0', // 타워 - 사다리
  57: '#B98A55', // 타워 - 통
  58: '#134B73', // 태화강 - 강물
  59: '#1E2A3A', // 태화강 - 취수장
  60: '#B15DFF', // 태화강 - 오염물
  61: '#FF8A80', // (예비)
  62: '#0B1220', // 오염원 추적 - 지도 바탕
  63: '#5C6B85', // 젬 아레나 - 벽
  64: '#8B5CF6', // 젬 아레나 - 광산
  65: '#2E8B57', // 젬 아레나 - 수풀
  66: '#1F2B3E', // 젬 아레나 - 바닥
  67: '#B15DFF', // 젬 아레나 - 젬
  68: '#FF5C7A', // 젬 아레나 - 레드
  69: '#4CC9F0'  // 젬 아레나 - 블루
};

// 숫자 2차원 배열을 캔버스에 그림 (교사 화면 미니 보드용)
function drawBoardGrid(ctx, board, cellSize) {
  const rows = board.length;
  const cols = board[0] ? board[0].length : 0;
  ctx.fillStyle = CELL_COLORS[0];
  ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = board[y][x];
      if (v !== 0) {
        ctx.fillStyle = CELL_COLORS[v] || '#888';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }
}

// 입체감 있는 블록 (학생 화면용)
// 블록 셀 — 둥근 모서리 · 세로 그라데이션 · 윗면 광택 · 안쪽 그림자.
// 크기·색 조합마다 한 번만 그려 캐시해 두고 복사합니다 (테트리스 200칸 + 교사 미니보드 30개도 가볍게).
const _cellCache = new Map();
function _tintHex(hex, k) {
  const h = String(hex).replace('#', ''); if (h.length !== 6) return hex;
  const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return '#' + v.map(c => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))).toString(16).padStart(2, '0')).join('');
}
function _cellSprite(size, color) {
  const key = size + '|' + color; let c = _cellCache.get(key); if (c) return c;
  const S = Math.max(2, Math.round(size)); c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'), pad = Math.max(0.5, S * 0.06), r = Math.max(1.5, S * 0.18);
  const rr = (x, y, w, h, rad) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, rad); else g.rect(x, y, w, h); };
  // 본체
  const lg = g.createLinearGradient(0, pad, 0, S - pad); lg.addColorStop(0, _tintHex(color, 0.32)); lg.addColorStop(0.5, color); lg.addColorStop(1, _tintHex(color, -0.34));
  g.fillStyle = lg; rr(pad, pad, S - pad * 2, S - pad * 2, r); g.fill();
  // 윗면 광택
  g.fillStyle = 'rgba(255,255,255,0.30)'; rr(pad * 2, pad * 2, S - pad * 4, (S - pad * 4) * 0.36, r * 0.7); g.fill();
  // 안쪽 아래 그림자
  g.fillStyle = 'rgba(0,0,0,0.22)'; rr(pad * 2, S - pad * 2 - (S - pad * 4) * 0.22, S - pad * 4, (S - pad * 4) * 0.22, r * 0.7); g.fill();
  // 테두리
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(0.8, S * 0.04); rr(pad, pad, S - pad * 2, S - pad * 2, r); g.stroke();
  if (_cellCache.size > 400) _cellCache.clear();
  _cellCache.set(key, c); return c;
}
function drawBevelCell(ctx, px, py, size, color) {
  ctx.drawImage(_cellSprite(size, color), px, py, size, size);
}

// 교사 화면이 줄여 쓰기를 안다고 알리면(session.rle → window.BOARD_RLE) 같은 값이 3칸 이상 이어질 때 '값*개수' 로 줄여 보냄
// (예: 0,0,0,0,0,0,0,0,0,0 → 0*10 · 젬 아레나 판 5.3KB → 1.4KB · 테트리스 0.44KB → 0.24KB — 30명 판을 받는 교사 쪽 통신량이 큼)
// 옛 교사 화면은 rle 를 알리지 않으므로 예전 모양 그대로 보냄
function boardToRows(board) {
  if (typeof window === 'undefined' || !window.BOARD_RLE) return board.map(row => row.join(','));
  return board.map(row => { const o = [];
    for (let i = 0; i < row.length;) { let j = i + 1; while (j < row.length && row[j] === row[i]) j++; const n = j - i;
      if (n >= 3) o.push(row[i] + '*' + n); else for (let k = 0; k < n; k++) o.push(String(row[i])); i = j; }
    return o.join(','); });
}

function rowsToBoard(rows) {
  return rows.map(r => { const o = []; String(r).split(',').forEach(t => { const k = t.indexOf('*');
    if (k < 0) o.push(Number(t)); else { const v = Number(t.slice(0, k)), n = Math.min(4096, +t.slice(k + 1) || 0); for (let i = 0; i < n; i++) o.push(v); } }); return o; });
}

// ── 진동 피드백 (지원 기기만 · 아주 짧게) ──
const Haptic = {
  on: true,
  tap()  { if (this.on && navigator.vibrate) navigator.vibrate(12); },
  hit()  { if (this.on && navigator.vibrate) navigator.vibrate([30, 30, 30]); },
  good() { if (this.on && navigator.vibrate) navigator.vibrate(20); },
  big()  { if (this.on && navigator.vibrate) navigator.vibrate([60, 40, 80]); }
};

// ── 아이폰·아이패드(사파리) 호환 — 안드로이드와 똑같이 움직이게 ──
//   index.html · admin.html 이 함께 씀. 안드로이드·PC 에서는 이미 있는 기능이라 아무것도 바꾸지 않음
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // ① 터치 목록(TouchList)을 for…of · [...] 로 돌 수 있게 — 안 되는 사파리에서는 조이스틱 게임(레이저 태그·젬 아레나·뱀 아레나·탱크)의
  //    터치 처리 전체가 예외로 멈춰 조이스틱·조준이 전혀 안 움직였음 (크로미움에서 지우고 재현: 4게임 오류 14~19건)
  try { if (window.TouchList && typeof Symbol === 'function' && Symbol.iterator && !TouchList.prototype[Symbol.iterator]) TouchList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator]; } catch (e) {}
  // ② 둥근 사각형 roundRect (iOS 16 미만에 없음) — 없으면 카트 순위표·결과 상자 등 일부 배경이 안 그려졌음
  function rr(x, y, w, h, r) {
    let a = Array.isArray(r) ? r : [r == null ? 0 : r]; a = a.map(v => (v && typeof v === 'object') ? (+v.x || 0) : (+v || 0));
    const tl = a[0], tr = a.length > 1 ? a[1] : tl, br = a.length > 2 ? a[2] : tl, bl = a.length > 3 ? a[3] : (a.length > 1 ? a[1] : tl);
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    const m = Math.min(w, h) / 2, k = v => Math.max(0, Math.min(m, v));
    const r1 = k(tl), r2 = k(tr), r3 = k(br), r4 = k(bl);
    this.moveTo(x + r1, y); this.lineTo(x + w - r2, y); this.arcTo(x + w, y, x + w, y + r2, r2);
    this.lineTo(x + w, y + h - r3); this.arcTo(x + w, y + h, x + w - r3, y + h, r3);
    this.lineTo(x + r4, y + h); this.arcTo(x, y + h, x, y + h - r4, r4);
    this.lineTo(x, y + r1); this.arcTo(x, y, x + r1, y, r1); this.closePath();
  }
  try { if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = rr; } catch (e) {}
  try { if (window.Path2D && !Path2D.prototype.roundRect) Path2D.prototype.roundRect = rr; } catch (e) {}

  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   // 아이패드는 '데스크톱 사이트'로 Mac 처럼 보고함
  window.IS_IOS = iOS;
  // ③ 강조색 반투명(color-mix, iOS 16.2 미만 없음) — 없으면 강조 배경·테두리가 통째로 빠져 보임 → 같은 색을 rgba 로 채움
  try {
    if (window.CSS && CSS.supports && !CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')) {
      const fill = () => { const root = document.documentElement, hex = (getComputedStyle(root).getPropertyValue('--game-hex') || '').trim();
        const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return; const n = parseInt(m[1], 16), c = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
        if (root.style.getPropertyValue('--accent-soft') === 'rgba(' + c + ',0.18)') return;
        root.style.setProperty('--accent-soft', 'rgba(' + c + ',0.18)'); root.style.setProperty('--accent-glow', 'rgba(' + c + ',0.35)'); };
      fill(); document.addEventListener('DOMContentLoaded', fill);
      if (window.MutationObserver) new MutationObserver(fill).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    }
  } catch (e) {}
  // ④ :has() 선택자(iOS 15.4·크롬 105 미만 없음) — 없으면 가로 화면에서 버튼이 게임판을 가리고(판 양옆 비움 규칙이 통째로 빠짐) 타워 오르기 배치가 깨짐
  //    → 같은 조건을 #screen-game 의 class(hs-…)로 달아 style.css 의 짝 규칙이 대신 적용되게
  try {
    const hasOk = window.CSS && CSS.supports && CSS.supports('selector(:has(a))');
    if (!hasOk && window.MutationObserver) {
      let due = false;
      const upd = () => { due = false; const sg = document.getElementById('screen-game'); if (!sg) return;
        const pad = document.getElementById('pad'), q = s => !!sg.querySelector(s), fc = document.getElementById('fps-ctl');
        const set = (c, on) => { if (sg.classList.contains(c) !== on) sg.classList.toggle(c, on); };
        set('hs', true); set('hs-pnone', !!(pad && pad.classList.contains('pad-none'))); set('hs-pany', !!(pad && !pad.classList.contains('pad-none')));
        set('hs-climb', q('.pad-climb')); set('hs-1d', q('.pad.pad-single > .dpad')); set('hs-1r', q('.pad.pad-single > .pad-r'));
        set('hs-fps', !!(fc && sg.contains(fc) && !fc.classList.contains('k3-ctl') && !fc.classList.contains('arena-ctl'))); };
      const kick = () => { if (!due) { due = true; requestAnimationFrame(upd); } };
      const go = () => { kick(); new MutationObserver(kick).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); };
      if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
    }
  } catch (e) {}
  if (!iOS) return;
  document.documentElement.classList.add('ios');
  // ⑤ 글자 입력(닉네임) 뒤 키보드가 닫혀도 화면이 위로 밀린 채 남으면, 보이는 버튼과 실제로 눌리는 자리가 어긋남 → 제자리로
  document.addEventListener('focusout', e => {
    const t = e.target; if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    setTimeout(() => {
      const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;   // 다른 입력 칸으로 옮겨 간 것
      if ((window.scrollX || window.scrollY) && getComputedStyle(document.body).overflow === 'hidden') window.scrollTo(0, 0);
    }, 80);
  }, true);
})();
