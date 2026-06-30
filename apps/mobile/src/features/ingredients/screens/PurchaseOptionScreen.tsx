// PurchaseOptionScreen.tsx — ING-06 구매 링크 · 옵션 추가/수정 (ScreenING05)
// mode=add: 빈 폼 · [닫기/추가] / mode=edit: 누른 옵션 프리필 · [삭제/수정]
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { previewBaseUnitPrice, rawUnitPrice, round } from '@sikjae/core';
import { AppHeader, Field, Input, Button, Card, Badge, Icon } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals } from '@/lib/num';
import { optionsFor } from '../demoData';
import { UnitPickerSheet } from '../components/UnitPickerSheet';

const LOSS_PCT = 15;
const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
const baseUnitOf = (u: string): 'g' | 'ml' | '개' => (u === 'kg' || u === 'g' ? 'g' : u === 'L' || u === 'ml' ? 'ml' : '개');

// URL 도메인 → 구매처(쇼핑몰) 추정. 상품명·금액 자동 추출은 서버 스크래핑(백엔드 단계) 필요.
const VENDOR_MAP: [RegExp, string][] = [
  [/coupang/i, '쿠팡'],
  [/(smartstore|shopping\.naver|naver)/i, '네이버'],
  [/kurly/i, '마켓컬리'],
  [/emart/i, '이마트몰'],
  [/gmarket/i, 'G마켓'],
  [/11st/i, '11번가'],
  [/ssg/i, 'SSG'],
  [/auction/i, '옥션'],
  [/lotteon/i, '롯데온'],
  [/homeplus/i, '홈플러스'],
];
const inferVendor = (u: string): string => {
  for (const [re, v] of VENDOR_MAP) if (re.test(u)) return v;
  const m = u.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
  return m?.[1] ?? '';
};

