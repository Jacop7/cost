/** 폰트 등 정적 에셋 모듈 — Metro 가 require/import 시 에셋 id(number) 반환. */
declare module '*.otf' {
  const src: number;
  export default src;
}
declare module '*.ttf' {
  const src: number;
  export default src;
}
