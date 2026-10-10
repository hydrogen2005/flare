import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const file='.secrets.json';
let secrets;
if(fs.existsSync(file))secrets=JSON.parse(fs.readFileSync(file,'utf8'));
else{secrets={ADMIN_PASSWORD:randomBytes(24).toString('base64url'),SESSION_SECRET:randomBytes(48).toString('base64url')};fs.writeFileSync(file,JSON.stringify(secrets),{mode:0o600});fs.writeFileSync('.admin-credentials.txt',`Flare 管理员登录\n网址：https://flare.lipeng.fun/editor\n密码：${secrets.ADMIN_PASSWORD}\n\n请妥善保管。此文件和 .secrets.json 已排除 Git 和公开源码包。\n`,{mode:0o600})}
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk',file],{stdio:'inherit'});process.exitCode=result.status??1;
