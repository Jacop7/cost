import { fireEvent, render, screen } from '@testing-library/react';
import { Alert } from 'react-native';
import { afterEach, expect, it, vi } from 'vitest';
import { BUSINESS_EDIT_MESSAGE, useBusinessEditConfirmation } from '@/features/business-day/useBusinessEditConfirmation';

const mock=vi.hoisted(()=>({status:'none' as string | undefined,failed:false,refetch:vi.fn()}));
vi.mock('@/features/business-day/businessDay',()=>({useBusinessDay:()=>({data:{status:mock.status},isError:mock.failed,refetch:mock.refetch})}));
function Host({action}:{action:()=>void}) { const gate=useBusinessEditConfirmation('식재료');return <>{gate.dialog}<button onClick={()=>gate.request(action)}>편집 열기</button></>; }
afterEach(()=>{mock.failed=false;vi.restoreAllMocks();});
it.each(['open','break'])('%s: 확인 전에는 편집을 열지 않고 취소/확인을 구분한다',status=>{
  mock.status=status;const action=vi.fn();render(<Host action={action}/>);
  fireEvent.click(screen.getByText('편집 열기'));expect(action).not.toHaveBeenCalled();
  expect(screen.getByText('식재료를 수정하시겠습니까?')).toBeTruthy();expect(screen.getByText(BUSINESS_EDIT_MESSAGE)).toBeTruthy();
  fireEvent.click(screen.getByText('취소'));expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('편집 열기'));fireEvent.click(screen.getByText('수정'));expect(action).toHaveBeenCalledTimes(1);
});
it.each(['none','closed'])('%s: 바로 편집한다',status=>{
  mock.status=status;const action=vi.fn();render(<Host action={action}/>);fireEvent.click(screen.getByText('편집 열기'));
  expect(action).toHaveBeenCalledOnce();expect(screen.queryByText(BUSINESS_EDIT_MESSAGE)).toBeNull();
});
it.each([undefined,'open'])('상태 누락/오류는 영업 전으로 추정하지 않는다: %s',status=>{
  mock.status=status;mock.failed=status==='open';vi.spyOn(Alert,'alert').mockImplementation(()=>{});
  const action=vi.fn();render(<Host action={action}/>);fireEvent.click(screen.getByText('편집 열기'));
  expect(action).not.toHaveBeenCalled();expect(Alert.alert).toHaveBeenCalled();expect(mock.refetch).toHaveBeenCalled();
});
