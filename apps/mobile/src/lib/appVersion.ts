import appConfig from '../../app.json';

/** 서버의 구 앱 쓰기 차단에 전달하는 배포 판본. app.json과 별도 상수를 두지 않는다. */
export const APP_VERSION = appConfig.expo.version;

export const APP_VERSION_HEADER = 'x-margincook-app-version';
