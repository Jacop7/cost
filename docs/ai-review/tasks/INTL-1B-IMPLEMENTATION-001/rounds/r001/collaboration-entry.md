
<!-- fable-review:r001 sha256=7d073b300b12971b70b638e1a3c5d407f9329db4845bd197e54a3ac8d603a47d -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `7d073b300b12971b70b638e1a3c5d407f9329db4845bd197e54a3ac8d603a47d`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- input_files_sha256: `92e489beaf1c066ed289493fadb5854279465ba912a31cd8a349a194d10dce24`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: INTL1B-EVENTS-CASCADE-PURGE-CONFLICT, INTL1B-PROFILE-REVISION-MUTABILITY, INTL1B-TEST-CROSS-STORE-GAP
- 선택 미종결 Finding: INTL1B-MINORUNIT-DUAL-SOURCE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

0179 스키마는 INTL-1B 요구 구조를 충실히 구현했다. 시장·세금 프로필의 매장 경계(복합 FK id+store_id)·적용 구간 비중첩(advisory lock+trigger)·5개국 국가·통화·업무 로케일 조합 check, 기본세 1개 제약, 카테고리/override 배타 저장, 항목×채널 납부 주체, snapshot 원본 등식 guard, append-only 이벤트 원장, 앱 롤 직접 권한 0건과 capability 비활성, 0090 tax_of 불변 사후조건을 확인했다. DB enum 11종과 TypeScript 상수의 값·순서 parity, 시험 38, upgrade 시나리오 ⑮의 전후 불변 판별, ACL 감사의 원장 13종 목록 확장, RPC 허용 목록 66 불변, 문서의 게이트 미완 명시(INTL-1B-008 충족)도 확인했다. 그러나 두 가지 Major 틈이 있다. (1) sales_tax_events는 stores·daily_sales_items를 on delete cascade로 참조하는데 cascade 삭제도 행 단위 BEFORE DELETE 트리거를 발화시켜 42501로 중단되므로, 이벤트가 쌓인 뒤에는 공식 보존 정책 문인 purge_archived_store와 판매행 삭제 경로가 영구 실패할 수 있다. 공식 삭제 의미론을 스키마 단계에서 결정·시험해야 한다. (2) 프로필·구성 항목 내용을 revision 변경 없이 UPDATE하는 것을 막는 장치가 없어 (profile_id, revision)이 내용을 유일하게 식별하지 못하고, snapshot 원본 등식 guard와 INTL-1B-001/002의 revision 보존 주장이 무력화될 수 있다. 시장 프로필 기간 축소 시 내부 세금 프로필 재검증도 없다. 추가로 required_evidence가 약속한 교차 매장 차단을 시험 38이 직접 재지 않는 Minor TEST_GAP과, guard의 minor_unit 매핑(KRW=0, 그 외 2)이 LAUNCH_MARKETS.minorUnit과 이중 소스인데 parity 시험이 대조하지 않는 Improvement가 있다. 제안 편집 3건(내용 불변 guard, 삭제 의미론 결정 주석, 교차 매장 raises 시험)을 첨부했다.

### 공동 편집 제안 색인

- E1-PROFILE-VERSION-IMMUTABLE: ADD `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql` · for each row execute function public.guard_tax_profile_range(); · 원문은 review.md 참조
- E2-EVENTS-DELETE-SEMANTICS-DECISION: COMMENT `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql` · create trigger sales_tax_events_immutable_truncate · 원문은 review.md 참조
- E3-CROSS-STORE-RAISES: ADD `packages/db/tests/38_international_tax_schema.sql` · do $rls$ · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
