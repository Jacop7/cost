import { Redirect } from 'expo-router';

/** PRT-131: retain old deep links without reviving monthly sales entry. */
export default function AvgSalesScreen() {
  return <Redirect href="/recipes/add" />;
}
