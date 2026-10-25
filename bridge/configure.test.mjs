import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
test('config generator supports LAN, creates a private token and refuses overwrites',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agent-config-test-'));
 try{
  const file=join(dir,'bridge.json');
  const args=['bridge/configure.mjs','--bind','192.0.2.10','--config',file];
  const {stdout}=await exec(process.execPath,args);
  const original=await readFile(file,'utf8'),config=JSON.parse(original);
  assert.equal(config.bind,'192.0.2.10');assert.equal(config.token.length,64);
  assert.equal((await stat(file)).mode&0o777,0o600);
  assert.ok(!stdout.includes(config.token));
  await assert.rejects(exec(process.execPath,args));
  assert.equal(await readFile(file,'utf8'),original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
