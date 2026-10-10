import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {zipSync} from 'fflate';
const root=path.resolve('..'),files={};
for(const relative of execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split('\n')){if(relative&&!relative.startsWith('workers/'))files['flare/'+relative]=new Uint8Array(fs.readFileSync(path.join(root,relative)))}
function add(relative){const absolute=path.resolve(relative);if(fs.statSync(absolute).isDirectory()){for(const f of fs.readdirSync(absolute))add(relative+'/'+f)}else files['flare/workers/'+relative.replaceAll('\\','/')]=new Uint8Array(fs.readFileSync(absolute))}
for(const relative of ['src','public/assets','public/fonts','test','scripts','package.json','package-lock.json','wrangler.jsonc','README.md','.gitignore','.dev.vars.example'])if(fs.existsSync(relative))add(relative);
fs.mkdirSync('public/source',{recursive:true});fs.writeFileSync('public/source/flare-workers.zip',zipSync(files,{level:6}));console.log(`Source archive: ${Object.keys(files).length} files, ${fs.statSync('public/source/flare-workers.zip').size} bytes`);