export function PurchaseOptionScreen() {
  const { mode, base: baseParam, recent, rvendor, rname, oi } = useLocalSearchParams<{ mode?: string; base?: string; recent?: string; rvendor?: string; rname?: string; oi?: string }>();
  const isEdit = mode === 'edit';
  const lockBase = baseParam === 'g' || baseParam === 'ml' || baseParam === '개' ? baseParam : undefined;

  // 수정 모드: 누른 옵션을 프리필 / 추가 모드: 빈 폼.
  const editOpt = isEdit && rname ? optionsFor(rname)[Number(oi) || 0] : undefined;
  const parsedVol = editOpt ? editOpt.vol.match(/^([\d.]+)\s*(kg|g|L|ml|개|박스)/) : null;
  const initUnit = parsedVol?.[2] ?? (lockBase === 'ml' ? 'L' : lockBase === '개' ? '개' : 'kg');

  const [unit, setUnit] = useState(initUnit);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [url, setUrl] = useState('');
  const [name, setName] = useState(editOpt?.name ?? '');
  const [vendor, setVendor] = useState(editOpt?.vendor ?? '');
  const [vol, setVol] = useState(parsedVol?.[1] ?? '');
  const [boxQty, setBoxQty] = useState('');
  const [price, setPrice] = useState(editOpt ? String(parseInt(editOpt.price.replace(/[^\d]/g, ''), 10) || '') : '');

  const isMeasure = !(unit === '박스' || unit === '개');
  const base = baseUnitOf(unit);
  const perBase = unit === '박스' ? num(boxQty) : isMeasure ? num(vol) * (unit === 'kg' || unit === 'L' ? 1000 : 1) : num(vol);
  const rawPer = perBase > 0 ? round(rawUnitPrice(num(price), perBase), 2) : 0;
  const realPer = perBase > 0 ? round(previewBaseUnitPrice(num(price), perBase, LOSS_PCT / 100), 2) : 0;
  const boxEach = unit === '박스' && num(boxQty) > 0 ? round(num(price) / num(boxQty), 2) : 0;

  // URL 입력/붙여넣기 → 구매처 자동 추정(구매처 비어있을 때만).
  const handleUrl = (text: string) => {
    setUrl(text);
    const v = inferVendor(text.trim());
    if (v && vendor.trim() === '') setVendor(v);
  };

  const onPaste = async () => {
    // 웹은 브라우저 클립보드 권한이 필요 — 거부/미지원 시 무시(직접 붙여넣기 가능).
    try {
      const pasted = await Clipboard.getStringAsync();
      if (pasted) handleUrl(pasted.trim());
    } catch {
      // no-op
    }
  };

  // 최근(수정 진입 시 식재료의 최근 단가) vs 현재(입력) 비교.
  const compare: [string, string, string, 'neutral' | 'blue'][] = [];
  if (recent) {
    compare.push(['최근', `${rname ?? '최근 입고'}`, `${rvendor ?? ''}${rvendor ? ' · ' : ''}${recent}원/${base}`, 'neutral']);
  }
  compare.push([
    '현재',
    name || num(price) > 0 ? `${name || '신규 옵션'} · ${vol || boxQty || '-'}${unit} · ${num(price).toLocaleString('ko-KR')}원` : '입력하면 표시돼요',
    `${vendor || '-'} · ${rawPer}원/${base}`,
    'blue',
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title={isEdit ? '구매 링크 · 옵션 수정' : '구매 링크 · 옵션 추가'} onBack={() => safeBack()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {/* URL 붙여넣기 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 18 }}>
          <Icon name="link" size={18} color={T.ter} />
          <TextInput
            style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink, padding: 0 }}
            value={url}
            onChangeText={handleUrl}
            placeholder="상품 URL 붙여넣기"
            placeholderTextColor={T.ter}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Pressable hitSlop={8} onPress={onPaste}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>붙여넣기</Text>
          </Pressable>
        </View>

        <Field label="구매 식재료명"><Input value={name} onChangeText={setName} placeholder="예) 곰곰 깐대파" /></Field>
        <Field label="구매처"><Input value={vendor} onChangeText={setVendor} placeholder="예) 쿠팡" /></Field>

        <Field label="용량">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}><Input value={vol} onChangeText={(t) => setVol(clampByUnit(t, unit))} placeholder="0" mono keyboardType="decimal-pad" /></View>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 }}
            >
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink }}>{unit}</Text>
              <Icon name="chevronDown" size={18} color={T.ter} />
            </Pressable>
          </View>
        </Field>

        {unit === '박스' ? (
          <Field label="박스당 수량"><Input value={boxQty} onChangeText={(t) => setBoxQty(clampDecimals(t, 0))} placeholder="0" suffix="개" mono keyboardType="number-pad" /></Field>
        ) : null}

        <Field label="금액"><Input value={price} onChangeText={(t) => setPrice(clampDecimals(t, 0))} placeholder="0" suffix="원" mono keyboardType="number-pad" /></Field>

        {/* 단가 미리보기 */}
        <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 }}>
            <Icon name="info" size={17} color={T.blue} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>단가 미리보기</Text>
          </View>
          {unit === '박스' ? (
            <>
              <Row label="박스 단가" value={String(num(price))} unit="원/박스" />
              <Row label="낱개 단가" hint={`(${num(price)} ÷ ${num(boxQty) || 0})`} value={String(boxEach)} unit="원/개" />
              <Final lossPct={LOSS_PCT} value={String(realPer)} unit="원/개" />
            </>
          ) : (
            <>
              <Row label="환산 단가 (구매가)" value={String(rawPer)} unit={`원/${base}`} />
              <Final lossPct={LOSS_PCT} value={String(realPer)} unit={`원/${base}`} />
            </>
          )}
        </View>

        {/* 최근 주문 단가 비교 */}
        <Card onLine pad={14} shadow={false}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginBottom: 10 }}>최근 주문 단가 비교</Text>
          {compare.map(([tag, label, sub, tone], i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 7 }}>
              <Badge tone={tone} sm>{tag}</Badge>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{label}</Text>
                <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{sub}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        {isEdit ? (
          <>
            <Button kind="danger" size="lg" style={{ flex: 1 }} onPress={() => safeBack()}>삭제</Button>
            <Button kind="primary" size="lg" style={{ flex: 2 }} onPress={() => safeBack()}>수정</Button>
          </>
        ) : (
          <>
            <Button kind="gray" size="lg" style={{ flex: 1 }} onPress={() => safeBack()}>닫기</Button>
            <Button kind="primary" size="lg" style={{ flex: 2 }} onPress={() => safeBack()}>추가</Button>
          </>
        )}
      </View>

      <UnitPickerSheet
        visible={pickerOpen}
        unit={unit}
        onSelect={(u) => {
          setUnit(u);
          setVol((p) => clampByUnit(p, u));
        }}
        onClose={() => setPickerOpen(false)}
        base={lockBase}
      />
    </View>
  );
}

function Row({ label, hint, value, unit }: { label: string; hint?: string; value: string; unit: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub2 }}>
        {label} {hint ? <Text style={{ color: T.ter }}>{hint}</Text> : null}
      </Text>
      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, tnum]}>
        {value}<Text style={{ fontSize: 13, color: T.sub2 }}>{unit}</Text>
      </Text>
    </View>
  );
}

function Final({ lossPct, value, unit }: { lossPct: number; value: string; unit: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: T.blueLine }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.blue }}>
        실사용 단가 <Text style={{ fontWeight: '600' }}>(로스 {lossPct}% 반영)</Text>
      </Text>
      <Text style={[{ fontSize: 18, fontWeight: '800', color: T.blue }, tnum]}>
        {value}<Text style={{ fontSize: 16 }}>{unit}</Text>
      </Text>
    </View>
  );
}
