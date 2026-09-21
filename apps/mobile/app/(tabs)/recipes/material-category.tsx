import { Redirect } from 'expo-router';
export default function RetiredRoute() {
  return <Redirect href="/recipes/manage-order?kind=ingredient&target=category" />;
}
