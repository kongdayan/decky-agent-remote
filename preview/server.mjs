// Browser-only rendering of the compiled plugin with synthetic data and Decky UI shims.
// No microphone, network bridge, filesystem agent or credentials are used here.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../',import.meta.url));
const routes={
 '/':join(root,'preview/index.html'),'/demo.js':join(root,'preview/demo.js'),
 '/plugin.js':join(root,'dist/index.js'),
 '/react.js':join(dirname(require.resolve('react/package.json')),'umd/react.production.min.js'),
 '/react-dom.js':join(dirname(require.resolve('react-dom/package.json')),'umd/react-dom.production.min.js'),
};
http.createServer(async(req,res)=>{const file=routes[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);return res.end();}try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(500);res.end('Run pnpm build first');}}).listen(4177,'127.0.0.1',()=>console.log('Synthetic UI preview: http://127.0.0.1:4177'));
