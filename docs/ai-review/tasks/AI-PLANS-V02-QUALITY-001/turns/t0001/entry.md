
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-AI-DEPUTY`
- reply_to_turn_id: `null`
- target_commit_sha: `77bcda26057f3b5ec037826bc338899ef621ab4c`
- changed_artifact_paths: `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 평가 사건 완전성·Learning 독립성·hold-out 오염 방지·route 한정 자율성·중대 사고 A0 강등·모든 검수 Fable 필수
- 집중 검토 질문: 지표 조작, 자기 Learning 검증, 자율성 월권, 축소 검수를 최종 closure로 오인하거나 fallback으로 Fable을 대체하는 Critical/Major 반례가 있는가? 최대 3개로 합친다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 70/70; `corepack pnpm verify --no-db` 4/6. 다른 문서 계약은 compact evidence에 target commit·blob·시험 hash로 결속했다.
- 사람 결정이 필요한 항목: 이 문서 PASS 뒤에도 온톨로지 closure·오케스트레이션·디렉터리·최종 네트워크 Fable 검수가 남는다.
- next_review_request: `FABLE_REVIEW`
