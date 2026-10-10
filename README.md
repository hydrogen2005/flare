# Flare · Cloudflare Workers 中文版

一个简洁、轻量的个人导航网站，用于整理常用应用、分类书签和在线工具。

本仓库在 [Flare](https://github.com/soulteary/flare) 基础上，将核心导航功能迁移到普通 **Cloudflare Workers**，使用 **SQLite 型 Durable Objects** 保存数据。无需运行 Docker 或常驻 Go 服务，同时保留上游 Go 源码和历史。

- [在线访问](https://flare.lipeng.fun/)
- [管理入口](https://flare.lipeng.fun/editor)
- [Workers 详细说明](workers/README.md)
- [上游英文说明](README.en.md)

## 功能

- **个人导航**：常用应用、分类书签、图标和名称、描述、网址搜索。
- **紧凑布局**：分类多列排列，名称限制为约 5 个汉字宽；超出显示省略号，鼠标悬停显示完整名称。
- **在线编辑**：添加、删除、排序应用与书签，维护分类，修改标题和问候语。
- **主题切换**：支持深色与浅色主题。
- **天气展示**：默认显示合肥天气，可修改城市名称与经纬度；天气缓存 10 分钟。
- **持久化保存**：数据存储在 Cloudflare，后续代码发布不会重置已保存配置。
- **备份与导入**：支持 JSON 完整备份、恢复，以及原版 `apps.yml` / `bookmarks.yml` 导入。
- **登录保护**：编辑页需要管理员密码；可选择首页也需要登录。
- **并发保护**：保存时检查版本号，避免不同设备的编辑互相覆盖。

## 两种运行方式

| 项目 | Workers 迁移版 | 上游 Go 版 |
| --- | --- | --- |
| 代码位置 | `workers/` | 仓库根目录及 `internal/` 等目录 |
| 运行环境 | Cloudflare Workers | 支持 Go 程序的主机或容器 |
| 数据保存 | SQLite 型 Durable Objects | 本地 YAML 配置文件 |
| Docker | 不需要 | 可使用 Docker 部署 |
| 编辑器 | 本仓库重新实现 | 上游编辑器 |

Workers 版保留核心功能，未移植原版完整设置面板、天气动画、IP 自动定位及全部旧版 `config.yml` 选项。天气城市名称和经纬度需要一起修改，不会自动根据名称查询坐标。

## 本地运行 Workers 版

需要 **Node.js 24** 和 npm。

```powershell
git clone https://github.com/hydrogen2005/flare.git
cd flare/workers
npm ci
Copy-Item .dev.vars.example .dev.vars
```

编辑本地 `.dev.vars`，设置管理员密码和独立随机会话密钥：

```dotenv
ADMIN_PASSWORD="替换为你的管理员密码"
SESSION_SECRET="替换为独立的随机长字符串"
```

启动本地服务：

```powershell
npm run dev
```

打开 [本地首页](http://localhost:8798/) 或 [本地编辑页](http://localhost:8798/editor)。本地配置和生产配置相互独立。

## 部署到 Cloudflare

在 `workers/` 目录操作。

1. 修改 `wrangler.jsonc` 中的 `account_id` 为自己的 Cloudflare 账户 ID，按需修改 Worker 的 `name`。
2. 登录 Cloudflare 并发布：

   ```powershell
   npx wrangler login
   npm run deploy
   ```

3. 设置生产环境的管理员密码和会话密钥，按提示输入各自的值：

   ```powershell
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```

4. 使用发布返回的 `workers.dev` 地址访问。编辑入口为 `/editor`。
5. 如需自定义域名，在 Cloudflare 控制台进入该 Worker 的“域”页面，添加域名。

本项目的 `flare.lipeng.fun` 已通过控制台绑定。配置文件不管理自定义域名，后续发布沿用现有绑定。

部署时会自动创建配置中声明的 SQLite 型 Durable Object。请保留 `FlareStore` 类名、`FLARE` 绑定和迁移历史，以继续使用已有数据。

### 管理员与会话

- `ADMIN_PASSWORD` 是编辑页的管理员密码，不在页面源码中公开。
- `SESSION_SECRET` 是会话签名密钥，应与密码使用不同的随机值。
- 登录会话有效期为 7 天；更换密码或签名密钥会使旧会话失效。
- Cookie 使用 `HttpOnly`、`Secure` 和 `SameSite=Strict`；写入接口校验请求来源。
- 默认首页公开，编辑器中的“访问首页也需要登录”可开启私密访问。

请勿将实际密码、密钥、`.dev.vars`、`.secrets.json` 或 `.admin-credentials.txt` 提交到 Git。

## 数据与备份

应用、书签、分类和网站设置保存在 `FLARE` 命名空间中名为 `site` 的 Durable Object 内。首次访问展示默认配置，首次保存后持久化；重新部署代码不会清空这些数据。

在编辑页可以：

- 点击“下载完整备份”保存 JSON 文件，包括当前尚未保存的编辑内容。
- 使用“恢复备份”载入 JSON，再点击“保存更改”发布。
- 展开“使用 YAML 配置导入”，导入应用、书签和配置；该操作会替换并保存当前配置。

`config.yml` 仅支持本版设置及部分上游字段映射。覆盖数据前建议先下载完整备份。本地迁移备份和线上用户数据不会随代码上传。

## 验证

先保持 `npm run dev` 运行，再在另一个终端进入 `workers/` 执行：

```powershell
npm test
```

现有测试覆盖链接校验、分类校验、HTML 转义、原版 YAML 兼容、登录保护、跨站写入拦截、保存后读取和并发版本冲突。涉及保存的测试会在结束后恢复原配置。

## 目录结构

```text
flare/
├── workers/                    Workers 迁移版
│   ├── src/                    请求处理、数据校验与页面模板
│   ├── public/                 样式、脚本、字体及许可
│   ├── scripts/                源码打包与生产密钥配置工具
│   ├── test/                   功能测试
│   ├── wrangler.jsonc          Cloudflare 部署配置
│   └── README.md               Workers 详细说明
├── cmd/                        上游命令行与环境变量解析
├── config/                     上游配置与数据模型
├── internal/                   上游认证、页面及服务实现
├── docker/                     上游容器相关文件
├── main.go                     上游 Go 程序入口
├── README.en.md                保留的上游英文说明
└── LICENSE                     AGPL-3.0 许可证
```

## 上游 Go 版登录配置

以下设置仅适用于上游 Go 程序，不适用于 Workers 版。

上游默认关闭登录，可通过 `FLARE_DISABLE_LOGIN=false` 开启。`FLARE_COOKIE_SECRET` 应使用至少 32 字节的随机值，可以通过环境变量、`.env` 文件或 `--cookie_secret` 参数配置；优先级为命令行参数、`.env`、环境变量。

当密钥为空、使用旧默认值 `secret` 或长度不足时，程序会生成安全密钥，保存为 `config.yml` 同目录中的 `.flare-cookie-secret`，并在后续启动时复用。请将该文件与配置一起持久保存。程序不会在日志中输出密钥，也不会改写环境变量或 `.env`。

如果无法读取或保存密钥文件，程序使用当前进程临时密钥并发出警告，重启后需要重新登录。多实例应使用相同配置密钥或共享持久化密钥文件。更多细节见 [上游英文说明](README.en.md)。

## 使用成本

本迁移版使用普通 Workers 和 SQLite 型 Durable Objects，可使用 Cloudflare 提供的免费配额，无需 Containers。实际费用、配额与超限行为取决于账户计划，请查阅 [Cloudflare 官方价格说明](https://developers.cloudflare.com/durable-objects/platform/pricing/)。

## 来源与开源许可

- 上游项目：[soulteary/flare](https://github.com/soulteary/flare)。
- 初始迁移基于上游提交 `d4fd9a46c2c07dad40b56cb5f0cf8b8f2df67594`。
- 本修改版遵循 **AGPL-3.0**，保留上游版权与第三方图标许可。
- 页面底部提供“本站完整源码”下载。部署脚本会打包上游源码和 Workers 实现，排除密码、用户数据、依赖与部署缓存。
- 修改并发布时，请同步更新提供给访问者的源码包；`npm run deploy` 会先重新生成源码包。
