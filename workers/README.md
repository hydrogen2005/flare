# Flare Workers 迁移版

运行地址：https://flare.lipeng.fun

本目录将 Flare 的核心导航功能迁到普通 Cloudflare Workers，保留原始 Go 源码（上一级目录）、Flare 基础样式与 Material Design Icons。Workers 运行时为 JavaScript，使用 SQLite-backed Durable Object 保存配置，不运行 Docker 或 Go 进程。

## 功能

- 服务端生成导航页、搜索、常用应用、分类书签、图标、深浅主题。
- 密码登录、在线编辑、排序、网站设置、公开或私密首页。
- 合肥天气（Open-Meteo），可修改城市名称和经纬度，缓存 10 分钟。
- 原版 apps.yml / bookmarks.yml 导入；config.yml 支持本版设置及部分原版字段映射。
- JSON 完整备份与恢复。保存使用版本号，避免多设备互相覆盖。
- 编辑需要登录，写入严格校验 Origin，Cookie 使用 HttpOnly / Secure / SameSite=Strict。

本版重新实现编辑器，不包含原版完整设置面板、天气动画、IP 自动定位或所有旧版 config.yml 选项。天气名称和经纬度需一起修改；不会自动地理编码。

## 运行与部署

需要 Node.js 24。进入 workers 目录运行：

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
# 修改本地 .dev.vars 中的密码和密钥
npm run dev
npm test
npm run deploy
```

生产配置需要两个独立随机 Secret：ADMIN_PASSWORD、SESSION_SECRET。通过 `wrangler secret put ADMIN_PASSWORD` 和 `wrangler secret put SESSION_SECRET` 设置；禁止把它们写进 wrangler.jsonc 或提交 Git。部署配置默认不管理域名；flare.lipeng.fun 已通过 Cloudflare 控制台绑定。未来发布不会删除这项绑定。

编辑地址：`/editor`。默认首页公开；可在设置勾选首页需要登录。登录会话 7 天过期，密码或 SESSION_SECRET 轮换会使旧会话失效。退出只清除当前浏览器 Cookie。

持久化数据存于 FLARE 命名空间的 `site` Durable Object。首次读取展示默认配置，首次保存初始化数据；后续代码部署不重置已保存配置。请通过编辑页下载备份。保留 Durable Object 类名及迁移历史。

测试使用本地 wrangler dev（默认测试地址 http://localhost:8798），涉及认证、跨站写入、恶意链接、YAML、持久化与并发版本冲突。测试完成会恢复原配置。生产验证只做只读检查。

## 上游与许可

上游：https://github.com/soulteary/flare

迁移基于 d4fd9a46c2c07dad40b56cb5f0cf8b8f2df67594。修改版按 AGPL-3.0 提供。页面底部提供本站运行版本完整源码下载，`npm run source` 将原始源码与本版实现打包；明确排除 Git、依赖、部署状态、密码和用户数据。此包必须随版本更新。请保留上游版权及第三方图标许可。

成本：使用普通 Workers 与 SQLite-backed Durable Objects，未启用 Containers 或付费计划；适用 Cloudflare 免费配额，超限行为以当前账户计划为准。
