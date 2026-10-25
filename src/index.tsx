import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, ButtonItem, DropdownItem, ToggleField, TextField, Focusable, ConfirmModal, DialogBody, showModal, Navigation, staticClasses } from '@decky/ui';
import { callable, definePlugin, toaster, addEventListener, removeEventListener } from '@decky/api';
import { FaSatelliteDish } from 'react-icons/fa';
import {createPushToTalk} from './ptt';

declare const SteamClient:{Input:{RegisterForControllerInputMessages:(cb:(index:number,button:number,down:boolean)=>void)=>{unregister:()=>void}}};
declare global {interface Window {DeckyPluginLoader?:{deckyState?:{setActivePlugin:(name:string)=>void}}}}

type State = {hosts:{id:string;name:string;url:string}[];host:string;agent:string;session:string;hotkey:number;autoSend:boolean;phase:string;draft:string;last:string};
type Message = {id?:string;role:string;text:string;time?:number};
type Session = {id:string;title:string;state:string;flags?:string[];cwd?:string;live?:boolean;messages?:Message[]};
type HistoryPage = {messages:Message[];nextCursor:string|null};
const saveHost=callable<[string,string,string,string],State>('save_host');
const removeHost=callable<[string],State>('remove_host');
const capabilities=callable<[string],{agents:string[];speech:boolean}>('capabilities');
const getState=callable<[],State>('get_state');
const select=callable<[string,string,string],State>('select');
const preferences=callable<[number,boolean],State>('preferences');
const sessions=callable<[string,string],{sessions:Session[]}>('sessions');
const detail=callable<[string,string,string],Session>('detail');
const history=callable<[string,string,string,string],HistoryPage>('history');
const recordStart=callable<[],State>('record_start');
const recordStop=callable<[boolean],State>('record_stop');
const cancelRecording=callable<[],State>('cancel_recording');
const sendText=callable<[string],unknown>('send_text');
const discardDraft=callable<[],State>('discard_draft');
const newSession=callable<[],State>('new_session');
let current:State|undefined;
const listeners=new Set<()=>void>();
const cache=new Map<string,Session>();
let wantsLatest=false;
let settingsView:ReturnType<typeof showModal>|undefined;
const targetKey=(s:State)=>`${s.host}:${s.agent}:${s.session}`;
const publish=()=>listeners.forEach(fn=>fn());
const putState=(s:State)=>{current=s;publish();};
const putSession=(s:State,value:Session)=>{
  cache.delete(targetKey(s));cache.set(targetKey(s),value);
  if(cache.size>5)cache.delete(cache.keys().next().value!);
  publish();
};
const cached=()=>current?cache.get(targetKey(current)):undefined;
const statusText=(s:string)=>({active:'执行中',idle:'已连接',waiting:'等待回复',systemError:'执行异常',notLoaded:'保存的会话'}[s]??s);
const notify=(title:string,body:string)=>toaster.toast({title,body,duration:4500});
const fail=(e:unknown)=>notify('Agent Remote',String(e));
const wrapped:CSSProperties={minWidth:0,maxWidth:'100%',whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.5};
const hint:CSSProperties={...wrapped,fontSize:12,opacity:.65};
const messageKey=(m:Message)=>m.id??`${m.role}:${m.time??''}:${m.text}`;
function mergeMessages(older:Message[],newer:Message[]){
  const all=new Map<string,Message>();
  for(const m of [...older,...newer])all.set(messageKey(m),m);
  return [...all.values()];
}
function showPanel(){settingsView?.Close();wantsLatest=true;publish();window.DeckyPluginLoader?.deckyState?.setActivePlugin('Agent Remote');Navigation.OpenQuickAccessMenu(999);}

