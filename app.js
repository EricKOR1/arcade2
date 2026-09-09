/* ══════════════════════════════════════════════════════════
   app.js — 과학 게임(광합성·힘·몸속 여행)용 App 어댑터

   원본 게임들은 Google Apps Script 플랫폼의 App 객체를 씁니다.
   그 API를 그대로 흉내 내되, 서버 호출은 Firebase 로 바꿨습니다.
   덕분에 게임 파일은 한 줄도 고치지 않고 그대로 올릴 수 있습니다.
   ══════════════════════════════════════════════════════════ */
var App = (function () {
"use strict";

var games = {};          /* 게임이 스스로 등록합니다 */
var loaded = {};         /* 이미 내려받은 게임 파일 */
var info = {};           /* 게임 파일의 GAMEINFO 블록 */
var routeSent = {};      /* 여정(기관 순서)을 이미 올린 방 */
var spectate = false;    /* 교사 관전 모드 — 방에 내 자리를 만들지 않습니다 */
var current = null;      /* 지금 올라와 있는 게임 */
var hooks = { home: null, score: null };

/* ── 글자 escape ── */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ── 팝업 ── */
function overlay(html) {
  var ov = document.getElementById("overlay");
  if (!ov) return;
  ov.innerHTML = '<div class="ov">' + html + '</div>';
  ov.hidden = false;
  ov.scrollTop = 0;
}
function closeOverlay() {
  var ov = document.getElementById("overlay");
  if (!ov) return;
  ov.hidden = true;
  ov.innerHTML = "";
}

/* ── 게임 등록 / 올리기 ── */
function registerGame(g) { games[g.id] = g; }

/* 게임 파일(html 조각)을 한 번만 내려받아 <style>·<script> 를 심습니다.
   GAS 가 하던 include 와 같은 일입니다. */
function loadFile(src) {
  if (loaded[src]) return Promise.resolve();
  return fetch(src, { cache: "no-cache" }).then(function (r) {
    if (!r.ok) throw new Error(src + " 를 불러오지 못했습니다 (" + r.status + ")");
    return r.text();
  }).then(function (html) {
    var box = document.createElement("div");
    box.innerHTML = html;                      /* innerHTML 로는 스크립트가 실행되지 않습니다 */
    Array.prototype.forEach.call(box.querySelectorAll("style"), function (s) {
      var el = document.createElement("style");
      el.textContent = s.textContent;
      document.head.appendChild(el);
    });
    try { window.GAMEINFO = undefined; } catch (e) {}
    Array.prototype.forEach.call(box.querySelectorAll("script"), function (s) {
      var el = document.createElement("script");
      el.textContent = s.textContent;          /* 전역에서 실행 → registerGame 이 불립니다 */
      document.body.appendChild(el);
    });
    /* 게임 파일이 스스로 밝힌 정보 — 필요하면 대시보드에서 쓸 수 있습니다 */
    info[src] = (typeof window.GAMEINFO === "object" && window.GAMEINFO) || null;
    loaded[src] = true;
  });
}

/* 게임을 화면에 올리고 시작합니다 */
function mountGame(id, src, host) {
  return loadFile(src).then(function () {
    var g = games[id];
    if (!g) throw new Error("게임 '" + id + "' 이(가) 등록되지 않았습니다");
    stopGame();
    current = g;
    host.innerHTML = "";
    g.mount(host);
    if (g.start) g.start();
    return g;
  });
}
function stopGame() {
  routeSent = {};
  if (current && current.stop) { try { current.stop(); } catch (e) {} }
  current = null;
  closeOverlay();
}
function goHome() { if (hooks.home) hooks.home(); }

/* ══════════════════════════════════════════════════════════
   순위 · 점수
   ══════════════════════════════════════════════════════════ */
function meKey() {
  var u = App.user || {};
  return u.grade + "-" + u.cls + "-" + u.num;
}
function rankHtml(list, label) {
  if (!list || !list.length)
    return '<div class="rank"><h4>' + esc(label || "순위") + '</h4>' +
           '<div class="empty">아직 기록이 없습니다. 첫 기록의 주인이 되어 보세요!</div></div>';
  var me = meKey();
  return '<div class="rank"><h4>' + esc(label || "순위") + '</h4><ol>' +
    list.slice(0, 10).map(function (p, i) {
      return '<li' + (p.k === me ? ' class="me"' : '') + '>' +
        '<span class="n">' + (["🥇", "🥈", "🥉"][i] || (i + 1) + ".") + '</span>' +
        '<span class="nm">' + esc(p.nm) + '</span>' +
        '<span class="sc">' + (p.score || 0) + '</span></li>';
    }).join("") + '</ol></div>';
}

/* 점수를 저장하고 순위를 그려 줍니다 (게임들이 직접 부릅니다) */
function submitAndRank(gameId, p, svEl, rkEl, level) {
  return call("saveScore", {
    user: App.user, game: gameId, level: p.level,
    score: p.score, d1: p.d1, d2: p.d2, cleared: p.cleared
  }).then(function (r) {
    if (svEl) {
      svEl.textContent = r.ok ? "점수를 저장했어요." : ("점수 저장 실패: " + r.msg);
      svEl.className = "msg " + (r.ok ? "good" : "bad");
    }
    return call("getBoard", gameId);
  }).then(function (r) {
    if (!r || !r.ok || !rkEl) return;
    rkEl.innerHTML = rankHtml(r.data.levels[String(p.level)] || [], (level || p.level) + "단계 순위");
  })["catch"](function (e) {
    if (svEl) { svEl.textContent = "점수 저장 실패: " + e.message; svEl.className = "msg bad"; }
  });
}

/* 지금 올라와 있는 게임이 peek() 을 열어 두었다면
   "어느 기관에 있는지"를 읽어 위치 신호에 함께 실어 보냅니다.
   (몸속 여행이 검사용으로 제공하는 창구라 게임 파일은 손대지 않습니다) */
function peekExtra() {
  try {
    var g = current;
    if (!g || typeof g.peek !== "function") return null;
    var st = g.peek();
    if (!st || !st.steps || !st.steps.length) return null;
    var route = [], last = null;
    st.steps.forEach(function (x) { if (x.org !== last) { route.push(x.org); last = x.org; } });
    var idx = Math.max(0, Math.min(st.i || 0, st.steps.length - 1));
    var org = (st.steps[idx] || {}).org || "";

    /* 같은 기관 안에서 몇 번째 문제까지 왔는지 → 0~1 로 환산.
       교사 화면에서 학생 표시가 기관 사이를 부드럽게 옮겨 가게 합니다. */
    var a = idx, b = idx;
    while (a > 0 && st.steps[a - 1].org === org) a--;
    while (b < st.steps.length - 1 && st.steps[b + 1].org === org) b++;
    var frac = (b > a) ? (idx - a) / (b - a + 1) : 0;
    if (st.moving) frac = Math.min(1, frac + (1 / (b - a + 1)) * 0.6);

    return {
      org: org, oi: route.indexOf(org), on: route.length, of: frac,
      route: route, moving: st.moving ? 1 : 0,
      combo: st.combo || 0, label: st.label || ""
    };
  } catch (e) { return null; }
}

/* ══════════════════════════════════════════════════════════
   서버 호출 — Firebase 로 구현
     rooms/{game}/L{level}  : 대결 방 (status · startAt · seed · players)
     scores/{game}/L{level} : 점수판
   ══════════════════════════════════════════════════════════ */
var STALE = 20000;       /* 이 시간 넘게 소식이 없으면 자리를 비웠다고 봅니다 */

function ok(data)  { return { ok: true,  data: data || {}, msg: "" }; }
function bad(msg)  { return { ok: false, data: {},          msg: msg }; }
function roomRef(game, level) { return db.ref("rooms/" + game + "/L" + level); }
function scoreRef(game, level) { return db.ref("scores/" + game + "/L" + level); }
function once(ref) { return ref.once("value").then(function (s) { return s.val(); }); }

function userLabel(u) {
  u = u || {};
  return { nm: u.name || "학생", cl: (u.grade != null && u.cls) ? (u.grade + "-" + u.cls) : "" };
}

/* 참가자를 순위대로 정리합니다 — 완주한 사람 먼저, 그다음 진행도·점수 순 */
function sortPlayers(raw) {
  var now = Date.now(), out = [];
  Object.keys(raw || {}).forEach(function (k) {
    var p = raw[k] || {};
    out.push({
      k: k, nm: p.nm || "학생", cl: p.cl || "",
      i: p.i || 0, m: p.m || 1, sc: p.sc || 0,
      d: p.d ? 1 : 0, r: p.r ? 1 : 0, lb: p.lb || "",
      stale: (now - (p.t || 0)) > STALE
    });
  });
  out.sort(function (a, b) {
    if (a.d !== b.d) return b.d - a.d;
    var pa = a.i / (a.m || 1), pb = b.i / (b.m || 1);
    if (pa !== pb) return pb - pa;
    return (b.sc || 0) - (a.sc || 0);
  });
  return out;
}
function roomPayload(v) {
  v = v || {};
  var players = sortPlayers(v.players);
  var live = players.filter(function (p) { return p.r && !p.stale; });
  return {
    players: players,
    status: v.status || "wait",
    startAt: v.startAt || 0,
    seed: v.seed || 0,
    auto: !!v.auto,
    running: live.length,
    done: live.filter(function (p) { return p.d; }).length
  };
}

function call(method, payload) {
  payload = payload || {};
  try {
    var game = payload.game, level = payload.level;
    var key = meKey(), lab = userLabel(payload.user || App.user);

    /* ── 대결: 참가 ── */
    if (method === "roomJoin") {
      var rr = roomRef(game, level);
      if (spectate) return once(rr).then(function (v) { return ok(roomPayload(v)); });
      return once(rr).then(function (v) {
        v = v || {};
        var init = {};
        if (!v.status) { init.status = "wait"; init.startAt = 0; init.seed = 0; }
        init["players/" + key] = { nm: lab.nm, cl: lab.cl, i: 0, m: 1, sc: 0,
                                   d: 0, r: 0, t: Date.now() };
        return rr.update(init).then(function () { return once(rr); });
      }).then(function (v) { return ok(roomPayload(v)); });
    }

    /* ── 대결: 방 상태 ── */
    if (method === "roomState") {
      return once(roomRef(game, level)).then(function (v) { return ok(roomPayload(v)); });
    }

    /* ── 대결: 내 위치 보내기 ── */
    if (method === "roomPing") {
      var rr2 = roomRef(game, level);
      if (spectate) return once(rr2).then(function (v) { return ok(roomPayload(v)); });
      var ex = peekExtra();
      var upd = {
        nm: lab.nm, cl: lab.cl, i: payload.i || 0, m: payload.m || 1,
        sc: payload.sc || 0, d: payload.done ? 1 : 0, r: 1, lb: payload.lb || "",
        first: payload.first || 0, wrong: payload.wrong || 0,
        time: payload.time || 0, seed: payload.seed || 0, t: Date.now()
      };
      if (ex) {                                   /* 교사 화면의 여정 지도에 쓰입니다 */
        upd.org = ex.org; upd.oi = ex.oi; upd.on = ex.on; upd.of = +ex.of.toFixed(2);
        upd.mv = ex.moving; upd.cb = ex.combo;
        if (ex.label) upd.lb = ex.label;
      }
      var rk = game + "/L" + level;
      var needRoute = !!(ex && ex.route && !routeSent[rk]);
      if (needRoute) routeSent[rk] = 1;
      return rr2.child("players/" + key).update(upd).then(function () {
        /* 기관 순서는 한 번만 올려 두면 교사 화면이 지도를 그릴 수 있습니다 */
        if (needRoute) return rr2.child("route").set(ex.route);
      }).then(function () {
        return once(rr2);
      }).then(function (v) {
        var p = roomPayload(v);
        /* 달리던 사람이 모두 들어오면 대결을 자동으로 마칩니다 */
        if (p.status === "run" && p.running > 0 && p.done >= p.running) {
          return rr2.update({ status: "end", auto: true }).then(function () {
            p.status = "end"; p.auto = true; return ok(p);
          });
        }
        return ok(p);
      });
    }

    /* ── 대결: 풀던 자리 이어 하기 ── */
    if (method === "roomResume") {
      if (spectate) return Promise.resolve(ok({ resume: null }));
      return once(roomRef(game, level)).then(function (v) {
        v = v || {};
        var me = (v.players || {})[key];
        if (v.status !== "run" || !me || me.d || !(me.i > 0)) return ok({ resume: null });
        return ok({ resume: { i: me.i, sc: me.sc || 0, time: me.time || 0,
                              seed: me.seed || v.seed || 0,
                              first: me.first || 0, wrong: me.wrong || 0 } });
      });
    }

    /* ── 점수 저장 (최고 기록만 남김) ── */
    if (method === "saveScore") {
      if (spectate) return Promise.resolve(ok({}));
      /* submitAndRank 를 거치지 않고 직접 부르는 게임(몸속 여행)도
         교사 화면에 점수가 올라가도록 여기서 한 번 더 알립니다 */
      if (hooks.score) { try { hooks.score(payload); } catch (e) {} }
      var sr = scoreRef(game, level).child(key);
      return sr.transaction(function (cur) {
        if (cur && (cur.score || 0) >= (payload.score || 0)) return cur;
        return { k: key, nm: lab.nm, cl: lab.cl, score: payload.score || 0,
                 d1: payload.d1 || 0, d2: payload.d2 || 0,
                 cleared: payload.cleared ? 1 : 0, at: Date.now() };
      }).then(function () { return ok({}); });
    }

    /* ── 점수판 읽기 ── */
    if (method === "getBoard") {
      var g = (typeof payload === "string") ? payload : payload.game;
      return once(db.ref("scores/" + g)).then(function (v) {
        var levels = {};
        Object.keys(v || {}).forEach(function (lk) {
          var arr = [];
          Object.keys(v[lk] || {}).forEach(function (pk) {
            var p = v[lk][pk]; if (p) arr.push(p);
          });
          arr.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
          levels[lk.replace(/^L/, "")] = arr.slice(0, 20);
        });
        return ok({ levels: levels });
      });
    }

    return Promise.resolve(bad("알 수 없는 요청: " + method));
  } catch (e) {
    return Promise.resolve(bad(e.message));
  }
}

return {
  /* 게임이 쓰는 API — 원본 GAS 플랫폼과 같은 모양 */
  user: null, meta: null,
  registerGame: registerGame,
  overlay: overlay, closeOverlay: closeOverlay,
  goHome: goHome, esc: esc,
  call: call, rankHtml: rankHtml, submitAndRank: submitAndRank,

  /* 아케이드 쪽에서만 쓰는 부분 */
  _games: games,
  _peek: peekExtra,
  _spectate: function (v) { spectate = !!v; },
  _state: function () { return (current && current.peek) ? current.peek() : null; },
  _info: info,
  _mount: mountGame,
  _stop: stopGame,
  _onHome: function (fn) { hooks.home = fn; },
  _onScore: function (fn) { hooks.score = fn; },
  _meKey: meKey
};
})();
