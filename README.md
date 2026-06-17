<div align="center">
  <h1>music-api</h1>
  <p>一个聚合多音源的音乐搜索 / 播放直链 / 歌词 / 下载的轻量 HTTP API 服务。</p>
</div>

<div align="center">

![Node](https://img.shields.io/badge/Node-20-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Hono](https://img.shields.io/badge/Hono-4-e36002)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

## 项目定位

本项目是一个**纯后端音乐接口服务**：把多个第三方音源的搜索、播放直链、歌词与下载能力封装成统一的 HTTP API，方便任意前端 / 客户端 / 脚本调用。不含任何 Web UI 或桌面端。

技术栈：**TypeScript + Hono + @hono/node-server**，ESM，使用 `tsup` 打包成自包含产物，可直接 Docker 部署。

## 接口一览

所有数据接口挂在 `/api/*` 下，统一返回 JSON（`/api/download` 除外，返回音频流）。

| 方法 | 路径 | 查询参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/` | — | 服务信息 |
| GET | `/health` | — | 健康检查，返回 `{"status":"ok"}` |
| GET | `/api/providers` | — | 列出所有可用音源名（即 `provider` 取值） |
| GET | `/api/search` | `q`（必填）、`provider`、`limit`(1–50，默认 20)、`offset`(默认 0) | 搜索歌曲，返回 `{ items: MusicItem[] }` |
| GET | `/api/url` | `id`（必填）、`provider`、`extra` | 获取播放直链，返回 `PlayInfo` |
| GET | `/api/lyric` | `id`（必填）、`provider`、`extra` | 获取歌词，返回 `{ songid, provider, lines, lrc }`（无歌词时 `lines` 为空） |
| GET | `/api/download` | `id`（必填）、`filename`、`provider`、`extra` | 以附件形式流式下载音频 |

说明：
- `provider` 缺省为 `netease`；`search` 接口传 `all` 时等同 `netease`。
- `extra` 是某些音源需要的渠道原始数据，以 **JSON 字符串**传入（通常取自 `search` 结果项里的 `extra` 字段）。解析失败时按未提供处理。
- 典型调用链：`/api/search` 拿到 `id`（及可能的 `extra`）→ `/api/url` 取直链或 `/api/download` 下载 → `/api/lyric` 取歌词。

### 数据结构

```ts
interface MusicItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: string;
  provider: string;   // 来源音源，如 'netease'
  extra?: unknown;     // 渠道特有原始数据，回传给 url/lyric/download
}

interface PlayInfo {
  url: string;
  type: 'mp3' | 'm4a' | 'flac' | string;
  bitrate?: string;
  cover?: string;
}
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

类型检查：

```bash
npm run typecheck
```

### 调用示例

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/providers
curl 'http://localhost:3000/api/search?q=周杰伦&provider=netease&limit=10'
curl 'http://localhost:3000/api/url?id=<id>&provider=netease'
curl 'http://localhost:3000/api/lyric?id=<id>&provider=netease'
curl -L 'http://localhost:3000/api/download?id=<id>&provider=netease&filename=song.mp3' -o song.mp3
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `ENABLE_DOWNLOAD` | （未设置=启用） | 设为 `0` 时 `/api/download` 返回 503，仅在响应体里给出直链 `url` |
| `CORS_ORIGIN` | `*` | 允许的跨域来源，多个用英文逗号分隔 |

## Docker

使用 docker compose（本地构建）：

```bash
docker compose up -d --build
```

或直接用 Dockerfile：

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

`provider` 可选值（来自 provider 注册表，可用 `GET /api/providers` 实时获取）：

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

不同音源的可用性、音质和返回字段会随第三方站点变化而变化。项目通过 `src/lib/providers/` 的 provider 层隔离这些差异，新增音源时优先在该层补实现，再到 `src/lib/providers/index.ts` 注册。

## 项目结构

```text
src/
├─ index.ts            # 服务启动 (@hono/node-server)
├─ app.ts              # Hono 实例：CORS、路由挂载、错误处理
├─ routes/             # 各接口处理器 (search/url/lyric/download/providers)
├─ lib/
│  ├─ http.ts          # 查询参数解析等共享工具
│  └─ providers/       # 各音源解析实现 (impl/*) 与注册表 (index.ts)
└─ types/music.ts      # MusicItem / PlayInfo / MusicProvider 类型
```

## 技术栈

- Node 20 / TypeScript 5（ESM）
- Hono + @hono/node-server
- Axios、Cheerio
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
