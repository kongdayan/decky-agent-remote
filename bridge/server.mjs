import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { isIP } from 'node:net';
import { CodexClient,DshClient } from './clients.mjs';
import * as OpenCC from 'opencc-js';
const exec=promisify(execFile);
const simplified=OpenCC.Converter({from:'tw',to:'cn'});
export function normalizeTranscript(text) {return simplified(text).trim();}

export function authorized(header, token) {
  const a=Buffer.from(header??''); const b=Buffer.from(`Bearer ${token}`);
  return a.length===b.length && timingSafeEqual(a,b);
}
export function validateMessage(body) {
  if (!['dsh','codex'].includes(body.agent)||typeof body.session!=='string'||!body.session||body.session.length>160||typeof body.text!=='string'||!body.text.trim()||body.text.length>20000) throw new Error('无效的目标或消息');
}
export async function transcribe(audio, config) {
  if (audio.length<1000 || audio.toString('ascii',0,4)!=='RIFF' || audio.toString('ascii',8,12)!=='WAVE') throw new Error('需要 WAV 录音');
  const dir=await mkdtemp(join(tmpdir(),'decky-voice-'));
  try {
    const input=join(dir,'input.wav'),wav=join(dir,'audio.wav'),out=join(dir,'result');
    await writeFile(input,audio,{mode:0o600});
    await exec(config.ffmpeg??'ffmpeg',['-v','error','-y','-i',input,'-t','90','-ar','16000','-ac','1',wav],{timeout:20000});
    const {stdout}=await exec(config.ffmpeg??'ffmpeg',['-hide_banner','-i',wav,'-af','volumedetect','-f','null','-'],{timeout:10000}).then(r=>({stdout:r.stderr}));
    const peak=Number(/max_volume: ([\d.-]+) dB/.exec(stdout)?.[1]??-100);
    if (peak < -45) throw new Error('录音过轻或没有声音，请靠近麦克风重试');
    await exec(config.whisper??'whisper-cli',['-m',config.model,'-f',wav,'-l','zh','--prompt','以下是普通话语音，请使用简体中文准确转写。','-otxt','-of',out,'-nt','-np'],{timeout:180000,maxBuffer:2*1024*1024});
    const text=normalizeTranscript(await readFile(out+'.txt','utf8'));
    if (!text || /^[\s\[\]()（），。！？!?.]*(?:BLANK_AUDIO|silence|无声)[\s\[\]()（），。！？!?.]*$/i.test(text)) throw new Error('没有识别到语音');
    return text;
  } finally { await rm(dir,{recursive:true,force:true}); }
}
export function createServer(config, clients) {
  const inFlight=new Map(); let asrBusy=false;
  return http.createServer(async(req,res)=>{
    const reply=(status,value)=>{if(res.destroyed||res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    if (!authorized(req.headers.authorization,config.token)) { req.resume();reply(401,{error:'Unauthorized'});return; }
    if (req.headers.origin) {req.resume();reply(403,{error:'Browser access disabled'});return;}
    try {
      const url=new URL(req.url,'http://bridge');
      if (req.method==='GET'&&url.pathname==='/v1/health') return reply(200,{name:config.name,version:'0.4.1',speech:!!config.model,agents:Object.keys(clients)});
      const agent=url.searchParams.get('agent');
      if (req.method==='GET'&&url.pathname==='/v1/sessions') {
        if(!clients[agent])throw new Error('未知 Agent');return reply(200,{sessions:await clients[agent].list()});
      }
      if (req.method==='GET'&&url.pathname==='/v1/session') {
        if(!clients[agent])throw new Error('未知 Agent');return reply(200,await clients[agent].detail(url.searchParams.get('id')));
      }
      if (req.method==='GET'&&url.pathname==='/v1/history') {
        const id=url.searchParams.get('id'),cursor=url.searchParams.get('cursor');
        if(!clients[agent]||!id||id.length>160||(cursor?.length??0)>4096)throw new Error('无效历史请求');
        return reply(200,await clients[agent].history(id,cursor));
      }
      if (req.method!=='POST'||!['/v1/messages','/v1/transcribe','/v1/new'].includes(url.pathname)) {req.resume();return reply(404,{error:'Not found'});}
      const limit=url.pathname==='/v1/transcribe'?10*1024*1024:128*1024;
      const chunks=[];let length=0;
      for await (const chunk of req) {length+=chunk.length;if(length>limit)throw new Error('录音过大');chunks.push(chunk);}
      const bytes=Buffer.concat(chunks);
      if(url.pathname==='/v1/transcribe') {
        if(!config.model)throw new Error('执行机器尚未配置语音模型');
        if(asrBusy)return reply(409,{error:'正在识别另一段录音'});
        asrBusy=true;try {return reply(200,{text:await transcribe(bytes,config)});}finally{asrBusy=false;}
      }
      const b=JSON.parse(bytes.toString());
      if(url.pathname==='/v1/new') {
        if(!clients[b.agent])throw new Error('未知 Agent');
        return reply(200,await clients[b.agent].create(config.workspace??homedir()));
      }
      validateMessage(b);
      if(!clients[b.agent])throw new Error('Agent 未启用');
      if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{8,100}$/.test(b.requestId))throw new Error('缺少 requestId');
      // Retrying after a lost response must never execute the same message twice.
      const key=b.requestId,fingerprint=JSON.stringify([b.agent,b.session,b.text]);
      const existing=inFlight.get(key);
      if(existing && existing.fingerprint!==fingerprint)return reply(409,{error:'请求编号已用于另一条消息'});
      if(!existing){
        // Keep pending requests; expire only completed entries after 24 hours.
        for(const [id,entry] of inFlight)if(entry.completed&&Date.now()-entry.completed>86400000)inFlight.delete(id);
        if(inFlight.size>=2000)return reply(429,{error:'请求缓存已满，请稍后重试'});
        const promise=clients[b.agent].send(b.session,b.text,b.requestId);
        const entry={fingerprint,promise,completed:0};
        inFlight.set(key,entry);
        promise.then(()=>{entry.completed=Date.now();},()=>{
          // DSH also deduplicates its prompt requestId; retry a transport failure with that same ID.
          // Codex has no equivalent guarantee here, so keep uncertain failures cached.
          if(b.agent==='dsh')inFlight.delete(key);else entry.completed=Date.now();
        });
      }
      return reply(200,await inFlight.get(key).promise);
    }catch(e){reply(400,{error:e.message??'请求失败'});}
  });
}
export async function main() {
  const config=JSON.parse(await readFile(process.env.DECKY_AGENT_CONFIG??`${homedir()}/.config/decky-agent-remote/bridge.json`,'utf8'));
  if(typeof config.token!=='string'||config.token.length<32||config.token.length>512||/\s/.test(config.token))throw new Error('缺少安全令牌');
  config.bind??='127.0.0.1';
  if(!isIP(config.bind))throw new Error('bind must be an explicit IPv4 or IPv6 address');
  if(!Number.isInteger(config.port??18765)||(config.port??18765)<1||(config.port??18765)>65535)throw new Error('Invalid port');
  const clients={dsh:new DshClient(config.dshUrl??'http://127.0.0.1:3080',{home:config.dshHome,tokenFile:config.dshTokenFile})};
  if(config.codexSocket)clients.codex=new CodexClient(config.codexSocket);
  const server=createServer(config,clients);server.listen(config.port??18765,config.bind,()=>console.log('Agent Remote bridge ready'));
  process.on('SIGTERM',()=>{server.close();clients.codex?.ws?.close();setTimeout(()=>process.exit(0),1000).unref();});
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1);});
