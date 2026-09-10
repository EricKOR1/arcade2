// ═══════════════════════════════════════════════════════════
//  Firebase 프로젝트 설정
//  Firebase 콘솔(console.firebase.google.com)
//    > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성
//  에서 값을 복사해 아래를 채우세요.
//
//  ★ 이미 저장소에 본인 값이 든 파일이 있다면 이 파일로 덮어쓰지 마세요.
// ═══════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyA95pJwc-X2AyXq3XU_1CAPyu755U5AERk",
  authDomain: "arcadegame-25262.firebaseapp.com",
  databaseURL: "https://arcadegame-25262-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "arcadegame-25262",
  storageBucket: "arcadegame-25262.firebasestorage.app",
  messagingSenderId: "171893226218",
  appId: "1:171893226218:web:75c3daf40a8be1078cf593"
};

/* 설정을 안 채웠으면 화면에 크게 알려 줍니다 (조용히 실패하지 않도록) */
const FB_UNSET = String(firebaseConfig.databaseURL).indexOf('여기에_') >= 0;

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ── 연결 상태를 확인해서 문제가 있으면 화면 위에 띄웁니다 ── */
(function () {
  function banner(title, lines) {
    if (document.getElementById('fb-banner')) return;
    const d = document.createElement('div');
    d.id = 'fb-banner';
    d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;padding:14px 18px;' +
      'background:#FF5C7A;color:#0A0C12;font:600 14px/1.5 Pretendard,sans-serif;' +
      'box-shadow:0 10px 30px -12px rgba(0,0,0,.8)';
    const h = document.createElement('b');
    h.style.cssText = 'display:block;font-size:15px;margin-bottom:4px';
    h.textContent = title;
    d.appendChild(h);
    lines.forEach(function (t) {
      const p = document.createElement('div');
      p.style.cssText = 'font-weight:500;opacity:.85';
      p.textContent = t;
      d.appendChild(p);
    });
    (document.body || document.documentElement).appendChild(d);
  }

  if (FB_UNSET) {
    banner('Firebase 설정이 비어 있습니다', [
      'firebase-config.js 를 열어 Firebase 콘솔의 값으로 채워주세요.',
      '지금은 접속·점수·순위가 저장되지 않습니다.'
    ]);
    return;
  }

  // 3초 안에 연결되지 않으면 알려 줍니다
  let connected = false;
  db.ref('.info/connected').on('value', function (s) { if (s.val() === true) connected = true; });
  setTimeout(function () {
    if (!connected) banner('Firebase 에 연결되지 않았습니다', [
      'databaseURL 이 맞는지, Realtime Database 를 만들었는지 확인해주세요.',
      '인터넷 연결이나 학교 방화벽 문제일 수도 있습니다.'
    ]);
  }, 3000);

  // 규칙 때문에 읽기가 막히면 바로 알려 줍니다 (기본 규칙은 30일 뒤 만료됩니다)
  db.ref('players').once('value').catch(function (e) {
    banner('Firebase 규칙에 막혀 저장이 안 됩니다', [
      '콘솔 > Realtime Database > 규칙 에서 read/write 를 true 로 바꿔주세요.',
      '(' + (e && e.message ? e.message : '권한 없음') + ')'
    ]);
  });
})();
