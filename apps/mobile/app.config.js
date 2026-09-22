const { expo } = require('./app.json');

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();

// Nitro 모듈은 설치만 해도 iOS CocoaPods에 자동 연결된다. OAuth 값이 없어도
// 플러그인을 적용해 필수 modular headers를 유지한다. 아래 scheme은 로그인 버튼이
// 숨겨진 환경에서만 쓰이는 빌드용 자리표시자다.
const googleReady = googleWebClientId && googleIosClientId && googleIosUrlScheme;
const iosUrlScheme = googleReady ? googleIosUrlScheme : 'com.googleusercontent.apps.costkeep-unconfigured';

module.exports = {
  ...expo,
  plugins: [...expo.plugins, ['react-native-nitro-google-signin', { iosUrlScheme }]],
};
