import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushToTalk} from '../src/ptt.ts';
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
function setup(){
  let timer:(()=>void)|undefined;
  const calls:string[]=[];
  let resolveStart:(state:{phase:string})=>void=()=>{};
  const ptt=createPushToTalk({
    start:()=>{calls.push('start');return new Promise<{phase:string}>(resolve=>{resolveStart=resolve;});},
    stop:async()=>{calls.push('stop');return {phase:'idle'};},
    onState:state=>calls.push(state.phase),onTap:()=>calls.push('open'),onError:()=>calls.push('error'),
    schedule:fn=>{timer=fn;return 1 as unknown as ReturnType<typeof setTimeout>;},cancel:()=>{timer=undefined;},
  });
  return {ptt,calls,fire:()=>timer?.(),ready:()=>resolveStart({phase:'recording'})};
}
test('short press opens the conversation without taking microphone input',()=>{
 const t=setup();t.ptt.press();t.ptt.release();t.fire();assert.deepEqual(t.calls,['open']);
});
test('release while start RPC is pending still stops and sends exactly once',async()=>{
 const t=setup();t.ptt.press();t.ptt.press();t.fire();t.ptt.release();t.ptt.release();
 assert.deepEqual(t.calls,['start']);t.ready();await settle();assert.deepEqual(t.calls,['start','recording','stop','idle']);
});
test('unloaded plugin does not open UI or deliver a stale callback',async()=>{
 const t=setup();t.ptt.press();t.fire();t.ptt.dispose();t.ready();t.ptt.release();await settle();assert.deepEqual(t.calls,['start']);
});
