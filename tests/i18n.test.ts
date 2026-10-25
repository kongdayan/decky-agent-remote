import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {translate,setLanguage,t,agentName} from '../src/i18n.ts';

test('language switching translates UI templates without translating arbitrary conversation text',()=>{
 setLanguage('en');assert.equal(t('说话 / 发送'),'Talk / Send');
 assert.equal(t('按住 {key} 说话 · {action}',{key:'L5',action:'Release to send'}),'Hold L5 to talk · Release to send');
 assert.equal(t('This message 原文 ./Foo.ts'),'This message 原文 ./Foo.ts');
 assert.equal(agentName('dsh'),'DeepSeek Harness');
 setLanguage('zh-CN');assert.equal(t('说话 / 发送'),'说话 / 发送');
 assert.equal(translate('unknown','说话 / 发送'),'说话 / 发送');
});

test('all owned Chinese frontend strings have an English catalog entry',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../locales/en.json',import.meta.url),'utf8'));
 const source=ts.createSourceFile('index.tsx',readFileSync(new URL('../src/index.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const missing:string[]=[];
 function visit(node:ts.Node){
  if(ts.isStringLiteral(node)&&/[\u4e00-\u9fff]/.test(node.text)&&node.text!=='简体中文'&&!catalog[node.text])missing.push(node.text);
  if(ts.isJsxText(node)&&/[\u4e00-\u9fff]/.test(node.text))missing.push('Untranslated JSX: '+node.text);
  ts.forEachChild(node,visit);
 }
 visit(source);assert.deepEqual(missing,[]);
});
