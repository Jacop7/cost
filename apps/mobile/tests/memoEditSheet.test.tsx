import { useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoEditSheet } from '@/components/kit/MemoEditSheet';

// Real shared Sheet/Button/TextInput, with Modal visibility stubbed because jsdom
// does not complete native/RNW slide animations. Fonts/geometry use browser evidence.
vi.mock('react-native', async (original) => {
  const rn = await original<typeof import('react-native')>();
  return { ...rn, Modal: ({ visible, children }: { visible?: boolean; children?: ReactNode }) => visible ? <>{children}</> : null };
});

describe('공용 메모 편집 시트', () => {
  for (const saving of [false, true]) {
    it(`refetch 중 saving=${saving}: 사용자 초안은 보존하고 닫고 재열면 최신 원문을 받는다`, () => {
      const save = vi.fn(), close = vi.fn();
      const props = { onSave: save, onClose: close };
      const { rerender } = render(<MemoEditSheet {...props} visible value="기존 서버 값" />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '  내 초안\n두 줄  ' } });
      rerender(<MemoEditSheet {...props} visible value="새 서버 값" saving={saving} />);
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('  내 초안\n두 줄  ');
      expect(save).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
      rerender(<MemoEditSheet {...props} visible={false} value="새 서버 값" />);
      rerender(<MemoEditSheet {...props} visible value="새 서버 값" />);
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('새 서버 값');
    });
  }
  it('사용자가 아직 수정하지 않았으면 늦게 도착한 서버 메모를 반영한다', () => {
    const props = { onSave: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<MemoEditSheet {...props} visible value="" />);
    rerender(<MemoEditSheet {...props} visible value="조회 완료 메모" />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('조회 완료 메모');
  });
  it('입력과 refetch가 같은 이벤트 묶음이어도 새 초안을 보존한다', () => {
    const props = { onSave: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<MemoEditSheet {...props} visible value="원본" />);
    act(() => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '같은 틱 초안' } });
      rerender(<MemoEditSheet {...props} visible value="재조회 값" />);
    });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('같은 틱 초안');
  });
  it('마지막 수용 원문으로 되돌리면 이후 재조회는 다시 반영한다', () => {
    const props = { onSave: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<MemoEditSheet {...props} visible value="원본" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '수정' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '원본' } });
    rerender(<MemoEditSheet {...props} visible value="새 원본" />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('새 원본');
  });
  for (const value of ['', '원본 메모']) {
    it(`입력값 ${value ? '있음' : '없음'}: 명시적인 메모 이름과 최대 길이를 제공한다`, () => {
      render(<MemoEditSheet visible value={value} onClose={vi.fn()} onSave={vi.fn()} />);
      const input = screen.getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement;
      expect(input.value).toBe(value); expect(input.maxLength).toBe(100);
      expect(screen.getByText(`${value.length} / 100`)).toBeTruthy();
    });
  }
  it('취소/완료는 공용 버튼을 유지하며 동일한 비율을 사용한다', () => {
    render(<MemoEditSheet visible value="" onClose={vi.fn()} onSave={vi.fn()} />);
    const cancel = getComputedStyle(screen.getByRole('button', { name: '취소' }));
    const done = getComputedStyle(screen.getByRole('button', { name: '완료' }));
    expect(cancel.flexGrow).toBe('1'); expect(done.flexGrow).toBe(cancel.flexGrow);
  });
  it('draft의 양끝 공백만 제거하여 mock 저장 콜백에 전달한다', () => {
    const save = vi.fn(); render(<MemoEditSheet visible value="원본" onClose={vi.fn()} onSave={save} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  첫 줄\n둘째 줄  ' } });
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(save).toHaveBeenCalledWith('첫 줄\n둘째 줄');
  });
  it('기존 100자 초과 메모를 열거나 완료해도 임의로 자르지 않는다', () => {
    const value = '기존'.repeat(60), save = vi.fn();
    render(<MemoEditSheet visible value={value} onClose={vi.fn()} onSave={save} />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(value);
    expect(screen.getByText('120 / 100')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '완료' })); expect(save).toHaveBeenCalledWith(value);
  });
  for (const original of ['식재료 원본 메모', '메뉴 원본 메모']) {
    it(`${original}: 취소 후 재열면 원본을 복원하고 저장하지 않는다`, () => {
      const save = vi.fn();
      function Host() {
        const [visible, setVisible] = useState(true);
        return <><button onClick={() => setVisible(true)}>다시 열기</button><MemoEditSheet visible={visible} value={original} onClose={() => setVisible(false)} onSave={save} /></>;
      }
      render(<Host />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '미저장 변경' } });
      fireEvent.click(screen.getByRole('button', { name: '취소' })); expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: '다시 열기' }));
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(original); expect(save).not.toHaveBeenCalled();
    });
  }
  it('저장 중 두 footer 버튼은 추가 콜백을 호출하지 않는다', () => {
    const save = vi.fn(), close = vi.fn(); render(<MemoEditSheet visible saving value="원본" onClose={close} onSave={save} />);
    for (const name of ['취소', '완료']) {
      const button = screen.getByRole('button', { name }); expect(button.getAttribute('aria-disabled')).toBe('true'); fireEvent.click(button);
    }
    expect(save).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
  it('사용처의 별도 maxLength를 보존하며 빈 메모도 콜백으로 전달한다', () => {
    const save = vi.fn(); render(<MemoEditSheet visible value="" maxLength={200} onClose={vi.fn()} onSave={save} />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).maxLength).toBe(200);
    expect(screen.getByText('0 / 200')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '완료' })); expect(save).toHaveBeenCalledWith('');
  });
});
