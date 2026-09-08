import { useSyncExternalStore } from 'react';
import { Platform, Text, View } from 'react-native';
import { getWebAlert, respondWebAlert, subscribeWebAlert } from '@/lib/webAlert';
import { COLOR, TYPE, space } from '@/theme/tokens';
import { Sheet } from './Sheet';
import { Button } from './Button';

/** Shared Expo Web presentation, also used unchanged inside AppMap. */
export function WebAlertHost() {
  const entry = useSyncExternalStore(subscribeWebAlert, getWebAlert, () => null);
  if (Platform.OS !== 'web' || !entry) return null;
  return <Sheet visible title={entry.title} onClose={() => respondWebAlert(entry.id)}>
    {entry.message ? <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{entry.message}</Text> : null}
    <View style={{ gap: space.sm, marginTop: space.lg }}>
      {entry.buttons.map((button, index) => <Button key={index} full size="lg"
        kind={button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'ghost' : 'primary'}
        onPress={() => respondWebAlert(entry.id, index)}>{button.text ?? '확인'}</Button>)}
    </View>
  </Sheet>;
}
