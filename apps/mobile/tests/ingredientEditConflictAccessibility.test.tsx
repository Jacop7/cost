import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditConflictNotice, useIngredientEditConflict } from '@/features/ingredients/editConflict';
import type { IngredientDetail } from '@/features/ingredients/hooks';

const native = vi.hoisted(() => ({ platform: 'web', announce: vi.fn() }));
vi.mock('react-native', async original => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Platform: { ...rn.Platform, get OS() { return native.platform; } },
    AccessibilityInfo: { ...rn.AccessibilityInfo, announceForAccessibility: native.announce } };
});

type Result = { data?: IngredientDetail | null; error?: unknown };
const spoken = (message: string) => `다른 곳에서 수정됐어요. 입력한 내용은 보존했습니다. 최신 내용을 확인하기 전에는 저장할 수 없어요. ${message}`;
function Harness({ read }: { read: () => Promise<Result> }) {
  const recovery = useIngredientEditConflict('g1', read);
  const [draft, setDraft] = useState('초안');
  return <>
    <input aria-label="고지 시험 초안" value={draft} onChange={e => setDraft(e.target.value)} />
    <button onClick={() => recovery.handleError({ code: '40001' })}>충돌 발생</button>
    <EditConflictNotice recovery={recovery} onAccept={() => {}} />
  </>;
}

// Native platform branches are mocked; actual VoiceOver/TalkBack speech is not certified.
describe('식재료 동적 충돌 고지의 플랫폼별 단일 채널', () => {
  beforeEach(() => native.announce.mockReset());
  it.each(['web', 'android', 'ios'])('%s loading→실패→재조회→완료 고지, 재렌더 중복 없음', async platform => {
    native.platform = platform;
    let finish!: (value: Result) => void;
    const read = vi.fn(() => new Promise<Result>(resolve => { finish = resolve; }));
    render(<StrictMode><Harness read={read} /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: '충돌 발생' }));
    const loading = screen.getByText('최신 내용을 불러오는 중…');
    const announcement = screen.getByLabelText(spoken('최신 내용을 불러오는 중…'));
    expect(loading.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('다른 곳에서 수정됐어요').closest('[aria-hidden="true"]')).toBeTruthy();
    if (platform === 'web') {
      expect(announcement.getAttribute('role')).toBe('alert');
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(announcement.getAttribute('aria-live')).toBeNull();
    } else if (platform === 'android') {
      expect(announcement.getAttribute('aria-live')).toBe('polite');
      expect(screen.queryByRole('alert')).toBeNull();
    } else {
      expect(announcement.getAttribute('aria-live')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(native.announce.mock.calls).toEqual([[spoken('최신 내용을 불러오는 중…')]]);
    }
    fireEvent.change(screen.getByLabelText('고지 시험 초안'), { target: { value: '수정 초안' } });
    expect(native.announce).toHaveBeenCalledTimes(platform === 'ios' ? 1 : 0);
    await act(async () => finish({ error: new Error('다시 조회해 주세요') }));
    const error = screen.getByLabelText(spoken('다시 조회해 주세요'));
    if (platform === 'web') expect(error.getAttribute('role')).toBe('alert');
    if (platform === 'android') expect(error.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: '최신 내용 다시 불러오기' }));
    await act(async () => finish({ data: { id: 'g1' } as IngredientDetail }));
    const latest = screen.getByLabelText(spoken('최신 내용을 불러왔어요. 확인 후 계속 수정해 주세요.'));
    if (platform === 'web') expect(latest.getAttribute('role')).toBe('alert');
    if (platform === 'android') expect(latest.getAttribute('aria-live')).toBe('polite');
    expect(native.announce.mock.calls).toEqual(platform === 'ios' ? [
      [spoken('최신 내용을 불러오는 중…')], [spoken('다시 조회해 주세요')],
      [spoken('최신 내용을 불러오는 중…')], [spoken('최신 내용을 불러왔어요. 확인 후 계속 수정해 주세요.')],
    ] : []);
  });
});
