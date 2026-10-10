import { defaults } from './defaults.js';
export function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('配置格式不正确');
  const s=input.settings;
  const str=(x,n=200)=>typeof x==='string'&&x.length<=n;
  if(!s || !str(s.title,80)||!s.title.trim()||!str(s.greeting,160)||!['dark','light'].includes(s.theme)||!str(s.city,80)) throw new Error('网站设置不正确');
  for(const key of ['showWeather','newTab','private']) if(typeof s[key]!=='boolean') throw new Error('开关设置不正确');
  if(!Number.isFinite(s.latitude)||Math.abs(s.latitude)>90||!Number.isFinite(s.longitude)||Math.abs(s.longitude)>180) throw new Error('经纬度不正确');
  const cats=input.bookmarks?.categories;
  if(!Array.isArray(cats)||cats.length>100) throw new Error('分类最多 100 个');
  const ids=new Set();
  const categories=cats.map(c=>{const id=String(c.id);if(!str(id,80)||!id||ids.has(id)||!str(c.title,80)||!c.title.trim())throw new Error('分类编号必须唯一，名称不能为空');ids.add(id);return{id,title:c.title.trim()}});
  function links(values,bookmarks) {
    if(!Array.isArray(values)||values.length>2000) throw new Error('每类最多 2000 个链接');
    return values.map(l=>{
      if(!str(l.name,120)||!l.name.trim()||!str(l.link,2048))throw new Error('链接名称或地址不正确');
      let url;try{url=new URL(l.link)}catch{throw new Error('请填写完整网址（https://…）')}
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('仅支持不含账号密码的 HTTP / HTTPS 地址');
      const icon=l.icon||'link-variant';if(!str(icon,100)||!/^[a-zA-Z0-9-]+$/.test(icon))throw new Error('图标名称只能包含字母、数字或连字符');
      if(l.desc!==undefined&&!str(l.desc,300))throw new Error('描述过长');
      const category=String(l.category??'');if(bookmarks&&category&&!ids.has(category))throw new Error('书签引用了不存在的分类');
      return {name:l.name.trim(),link:url.href,icon,desc:l.desc||'',...(bookmarks?{category}:{})};
    });
  }
  return {schemaVersion:1,settings:{title:s.title.trim(),greeting:s.greeting,theme:s.theme,city:s.city,latitude:s.latitude,longitude:s.longitude,showWeather:s.showWeather,newTab:s.newTab,private:s.private},apps:{links:links(input.apps?.links,false)},bookmarks:{categories,links:links(input.bookmarks?.links,true)}};
}
export function fromYaml(parts,parse) {
  const apps=parse(parts.apps),bookmarks=parse(parts.bookmarks),config=parse(parts.config);
  if(!config||typeof config!=='object'||Array.isArray(config)) throw new Error('config.yml 格式不正确');
  const mapping={title:'title',greeting:'greeting',theme:'theme',show_weather:'showWeather',location:'city',latitude:'latitude',longitude:'longitude',open_app_new_tab:'newTab',private:'private'};
  const settings={...defaults.settings,...config};
  for(const [old,key] of Object.entries(mapping))if(config[old]!==undefined)settings[key]=config[old];
  return validate({settings,apps,bookmarks});
}
export function escape(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
