---
name: team-service-bootstrap
description: Initialize, diagnose, verify, migrate, or recover a portable project-declared Codex team service. Use for installing the 11-role team profile in another project or computer, checking capability tiers, producing no-send evidence, or rebuilding the bootstrap package after loss. Do not use it to send chat messages, activate Team Router, bind endpoints, deploy applications, or change databases.
---

# Team Service Bootstrap

Use the plugin root's `scripts/team-service.mjs`. Resolve the project root explicitly and start with a read-only
doctor. Never infer a higher capability tier from a configuration string.

## Required order

1. `doctor --project <root>` and retain its JSON output.
2. `init --project <root> --plan`; stop on `CONFLICT` or `MERGE_REQUIRED`.
3. `init --project <root> --apply`; it may create only absent files or accept byte-identical files.
4. `init-runtime --project <root>`; runtime stays outside Git under the current user's LocalAppData.
5. `dry-run --project <root>` and require zero provider calls.
6. `verify-install --project <root>` and report the sealed tier exactly.

Use `prepare-activation` only with an exact external human Decision and reviewed candidate envelope. It validates
but does not activate Router or send anything. Use `recover` when source, project files, or runtime are missing.

## Boundaries

- Do not create or modify `.codex/team-router`, `.codex/mission-relay`, account continuity state, DB, Supabase,
  application code, branches, deployments, provider endpoints, or raw conversations.
- `LOCAL_CORE_ONLY` means deterministic local contracts only.
- `COOPERATIVE_OBSERVED` is not authenticated delivery.
- `AUTHENTICATED` requires host-provided evidence; project configuration cannot promote it.
- Missing or drifted evidence fails closed. Never call a no-send test a live service test.
