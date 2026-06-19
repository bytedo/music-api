<div align="center">
  <h1>music-api</h1>
  <p>一个聚合多音源的音乐搜索 / 播放直链 / 歌词 / 下载的轻量 HTTP API 服务。</p>
</div>

<div align="center">

![Node](https://img.shields.io/badge/Node-20-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Hono](https://img.shields.io/badge/Hono-4-e36002)
![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6ba539)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

## 项目定位

本项目是一个**纯后端音乐接口服务**：把多个第三方音源的搜索、播放直链、歌词与下载能力封装成统一的 HTTP API，方便任意前端 / 客户端 / 脚本调用。不含任何 Web UI 或桌面端。

技术栈：**TypeScript + Hono + @hono/zod-openapi**，ESM，使用 `tsup` 打包成自包含产物，可直接 Docker 部署。内置 zod 参数校验、统一响应结构、可选 API Key 鉴权，并自带 Swagger 在线文档。

## 在线文档

启动后访问：

- `GET /docs` —— Swagger UI，可直接在浏览器里查看和调试全部接口。
- `GET /doc` —— OpenAPI 3.1 JSON。

## 统一响应结构

除 `/`、`/health` 外，所有接口返回统一信封（`/api/download` 成功时除外，返回音频流或 302）：

```jsonc
{ "code": 0, "message": "ok", "data": { /* ... */ } }
```

`code` 为 0 表示成功，非 0 表示失败（同时 HTTP 状态码也反映成败）；参数校验失败返回 `code:400`，鉴权失败 `code:401`。

## 鉴权（可选）

- 未设置环境变量 `API_KEY` 时，所有接口开放（本地 / 开发友好）。
- 设置 `API_KEY` 后，`/api/*` 需要在请求头携带密钥，否则返回 401：
  - `X-API-Key: <你的密钥>`，或
  - `Authorization: Bearer <你的密钥>`
- `/`、`/health`、`/docs`、`/doc` 始终公开。Swagger UI 右上角 Authorize 可填入密钥后在线调试。

## 接口一览

| 方法 | 路径 | 主要参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/` | — | 服务信息 |
| GET | `/health` | — | 健康检查 |
| GET | `/api/providers` | — | 列出所有音源名 |
| GET | `/api/search` | `q`(必填)、`provider`、`limit`(1–50)、`offset` | 搜索；`provider` 省略或 `all` 时多源聚合 |
| GET | `/api/url` | `token` 或 `id`(+`provider`+`extra`)、`quality` | 获取播放直链 |
| GET | `/api/lyric` | `token` 或 `id`(+`provider`+`extra`) | 获取歌词 |
| GET | `/api/download` | `token` 或 `id`(+`provider`)、`quality`、`filename`、`mode` | 下载音频 |

### token 调用方式（推荐）

`/api/search` 返回的每一项都带一个 `token`，它打包了该曲目的 `provider`、`id` 与 provider 特有的 `extra`。后续调用 `url`/`lyric`/`download` 只需把这个 `token` 透传即可，无需再手动拼 `extra`：

```
search → 拿到 item.token → /api/url?token=<token>
```

也可以用显式参数 `id` + `provider`（+ 可选 `extra` 的 JSON 字符串）。**`token` 与 `id` 二选一**（同时给会返回 400）。

### 音质与下载

- `quality`：可选，作用于 `url`/`download`。如 netease 的 `standard|exhigh|lossless|hires|...`；可在搜索后再选音质，无需重新搜索。仅对支持多音质的音源（如 netease、joox）生效，其余忽略。
- `/api/download` 默认由服务端流式代理返回文件（带超时重试，可用 `filename` 指定下载文件名）。
- `mode=redirect`：改为 302 跳转到源直链，由客户端/浏览器直接下载，服务器不代理大文件。
- 设环境变量 `ENABLE_DOWNLOAD=0` 时，`/api/download` 返回 503，并在 `data.url` 中给出直链。

### 数据结构

```ts
interface MusicItem {
  id: string; title: string; artist: string;
  album?: string; cover?: string; duration?: string;
  provider: string;     // 来源音源，如 'netease'
  extra?: unknown;       // 渠道特有原始数据
  token: string;         // 调用 url/lyric/download 的句柄
}
interface PlayInfo { url: string; type: string; bitrate?: string; cover?: string }
```

## 快速开始

```bash
npm install
npm run dev          # tsx 热更新，监听 http://localhost:3000
```

生产构建与运行：

```bash
npm run build        # tsup 打包到 dist/
npm run start        # node dist/index.js
```

### 调用示例

```bash
# 搜索（多源聚合）
curl 'http://localhost:3000/api/search?q=周杰伦&provider=all&limit=10'

# 取上一步某条结果的 token，然后：
curl 'http://localhost:3000/api/url?token=<token>'
curl 'http://localhost:3000/api/url?token=<token>&quality=hires'
curl 'http://localhost:3000/api/lyric?token=<token>'
curl -L 'http://localhost:3000/api/download?token=<token>&filename=song.flac' -o song.flac
curl -I 'http://localhost:3000/api/download?token=<token>&mode=redirect'   # 看 Location

# 显式参数 + 鉴权（设置了 API_KEY 时）
curl -H 'X-API-Key: yourkey' \
  'http://localhost:3000/api/url?id=1822070830&provider=netease&quality=lossless'
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `API_KEY` | （未设置=不鉴权） | 设置后 `/api/*` 需携带 `X-API-Key` 或 `Authorization: Bearer` |
| `ENABLE_DOWNLOAD` | （未设置=启用） | 设为 `0` 时 `/api/download` 返回 503，`data.url` 仍给出直链 |
| `CORS_ORIGIN` | `*` | 允许的跨域来源，多个用英文逗号分隔 |

## Docker

```bash
docker compose up -d --build
```

或：

```bash
docker build -t music-api .
docker run -d -p 3000:3000 --name music-api music-api
```

或直接拉取由 GitHub Actions 自动发布到 GHCR 的镜像：

```bash
docker run -d -p 3000:3000 --name music-api ghcr.io/bytedo/music-api:latest
```

镜像由 `tsup` 打包为自包含产物，运行阶段不含 `node_modules`，以非 root 用户启动。

## 音源说明

`provider` 可选值（可用 `GET /api/providers` 实时获取）：

| provider | 音源 |
| --- | --- |
| `netease` | 网易云（官方接口解析，默认） |
| `qq` | QQ 音乐 |
| `kugou` | 酷狗 |
| `gequbao` | 歌曲宝 |
| `gequhai` | 歌曲海 |
| `bugu` | 布谷音乐 |
| `bodian` | 波点音乐 |
| `qqmp3` | QQMP3 |
| `mitu` | 米兔音乐 |
| `joox` | JOOX |
| `migu` | 咪咕音乐 |
| `livepoo` | LivePoo |
| `aiting` | 爱听 |
| `jianbin-netease` / `jianbin-qq` / `jianbin-kugou` / `jianbin-kuwo` | 煎饼音乐（多平台解析） |

`/api/search` 省略 `provider` 或传 `all` 时，会并发聚合 `netease、qq、kugou、migu` 的结果（失败的音源自动跳过）。不同音源的可用性、音质和返回字段会随第三方站点变化而变化；项目通过 `src/lib/providers/` 的 provider 层隔离这些差异，新增音源时优先在该层补实现，再到 `src/lib/providers/index.ts` 注册。

## 项目结构

```text
src/
├─ index.ts            # 服务启动 (@hono/node-server)
├─ app.ts              # OpenAPIHono 实例：CORS、鉴权、路由、/doc + /docs、错误处理
├─ schemas.ts          # 共享 zod schema（含 OpenAPI 元数据）
├─ routes/             # 各接口 (search/url/lyric/download/providers)
├─ lib/
│  ├─ openapi.ts       # OpenAPIHono 工厂（统一 defaultHook）
│  ├─ response.ts      # 统一响应信封 envelope/ok/fail
│  ├─ token.ts         # token 编解码 / resolveTarget / 音质注入
│  ├─ auth.ts          # API Key 鉴权中间件
│  ├─ http.ts          # 查询参数解析等共享工具
│  └─ providers/       # 各音源解析实现 (impl/*) 与注册表 (index.ts)
└─ types/music.ts      # MusicItem / PlayInfo / MusicProvider 类型
```

## 技术栈

- Node 20 / TypeScript 5（ESM）
- Hono + @hono/node-server + @hono/zod-openapi + @hono/swagger-ui
- zod、Axios、Cheerio
- tsup（打包）、tsx（开发）

## 免责声明

1. 本项目仅供个人学习、技术研究与交流使用，严禁用于商业用途。
2. 项目不存储任何音乐文件，所有音乐内容均来自第三方公开 API 接口。
3. 项目中使用的所有音源接口均为第三方服务提供。
4. 第三方音源的可用性、数据准确性和版权状态不由本项目保证。
5. 请勿将本项目用于任何违反当地法律法规的行为，请尊重音乐版权。
6. 如本项目内容侵犯了您的权益，请通过 GitHub Issues 联系处理，我们会及时响应。
7. **下载的音乐文件仅供个人学习研究使用，请支持正版音乐。**

## 许可证

本项目使用 MIT License。
