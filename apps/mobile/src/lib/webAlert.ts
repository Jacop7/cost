/** Web Alert uses the shared Sheet host. Native Alert is unchanged.
 * Preserve every button and callback; merely displaying an alert never confirms it.
 */
import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

type Entry = { id: number; title: string; message?: string; buttons: AlertButton[]; options?: AlertOptions };
let queue: Entry[] = [], serial = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
export const subscribeWebAlert = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getWebAlert = () => queue[0] ?? null;
export function respondWebAlert(id: number, index?: number): void {
  const entry = queue[0];
  if (!entry || entry.id !== id) return; // stale/double click must not confirm the next alert
  queue = queue.slice(1); emit();
  if (index !== undefined) entry.buttons[index]?.onPress?.();
  else {
    entry.buttons.find(b => b.style === 'cancel')?.onPress?.();
    entry.options?.onDismiss?.();
  }
}
export function installWebAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if ((Alert as typeof Alert & { __webPatched?: boolean }).__webPatched) return;
  Alert.alert = (title, message, buttons, options) => {
    queue = [...queue, { id: ++serial, title, message, buttons: buttons?.length ? buttons : [{ text: '확인' }], options }];
    emit();
  };
  (Alert as typeof Alert & { __webPatched?: boolean }).__webPatched = true;
}
