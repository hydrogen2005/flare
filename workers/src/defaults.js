export const defaults = {
  schemaVersion:1,revision:0,
  settings:{title:'我的导航',greeting:'所有常用，都在这里。',theme:'dark',showWeather:true,city:'合肥',latitude:31.8206,longitude:117.2272,newTab:true,private:false},
  apps:{links:[
    {name:'个人导航',link:'https://nav.lipeng.fun',icon:'compass-outline',desc:'常用网站'},
    {name:'NewsNow',link:'https://news.lipeng.fun',icon:'newspaper-variant-outline',desc:'热点与实时资讯'},
    {name:'IT-Tools',link:'https://tools.lipeng.fun',icon:'tools',desc:'开发工具箱'},
    {name:'Kindle 看板',link:'https://kindle.lipeng.fun',icon:'weather-partly-cloudy',desc:'天气与每日一句'}
  ]},
  bookmarks:{categories:[{id:'work',title:'工作与开发'},{id:'read',title:'阅读与探索'},{id:'life',title:'日常生活'}],links:[
    {name:'GitHub',link:'https://github.com',icon:'github',category:'work'},
    {name:'Cloudflare',link:'https://dash.cloudflare.com',icon:'cloud-outline',category:'work'},
    {name:'MDN',link:'https://developer.mozilla.org/zh-CN/',icon:'code-tags',category:'work'},
    {name:'Hacker News',link:'https://news.ycombinator.com',icon:'text-box-outline',category:'read'},
    {name:'少数派',link:'https://sspai.com',icon:'book-open-page-variant-outline',category:'read'},
    {name:'哔哩哔哩',link:'https://www.bilibili.com',icon:'play-circle-outline',category:'life'},
    {name:'OpenStreetMap',link:'https://www.openstreetmap.org',icon:'map-outline',category:'life'}
  ]}
};
