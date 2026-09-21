# 기존 전달 승인과 실행계획 재결속

2026-09-11 사용자는 두 기존 식재료·레시피 작업에 업무를 전달하도록 요청하고, 현재 실행계획에 맞춘 전달 승인 기록 갱신에 동의했다. 기존 NON_PRODUCTION_CHAT_MESSAGES 범위만 유지한다. DB·배포·사람 relay 권한은 추가하지 않는다.

기존 decision/receipt modelPlanSha256: 60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e.
현재 MODEL_PLAN_VERIFIED: 82e3edc4a15e3f97f13875de6a8ffb747220304e4773be64bc83ddd511d6666c.
기존 decision SHA: d066abab56cf851965ef155368e35e3077c942d6daabeca51a72012c4ef00327.

정책 바이트 해시도 기존 15aad51c…와 다르다. 현재 정책의 비운영 메시지 범위·humanRelayEnabled=false·dispatchEnabled=true를 직접 확인하고 현재 SHA 1596cb67cf53e3e58b32a2fb2ecbce4516624267b9095149de47302d8a513770으로 재결속한다. 원인을 줄바꿈 차이라고 단정하지 않는다.

기존 구현 및 검수 artifact 전체 해시는 재계산 결과 불일치/누락 없음. 재검수를 실행한 것으로 표시하지 않고 기존 검수 증거를 보존한다. 변경은 모델 계획 재결속 및 amendment 출처뿐이다. 개별 endpoint/edge/전송 검증은 별도로 통과해야 하며 이 문서 자체는 전송 성공 증거가 아니다.
