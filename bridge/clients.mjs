import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

export function displayMessages(records) {
  const messages=[];
  for(const record of records) {
    const event=record.event;
    if(!event)continue;
    let role,content;
    if(event.type==='user/message'&&event.data?.source?.kind==='user') {role='user';content=event.data.content;}
    if(event.type==='assistant/message') {role='assistant';content=event.data?.message?.content;}
    if(!role||!Array.isArray(content))continue;
    const text=content.filter(p=>p.type==='text'&&typeof p.text==='string').map(p=>p.text).join('\n');
    if(text.trim())messages.push({role,text,...(Number.isInteger(event.seq)?{id:`dsh-${event.seq}`}:{ }),...(typeof event.time==='number'?{time:event.time}:{})});
  }
  return messages;
}

export function dshHistoryCursor(value) {
  if(!value)return null;
  let p;
  try {p=JSON.parse(Buffer.from(value,'base64url').toString());}catch {throw new Error('无效历史游标');}
  if(!Number.isSafeInteger(p.throughSeq)||p.throughSeq<0||!Number.isSafeInteger(p.beforeSeq)||p.beforeSeq<0||p.beforeSeq>p.throughSeq)throw new Error('无效历史游标');
  return {throughSeq:p.throughSeq,beforeSeq:p.beforeSeq};
}

