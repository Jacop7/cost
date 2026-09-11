# 식재료·레시피·UI 재부팅 체크포인트

2026-09-11 23:12 KST 사용자 요청으로 작업 중 상태를 브랜치에 보존한다. **WIP이며 main 병합·운영 배포 후보 완료 판정이 아니다.**

- 브랜치: codex/domain-followup-20260911. 직전 커밋 6cd987bb626af817a2c3827f345bf375888a8c50은 식재료 상세 누락 시 이력 표시/취소 차단 3파일이며 총괄 관련33시험 재실행 통과 후 푸시했다.
- 실제 운영 제품은 7585b16dfbbc7d071c20b394c9c0a844d89a91d9 그대로다. 기존 배포 영수증 참조.
- 레시피 batch1: 현재 판매가 서버 one/batch 손익 표시 및 재조회 후 인분 선택 보존은 자체 코드검수와 관련53시험 재실행 통과했다.
- 레시피 batch2: 현재 snapshot을 헤더/상단/하단에서 재사용하고 국제 도넛·통화와 미확인 금액을 표현하는 변경은 작성 중이다. 항목별 snapshot 계약 및 미확인 UX 제안·회귀 검증이 남았다. batch1 시험은 batch2 완료 증거가 아니다.
- UI: MY 국제 세금 화면 분리, 공통 세금 요약, 레시피 세금 경로 및 AppMap/문서 동기화 변경을 현 상태로 보존한다. 총괄 최종 검수 전이다.
- 저장 시 전체 mobile typecheck와 git diff --check는 통과했다. 전체 verify·실기기·독립검수·새 SHA CI 성공을 주장하지 않는다.
- .codex/REBOOT-RESUME-LATEST.md와 각 담당 REBOOT-RESUME-20260911-SECOND.md가 로컬 재개 지점이다. 미커밋·신규 소스 snapshot 및 Docker 상태는 .codex/reboot-checkpoints 아래 보존한다. 민감한 DB dump/백업은 Git에 포함하지 않는다.
- 재개: 현재 브랜치/HEAD 확인 → Docker 및 기존 개발 서버 상태 확인 → 각 담당 남은 시험/Findings 확인 → 수정과 검수 → 필수 CI 후 통합. 저장용 WIP를 바로 main/운영에 적용하지 않는다.
