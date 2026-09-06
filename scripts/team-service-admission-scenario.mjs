import { createServiceWorkflow, nextServiceAction, applyServiceEvent } from './team-service-workflow.mjs';
import { roles, teams } from './team-routing-contract-audit.mjs';

// All receipts are synthetic and remain inside this fixture.
const verifier = {verifyReceipt:()=>true};
const initial = () => createServiceWorkflow({taskId:'TASK-ADMISSION',correlationId:'CORR-ADMISSION',team:teams[1],taskPointer:'TASK:ADMISSION'});
let state=initial();
const event=(type,actor,extra={})=>({eventId:`EVENT-${state.revision}`,expectedRevision:state.revision,
  taskId:state.taskId,correlationId:state.correlationId,type,actor,evidencePointer:'RECEIPT:SYNTHETIC',
  deliveryToken:state.activeDeliveryToken,...extra});
for(let i=0;i<6;i++) {
  const leg=state.legs[state.leg];
  state=applyServiceEvent(state,event('TOOL_ACCEPTED',leg.source,{deliveryToken:`DELIVERY-${i}`}),verifier);
  if(state.status!=='SENT_UNCONFIRMED') throw new Error('BAD_SEND_STATE');
  state=applyServiceEvent(state,event('ACK',leg.target),verifier);
  if(state.status!=='ACKNOWLEDGED') throw new Error('BAD_ACK_STATE');
  state=applyServiceEvent(state,event('LEG_COMPLETED',leg.target,{resultPointer:`ARTIFACT:FIXTURE-${i}`}),verifier);
}
const completed=state;
state=initial();
state=applyServiceEvent(state,event('HUMAN_STOP',roles.human),verifier);
export const observation={roundtrip_status:completed.status,revision:completed.revision,
  stop_status:nextServiceAction(state,roles.human).status,legs:completed.leg};
