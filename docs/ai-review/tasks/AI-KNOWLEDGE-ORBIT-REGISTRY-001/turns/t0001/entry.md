
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `196f60c22b68daa9419991081b2fb8d1c64eeea0`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`
- 충족해야 할 요구사항·불변식: 단일 공식 권위, 사람 승인 경계, 최소 node·edge registry, 요청 판정 enum 단일 권위
- 집중 검토 질문: HANDOFF·ROLE_CONTEXT·RELEASE와 HANDOFF_TO는 최소 어휘인가? 기각한 파생 관계가 필요한 저장 관계는 아닌가? 팀 역할과 ontology owner가 경쟁 권위를 만드는가?
- 실행한 테스트·현재 증거: 문서망 시뮬레이션 65/65. 압축 증거에 source blob과 node·edge 사보타주 결과를 결속했다.
- 사람 결정이 필요한 항목: Fable 외부 호출 시점과 별도 회차 상한. 승인 전에는 실행하지 않는다.
- next_review_request: `HUMAN_DECISION`
