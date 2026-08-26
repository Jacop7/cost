import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text, View } from 'react-native';
import { Button } from '@/components/kit';

/** 장치가 실제로 RN 컴포넌트를 그리는지. 여기가 깨지면 아래 화면 시험은 전부 무의미하다. */
describe('시험 장치', () => {
  it('RN 기본 요소를 그린다', () => {
    render(<View><Text>안녕</Text></View>);
    expect(screen.getByText('안녕')).toBeTruthy();
  });
  it('kit 버튼을 그리고 누를 수 있다', () => {
    render(<Button kind="primary" onPress={() => {}}>저장</Button>);
    expect(screen.getByText('저장')).toBeTruthy();
  });
});
