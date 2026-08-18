-- 인증 사용자로 가장해 RLS 를 그대로 통과시키는 테스트 프리앰블.
-- psql 은 기본이 superuser 라 RLS 가 무시된다 — 그러면 "앱에서도 되겠지"를 검증하지 못한다.
-- 실제 앱과 같은 조건(authenticated + auth.uid())으로 맞춘다.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
