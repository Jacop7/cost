/**
 * 세션·매장 컨텍스트 프로바이더 — 모든 실데이터 조회의 전제.
 *
 * RLS 가 `store_id in (select my_store_ids())` 이고 `my_store_ids()` 는
 * `stores where owner_id = auth.uid() and archived_at is null` 다. 로그인하지 않았거나
 * 탈퇴·폐점으로 매장이 아카이브되면 어떤 업무 행도 보이지 않는다.
 * 그래서 화면의 "데이터가 없어요"는 대개 빈 테이블이 아니라 세션이 없는 것이다 —
 * 이 둘을 반드시 구분해서 보여줘야 한다(가이드 §9.8).
 *
 * 여기서 준비 상태를 한 번만 판정하고 화면에는 이미 확정된 `storeId` 만 내려준다.
 * 화면마다 세션을 확인하게 하면 그 분기가 39개 화면에 복제된다.
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Button, Card, Field } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE } from '@/theme/tokens';
import { useSession, type SessionState } from './session';

const SessionContext = createContext<SessionState | null>(null);

/**
 * 준비된 세션. `SessionGate` 안에서만 호출해야 하며, 그 안에서는 `storeId` 가 항상 존재한다.
 * (게이트가 준비되지 않은 상태를 이미 걸러냈다.)
 */
export function useStoreId(): string {
  const s = useContext(SessionContext);
  if (s === null) throw new Error('useStoreId 는 SessionGate 안에서만 쓸 수 있습니다.');
  if (s.storeId === null) throw new Error('세션이 준비되기 전에 useStoreId 가 호출됐습니다.');
  return s.storeId;
}

/** 준비 여부와 무관하게 현재 세션 상태를 본다(게이트 자신·디버그용). */
export function useSessionState(): SessionState {
  const s = useContext(SessionContext);
  if (s === null) throw new Error('SessionProvider 가 없습니다.');
  return s;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 24, gap: 12 }}>
      {children}
    </ScrollView>
  );
}

function GateInput({ value, onChangeText, placeholder, accessibilityLabel, secureTextEntry = false,
  keyboardType, returnKeyType, onSubmitEditing, maxLength, error = false, autoComplete, textContentType }: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  maxLength?: number;
  error?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: COMPONENT.stackedForm.controlMinHeight,
      backgroundColor: T.surface, borderWidth: error || focused ? COMPONENT.input.activeBorderWidth : COMPONENT.input.borderWidth,
      borderColor: error ? COLOR.status.negative : focused ? COLOR.action.primary : COMPONENT.input.border.default,
      borderRadius: COMPONENT.input.radius, paddingVertical: COMPONENT.input.paddingVertical, paddingHorizontal: COMPONENT.input.paddingHorizontal }}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} accessibilityLabel={accessibilityLabel}
        style={{ flex: 1, minWidth: 0, padding: 0, fontSize: COMPONENT.input.textSize, fontWeight: COMPONENT.input.textWeight, color: T.ink }}
        placeholderTextColor={COLOR.text.tertiary} secureTextEntry={secureTextEntry} keyboardType={keyboardType}
        autoCapitalize="none" autoCorrect={false}
        autoComplete={autoComplete ?? (secureTextEntry ? 'current-password' : keyboardType === 'email-address' ? 'email' : 'off')}
        textContentType={textContentType ?? (secureTextEntry ? 'password' : keyboardType === 'email-address' ? 'emailAddress' : 'none')}
        returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} maxLength={maxLength}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    </View>
  );
}

type AuthMode = 'sign-in' | 'sign-up';

