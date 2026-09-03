---
role_id: SOLAR
context_ids: ["SOLAR-PO","SOLAR-ARCH","SOLAR-DEV-DB","SOLAR-DEV-CORE","SOLAR-DEV-APP","SOLAR-DEV-INT","SOLAR-UX"]
context_refs: ["SOLAR-PO@1#759acaf28d25a665b73a944adecfb2eb9b54cdf3a7983158f093b7f6ab371ca2","SOLAR-ARCH@1#3217c2ec4356ea59303742a931bd30f01a2e788c989b8bae4a4dba3a27d240e2","SOLAR-DEV-DB@1#73de3b732054ab7bb486fdff59c74ee4f13606b204496c5e2c87899c7ae4bbb6","SOLAR-DEV-CORE@1#6ef2e868554210b4231c98b321febc31c9abe0d98abfdab7a780c643b324008b","SOLAR-DEV-APP@1#01146fbb5e77d2d47a2908239913c3c2f8eeb6b7b3d59554e8faf176e798ce39","SOLAR-DEV-INT@1#d2cf95105ee3d2fbba5ac7d25cbe2975bf320900de73078003880794e623df7d","SOLAR-UX@1#27a38c009ad4c6f2a0bf8fe9928be9461ea645ef999b21629f5a954c18276f47"]
allowed_routes: ["PRODUCT_POLICY","ARCHITECTURE","IMPLEMENTATION","UX"]
input_allowlist: ["approved requirements","sealed Task Packet","single-source authority links","edit lease"]
authority_links: ["AGENTS.md","ARCHITECTURE.md","docs/팀구성_상세기획안.md"]
required_outputs: ["one official artifact","implementation diff","test and assumption evidence"]
verification_checklist: ["product invariants","authority boundary","user-owned file exclusion","handoff completeness"]
handoff_in: ["ORCHESTRATION"]
handoff_out: ["CODEX","INDEPENDENT-AUDIT","ORCHESTRATION"]
stop_conditions: ["unapproved policy change","production operation","missing edit lease","authority conflict"]
human_escape: HUMAN-CHIEF
---

# SOLAR 역할 manifest

도메인별 설계·구현은 하나의 공식 산출물을 개선한다. DB 확정값과 원장 공식은 DB RPC 권위를
따르며, 제작자는 자신의 결과를 최종 승인하지 않는다.
