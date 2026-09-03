# `<TASK-ID>`

```yaml
task_id: <TASK-ID>
objective: <one outcome>
risk_level: R0 | R1 | R2 | R3
target_commit_sha: <40-hex SHA>
artifact_paths: [<owned paths>]
excluded_paths: [<user-owned or out-of-scope paths>]
required_checks: [<deterministic commands>]
independent_review: <engine and packet boundary>
human_decisions: [<required decision IDs>]
stop_conditions: [<conditions that require handoff or human input>]
```

Task가 범위를 넓히거나 대상 SHA를 바꾸면 새 Decision과 새 검수 패킷을 만든다.
