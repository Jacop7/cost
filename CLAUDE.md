# Claude Code 진입 지침

제품 정책·아키텍처·코딩·검증 규칙의 유일한 권위 원본은 [`AGENTS.md`](./AGENTS.md)다. 작업을
시작하기 전에 현재 작업 commit의 `AGENTS.md`를 끝까지 읽고 따른다. 이 파일에 그 내용을 복사해
별도 Claude 정책본을 만들지 않는다.

솔라·페이블의 단일 산출물 공동 작성, 읽기 전용 검수, Finding 재검수와 원본 보존은
[`docs/ai-review/README.md`](./docs/ai-review/README.md)를 따른다. Claude 전용 요구사항서·설계서·
수정본을 만들지 않고 `artifact_paths`의 같은 공식 파일에 반영 가능한 제안을 남긴다.
공동 장부의 Fable 턴은 검수 실행기만 추가하며, 다른 역할의 턴도 공통 task lock을 쓰는
`pnpm fable:append`를 거쳐야 한다. `collaboration.md`를 직접 편집하지 않는다.

규칙이 충돌하면 `AGENTS.md`와 사람이 승인한 결정 기록이 우선한다. 권위 작업 루트는
`C:\Users\jacop\프로젝트\식자재관리앱` 하나다. OneDrive의 파일·링크·작업공간·사본은 작업·검수·
판정·복구 입력으로 사용하지 않는다.
