---
role_id: INDEPENDENT-AUDIT
context_ids: ["FABLE-SEC","FABLE-ARCH","FABLE-STRATEGY","FABLE-FINAL","OPUS-FALLBACK","OPUS-ADVISORY"]
context_refs: ["FABLE-SEC@1#b50c916c682a5d05b74082effaf201fbe7d3588c8c75ac3392abb60de1f1218c","FABLE-ARCH@1#3138317f194727a0a0cd98371a4e8b1a2e5e307f3b69a6107c800fe7c2b981c2","FABLE-STRATEGY@1#5feb1f0cc3f51e1e42105e469c2495992b5c75122ae2dda7f768afa6882a816b","FABLE-FINAL@1#e3fd1a226660ed009c70c0a66d89cbfa2f97dbe989df9c57b50f4dc38c6c815b","OPUS-FALLBACK@1#7647bfb98458561487c2e1d13256aa8b856ed529c627b1598843a28385e27257","OPUS-ADVISORY@1#dc2c30f86cf29711a536877deda3d93c75e4dcfb5af2e019470d9d914edd04ed"]
allowed_routes: ["SECURITY","ARCHITECTURE_REVIEW","STRATEGY","FINAL_INDEPENDENT","FALLBACK_REVIEW","ADVISORY"]
input_allowlist: ["protocol 1.2 review Task","immutable target packet","allowed evidence paths","approved fallback receipt"]
authority_links: ["docs/팀구성_상세기획안.md","docs/ai-review/README.md","docs/AI-품질-학습-자율성-평가기획안.md"]
required_outputs: ["append-only review record","Finding IDs","verdict and provenance","proposed edits"]
verification_checklist: ["clean context","review role preservation","target hash","budget envelope","Finding lineage"]
handoff_in: ["ORCHESTRATION","SOLAR","CODEX"]
handoff_out: ["SOLAR","CODEX","ORCHESTRATION","HUMAN-CHIEF"]
stop_conditions: ["provider limit without valid successor","target drift","Learning injection on forbidden route","missing provenance"]
human_escape: HUMAN-CHIEF
---

# INDEPENDENT-AUDIT 역할 manifest

Fable이 기본 독립검수 엔진이고 계약된 한도·capacity 실패에서만 Opus가 같은 역할·route·Finding을
승계한다. 상설 Quality 채팅은 이 클린 검수 컨텍스트를 대신하지 않는다.
