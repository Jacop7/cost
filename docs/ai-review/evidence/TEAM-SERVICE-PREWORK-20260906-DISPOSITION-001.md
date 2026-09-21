# 2026-09-06 남은 선작업: 실제 전체 검증 및 실패 처분 후보

## 범위와 판정

HEAD `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076`의 dirty 작업본. 제품 구현·DB 수정·운영·Router 활성화·팀 전송은 수행하지 않았다. 기존 사용자 변경을 stage/commit/stash/reset하지 않았다.
전체 검증 **4/6, exit 1**. 이 숫자는 6/6 PASS나 LC-ADMISSION 승인이 아니다. 아래 처분은 독립 자문 재확인 대상이다.

실행 원본: `TEAM-SERVICE-VERIFY-PREWORK-20260906-001.json`
SHA `f63c0e117cc609ad14a257d8d689286a0bbd3f4ba38996c636bed88b4e5412b9`.
2026-09-05T20:02:33.390Z ~ 20:34:27.535Z, Node/플랫폼/명령/HEAD/dirty/591개 입력 hash/전후 비교/출력/단계/exit 포함.
HEAD 동일, 인벤토리 내 drift 0, 출력 U+FFFD 0. 출력은 디코딩된 텍스트 보존이지 OS 원시 바이트나 provider attestation이 아니다.

| 단계 | 실제 결과 |
| --- | --- |
| ① 타입 | PASS |
| ② pnpm -r test | FAIL: 기존 개발 DB 43/50 |
| ③ CLI/ACL/색 대비/문서 | FAIL: 색 대비 결정 커밋 3개가 HEAD 조상 아님; 이후 항목은 이 run에서 미도달 |
| ④ 새 DB | PASS: migration 전체, DB 50/50, ACL, 두 세션 경합, locale/international live DB parity |
| ⑤ 업그레이드 | PASS: 실제 동기 실행·23/23, 1761.3초 |
| ⑥ 웹 번들 | PASS |

보충 기계 검사 `TEAM-SERVICE-PREWORK-20260906-CHECKS-001.json`: 로컬 명세/무발송/셸 55/55, 문서 그래프 PASS, ACL mock 보안 PASS, core194 PASS+12SKIP/mobile233 PASS. 보충 결과는 전체 run의 미도달 항목을 소급 PASS로 만들지 않는다. core/mobile 도구 출력 일부는 잘렸으며 CHECKS가 명시한다.

## 실패의 영향 분리·담당·재검증

