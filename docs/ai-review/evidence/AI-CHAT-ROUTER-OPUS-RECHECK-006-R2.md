# Team Router Opus 독립 재검수 006-R2

> 대상: Opus 006의 즉시 차단 Finding 5건 수정본
>
> 검수: Claude Opus, read-only, medium effort
>
> 결과: `PASS` — blocking Finding 0건

## 확인된 수정

1. active envelope에 `project_id`를 포함하고 수신 prompt가 project ID와 canonical root의 runtime 대조를
   요구한다.
2. 경로 불가·미등록·불일치·root record 손상·policy/hash 실패가 모두 `ROUTE_REJECTED` root 사유로 닫힌다.
3. canonical root binding은 현재 활성 Decision과 receipt 검증을 통과한 policy에만 결속된다.
4. `canonical-root.json`은 reparse 방지와 strict schema를 통과해야 한다.
5. 새 dispatch를 열 수 없는 unsealed 상태에서도 기존 `SENT_UNCONFIRMED` route는 delivery/rejection
   terminal audit event로 닫을 수 있다.

Opus는 38개 unit test 통과를 직접 확인했다. 추가 regression test 확대와 사용하지 않는
`record-delivery`/`record-rejection`의 `--project-root` 인자는 비차단 후속 개선으로 분리한다.
