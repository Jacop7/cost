# 역할별 학습 컨텍스트 계약

이 문서는 역할마다 어떤 학습을 받을 수 있는지 정의한다. 역할별 공식 제품 문서를 만들지 않으며,
공식 산출물·정책·테스트의 권위는 기존 단일 출처에 남는다.

| 레인 | 받을 수 있는 학습 | 금지 |
|---|---|---|
| `ORCHESTRATION` | 작업 분해, 인계, exact-SHA 게이트, 복구 순서 | 제품 정책을 학습 장부만으로 변경 |
| `SOLAR` | 같은 도메인·도구 범위의 검증된 제작 체크리스트 | 독립 감사 결론을 정답으로 미리 제공 |
| `CODEX` | fixture, 판별력, 회귀·현장 증거 수집 규칙 | 개발자의 의도나 자기평가를 검증 증거로 사용 |
| `INDEPENDENT-AUDIT` | 후속 보안 재검수에는 `VERIFIED` ID 목록만 | 최종 독립 감사 전체와 최초 보안 감사에 ID·요약 주입 |
| `OPERATIONS` | 릴리스, 백업, 복구, 관측 체크리스트 | 로컬 성공을 운영 준비 완료로 확대 |

## Task Packet

학습 장부가 대상 commit에 존재하는 신규 protocol 1.2 Task는 다음 필드를 모두 가진다.

```json
{
  "applied_learning_ids": ["LRN-ORCH-CI-001"],
  "excluded_learning_ids": [
    { "learning_id": "LRN-AUDIT-PIN-001", "reason": "CANDIDATE이며 현재 범위 밖" }
  ]
}
```

- 적용 ID는 장부에서 `VERIFIED`이고, target commit 날짜와 실행 UTC 날짜 중 늦은 날짜를 기준으로
  `review_by`가 지나지 않아야 한다.
- 적용·제외 ID는 모두 장부에 있어야 하고 서로 겹칠 수 없다.
- 상호 충돌 ID를 함께 적용하지 않는다.
- baseline과 target 사이에 `TEAM_LEARNING.md`가 바뀌면 그 파일을 Task의 `artifact_paths` 또는
  `reference_paths`에 포함한다. 장부 최초 도입은 `artifact_paths`에 포함해야 하며, 같은 commit에서
  바뀐 학습 항목은 그 Task에 적용할 수 없다. manifest는 target 장부 blob·내용 hash와 적용 집합
  hash를 봉인한다.
- protocol 1.1과 TEAM-LEARNING-1 이전 protocol 1.2 Task는 당시 원본으로 보존한다.
- `FINAL_INDEPENDENT` 모든 Task와 predecessor가 없는 최초 `SECURITY` Task는 두 배열이 모두
  비어 있어야 한다. 최종 독립 감사의 요청·요구·사람 결정·필수 증거와 두 경로의 공동 장부 전체에도
  Learning ID·학습 요약을 넣지 않는다.
- predecessor가 있는 보안 후속 Task는 `VERIFIED` 적용·제외 ID 목록만 받을 수 있고 제외 사유를
  포함한 학습 요약 본문은 받지 않는다.

## 재사용 측정

학습을 적용한 작업이 끝나면 원본 장부 항목의 `reuse_count`, `outcomes`, `regressions`를 다음 전용
학습 검토에서 갱신한다. 해당 작업의 기능 커밋에 사후 자기평가를 끼워 넣지 않는다. 재사용 결과는
시험·Finding·결정·정확한 commit 또는 원격 check-run 증거로 연결한다.