| ID | 처분 | 로컬 C1/C2 경계와의 관계 | 담당·재검증 |
| --- | --- | --- | --- |
| VERIFY-V07-SHELL | 수정 및 실제 재현 검증 완료 후보 | verify의 실행 도구 경계. PowerShell/비Bash를 거부하고 marker+exit37로 실제 Bash를 선택. 실제 자식 완료/nonzero exit 회귀 포함 6/6. 이번 ④⑤ 실제 하위 시험 PASS. | Operations+Quality: 같은 frozen helper/verify SHA에 대한 선검수 통과; 최종 후속 자문 확인. 이전 V07 성공 오표기 기록은 불변 보존. |
| VERIFY-PREWORK-DB | KNOWN_OPEN_NOT_WAIVED | C1/C2는 순수 workflow의 ID 타입/event hash뿐이며 DB 호출 없음. AC24 closure와 deny fs/fetch 시험으로 무발송 경계를 따로 확인. DB 상품/금액/설정 정확성은 미해결이며 제품 전체 승인에 사용 불가. | Data+Quality: 개발 DB fixture·적용 migration·국제 세금 상태와 fresh 비교, 7실패 재현 및 권위 계약 검토 후 별도 수정/재시험. DB reset·예상값 하향·legacy 수치 일괄치환 금지. |
| VERIFY-PREWORK-DESIGN | KNOWN_OPEN_NOT_WAIVED | 디자인/승인 계보 실패이며 C1/C2의 runtime import closure에 디자인 gate/토큰 없음. 다만 전체 verify는 FAIL 유지. | Product/Mobile 디자인 토큰 트랙+Quality: 정확한 승인 커밋 계보·pin을 정리한 동일 SHA에서 gate 재실행. ancestry 검사 삭제·무관한 커밋 병합으로 우회 금지. |
| VERIFY-PREWORK-INVENTORY | PARTIAL_INVENTORY_EXPLICIT_NOT_WAIVED | 591개 안의 코드/fixture 및 canonical 모델은 전후 동일. 그러나 전체 docs/** 및 .codex/team-router 변경 부재를 이 실행만으로 증명하지 못함. 로컬 변경과 분리 가능 여부는 독립 검토 대상. | Quality: 다음 admission 소비 전에 필요한 누락 입력을 포함한 snapshot 또는 좁은 경계 재현 검증을 별도 수행. 이번 원본에 사후 hash를 실행 전 hash로 덧씌우지 않음. |

개발 DB 실패 파일:
- 01_checksums.sql, 14_volume_weighted.sql: expected4046.69 / actual4046.60.
- 08_write_paths.sql, 22_revision_and_close.sql, 27_amend_ended_day.sql: 국제 세금 활성 뒤 기타매출 channel 필요.
- 17_profit_history.sql: 재료비 증가에 따른 이익 증감 assertion.
- 28_past_edit_round_trip.sql: 판매 기록 전제 불충족.

AGENTS/ARCHITECTURE의 현재 권위 금액은4046.60이나 fresh의 legacy 회귀는4046.6909로 통과한다. 따라서 7건 전체를 단순 낡은 기대값 오류라고 단정하지 않는다. DB 상태·세금 활성 경계·fixture 차이 조사가 필요하다.
디자인 오류 커밋: `f351058f30aa`, `9ffba3176f11`, `0d9f437782d6`.
실패의 담당은 역할 책임 표기이며 실제 팀 라우팅/수신 ACK를 주장하지 않는다.

## 페이블 S-1~S-5 반영

- S-1: 원본 후보001 보존. 후보002에 CLI `compute_budget` 소스 SHA·함수·규칙 인용. `MODEL_BUDGET_VALID`는 validate_plan+가중 합계 계산 가능성이지 상한≤잔여나 지출/경제성 승인이 아니다. 869280 > 292280을 숨기지 않으며 rollover 금지. `verify_plan`은 계산된 값과의 동등성 검사.
- S-2: 후보002에 stage14/D-FABLE-SOFTCAP/exact human pin 우선 명문화. 기존 budgetGuard 위임/봉투/잔액은 역사이며 신규 유료 호출 승인으로 재사용하지 않는다.
- S-3: 실행 중 capture 소스를 바꾸지 않았다. 이 문서 및 companion JSON에 `inventory_scope_partial: true`, 누락 범위 명시. 기존 run이 전체 입력을 봉인했다고 주장하지 않음.
- S-4: 후보002 input_refs의 계획·ADMISSION bundle에 실제 SHA 결속.
- S-5: verify.mjs에 기존 다른 작업의 setup-doctor/contrast 변경이 있음을 보존. 이번 셸 변경만 추후 선택적 commit 대상으로 하며 일괄 stage/commit하지 않았다. 디자인 실패는 디자인 트랙에 귀속.

## 정리와 남은 gate

러너가 사용한 `fresh_verify_32332_mtot89k6`, `fresh_upgrade_check_7516_28313`는 종료 뒤 pg_database 읽기 조회에서 둘 다 부재. 러너가 제거한 재생 가능한 일회용 DB만 해당하며 개발 DB를 reset하지 않았다.

후보002 `.codex/mission-relay/candidates/team-service-local-core-002.json`:
SHA `bd8575aca310dd4f2d1267412b8c7ac598b029c6d22c3efd25c913ae3cd00f15`, SEALED + MODEL_PLAN_VERIFIED. canonical 모델 `60d7cb6a…`와 기존 activation receipt는 무변경. 로컬 후보 봉인은 canonical 전환/구현 입장/경제성 결정이 아니다.

LC-ADMISSION은 아직 닫지 않는다. 남은 것은 **이 정확한 로컬 모델·명세/번들·실패 영향 분리의 독립 판단 및 필요한 동일 SHA gate 소비**다. P7 typed formal/유료 exact round 승인은 별도 미통과이며 Cowork 자문으로 대체하지 않는다. 무관한 P7/host 긍정 판정을 로컬 prework 자체의 선행조건으로 새로 만들지도 않는다.

