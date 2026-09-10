// Firebase 프로젝트 설정
// Firebase 콘솔(console.firebase.google.com) > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성
// 에서 아래 값들을 복사해서 그대로 바꿔넣으세요.

const firebaseConfig = {
  apiKey: "AIzaSyA95pJwc-X2AyXq3XU_1CAPyu755U5AERk",
  authDomain: "arcadegame-25262.firebaseapp.com",
  databaseURL: "https://arcadegame-25262-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "arcadegame-25262",
  storageBucket: "arcadegame-25262.firebasestorage.app",
  messagingSenderId: "171893226218",
  appId: "1:171893226218:web:75c3daf40a8be1078cf593"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
