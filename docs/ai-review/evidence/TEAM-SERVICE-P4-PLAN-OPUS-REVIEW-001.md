# TEAM-SERVICE-P4-PLAN-OPUS-REVIEW-001

- reviewer: Claude Opus 5 high, direct Cowork advisory
- candidate: `docs/ai-review/evidence/TEAM-SERVICE-P4-PLAN-REVIEW-CANDIDATE-001.json`
- candidate SHA-256: `a64f76da6f7a577a56b8ac5541928f7b22c00049be072cf6cd7472165c8f8da7`
- reviewed commit: `3f3bb3a`
- mode: read-only; no test rerun, file edit, provider call, or team-chat send
- formal CLI receipt: false

## Verdict

`CHANGES_REQUIRED`

- `p4_admission_prework_may_continue: false`
- `p4_implementation_may_begin: false`
- `service_ready: false`
- `real_send_authorized: false`

## Blocking findings

### B-1 — P4 gate and STORE_DRIVER profile do not bind the standalone ACL path

The P4 contract correctly separates ACL evidence from full stage-3 completion,
but `service-flow-acceptance.json` does not yet bind the standalone command,
the `ACL_NEGATIVE_UNVERIFIED` result, the eleven planned targets, AC-23 evidence
source, or the P4 negative-evidence and completion-rerun rules.

### B-2 — required AC-09 and AC-12 boundaries are incomplete

- AC-09-A02 lacks a stale DAG boundary and its division of responsibility from
  P5 AC-04/AC-08.
- AC-12-A04 lacks canonical NFC/key collision handling.
- AC-12-A05 lacks non-string identifier rejection.

The existing canonical interpreter should be reused rather than duplicated.

### B-3 — no P4-specific human authority exists

The active P3 completion decision explicitly forbids P4 prework and
implementation. A successor decision must authorize only the named P4
PLAN_TEST files before a model-scope candidate or AC-24 entry harness may be
prepared. That decision still must not authorize implementation or send.

## Nonblocking findings

1. Map `ACL_NEGATIVE_UNVERIFIED` to an allowed execution status and never to a
   passing skip.
2. Changing the shared P3 local runner would impair current bundle
   reproducibility; preserve it or record a successor-runner disposition.
3. Define the relation between the P4 runner and the P3 local runner.
4. Pin raw TAP for the next plan-test review candidate.
5. Future implementation tests must exercise source behavior rather than only
   restating the contract JSON.
6. The P3 decision timestamp is later than its commit timestamp; preserve the
   historical file and supersede it instead of rewriting evidence.
7. P4 should have explicit phase-specific human wording because it introduces
   the first persistent store and OS ACL work.

## Positive findings

The AC-23 fail-closed design is correct: an enabled account name is not proof
of another usable OS token; without an actual other non-admin token execution,
the result remains `ACL_NEGATIVE_UNVERIFIED`. Account creation, password
collection, and administrator/SYSTEM cryptographic-isolation claims remain
forbidden.
