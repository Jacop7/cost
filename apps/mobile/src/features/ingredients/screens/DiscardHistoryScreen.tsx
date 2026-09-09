import { Redirect, useLocalSearchParams } from 'expo-router';

/** ING-10 is retired. Preserve old links without reviving its unsafe cost/delete UI. */
export default function DiscardHistoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={id ? { pathname: '/ingredients/history/[id]', params: { id } } : '/ingredients'} />;
}
