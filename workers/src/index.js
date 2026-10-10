import { DurableObject } from 'cloudflare:workers';
import { parse, stringify } from 'yaml';
import { defaults } from './defaults.js';
import { validate, fromYaml } from './model.js';
import { home, login, editor } from './views.js';
const encoder=new TextEncoder();
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{...headers,...extra}});
const html=body=>new Response(body,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
const hex=x=>Array.from(new Uint8Array(x),v=>v.toString(16).padStart(2,'0')).join('');
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)))}
async function equal(a,b){const x=await digest(a),y=await digest(b);let n=0;for(let i=0;i<x.length;i++)n|=x.charCodeAt(i)^y.charCodeAt(i);return n===0}
async function sign(value,env){const key=await crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET+env.ADMIN_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))}
async function authenticated(request,env){if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return false;const match=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)flare_session=([^;]+)/);if(!match)return false;const [expiry,nonce,sig,...extra]=match[1].split('.');if(extra.length||!/^\d+$/.test(expiry)||!/^\w{32}$/.test(nonce||'')||!/^\w{64}$/.test(sig||''))return false;const time=Number(expiry);if(time<Date.now()||time>Date.now()+604800000+60000)return false;return equal(sig,await sign(expiry+'.'+nonce,env))}
const cookie=(value,age)=>`flare_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
async function body(request){const length=Number(request.headers.get('Content-Length')||0);if(length>1000000)throw new Error('配置不能超过 1 MB');if(!(request.headers.get('Content-Type')||'').includes('application/json'))throw new Error('需要 JSON 数据');const reader=request.body?.getReader();if(!reader)throw new Error('提交数据为空');let chunks=[],size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();throw new Error('配置不能超过 1 MB')}chunks.push(value)}const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(all))}
export class FlareStore extends DurableObject {
  async fetch(request){try{return await this.handle(request)}catch(error){console.error('Flare request failed',error?.name);return json({error:'服务暂时不可用，请重试'},500)}}
  async handle(request){
    const url=new URL(request.url),path=url.pathname;
    const method=request.method;
    if(!['GET','HEAD','POST','PUT'].includes(method))return json({error:'不支持的请求方法'},405);
    if(['POST','PUT'].includes(method)&&request.headers.get('Origin')!==url.origin)return json({error:'请从本站编辑页提交'},403);
    const data=await this.ctx.storage.get('data')||structuredClone(defaults);
    const auth=await authenticated(request,this.env);
    if(path==='/api/login'&&method==='POST'){
      if(!this.env.ADMIN_PASSWORD||!this.env.SESSION_SECRET)return json({error:'管理员密码尚未配置'},503);
      let input;try{input=await body(request)}catch{return json({error:'登录数据不正确'},400)}
      if(typeof input.password!=='string'||input.password.length>256)return json({error:'密码不正确'},401);
      const key='login:'+await digest(request.headers.get('CF-Connecting-IP')||'local');
      const now=Date.now();
      const allowed=await this.ctx.storage.transaction(async tx=>{let rate=await tx.get(key);if(!rate||now-rate.start>900000)rate={start:now,count:0};rate.count++;await tx.put(key,rate);return rate.count<=10});
      if(!allowed)return json({error:'尝试次数过多，请 15 分钟后重试'},429,{'Retry-After':'900'});
      if(!await equal(input.password,this.env.ADMIN_PASSWORD))return json({error:'密码不正确'},401);
      const value=String(now+604800000)+'.'+crypto.randomUUID().replaceAll('-','');
      return json({ok:true},200,{'Set-Cookie':cookie(value+'.'+await sign(value,this.env),604800)});
    }
    if(path==='/api/logout'&&method==='POST')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    if(path==='/login'&&method==='GET')return auth?Response.redirect(url.origin+'/editor',303):html(login(data.settings.theme));
    if(path==='/'&&(method==='GET'||method==='HEAD')){if(data.settings.private&&!auth)return Response.redirect(url.origin+'/login',303);return html(home(data,(url.searchParams.get('q')||'').slice(0,100)))}
    if(path==='/help'&&method==='GET')return Response.redirect(url.origin+'/editor',303);
    if(path==='/api/weather'&&method==='GET'){
      if(data.settings.private&&!auth)return json({error:'请先登录'},401);
      if(!data.settings.showWeather)return json({disabled:true});
      const s=data.settings,key=`weather:${s.latitude}:${s.longitude}`;
      const cached=await this.ctx.storage.get(key);
      if(cached&&Date.now()-cached.time<600000)return json(cached.value);
      try{const endpoint=`https://api.open-meteo.com/v1/forecast?latitude=${s.latitude}&longitude=${s.longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=Asia%2FShanghai`;
        const response=await fetch(endpoint,{signal:AbortSignal.timeout(7000)});if(!response.ok)throw new Error('Weather unavailable');const result=await response.json();if(!result.current||!Number.isFinite(result.current.temperature_2m))throw new Error('Invalid weather');const value={city:s.city,...result.current,updatedAt:Date.now()};await this.ctx.storage.put(key,{time:Date.now(),value});return json(value)
      }catch{if(cached&&Date.now()-cached.time<3600000)return json({...cached.value,stale:true});return json({error:'天气暂不可用'},502)}
    }
    if((path==='/editor'||path==='/settings')&&method==='GET')return auth?html(editor(data.settings.theme)):Response.redirect(url.origin+'/login',303);
    if(!path.startsWith('/api/'))return json({error:'页面不存在'},404);
    if(!auth)return json({error:'请先登录'},401);
    if(path==='/api/data'&&method==='GET')return json(data);
    if(path==='/api/export'&&method==='GET')return json({format:'flare-workers-v1',revision:data.revision,apps:stringify(data.apps),bookmarks:stringify(data.bookmarks),config:stringify(data.settings)});
    if((path==='/api/data'&&method==='PUT')||(path==='/api/import'&&method==='POST')){
      let input,clean;try{input=await body(request);clean=path==='/api/import'?fromYaml(input,(s)=>{if(typeof s!=='string')throw new Error('YAML 内容为空');return parse(s,{maxAliasCount:50})}):validate(input)}catch(error){return json({error:error.message||'配置格式不正确'},400)}
      if(!Number.isSafeInteger(input.revision)||input.revision<0)return json({error:'缺少配置版本，请刷新编辑页'},400);
      const saved=await this.ctx.storage.transaction(async tx=>{const current=await tx.get('data')||defaults;if(input.revision!==current.revision)return null;const next={...clean,revision:current.revision+1};await tx.put('data',next);return next});
      if(!saved)return json({error:'其他页面已更新配置。请先下载当前备份，再重新载入页面。'},409);
      return json(saved);
    }
    return json({error:'接口不存在'},404);
  }
}
export default {async fetch(request,env){const p=new URL(request.url).pathname;if(p.startsWith('/assets/')||p.startsWith('/fonts/')||p.startsWith('/source/')||p==='/LICENSE'){const response=await env.ASSETS.fetch(request);const h=new Headers(response.headers);h.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers:h})}return env.FLARE.getByName('site').fetch(request)}};
