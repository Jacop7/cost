# HANDOFF `<TASK-ID>` v<N>

- source_commit_sha: `<40-hex SHA>`
- task_snapshot_hash: `<SHA-256>`
- completed: `<checks and exact evidence pointers>`
- open_findings: `<IDs or none>`
- next_safe_action: `<one bounded action>`
- excluded_paths: `<user-owned paths>`

대화 원문, 실제 thread ID, 계정 식별자, credential은 넣지 않는다. 이전 HANDOFF를 수정하지 않고 새
판본으로 append한다.
