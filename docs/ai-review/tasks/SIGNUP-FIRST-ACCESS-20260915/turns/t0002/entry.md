
## CODEX_EVIDENCE · turn-c001

- role: `CODEX-FUNCTION-QA`

최종 입력의 타입 검사와 가입·세션·입고 대상 시험 70/70이 통과했다. 기능정의서 자동 검사는
v2.2, FN 103, REL 100, SC 335, 상세 103/103, 로컬 링크 227을 확인했고 문서 그래프와
`git diff --check`도 통과했다. 직전 모바일 전수는 136파일 1,644통과·4제외, 웹 번들·터치 감사와
로컬 실제 Auth/RPC 6항목도 통과했다.

Fable r001 시도는 `PROVIDER_HARD_CAP_UNAVAILABLE`로 Claude 호출 전에 중단됐다. 검수 결과와
Finding이 없으므로 독립검수 완료로 판정하지 않는다. 전체 `verify`도 ③의 기존 three-surface 실패와
실행 중 범위 밖 고정비 migration 세 파일이 바뀐 ⑤ 때문에 전체 PASS가 아니다. 호스티드 Auth/메일,
법률 문서와 동의, 대상 빌드 smoke는 운영 조건으로 남아 있다.
