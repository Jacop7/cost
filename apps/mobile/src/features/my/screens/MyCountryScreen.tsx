import { InternationalTaxScreen } from './InternationalTaxScreen';

/** MY-12 지역 설정은 언어·통화·시간대를 묶되 각 서버 저장 계약은 그대로 유지한다. */
export default function MyCountryScreen() {
  return <InternationalTaxScreen title="지역 설정" mode="market" />;
}
