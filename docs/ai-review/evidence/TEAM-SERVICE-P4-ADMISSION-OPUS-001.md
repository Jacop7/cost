# TEAM-SERVICE-P4-ADMISSION-OPUS-001

- reviewer: Claude Opus 5 high, direct Cowork advisory
- request packet: `docs/ai-review/evidence/TEAM-SERVICE-P4-ADMISSION-REVIEW-CANDIDATE-001.json`
- request packet SHA-256: `d526edb816a65975bf05747083c9c1b7181aa58cfc1521cb664481967d21ec79`
- reviewed commit: `4137570`
- mode: read-only advisory; no repository edit or test execution by the reviewer
- formal CLI receipt: false

## Verdict

`CHANGES_REQUIRED`

- P4 admission prework may continue only to correct the listed findings.
- P4 implementation may not begin.
- Real message dispatch remains unauthorized.
- Service readiness remains false.

## Blocking findings

### P4-B1 — candidate sidecar was not clean-checkout reproducible

The sidecar pinned a worktree CRLF byte hash while the committed candidate blob
uses LF. The evidence therefore could not be reproduced from a clean checkout.

### P4-B2 — the actual candidate path lacked exact owner authority

The effective candidate is named
`.codex/mission-relay/candidates/team-service-p4-admission-009.json` with its
sidecar, while the owner decision allowed the different
`team-service-local-core-009.*` paths. The admission candidate therefore lacked
an exact allowed-path binding.

## Nonblocking findings

1. The zero dispatch/provider counters are structural observations, not runtime
   execution evidence; record `STRUCTURAL_NO_RUNTIME_MODULE_EXECUTED` and require
   real capability-denial evidence at completion.
2. Candidate 009 intentionally omits stages 1–16 and top-level policy from the
   canonical plan; record that this is a scoped successor rather than an
   accidental loss.
3. Derive and validate the missing future-implementation path count instead of
   relying on a literal constant.
4. Rename `bundle_commit` because it identifies the authority baseline rather
   than the bundle's own commit.
5. A later P4 implementation decision must use an unambiguous human sentence;
   generic continuation language is insufficient.

## Disposition target

The next delta review must verify P4-B1 and P4-B2 against committed bytes and
confirm the handling of nonblocking findings 1–4. Finding 5 remains a future
human-decision requirement and is not closed by this prework.

