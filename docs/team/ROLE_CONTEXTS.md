# 역할별 학습 컨텍스트 계약

이 문서는 역할마다 어떤 학습을 받을 수 있는지 정의한다. 역할별 공식 제품 문서를 만들지 않으며,
공식 산출물·정책·테스트의 권위는 기존 단일 출처에 남는다.

## 활성 컨텍스트 레지스트리

모든 기존 route는 사람 activation 결정 `DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027`에 따라 A0로
등록했다. `context_hash`는 아래 `hash_algorithm`의 UTF-8 문자열을 SHA-256으로 계산한 식별자이며,
권한을 부여하지 않는다. 더 높은 단계는 별도 사람 Decision과 이 레지스트리의 새 version이 모두
있어야 효력이 생긴다.

<!-- role-context-registry:v1 -->
```json
{
  "schema_version": "1.0",
  "hash_algorithm": "sha256(context_id|version|route|autonomy_stage|decision_id|policy_hash)",
  "contexts": [
    { "context_id": "SOLAR-MASTER-ORCH", "version": 1, "route": "ORCHESTRATION", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "1e9f8217226fffc577e84198f323666ad8ac36fb7351b6150a4cdc17b203e96a" },
    { "context_id": "SOLAR-ORCH", "version": 1, "route": "ORCHESTRATION", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "cef6e53d5ee3b6321fce2bbffaf8ce38afd98c5107c35606cec3edffd46ce5e6" },
    { "context_id": "CONTEXT-STEWARD", "version": 1, "route": "STATUS_ONLY", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "9c0fcd11ad10e3a61e2c92e0007f96b721ce77c3802df8cd74424745709eaae4" },
    { "context_id": "SOLAR-PO", "version": 1, "route": "PRODUCT_POLICY", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "759acaf28d25a665b73a944adecfb2eb9b54cdf3a7983158f093b7f6ab371ca2" },
    { "context_id": "SOLAR-ARCH", "version": 1, "route": "ARCHITECTURE", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "3217c2ec4356ea59303742a931bd30f01a2e788c989b8bae4a4dba3a27d240e2" },
    { "context_id": "SOLAR-DEV-DB", "version": 1, "route": "IMPLEMENTATION", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "73de3b732054ab7bb486fdff59c74ee4f13606b204496c5e2c87899c7ae4bbb6" },
    { "context_id": "SOLAR-DEV-CORE", "version": 1, "route": "IMPLEMENTATION", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "6ef2e868554210b4231c98b321febc31c9abe0d98abfdab7a780c643b324008b" },
    { "context_id": "SOLAR-DEV-APP", "version": 1, "route": "IMPLEMENTATION", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "01146fbb5e77d2d47a2908239913c3c2f8eeb6b7b3d59554e8faf176e798ce39" },
    { "context_id": "SOLAR-DEV-INT", "version": 1, "route": "IMPLEMENTATION", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "d2cf95105ee3d2fbba5ac7d25cbe2975bf320900de73078003880794e623df7d" },
    { "context_id": "SOLAR-UX", "version": 1, "route": "UX", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "27a38c009ad4c6f2a0bf8fe9928be9461ea645ef999b21629f5a954c18276f47" },
    { "context_id": "SOLAR-OPS", "version": 1, "route": "OPERATIONS", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "8887326642dfd1f1e8bf841a33fa6407b25e017154abd89aee5df5edc737c482" },
    { "context_id": "CODEX-FUNCTION-QA", "version": 1, "route": "FUNCTIONAL_QA", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "5ee3a465195a5fbaaa136a19b7df23373e527d2932691a7345fcaeffd52671f4" },
    { "context_id": "CODEX-FIELD-QA", "version": 1, "route": "FIELD_QA", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "e61deebe641635629f06ba8901e9a4e1f0f131c7216ca914cc48c415483464dc" },
    { "context_id": "FABLE-SEC", "version": 1, "route": "SECURITY", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "b50c916c682a5d05b74082effaf201fbe7d3588c8c75ac3392abb60de1f1218c" },
    { "context_id": "FABLE-ARCH", "version": 1, "route": "ARCHITECTURE_REVIEW", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "3138317f194727a0a0cd98371a4e8b1a2e5e307f3b69a6107c800fe7c2b981c2" },
    { "context_id": "FABLE-STRATEGY", "version": 1, "route": "STRATEGY", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "5feb1f0cc3f51e1e42105e469c2495992b5c75122ae2dda7f768afa6882a816b" },
    { "context_id": "FABLE-FINAL", "version": 1, "route": "FINAL_INDEPENDENT", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "e3fd1a226660ed009c70c0a66d89cbfa2f97dbe989df9c57b50f4dc38c6c815b" },
    { "context_id": "OPUS-FALLBACK", "version": 1, "route": "FALLBACK_REVIEW", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "7647bfb98458561487c2e1d13256aa8b856ed529c627b1598843a28385e27257" },
    { "context_id": "OPUS-ADVISORY", "version": 1, "route": "ADVISORY", "autonomy_stage": "A0", "decision_id": "DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027", "effective_at": "2026-09-03T16:28:22+09:00", "policy_hash": "66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a", "context_hash": "dc2c30f86cf29711a536877deda3d93c75e4dcfb5af2e019470d9d914edd04ed" }
  ]
}
```
<!-- /role-context-registry:v1 -->

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
  비어 있어야 한다. 두 경로의 Task 요청·요구·사람 결정·필수 증거와 공동 장부 전체에도
  Learning ID·학습 요약을 넣지 않는다.
- predecessor가 있는 보안 후속 Task는 `VERIFIED` 적용·제외 ID 목록만 받을 수 있고 제외 사유를
  포함한 학습 요약 본문은 받지 않는다.

## 재사용 측정

학습을 적용한 작업이 끝나면 원본 장부 항목의 `reuse_count`, `outcomes`, `regressions`를 다음 전용
학습 검토에서 갱신한다. 해당 작업의 기능 커밋에 사후 자기평가를 끼워 넣지 않는다. 재사용 결과는
시험·Finding·결정·정확한 commit 또는 원격 check-run 증거로 연결한다.
