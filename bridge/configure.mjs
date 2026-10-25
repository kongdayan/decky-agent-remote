#!/usr/bin/env node
// Creates a private config without printing its token or overwriting an existing one.
import {mkdir,open} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {homedir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {parseArgs} from 'node:util';
import {isIP} from 'node:net';
const {values:v}=parseArgs({options:{config:{type:'string'},bind:{type:'string',default:'127.0.0.1'},port:{type:'string',default:'18765'},model:{type:'string'},workspace:{type:'string'},'dsh-url':{type:'string'},'dsh-home':{type:'string'},'codex-socket':{type:'string'},help:{type:'boolean'}}});
if(v.help){console.log('node bridge/configure.mjs [--bind IP] [--port 18765] [--model PATH] [--workspace PATH] [--dsh-url URL] [--dsh-home PATH] [--codex-socket PATH] [--config PATH]');process.exit(0);}
if(!isIP(v.bind)||!/^\d+$/.test(v.port)||Number(v.port)<1||Number(v.port)>65535)throw new Error('Use an explicit IP address and a valid port');
const file=resolve(v.config??`${homedir()}/.config/decky-agent-remote/bridge.json`);
await mkdir(dirname(file),{recursive:true,mode:0o700});
const config={name:'My computer',bind:v.bind,port:Number(v.port),token:randomBytes(32).toString('hex'),workspace:resolve(v.workspace??homedir()),...(v.model?{model:resolve(v.model)}:{}),...(v['dsh-url']?{dshUrl:v['dsh-url']}:{}),...(v['dsh-home']?{dshHome:resolve(v['dsh-home'])}:{}),...(v['codex-socket']?{codexSocket:resolve(v['codex-socket'])}:{})};
try{const handle=await open(file,'wx',0o600);try{await handle.writeFile(JSON.stringify(config,null,2)+'\n');}finally{await handle.close();}}
catch(e){if(e.code==='EEXIST')throw new Error('Config already exists; edit it locally instead of replacing its token');throw e;}
console.log(`Created private config: ${file}\nCopy its token directly into the Deck plugin. Never post the config in an issue.\nStart: DECKY_AGENT_CONFIG="${file}" node bridge/server.mjs`);
