import english from '../locales/en.json' with {type:'json'};
export type Language='zh-CN'|'en';
let language:Language='zh-CN';
export function setLanguage(value:string|undefined){language=value==='en'?'en':'zh-CN';}
export function translate(locale:string,source:string,values:Record<string,string>={}){
  const text=locale==='en'?(english as Record<string,string>)[source]??source:source;
  return text.replace(/\{(\w+)\}/g,(match,key)=>values[key]??match);
}
export const t=(source:string,values:Record<string,string>={})=>translate(language,source,values);
export const agentName=(agent:string)=>agent==='dsh'?'DeepSeek Harness':agent==='codex'?'Codex':agent;
