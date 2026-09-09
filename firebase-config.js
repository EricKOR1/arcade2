// Firebase 프로젝트 설정
// Firebase 콘솔(console.firebase.google.com) > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성
// 에서 아래 값들을 복사해서 그대로 바꿔넣으세요.

const firebaseConfig = {
  apiKey: "여기에_API_KEY",
  authDomain: "여기에_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://여기에_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "여기에_PROJECT_ID",
  storageBucket: "여기에_PROJECT_ID.appspot.com",
  messagingSenderId: "여기에_SENDER_ID",
  appId: "여기에_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
