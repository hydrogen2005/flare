import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate,fromYaml,escape} from '../src/model.js';
import {defaults} from '../src/defaults.js';
import {home} from '../src/views.js';
import {parse} from 'yaml';
test('reject script URLs and credentials',()=>{for(const link of ['javascript:alert(1)','data:text/html,x','https://user:pass@example.com']){const d=structuredClone(defaults);d.apps.links[0].link=link;assert.throws(()=>validate(d))}});
test('validate categories and limits',()=>{const d=structuredClone(defaults);d.bookmarks.categories.push(d.bookmarks.categories[0]);assert.throws(()=>validate(d));d.bookmarks.categories.pop();d.bookmarks.links[0].category='missing';assert.throws(()=>validate(d))});
test('HTML escape user-controlled text and search',()=>{const d=structuredClone(defaults);d.settings.greeting='<script>alert(1)</script>';assert(!home(d).includes('<script>alert(1)</script>'));assert.equal(escape('"<&'), '&quot;&lt;&amp;');assert(home(defaults,'zzzz-not-found').includes('暂无匹配'))});
test('original YAML numeric category migration',()=>{const d=fromYaml({apps:'links: []',bookmarks:'categories:\n  - id: 1\n    title: 工作\nlinks:\n  - name: GitHub\n    link: https://github.com\n    category: 1',config:'title: 导航\nshow_weather: false'},parse);assert.equal(d.bookmarks.links[0].category,'1');assert.equal(d.settings.showWeather,false)});
const base=process.env.FLARE_TEST_URL||'http://localhost:8798';
test('Workers persistence, auth, same-origin writes and conflict handling',async()=>{
 const call=async(path,options={})=>fetch(base+path,{redirect:'manual',...options});
 assert.equal((await call('/editor')).status,303);
 assert.equal((await call('/api/data')).status,401);
 assert.equal((await call('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 const logged=await call('/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({password:'development-password-only'})});assert.equal(logged.status,200);const setCookie=logged.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);const cookie=setCookie.split(';')[0];
 const get=()=>call('/api/data',{headers:{Cookie:cookie}}).then(r=>r.json());const original=await get();
 const put=(data,origin=base)=>call('/api/data',{method:'PUT',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
 try{
 assert.equal((await put(original,'https://attacker.example')).status,403);
 const bad=structuredClone(original);bad.apps.links[0].link='javascript:alert(1)';assert.equal((await put(bad)).status,400);
 const edit=structuredClone(original);edit.settings.title='Persistence check';const responses=await Promise.all([put(edit),put(edit)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await get()).settings.title,'Persistence check');
 const current=await get();current.settings.private=true;assert.equal((await put(current)).status,200);assert.equal((await call('/')).status,303);assert.equal((await call('/api/weather')).status,401);
 const malicious=await call('/api/import',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({revision:(await get()).revision,apps:'links: [',bookmarks:'',config:''})});assert.equal(malicious.status,400);
 assert.equal((await call('/editor',{headers:{Cookie:'flare_session=9999999999999.fake.fake'}})).status,303);
 }finally{const latest=await get();assert.equal((await put({...original,revision:latest.revision})).status,200)}
 const out=await call('/api/logout',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
});
