import test from 'node:test';
import assert from 'node:assert/strict';
import {displayMessages,dshHistoryCursor} from './clients.mjs';

test('display the full assistant response without model reasoning or injected context',()=>{
  const full='完整回复。'.repeat(600);
  const events=[
    {type:'user/message',data:{source:{kind:'system'},content:[{type:'text',text:'injected context'}]}},
    {type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'你谁啊'}]}},
    {type:'assistant/message',data:{message:{content:[{type:'reasoning',text:'private reasoning'},{type:'text',text:full}]}}},
  ];
  const messages=displayMessages(events.map(event=>({type:'event',event})));
  assert.deepEqual(messages,[{role:'user',text:'你谁啊'},{role:'assistant',text:full}]);
});

test('history keeps stable event identities beyond the recent-message preview',()=>{
  const records=Array.from({length:25},(_,seq)=>({event:{seq,time:1000+seq,type:'assistant/message',data:{message:{content:[{type:'text',text:`reply ${seq}`} ]}}}}));
  const messages=displayMessages(records);
  assert.equal(messages.length,25);
  assert.equal(new Set(messages.map(m=>m.id)).size,25);
  assert.equal(messages[0].time,1000);
});

test('history cursor rejects invalid bounds before sending an upstream request',()=>{
  const encode=p=>Buffer.from(JSON.stringify(p)).toString('base64url');
  assert.deepEqual(dshHistoryCursor(encode({throughSeq:99,beforeSeq:40})),{throughSeq:99,beforeSeq:40});
  for(const p of [{throughSeq:2,beforeSeq:4},{throughSeq:-1,beforeSeq:0},{throughSeq:9,beforeSeq:1.5}])assert.throws(()=>dshHistoryCursor(encode(p)));
});
