/** 하단 탭은 각 도메인의 메인 화면에만 표시한다. 상세·작성·하위 설정은 뒤로가기로 복귀한다. */
export function isTabRootPath(pathname: string): boolean {
  return /^\/(ingredients|recipes|orders|sales|my)\/?$/.test(pathname);
}
