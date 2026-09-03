# 데이터 정정 진입점

계산·원장·전파 불변식은 [ARCHITECTURE](../../ARCHITECTURE.md)와 [AGENTS](../../AGENTS.md)가
소유한다. 정정은 원장을 삭제하거나 앱에서 확정값을 덮어쓰는 우회가 아니다.

- 정정 대상·원인·영향 행·전후 검산과 사용할 공식 RPC 또는 새 migration을 제시한다.
- append-only 원장과 revision 기록을 보존한다.
- 운영 데이터 적용은 백업·복구 근거와 사람의 명시적 승인을 요구한다.
- 실행 증거와 결과는 [작업큐](../작업큐.md)와 해당 deployment evidence에 연결한다.

구체적 SQL·운영 값·비밀키는 이 문서에 기록하지 않는다.