function AccountAccess({ session }: { session: SessionState }) {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const changeMode = (next: AuthMode) => {
    if (submitting) return;
    setMode(next);
    setError(null);
    setConfirmationRequired(false);
    setPassword('');
    setPasswordConfirmation('');
  };
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    if (mode === 'sign-in') {
      setError(await session.signIn(email, password));
    } else {
      const result = await session.signUp(email, password, passwordConfirmation);
      setError(result.error);
      setConfirmationRequired(result.error === null && result.confirmationRequired);
    }
    setSubmitting(false);
  };
  if (confirmationRequired) {
    return (
      <Centered>
        <View style={{ width: '100%', maxWidth: 440 }}>
          <Card style={{ gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink }}>이메일을 확인해 주세요</Text>
              <Text accessibilityRole="alert" style={{ fontSize: 16, lineHeight: TYPE.body.lineHeight, color: T.sub2 }}>
                가입 요청을 접수했어요. 확인 메일이 도착했다면 인증을 마친 뒤 로그인해 주세요.
              </Text>
            </View>
            <Button kind="primary" size="sm" full onPress={() => changeMode('sign-in')}>로그인으로 돌아가기</Button>
            <Button kind="ghost" size="sm" full onPress={() => setConfirmationRequired(false)}>가입 다시 시도</Button>
          </Card>
        </View>
      </Centered>
    );
  }
  const signingUp = mode === 'sign-up';
  return (
    <Centered>
      <View style={{ width: '100%', maxWidth: 440 }}>
        <Card style={{ gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink }}>
              {signingUp ? 'Costkeep 회원가입' : 'Costkeep 로그인'}
            </Text>
            <Text style={{ fontSize: 16, lineHeight: TYPE.body.lineHeight, color: T.sub2 }}>
              {signingUp ? '이메일 계정을 만들고 첫 매장을 연결해 보세요.' : '이메일 계정으로 로그인해 주세요.'}
            </Text>
          </View>
          <View>
            <Field label="이메일" req>
              <GateInput value={email} onChangeText={setEmail} placeholder="owner@example.com" keyboardType="email-address"
                accessibilityLabel="이메일" returnKeyType="next" />
            </Field>
            <Field label="비밀번호" req error={signingUp ? undefined : error ?? undefined} last={!signingUp}>
              <GateInput value={password} onChangeText={setPassword} placeholder="비밀번호" secureTextEntry
                accessibilityLabel="비밀번호" returnKeyType={signingUp ? 'next' : 'done'}
                autoComplete={signingUp ? 'new-password' : 'current-password'}
                textContentType={signingUp ? 'newPassword' : 'password'}
                onSubmitEditing={signingUp ? undefined : () => { void submit(); }} error={!!error} />
            </Field>
            {signingUp ? (
              <Field label="비밀번호 확인" req error={error ?? undefined} last>
                <GateInput value={passwordConfirmation} onChangeText={setPasswordConfirmation} placeholder="비밀번호 다시 입력"
                  secureTextEntry accessibilityLabel="비밀번호 확인" returnKeyType="done"
                  autoComplete="new-password" textContentType="newPassword"
                  onSubmitEditing={() => { void submit(); }} error={!!error} />
              </Field>
            ) : null}
          </View>
          <Button kind="primary" size="sm" full loading={submitting} onPress={() => { void submit(); }}>
            {signingUp ? '회원가입' : '로그인'}
          </Button>
          <Button kind="ghost" size="sm" full disabled={submitting}
            onPress={() => changeMode(signingUp ? 'sign-in' : 'sign-up')}>
            {signingUp ? '이미 계정이 있어요 · 로그인' : '처음이신가요? 회원가입'}
          </Button>
          <Text style={{ fontSize: 14, lineHeight: TYPE.caption.lineHeight, color: T.sub2, textAlign: 'center' }}>
            가입 후 매장 이름을 등록하면 업무를 시작할 수 있어요.
          </Text>
        </Card>
      </View>
    </Centered>
  );
}

function InitialStore({ session }: { session: SessionState }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const nextError = await session.createStore(name);
    setError(nextError);
    setSubmitting(false);
  };
  const switchAccount = async () => {
    if (submitting || switching) return;
    setSwitching(true);
    setError(null);
    const nextError = await session.signOut();
    setError(nextError);
    setSwitching(false);
  };
  return (
    <Centered>
      <View style={{ width: '100%', maxWidth: 440 }}>
        <Card style={{ gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: T.ink }}>첫 매장을 연결해 주세요</Text>
            <Text style={{ fontSize: 16, lineHeight: TYPE.body.lineHeight, color: T.sub2 }}>
              매장 이름을 입력하면 기본 설정과 함께 안전하게 시작합니다.
            </Text>
          </View>
          <Field label="매장 이름" req error={error ?? undefined} last>
            <GateInput value={name} onChangeText={setName} placeholder="예: 코스트킵 식당" maxLength={80}
              accessibilityLabel="매장 이름" returnKeyType="done" onSubmitEditing={() => { void submit(); }} error={!!error} />
          </Field>
          <Button kind="primary" size="sm" full loading={submitting} onPress={() => { void submit(); }}>매장 시작하기</Button>
          <Button kind="gray" size="sm" full loading={switching} disabled={submitting}
            onPress={() => { void switchAccount(); }}>다른 계정으로 로그인</Button>
        </Card>
      </View>
    </Centered>
  );
}

