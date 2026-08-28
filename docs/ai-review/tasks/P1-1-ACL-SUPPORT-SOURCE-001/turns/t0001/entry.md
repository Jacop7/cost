
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- finding_ids: `P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED`, `P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED`, `P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION`
- disposition: `APPLIED`
- 적용 내용: fresh DB의 10개 보안 사후조건을 정확한 값으로 단언하고 migrations는 0 또는 2만 허용했다. 기존 P0-5 부채는 `ledger_write_paths<=32`, `unapproved_authenticated_rpc<=87`로 증가만 차단하고 축소는 허용한다. 동적 `.rpc(name)`은 파일·줄과 함께 실패시키며 치환 없는 템플릿 리터럴은 수집한다. 비-mobile 예외는 허용 목록의 부분집합이어야 하고 허용 시그니처 0건·잘못된 컨테이너 이름도 실패한다.
- 증거 보강: r003 Improvement 원문은 predecessor review 경로에 보존되어 있고, 이번 공동 장부에 실패 경로 사보타주와 전체 verify 결과를 연결한다.
- 사람 결정 유지: 실제 호스티드 audit와 32/87 권한 축소는 별도 P0-5 R3 승인 범위다. 이번 변경은 회귀가 부채를 늘리지 못하게 봉인할 뿐 권한을 자동 변경하지 않는다.
- next_review_request: `CODEX_EVIDENCE`
