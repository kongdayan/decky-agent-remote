import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,normalizeTranscript} from './server.mjs';

test('voice output uses simplified Chinese while keeping ASCII paths',()=>{
  assert.equal(normalizeTranscript('  你誰呀，幫我看看遊戲裏的天賦。 codex ./Foo.ts  '),'你谁呀，帮我看看游戏里的天赋。 codex ./Foo.ts');
});

test('authenticated remote execution rejects browser requests and deduplicates concurrent retries',async()=>{
  let sends=0;
  const server=createServer({token:'x'.repeat(48),name:'test'}, {dsh:{send:async()=>{sends++;await new Promise(r=>setTimeout(r,20));return {accepted:true};},list:async()=>[]}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base+'/v1/health')).status,401);
    const headers={Authorization:'Bearer '+'x'.repeat(48),'Content-Type':'application/json'};
    assert.equal((await fetch(base+'/v1/health',{headers:{...headers,Origin:'http://evil'}})).status,403);
    const body=JSON.stringify({agent:'dsh',session:'fixture',text:'test',requestId:'retry-12345'});
    const results=await Promise.all([1,2].map(()=>fetch(base+'/v1/messages',{method:'POST',headers,body})));
    assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(sends,1);
    assert.equal((await fetch(base+'/v1/messages',{method:'POST',headers,body:JSON.stringify({...JSON.parse(body),text:'different'})})).status,409);
    assert.equal((await fetch(base+'/v1/messages',{method:'POST',headers,body:JSON.stringify({agent:'shell',session:'fixture',text:'bad'})})).status,400);
    assert.equal(sends,1);
  }finally{await new Promise(r=>server.close(r));}
});

test('a transient DSH failure can retry with the same upstream request identity',async()=>{
 let calls=0;const ids=[];
 const server=createServer({token:'x'.repeat(48)}, {dsh:{send:async(_session,_text,id)=>{ids.push(id);if(++calls===1)throw new Error('temporary offline');return {accepted:true};}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const url=`http://127.0.0.1:${server.address().port}/v1/messages`;
  const options={method:'POST',headers:{Authorization:'Bearer '+'x'.repeat(48),'Content-Type':'application/json'},body:JSON.stringify({agent:'dsh',session:'test',text:'retry me',requestId:'retry-dsh-1234'})};
  assert.equal((await fetch(url,options)).status,400);
  assert.equal((await fetch(url,options)).status,200);
  assert.deepEqual(ids,['retry-dsh-1234','retry-dsh-1234']);
 }finally{await new Promise(r=>server.close(r));}
});

test('English and automatic speech avoid the Mandarin prompt and preserve original text',async()=>{
 const {whisperArguments,speechLanguage}=await import('./server.mjs');
 for(const language of ['en','auto']){
  const args=whisperArguments('model','audio','out',language);
  assert.equal(args[args.indexOf('-l')+1],language);
  assert.ok(!args.includes('--prompt'));
  assert.equal(normalizeTranscript('  Check ./Foo.ts — 遊戲  ',language),'Check ./Foo.ts — 遊戲');
 }
 assert.ok(whisperArguments('model','audio','out','zh').includes('--prompt'));
 assert.throws(()=>speechLanguage('en --anything'));
});

test('speech language is validated before model execution and API errors match UI language',async()=>{
 const server=createServer({token:'x'.repeat(48)},{dsh:{}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={Authorization:'Bearer '+'x'.repeat(48),'X-Agent-Language':'en'};
  const health=await (await fetch(base+'/v1/health',{headers})).json();
  assert.deepEqual(health.speechLanguages,['zh','en','auto']);
  const invalid=await fetch(base+'/v1/transcribe?language=bad',{method:'POST',headers,body:'invalid'});
  assert.equal(invalid.status,400);assert.equal((await invalid.json()).error,'Invalid language option');
  const noModel=await fetch(base+'/v1/transcribe?language=en',{method:'POST',headers,body:'invalid'});
  assert.equal((await noModel.json()).error,'The computer has no speech model configured');
 }finally{await new Promise(r=>server.close(r));}
});