/**
 * 세션이 준비될 때까지 화면을 막는 게이트.
 *
 * 상태를 뭉뚱그리지 않는다 — "환경 미설정 / 로그인 필요 / 연결 실패"는 원인도 해결책도 다르다.
 * 하나로 합치면 사장님이 무엇을 해야 할지 알 수 없다(가이드 §9.8 Error).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const s = useSession();
  const qc = useQueryClient();
  // 로그아웃→동일 사용자 로그인 업데이트가 한 렌더로 합쳐져도 이전 캐시를 승계하지 않는다.
  const owner = s.phase === 'ready' && s.userId && s.storeId
    ? JSON.stringify([s.userId, s.storeId, s.sessionGeneration ?? 0]) : null;
  const [admittedOwner, setAdmittedOwner] = useState<string | null>(null);
  const cleanupGeneration = useRef(0);
  useLayoutEffect(() => {
    const ticket = ++cleanupGeneration.current;
    setAdmittedOwner(null);
    // 날짜-only 등 공통 키는 소유자 경계에서 비운다. 화면이 내려가도 끝날 수 있는
    // 이전 조회를 먼저 취소하고, 캐시 제거가 끝난 뒤에만 새 소유자의 화면을 연다.
    void qc.cancelQueries().then(() => {
      if (cleanupGeneration.current !== ticket) return;
      qc.clear();
      setAdmittedOwner(owner);
    });
    return () => { cleanupGeneration.current += 1; };
  }, [qc, owner]);

  if (s.phase === 'loading' || (s.phase === 'ready' && (owner === null || admittedOwner !== owner))) {
    return (
      <SessionContext.Provider value={s}>
        <Centered>
          <ActivityIndicator size="large" color={COLOR.action.primary} />
          <Text style={{ fontSize: 16, color: T.sub2, fontWeight: '600' }}>불러오는 중이에요</Text>
        </Centered>
      </SessionContext.Provider>
    );
  }

  if (s.phase !== 'ready') {
    if (s.phase === 'signed-out') {
      return <SessionContext.Provider value={s}><AccountAccess session={s} /></SessionContext.Provider>;
    }
    if (s.phase === 'needs-store') {
      return <SessionContext.Provider value={s}><InitialStore session={s} /></SessionContext.Provider>;
    }
    const title =
      s.phase === 'unconfigured' ? '서버 연결 설정이 없어요'
      : '서버에 연결하지 못했어요';
    const hint =
      s.phase === 'unconfigured'
        ? 'apps/mobile/.env 에 Supabase 주소와 키를 넣어 주세요.'
        : '로컬 Supabase 가 켜져 있는지 확인한 뒤 다시 시도해 주세요.';

    return (
      <SessionContext.Provider value={s}>
        <Centered>
          <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink, textAlign: 'center' }}>{title}</Text>
          <Text style={{ fontSize: 16, color: T.sub2, textAlign: 'center', lineHeight: TYPE.body.lineHeight }}>
            {s.message ?? hint}
          </Text>
          {/* 환경 미설정은 재시도해도 달라지지 않는다 — .env 를 고쳐야 한다. 그때는 버튼을 숨긴다. */}
          {s.phase === 'unconfigured' ? null : (
            <Button kind="primary" size="lg" onPress={s.retry}>다시 시도</Button>
          )}
        </Centered>
      </SessionContext.Provider>
    );
  }

  return <SessionContext.Provider value={s}>{children}</SessionContext.Provider>;
}