export class CodexClient {
  constructor(socket) { this.socket = socket; this.pending = new Map(); this.seq = 0; this.recent=new Map(); this.requests=new Map(); this.owned=new Set(); }
  async connect() {
    if (this.connecting) return this.connecting;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.connecting = (async () => {
      const ws = this.ws = new WebSocket(`ws+unix://${this.socket}:/`);
      this.owned.clear();
      ws.on('message', bytes => {
        let m; try { m = JSON.parse(bytes); } catch { return; }
        if(m.method==='item/completed' && m.params?.threadId) {
          const item=m.params.item;
          if(item?.type==='agentMessage') {
            const recent=this.recent.get(m.params.threadId)??[];
            recent.push({role:'assistant',text:item.text});this.recent.set(m.params.threadId,recent.slice(-6));
          }
        }
        if(m.method==='turn/completed' && m.params?.threadId) {
          const messages=(m.params.turn?.items??[]).filter(i=>i.type==='agentMessage').map(i=>({role:'assistant',text:i.text}));
          if(messages.length)this.recent.set(m.params.threadId,messages.slice(-6));
        }
        if (m.id != null && this.pending.has(m.id)) {
          const p = this.pending.get(m.id); this.pending.delete(m.id); clearTimeout(p.timer);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        } else if (m.id != null && m.method) {
          // Leave approvals pending. A paired UI can display/answer them explicitly.
          // No approval policy is weakened by the remote controller.
          this.requests.set(m.id,{method:m.method,threadId:m.params?.threadId});
        }
      });
      ws.on('close', () => { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Codex connection closed')); } this.pending.clear(); });
      ws.on('error', () => {});
      await new Promise((resolve,reject) => { ws.once('open',resolve); ws.once('error',reject); });
      await this.call('initialize',{clientInfo:{name:'decky-agent-remote',version:'0.1.0'}});
      ws.send(JSON.stringify({method:'initialized'}));
    })().finally(() => { this.connecting = null; });
    return this.connecting;
  }
  call(method,params) {
    const id = ++this.seq;
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Codex request timed out')); },20000);
      this.pending.set(id,{resolve,reject,timer});
      try { this.ws.send(JSON.stringify({id,method,params})); } catch(e) { clearTimeout(timer);this.pending.delete(id);reject(e); }
    });
  }
  async list() {
    await this.connect();
    const r = await this.call('thread/list',{limit:60,sourceKinds:['cli','vscode','appServer'],sortKey:'updated_at',archived:false});
    return r.data.map(t => ({id:t.id,title:t.name || t.preview?.slice(0,80) || t.id,state:t.status?.type ?? 'unknown',flags:t.status?.activeFlags??[],cwd:t.cwd,updatedAt:t.updatedAt,live:t.status?.type!=='notLoaded'}));
  }
  async detail(id) {
    await this.connect();
    const {thread:t} = await this.call('thread/read',{threadId:id});
    let turns;
    try { turns=(await this.call('thread/turns/list',{threadId:id,limit:2,sortDirection:'desc',itemsView:'summary'})).data; }
    catch(e) {
      if(!e.message.includes('ephemeral threads do not support'))throw e;
      turns=[];
    }
    const messages = [];
    for (const turn of [...turns].reverse()) for (const item of turn.items??[]) {
      if (item.type==='agentMessage') messages.push({role:'assistant',text:item.text});
      if (item.type==='userMessage') messages.push({role:'user',text:(item.content??[]).filter(p=>p.type==='text').map(p=>p.text).join('\n')});
    }
    return {id:t.id,title:t.name || t.preview?.slice(0,80) || id,state:t.status?.type??'unknown',flags:t.status?.activeFlags??[],messages:messages.length?messages.slice(-6):this.recent.get(id)??[],live:t.status?.type!=='notLoaded'};
  }
  async create(cwd,language='zh-CN') {
    await this.connect();
    const {thread} = await this.call('thread/start',{cwd});
    this.owned.add(thread.id);
    await this.call('thread/name/set',{threadId:thread.id,name:(language==='en'?'Deck voice · ':'Deck 远程语音 · ')+new Date().toLocaleString(language==='en'?'en':'zh-CN')});
    return {id:thread.id};
  }
  async history(id,cursor) {
    await this.connect();
    let page;
    try {page=await this.call('thread/items/list',{threadId:id,limit:100,sortDirection:'desc',...(cursor?{cursor}:{})});}
    catch(e) {if(!e.message.includes('ephemeral threads do not support'))throw e;return {messages:this.recent.get(id)??[],nextCursor:null};}
    const messages=[];
    for(const row of [...page.data].reverse()) {
      const item=row.item;
      let role,text;
      if(item.type==='agentMessage'){role='assistant';text=item.text;}
      if(item.type==='userMessage'){role='user';text=(item.content??[]).filter(p=>p.type==='text').map(p=>p.text).join('\n');}
      if(role&&text?.trim())messages.push({id:item.id,role,text,time:row.completedAtMs??row.startedAtMs});
    }
    return {messages,nextCursor:page.nextCursor??null};
  }
  async send(id,text) {
    await this.connect();
    const {thread} = await this.call('thread/read',{threadId:id});
    // Desktop chats can be held by another app-server. Do not steal their writer.
    if (thread.status?.type==='notLoaded') throw new Error('该聊天未由共享 Codex 后台载入。请在执行机器打开此会话，或新建远程会话。');
    if (thread.status?.type==='active') throw new Error('Codex 正在执行，请等本轮完成后发送。');
    if(!this.owned.has(id)) { await this.call('thread/resume',{threadId:id});this.owned.add(id); }
    const result = await this.call('turn/start',{threadId:id,input:[{type:'text',text,text_elements:[]}]});
    return {accepted:true,turnId:result.turn?.id};
  }
}

