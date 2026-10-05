import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ProfDeepLink() {
  const params = useLocalSearchParams();
  const notion = typeof params.notion === 'string' ? params.notion : '';
  return <Redirect href={`/?notion=${encodeURIComponent(notion)}`} />;
}