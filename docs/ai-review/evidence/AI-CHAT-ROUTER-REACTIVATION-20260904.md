# AI Chat Router Reactivation Decision — 2026-09-04

- Decision: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- Scope: non-production chat messages only; human relay, database mutation, deployment mutation, and production routes remain disabled.
- Current design SHA-256: `02666df012569cfaf895f790713ee934f328e9ea5f697db7bb83f2dc790e072b`
- Model plan SHA-256: `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e`

The human authorized reactivation with: “현재 권위 문서 기준의 비운영 채팅 자동 라우팅 재활성화를 승인합니다”.
This amends the existing non-production activation decision after the design document bytes changed. It does not broaden the approved scope.

## Rebinding prerequisites and validation

- Policy SHA-256: `15aad51c68927075f8d54fdbdba043bde9c50db5bb7af866c040e7ed0ccb787e`
- Activation decision SHA-256: `d066abab56cf851965ef155368e35e3077c942d6daabeca51a72012c4ef00327`
- Validation by `CODEX-FUNCTION-QA` at `2026-09-04T13:42:00+09:00`: `validate-policy` returned `POLICY_VALID` with `ACTIVE_DISPATCH`; `validate-manifests` returned `MANIFESTS_VALID` with 11 chats and 21 edges; Router unit and sabotage tests were 38/38 PASS.

This reseal binds scope and current hashes only. Actual dispatch remains fail-closed until both subsequent gates are recorded: all 11 relocated logical-chat endpoints are rebound against the current installed implementation, and one `child_routes_allowed=false` ACK-only pilot records zero additional routes. No endpoint rebind or ACK pilot authorizes product, database, Supabase, git, staging, production, secret, deployment, human-relay, or automatic-new-chat mutation.