function SettingsModal({closeModal}:{closeModal?:()=>void}){
  const [s,setS]=useState(current);
  const [rows,setRows]=useState<Session[]>([]);
  const [agents,setAgents]=useState<string[]>(['dsh']);
  const [editing,setEditing]=useState(current?.hosts.length===0);
  const [hostId,setHostId]=useState('');
  const [name,setName]=useState('');
  const [url,setUrl]=useState('');
  const [token,setToken]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const working=useRef(false);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;const sync=()=>setS(current);listeners.add(sync);return()=>{alive.current=false;listeners.delete(sync);};},[]);
  useEffect(()=>{setRows([]);setError('');if(!s?.host)return;let valid=true;void capabilities(s.host).then(r=>{if(valid)setAgents(r.agents??['dsh']);}).catch(()=>{});void sessions(s.host,s.agent).then(r=>{if(valid)setRows(r.sessions);}).catch(e=>{if(valid)setError(String(e));});return()=>{valid=false;};},[s?.host,s?.agent]);
  const run=async(fn:()=>Promise<State>)=>{
    if(working.current)return;working.current=true;setBusy(true);
    try{putState(await fn());if(alive.current)setError('');}catch(e){if(alive.current)setError(String(e));}finally{working.current=false;if(alive.current)setBusy(false);}
  };
  if(!s)return null;
  const locked=busy||s.phase!=='idle';
  return <ConfirmModal strTitle="切换会话与设置" strOKButtonText="回到聊天" bAlertDialog onOK={closeModal} onCancel={closeModal}>
    <DialogBody style={{maxHeight:'60vh',overflowY:'auto'}}>
      <ButtonItem layout="below" disabled={locked} onClick={()=>{setEditing(v=>!v);setHostId('');setName('');setUrl('');setToken('');}}>{editing?'取消添加':'＋ 添加执行机器'}</ButtonItem>
      {editing&&<div>
        <TextField label="机器名称" value={name} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="我的电脑"/>
        <TextField label="Bridge 地址" value={url} disabled={busy} onChange={e=>setUrl(e.target.value)} placeholder="http://主机地址:18765"/>
        <TextField label="连接令牌" bIsPassword value={token} disabled={busy} onChange={e=>setToken(e.target.value)} placeholder={hostId?'留空保留原令牌':'从执行机器的 bridge 配置复制'}/>
        <ButtonItem layout="below" disabled={locked||!name||!url||(!hostId&&!token)} onClick={()=>void run(async()=>{const state=await saveHost(hostId,name,url,token);setEditing(false);setToken('');return state;})}>连接并保存</ButtonItem>
      </div>}
      <DropdownItem label="机器" layout="below" childrenContainerWidth="max" rgOptions={s.hosts.map(h=>({data:h.id,label:h.name}))} selectedOption={s.host} disabled={locked} onChange={o=>void run(()=>select(o.data,s.agent,''))}/>
      <DropdownItem label="Agent" layout="below" childrenContainerWidth="max" rgOptions={agents.map(data=>({data,label:data.toUpperCase()}))} selectedOption={s.agent} disabled={locked} onChange={o=>void run(()=>select(s.host,o.data,''))}/>
      <DropdownItem key={`${s.host}:${s.agent}:${rows.length}`} label="会话" layout="below" childrenContainerWidth="max" selectedOption={s.session} strDefaultLabel="请选择会话" rgOptions={rows.map(r=>({data:r.id,label:<div style={wrapped}>{r.title}</div>}))} disabled={locked} onChange={o=>void run(async()=>{const state=await select(s.host,s.agent,o.data);putState(state);closeModal?.();return state;})}/>
      <ButtonItem layout="below" disabled={locked} onClick={()=>void run(async()=>{const state=await newSession();putState(state);closeModal?.();return state;})}>新建会话并开始聊天</ButtonItem>
      {!!s.host&&<ButtonItem layout="below" disabled={locked} onClick={()=>{const host=s.hosts.find(h=>h.id===s.host);if(host){setHostId(host.id);setName(host.name);setUrl(host.url);setToken('');setEditing(true);}}}>编辑当前机器</ButtonItem>}
      {!!s.host&&<ButtonItem layout="below" disabled={locked} onClick={()=>showModal(<ConfirmModal strTitle="移除此机器？" strDescription="只移除 Deck 上的连接配置，不影响远端会话。" strOKButtonText="移除" onOK={()=>void run(()=>removeHost(s.host))}/>)}>移除当前机器</ButtonItem>}
      <ToggleField label="松开后自动发送" checked={s.autoSend} disabled={locked} onChange={v=>void run(()=>preferences(s.hotkey,v))}/>
      <DropdownItem label="说话背键" layout="below" childrenContainerWidth="max" rgOptions={[{data:33,label:'R4'},{data:32,label:'L4'},{data:45,label:'R5'},{data:44,label:'L5'},{data:-1,label:'关闭背键'}]} selectedOption={s.hotkey} disabled={locked} onChange={o=>void run(()=>preferences(o.data,s.autoSend))}/>
      {error&&<div style={{...wrapped,color:'#ffb7ad'}}>{error}</div>}
    </DialogBody>
  </ConfirmModal>;
}
const settings=()=>{settingsView=showModal(<SettingsModal/>);const view=settingsView;void view.ClosedPromise.then(()=>{if(settingsView===view)settingsView=undefined;});return view;};

