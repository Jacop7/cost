import { Redirect, useLocalSearchParams } from 'expo-router';
export default function RetiredRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={id ? `/ingredients/${id}` : '/recipes/ingredients'} />;
}