export class DshClient {
  constructor(base='http://127.0.0.1:3080', options={}) {
    const parsed=new URL(base);
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('Invalid DSH URL');
    this.base=base.replace(/\/$/,''); this.cookie='';this.options=options;
    this.home=options.home??`${homedir()}/.dsh`;
  }
  async login() {
    const tokens=[];
    if(this.options.tokenFile)tokens.push((await readFile(this.options.tokenFile,'utf8')).trim());
    else if(process.env.DSH_LAUNCH_TOKEN)tokens.push(process.env.DSH_LAUNCH_TOKEN);
    else {
      const dir = `${this.home}/logs`;
      const files = (await readdir(dir)).filter(f=>/^web.*\.log$/.test(f)).sort();
      for (const file of files) {
        const log=await readFile(`${dir}/${file}`,'utf8');
        for (const m of log.matchAll(/https?:\/\/[^\s/]+\/\?token=([^\s]+)/g)) tokens.push(m[1]);
      }
    }
    for (const token of tokens.reverse()) {
      const r=await fetch(`${this.base}/?token=${encodeURIComponent(token)}`,{redirect:'manual',signal:AbortSignal.timeout(5000)});
      const cookies=r.headers.getSetCookie();
      if (cookies.length) { this.cookie=cookies.map(c=>c.split(';')[0]).join('; '); return; }
    }
    throw new Error('DSH 登录凭据不可用，请在执行机器启动 DSH Web 服务');
  }
  async rpc(method,args,retry=true,namespace='session') {
    if (!this.cookie) await this.login();
    const r=await fetch(`${this.base}/api/${namespace}/${method}`,{method:'POST',headers:{'Content-Type':'application/json','Origin':this.base,'Cookie':this.cookie},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method:`${namespace}/${method}`,payload:{args}}),signal:AbortSignal.timeout(20000)});
    if ((r.status===401||r.status===403) && retry) { this.cookie=''; return this.rpc(method,args,false,namespace); }
    if (!r.ok) throw new Error(`DSH HTTP ${r.status}`);
    const envelope=await r.json();
    if (!envelope.result?.ok) throw new Error(envelope.result?.error?.message??'DSH 请求失败');
    return envelope.result.value;
  }
  normalize(s) {
    const p=s.projections?.values??{};
    const last=p.turnOutline?.at(-1);
    const waiting=(p.userQuestions?.pending?.length??0)>0;
    return {id:s.sessionId,title:p.title||s.sessionId,state:waiting?'waiting':s.running?'active':s.agentAvailable?'idle':'notLoaded',cwd:s.cwd,updatedAt:s.updatedAt,live:true,messages:last?[{role:'user',text:last.prompt??''},{role:'assistant',text:last.response??''}]:[]};
  }
  async list() {
    // session/list includes archived records; the local registry owns visibility.
    let archived=new Set();
    try { archived=new Set(JSON.parse(await readFile(`${this.home}/storages/workspace.json`,'utf8')).global?.archivedSessionIds??[]); }
    catch(e) { if(e.code!=='ENOENT')throw new Error('DSH 归档列表读取失败'); }
    return (await this.rpc('list',{_request:{}})).items.filter(i=>i.origin!=='subagent'&&!archived.has(i.sessionId)).map(s=>this.normalize(s)).slice(0,60);
  }
  async detail(id) {
    const all=await this.list(),row=all.find(s=>s.id===id);
    if(!row)throw new Error('DSH 会话已不存在');
    const baseline=await this.rpc('projections',{request:{sessionId:id}});
    if(!baseline)throw new Error('DSH 会话已不存在');
    const page=await this.rpc('page',{request:{address:{kind:'session',sessionId:id},throughSeq:baseline.asOfSeq,maxMessages:6}});
    return {...row,messages:displayMessages(page.records).slice(-6)};
  }
  async history(id,cursor) {
    let request=dshHistoryCursor(cursor);
    if(!request) {
      const baseline=await this.rpc('projections',{request:{sessionId:id}});
      if(!baseline)throw new Error('DSH 会话已不存在');
      request={throughSeq:baseline.asOfSeq};
    }
    const page=await this.rpc('page',{request:{address:{kind:'session',sessionId:id},...request,maxMessages:20}});
    const first=page.records[0]?.event?.seq;
    const nextCursor=page.hasMore&&Number.isSafeInteger(first)&&first>0?Buffer.from(JSON.stringify({throughSeq:request.throughSeq,beforeSeq:first})).toString('base64url'):null;
    return {messages:displayMessages(page.records),nextCursor};
  }
  async send(id,text,requestId=randomUUID()) { return this.rpc('prompt',{request:{sessionId:id,requestId,mode:'queue',content:[{type:'text',text}],clientTimeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}}); }
  async create(cwd) { const r=await this.rpc('create',{request:{cwd}});return {id:r.sessionId}; }
}