function Content(){
  const [s,setS]=useState(current);
  const [selected,setSelected]=useState(cached);
  const [messages,setMessages]=useState<Message[]>(()=>cached()?.messages??[]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [operationError,setOperationError]=useState('');
  const [busy,setBusy]=useState(false);
  const [loadingOlder,setLoadingOlder]=useState(false);
  const [online,setOnline]=useState(false);
  const [newReply,setNewReply]=useState(false);
  const [draft,setDraft]=useState(current?.draft??'');
  const scroll=useRef<HTMLDivElement>(null);
  const latest=useRef<HTMLDivElement>(null);
  const key=useRef(current?targetKey(current):'');
  const generation=useRef(0);
  const hydrated=useRef('');
  const alive=useRef(true);
  const following=useRef(true);
  const lastScroll=useRef(0);
  const actionBusy=useRef(false);
  const fetching=useRef(false);
  const lastAssistant=useRef('');
  const anchor=useRef<'latest'|'bottom'|{height:number;top:number}|null>('latest');
  const programmatic=useRef(false);
  const refreshRef=useRef<()=>Promise<void>>(async()=>{});
  const receive=(value:Session)=>{
    setSelected(value);
    const reply=value.messages?.filter(m=>m.role==='assistant').slice(-1)[0];
    const fingerprint=reply?messageKey(reply)+reply.text:'';
    if(fingerprint&&fingerprint!==lastAssistant.current){
      if(following.current)anchor.current='latest';else setNewReply(true);
      lastAssistant.current=fingerprint;
    }
    setMessages(previous=>mergeMessages(previous,value.messages??[]));
  };
  useEffect(()=>{
    alive.current=true;
    const sync=()=>{
      if(!current||!alive.current)return;
      const next=targetKey(current);
      if(next!==key.current){
        generation.current++;key.current=next;hydrated.current='';
        setMessages(cache.get(next)?.messages??[]);setCursor(null);setError('');setOperationError('');setSelected(cache.get(next));
        setOnline(false);following.current=true;lastAssistant.current='';anchor.current='latest';setNewReply(false);
        void Promise.resolve().then(()=>refreshRef.current());
      }
      setS(current);
      const value=cache.get(next);if(value)receive(value);
      if(wantsLatest){wantsLatest=false;following.current=true;setNewReply(false);anchor.current='latest';setMessages(previous=>[...previous]);}
    };
    const refresh=async()=>{
      if(fetching.current||actionBusy.current||!alive.current)return;
      fetching.current=true;const version=generation.current;
      try{
        const state=await getState();if(!alive.current||version!==generation.current)return;
        putState(state);
        const activeKey=targetKey(state),epoch=generation.current;
        const valid=()=>alive.current&&epoch===generation.current&&current&&targetKey(current)===activeKey;
        if(!state.session)return;
        const value=await detail(state.host,state.agent,state.session);if(!valid())return;
        putSession(state,value);setOnline(true);setError('');
        if(hydrated.current!==activeKey){
          const page=await history(state.host,state.agent,state.session,'');if(!valid())return;
          hydrated.current=activeKey;setCursor(page.nextCursor);anchor.current='latest';
          setMessages(previous=>mergeMessages(page.messages,previous));
        }
      }catch(e){if(alive.current&&version===generation.current){setOnline(false);setError(String(e));}}
      finally{fetching.current=false;}
    };
    refreshRef.current=refresh;listeners.add(sync);sync();void refresh();
    const timer=setInterval(()=>void refresh(),2000);
    return()=>{alive.current=false;listeners.delete(sync);clearInterval(timer);};
  },[]);
  useEffect(()=>{setDraft(s?.draft??'');if(s?.phase==='recording'||s?.phase==='transcribing')anchor.current='bottom';},[s?.draft,s?.phase]);
  useLayoutEffect(()=>{
    const area=scroll.current;if(!area||!anchor.current)return;
    programmatic.current=true;
    if(anchor.current==='latest'&&latest.current)area.scrollTop+=latest.current.getBoundingClientRect().top-area.getBoundingClientRect().top;
    else if(anchor.current==='bottom')area.scrollTop=area.scrollHeight;
    else if(typeof anchor.current==='object')area.scrollTop=anchor.current.top+area.scrollHeight-anchor.current.height;
    lastScroll.current=area.scrollTop;anchor.current=null;
    requestAnimationFrame(()=>{programmatic.current=false;});
  },[messages,s?.phase]);
  const run=async(fn:()=>Promise<State|void>)=>{
    if(actionBusy.current)return;
    actionBusy.current=true;setBusy(true);setOperationError('');
    try{const state=await fn();if(state)putState(state);setError('');}
    catch(e){setOperationError(String(e));}
    finally{actionBusy.current=false;setBusy(false);void refreshRef.current();}
  };
  const older=async()=>{
    if(!s||!cursor||loadingOlder)return;
    const state=s,version=generation.current;setLoadingOlder(true);following.current=false;
    try{
      const page=await history(state.host,state.agent,state.session,cursor);
      if(!alive.current||version!==generation.current)return;
      if(scroll.current)anchor.current={height:scroll.current.scrollHeight,top:scroll.current.scrollTop};
      setMessages(previous=>mergeMessages(page.messages,previous));setCursor(page.nextCursor);setError('');
    }catch(e){if(version===generation.current)setError(String(e));}
    finally{if(alive.current)setLoadingOlder(false);}
  };
  if(!s)return <div style={{padding:16,...hint}}>正在读取会话…</div>;
  const lastReply=messages.filter(m=>m.role==='assistant').slice(-1)[0];
  const host=s.hosts.find(h=>h.id===s.host)?.name??s.host;
  const locked=busy||['transcribing','sending','creating'].includes(s.phase);
  const hotkeyName=({33:'R4',32:'L4',45:'R5',44:'L5'} as Record<number,string>)[s.hotkey];
  const phaseText=s.phase==='recording'?`正在听 · ${s.autoSend?'结束后发送':'结束后预览文字'}`:s.phase==='transcribing'?'正在识别普通话…':s.phase==='sending'?'正在发送…':selected?.state==='active'?'Agent 正在执行…':hotkeyName?`按住 ${hotkeyName} 说话 · ${s.autoSend?'松开发送':'松开预览'}`:'点按钮说话，再点一次发送';
  const voiceError=s.phase==='idle'&&s.last&&!s.last.startsWith('已发送：')&&!s.last.startsWith('识别完成，待发送：')?s.last:'';
  const displayError=operationError||voiceError||error;
  const buttonText=s.phase==='recording'?(s.autoSend?'结束并发送':'结束并预览'):s.phase==='transcribing'?'正在识别…':s.phase==='sending'?'正在发送…':s.draft?'发送识别文字':'说话 / 发送';
  return <Focusable flow-children="column" style={{height:'calc(100vh - 100px)',minHeight:0,display:'flex',flexDirection:'column',width:'100%',boxSizing:'border-box',padding:'0 16px 8px',gap:8}} onSecondaryActionDescription="录音 / 发送" onSecondaryButton={e=>{e.stopPropagation();if(!locked&&s.session&&selected?.live!==false)void run(async()=>{if(s.draft){await sendText(draft);return getState();}return s.phase==='recording'?recordStop(true):recordStart();});}}>
    <div style={{flex:'0 0 auto'}}>
      <Button style={{width:'100%',padding:'8px 10px',textAlign:'left',fontSize:13,background:'rgba(255,255,255,.07)',color:'#dbe2e9',border:'none'}} onClick={settings} disabled={s.phase!=='idle'}>
        <div style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{selected?.title??'选择或新建会话'} ▾</div>
        <div style={{fontSize:11,opacity:.65}}>{host} · {s.agent.toUpperCase()} · {online?statusText(selected?.state??'idle'):error?'连接异常':'连接中'}</div>
      </Button>
    </div>
    {newReply&&<Button style={{width:'100%',fontSize:12}} onClick={()=>{following.current=true;setNewReply(false);anchor.current='latest';setMessages(previous=>[...previous]);}}>有新回复 · 回到最新</Button>}
    <Focusable ref={scroll} tabIndex={0} style={{flex:'1 1 auto',minHeight:0,overflowY:'auto',overflowX:'hidden',padding:'0 4px'}} onScroll={()=>{
      const area=scroll.current;if(!area)return;
      if(!programmatic.current){if(area.scrollTop<lastScroll.current-4)following.current=false;else if(area.scrollHeight-area.clientHeight-area.scrollTop<40)following.current=true;}
      lastScroll.current=area.scrollTop;
    }}>
      {cursor&&<Button style={{width:'100%',fontSize:12,marginBottom:10}} disabled={loadingOlder} onClick={()=>void older()}>{loadingOlder?'正在读取…':'↑ 更早消息'}</Button>}
      {!s.hosts.length&&<Button style={{width:'100%'}} onClick={settings}>添加执行机器</Button>}
      {!s.session&&<div style={hint}>{s.hosts.length?'点上方选择会话，之后打开直接看回复。':'先添加执行机器，支持局域网或 Tailscale。'}</div>}
      {!!s.session&&!messages.length&&<div style={hint}>{online?'还没有消息，直接说话开始。':'正在读取聊天…'}</div>}
      {messages.map((message,i)=><div key={messageKey(message)||i} ref={message===lastReply?latest:undefined} style={{...wrapped,marginBottom:14,fontSize:14}}>
        <div style={{fontSize:11,opacity:.55,marginBottom:3}}>{message.role==='user'?'你':s.agent.toUpperCase()}{message.time?' · '+new Date(message.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):''}</div>
        <div style={{padding:'8px 10px',background:message.role==='user'?'rgba(70,125,170,.22)':'rgba(255,255,255,.05)',borderRadius:8}}>{message.text}</div>
      </div>)}
      {s.phase==='transcribing'&&<div style={hint}>正在识别你的语音…</div>}
      {s.draft&&<TextField label="识别文字" value={draft} onChange={e=>setDraft(e.target.value)}/>}
      {displayError&&<div role="alert" style={{...wrapped,fontSize:12,color:'#ffb7ad'}}>{displayError}{error&&!operationError&&!voiceError&&<Button style={{width:'100%'}} onClick={()=>void refreshRef.current()}>重试连接</Button>}</div>}
      {!!selected?.flags?.length&&<div style={hint}>需要在执行机器处理：{selected.flags.join('、')}</div>}
      {selected&&!selected.live&&<div style={hint}>这是保存的桌面聊天记录，当前后台无法发送。点上方可切换会话。</div>}
    </Focusable>
    <div style={{flex:'0 0 auto',borderTop:'1px solid rgba(255,255,255,.12)',paddingTop:8}}>
      <Button preferredFocus style={{width:'100%',fontSize:15,padding:'10px 8px',background:s.phase==='recording'?'#bd414b':'#187cba',color:'white',border:'none'}} disabled={locked||!s.session||!!selected&&!selected.live} onClick={()=>void run(async()=>{if(s.draft){await sendText(draft);return getState();}return s.phase==='recording'?recordStop(true):recordStart();})}>{buttonText}</Button>
      <div style={{fontSize:11,opacity:.65,marginTop:4,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{phaseText}</div>
      {s.phase==='recording'&&<Button style={{width:'100%',fontSize:12,marginTop:4}} onClick={()=>void run(cancelRecording)}>取消录音</Button>}
      {!!s.draft&&<Button style={{width:'100%',fontSize:12,marginTop:4}} disabled={locked} onClick={()=>void run(discardDraft)}>放弃这段文字</Button>}
    </div>
  </Focusable>;
}

export default definePlugin(()=>{
  const seed=async()=>{const state=await getState();putState(state);if(state.session)putSession(state,await detail(state.host,state.agent,state.session));};
  void seed().catch(()=>{});
  const notice=addEventListener<[string,string]>('agent_notice',(title,body)=>{
    // In the conversation, status updates inline; background recording keeps its toast.
    if(!listeners.size||title==='语音未发送')notify(title,body);
    void getState().then(putState).catch(()=>{});
  });
  const reply=addEventListener<[string,string,string,string,string]>('agent_reply',(host,agent,session,title,text)=>{
    void getState().then(async state=>{putState(state);if(state.host===host&&state.agent===agent&&state.session===session)putSession(state,await detail(host,agent,session));}).catch(()=>{});
    toaster.toast({title:'收到回复 · '+title,body:text,duration:6000,onClick:showPanel});
  });
  const ptt=createPushToTalk({start:recordStart,stop:()=>recordStop(true),onState:putState,onTap:showPanel,onError:fail});
  let controller:{unregister:()=>void}|undefined;
  try{controller=SteamClient.Input.RegisterForControllerInputMessages((_idx,button,down)=>{
    if(!current||current.hotkey<0||button!==current.hotkey)return;
    if(down)ptt.press();else ptt.release();
  });}catch(e){fail(e);}
  return {name:'Agent Remote',titleView:<div className={staticClasses.Title}>Agent Remote</div>,content:<Content/>,icon:<FaSatelliteDish/>,onDismount(){ptt.dispose();controller?.unregister();removeEventListener('agent_notice',notice);removeEventListener('agent_reply',reply);void cancelRecording().catch(()=>{});}};
});
