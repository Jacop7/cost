# INTL-LAUNCH-PLANNING-001 공동 작업 장부

> 이 장부는 한국·미국·영국·호주·캐나다 동시 출시를 위한 언어·통화·세금·브랜치·DB·서버
> 개정판을 검수하는 append-only 기록이다. 비-Fable 턴은
> `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `99cd21f272d08465e91b685b80989a04a0c5d6af`
- changed_artifact_paths: `ARCHITECTURE.md`, `README.md`, `apps/mobile/src/features/README.md`, `docs/prototypes/international-tax-settings.html`, `docs/국가-통화-세금-국제출시-기획안.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: `INTL-REQ-001..011`, DB RPC 계산 권위, 시점 스냅샷, 전진 migration, 현재 구현과 계획 상태 분리
- 이번에 바꾼 내용: 1차 출시 국가를 한국·미국·영국·호주·캐나다, 언어를 한국어·영어로 확정하고 국가·업무 로케일·통화·시간대·세금 관할을 분리했다. 국가별 기본세 명칭·법정 세율·판매가 포함 여부와 각 추가세의 계산 기준을 정의했으며, 수식·스냅샷·DB 전진 적용·서버 확장 보류·검증 행렬을 공식 문서에 연결했다. 프로토타입도 같은 입력 구조와 용어로 맞췄다.
- 집중 검토 질문: 다섯 국가 공통 계약이 실제로 하나의 타입·DB 모델로 구현 가능한가? 기본세 포함·미포함과 추가세별 기준 수식에 이중 과세·누락 가능성이 없는가? 현재 0090 계약과 차기 INTL-1 계획이 명확히 분리됐는가? 브랜치·DB·서버·화면·작업큐 문서 사이에 구현 상태 또는 배포 순서 모순이 없는가? 국가별 세무 책임을 제품 자동 판정으로 오인할 표현이 남았는가?
- 실행한 테스트·현재 증거: 로컬 Markdown 링크 확인, 프로토타입 스크립트 문법 확인, `git diff --check` 통과. 문서·프로토타입 전용 변경이라 제품 전체 `corepack pnpm verify`는 실행하지 않았다. 검수 실행기 자체시험과 Claude 연결 확인은 별도로 통과했다.
- 사람 결정이 필요한 항목: 국가·지역별 실제 세율과 신고 규칙은 출시 전 공식 기관·현지 전문가 확인이 필요하며, 이번 문서는 자동 세무 판정이나 신고 대행을 확정하지 않는다.
- applied_learning_ids: 없음
- excluded_learning_ids: `LRN-ORCH-CI-001`, `LRN-CODEX-TIME-001`, `LRN-OPS-BACKUP-001`, `LRN-AUDIT-PIN-001`(각 제외 사유는 task.json에 봉인)
- next_review_request: `FABLE_REVIEW`
