type Toast = { id: number; message: string };
let current: Toast | null = null;
let sequence = 0;
const listeners = new Set<() => void>();
export const getToast = () => current;
export const subscribeToast = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function showToast(message: string) {
  current = { id: ++sequence, message };
  listeners.forEach(listener => listener());
}
export function dismissToast(id: number) {
  if (current?.id !== id) return;
  current = null; listeners.forEach(listener => listener());
}
