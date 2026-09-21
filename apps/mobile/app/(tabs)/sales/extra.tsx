import { type Href, Redirect, useLocalSearchParams } from 'expo-router';

/** 부자재가 재료로 통합되기 전 주소. 기간 쿼리는 재료 원가 상세로 그대로 넘긴다. */
export default function RetiredSalesExtraRoute() {
  const { from, to, date } = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
  const query = [from ? `from=${encodeURIComponent(from)}` : '', to ? `to=${encodeURIComponent(to)}` : '',
    date ? `date=${encodeURIComponent(date)}` : ''].filter(Boolean).join('&');
  return <Redirect href={`/sales/material${query ? `?${query}` : ''}` as Href} />;
}
