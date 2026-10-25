import {tr} from './english.mjs';
const isEnglish=new URLSearchParams(location.search).get('lang')==='en';
const translate=value=>isEnglish?tr(value):value;
const translatedProps=props=>props?{...props,...('children' in props?{children:Array.isArray(props.children)?props.children.map(translate):translate(props.children)}:{})}:props;
const h=React.createElement;
window.SP_REACT=React;window.SP_REACTDOM=ReactDOM;window.SP_JSX={jsx:(type,props,key)=>h(type,{...translatedProps(props),key}),jsxs:(type,props,key)=>h(type,{...translatedProps(props),key})};
const messages=[{id:'demo-1',role:'user',text:'帮我查看游戏模组的修改进度。'},{id:'demo-2',role:'assistant',text:'已检查配置文件，完成天赋选择界面的调整。\n\n• 保留原有存档\n• 修改只影响本地游戏\n• 等待你确认实际关卡表现\n\n可以继续游戏。需要新任务时，按住 R4 说话即可。'}];
if(isEnglish){
 messages[0].text='Check the progress of my local game mod.';
 messages[1].text='The configuration changes are ready for review.\n\n• Original saves are preserved\n• Changes target the local game\n• In-game verification is still pending\n\nHold R4 when you have another instruction.';
 document.documentElement.lang='en';
 document.querySelector('.intro h1').innerHTML='Keep playing.<br>Keep work moving.';
 document.querySelector('.intro p').innerHTML='Open to the latest reply.<br>Hold to talk. Release to send.<br>DSH runs on your computer.';
 document.querySelector('.demo').textContent='ENGLISH-LOCALIZED PREVIEW · SYNTHETIC DATA · v0.4.1 UI / ASR: CHINESE / MANDARIN';
}
let state={hosts:[{id:'demo',name:translate('我的电脑'),url:'http://192.0.2.10:18765'}],host:'demo',agent:'dsh',session:'demo-session',hotkey:33,autoSend:true,phase:'idle',draft:'',last:''};
const listeners=new Map();const notify=(name,...args)=>(listeners.get(name)??[]).forEach(f=>f(...args));
const snapshot=()=>structuredClone(state);
const row=()=>({id:'demo-session',title:translate('游戏模组 · 本地修改'),state:'idle',live:true,messages:structuredClone(messages)});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const handlers={
 get_state:snapshot,capabilities:()=>({agents:['dsh'],speech:true}),sessions:()=>({sessions:[row()]}),detail:row,history:()=>({messages:structuredClone(messages),nextCursor:null}),
 select:(host,agent,session)=>{state={...state,host,agent,session};return snapshot();},
 preferences:(hotkey,autoSend)=>{Object.assign(state,{hotkey,autoSend});return snapshot();},
 save_host:(id,name,url)=>{state.hosts=[...state.hosts.filter(h=>h.id!==id),{id:id||'new-demo',name,url}];state.host=id||'new-demo';state.session='';return snapshot();},
 remove_host:id=>{state.hosts=state.hosts.filter(h=>h.id!==id);state.host=state.hosts[0]?.id??'';state.session='';return snapshot();},
 new_session:()=>{state.session='demo-session';return snapshot();},
 record_start:()=>{state.phase='recording';return snapshot();},
 cancel_recording:()=>{state.phase='idle';return snapshot();},
 discard_draft:()=>{state.draft='';return snapshot();},
 record_stop:async()=>{state.phase='transcribing';notify('agent_notice','正在识别','演示');await sleep(900);state.draft=isEnglish?'Please check the updated configuration.':'请继续检查更新后的配置。';if(state.autoSend)await handlers.send_text(state.draft);state.phase='idle';return snapshot();},
 send_text:async text=>{state.phase='sending';messages.push({id:crypto.randomUUID(),role:'user',text});state.draft='';await sleep(600);messages.push({id:crypto.randomUUID(),role:'assistant',text:isEnglish?'Understood. Next I would check compatibility and document the changes.\n\nThis is a synthetic demo response. No live agent received this instruction.':'收到，接下来检查配置兼容性，并整理修改记录。\n\n这是演示回复，没有向真实 Agent 派发任务。'});state.phase='idle';notify('agent_reply',state.host,'dsh',state.session,row().title,'收到，接下来检查配置兼容性。');return {accepted:true};},
};
window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit={connect:()=>({_version:2,callable:name=>async(...args)=>{if(!handlers[name])throw Error('Unsupported demo call');return handlers[name](...args);},addEventListener:(name,fn)=>{listeners.set(name,[...(listeners.get(name)??[]),fn]);return fn;},removeEventListener:()=>{},toaster:{toast:({title,body})=>{const el=document.querySelector('#toast');el.textContent=title+' · '+body;el.style.display='block';setTimeout(()=>{el.style.display='none';},2500);}}})};
const clean=props=>{const {children,preferredFocus,onSecondaryButton,onSecondaryActionDescription,...rest}=props;delete rest['flow-children'];return {children,rest,onSecondaryButton};};
const Focusable=React.forwardRef((props,ref)=>{const {children,rest,onSecondaryButton}=clean(props);return h('div',{...rest,ref,onKeyDown:e=>{if(e.key.toLowerCase()==='x')onSecondaryButton?.(e);}},children);});
const Button=props=>{const {children,rest}=clean(props);return h('button',rest,children);};
const ButtonItem=({layout,...props})=>h(Button,{...props,className:'field-button'});
const labelText=node=>typeof node==='object'?React.Children.toArray(node.props?.children).map(labelText).join(''):String(node??'');
const DropdownItem=({label,rgOptions,selectedOption,onChange,disabled,strDefaultLabel})=>h('label',{},translate(label),h('select',{value:selectedOption,disabled,onChange:e=>onChange(rgOptions.find(o=>String(o.data)===e.target.value))},h('option',{value:''},translate(strDefaultLabel)??(isEnglish?'Choose':'请选择')),...rgOptions.map(o=>h('option',{key:o.data,value:o.data},translate(labelText(o.label))))));
const TextField=({label,bIsPassword,value,onChange,placeholder,disabled})=>h('label',{},translate(label),h('input',{type:bIsPassword?'password':'text',value,onChange,placeholder:translate(placeholder),disabled}));
const ToggleField=({label,checked,onChange,disabled})=>h('label',{},h('input',{type:'checkbox',checked,disabled,onChange:e=>onChange(e.target.checked),style:{display:'inline',width:20,marginRight:10}}),translate(label));
let modalRoot,closeModal;
function showModal(element){const container=document.querySelector('#modal');container.style.display='flex';let done;const ClosedPromise=new Promise(r=>{done=r;});closeModal=()=>{modalRoot?.unmount();modalRoot=null;container.style.display='none';done();};modalRoot=ReactDOM.createRoot(container);modalRoot.render(React.cloneElement(element,{closeModal}));return {Close:closeModal,ClosedPromise};}
const ConfirmModal=({strTitle,strDescription,children,strOKButtonText,onOK,onCancel,closeModal})=>h('div',{className:'modal'},h('h2',{},translate(strTitle)),strDescription&&h('p',{},translate(strDescription)),children,h(Button,{className:'field-button',onClick:()=>{onOK?.();closeModal?.();}},translate(strOKButtonText)??(isEnglish?'OK':'确定')),onCancel&&h(Button,{onClick:()=>{onCancel();closeModal?.();}},translate('关闭')));
window.DFL={Button,ButtonItem,DropdownItem,ToggleField,TextField,Focusable,ConfirmModal,DialogBody:props=>h('div',props),showModal,Navigation:{OpenQuickAccessMenu:()=>{}},staticClasses:{Title:'title'}};
window.SteamClient={Input:{RegisterForControllerInputMessages:cb=>{document.addEventListener('keydown',e=>{if(e.code==='F8')cb(0,state.hotkey,true);});document.addEventListener('keyup',e=>{if(e.code==='F8')cb(0,state.hotkey,false);});return {unregister:()=>{}};}}};
const {default:plugin}=await import('/plugin.js');const p=plugin();ReactDOM.createRoot(document.querySelector('#root')).render(p.content);
