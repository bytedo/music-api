import { createRoute, z } from '@hono/zod-openapi';
import axios from 'axios';
import { Readable } from 'node:stream';
import { createOpenAPIHono } from '../lib/openapi';
import { getProvider } from '../lib/providers';
import { resolveTarget, mergeQuality } from '../lib/token';
import { fail } from '../lib/response';
import { TargetWithQualitySchema } from '../schemas';

const DOWNLOAD_TIMEOUT = 30000;
const RETRY_LIMIT = 2;
const RETRY_DELAY = 600;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown) {
  const err = error as { code?: string; message?: string };
  const code = err?.code || '';
  const message = err?.message || '';
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    message.toLowerCase().includes('timeout')
  );
}

async function requestAudioStream(
  url: string,
  attempt = 0
): Promise<{
  stream: ReadableStream<Uint8Array>;
  headers: Record<string, string | undefined>;
}> {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: DOWNLOAD_TIMEOUT,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Upstream error: ${response.status}`);
    }

    const stream = Readable.toWeb(response.data) as ReadableStream<Uint8Array>;
    return { stream, headers: response.headers as Record<string, string | undefined> };
  } catch (error) {
    if (attempt < RETRY_LIMIT && isRetryableError(error)) {
      await delay(RETRY_DELAY * (attempt + 1));
      return requestAudioStream(url, attempt + 1);
    }
    throw error;
  }
}

export const downloadRoute = createOpenAPIHono();

const errEnvelope = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().nullable(),
});

const route = createRoute({
  method: 'get',
  path: '/',
  tags: ['download'],
  summary: '下载音频（token 或 id+provider；mode=redirect 时 302 跳转源直链）',
  security: [{ ApiKeyAuth: [] }],
  request: { query: TargetWithQualitySchema },
  responses: {
    200: {
      description: '音频流',
      content: { 'audio/mpeg': { schema: z.string().openapi({ format: 'binary' }) } },
    },
    302: { description: 'mode=redirect 时跳转到源直链' },
    404: {
      description: '取不到直链',
      content: { 'application/json': { schema: errEnvelope } },
    },
    503: {
      description: '下载被禁用（ENABLE_DOWNLOAD=0），data 内仍给出 url',
      content: { 'application/json': { schema: errEnvelope } },
    },
  },
});

downloadRoute.openapi(route, async (c) => {
  const q = c.req.valid('query');
  const target = resolveTarget(q);
  if (!target) return fail(c, 400, 400, 'Invalid token');

  const extra = mergeQuality(target.extra, q.quality);
  try {
    // 1. 获取真实播放地址
    const playInfo = await getProvider(target.provider).getPlayInfo(target.id, extra);
    if (!playInfo || !playInfo.url) {
      return fail(c, 404, 404, 'Failed to get url');
    }

    // 2. 禁用开关：对代理与重定向都生效，但仍把 url 返回给客户端
    if (process.env.ENABLE_DOWNLOAD === '0') {
      return fail(c, 503, 503, 'Download disabled', { url: playInfo.url });
    }

    // 3. 重定向模式：直接 302 到源直链，服务器不代理
    if (q.mode === 'redirect') {
      return c.redirect(playInfo.url, 302);
    }

    // 4. 默认：服务端流式代理（带超时重试）
    const { stream, headers: upstreamHeaders } = await requestAudioStream(playInfo.url);

    const headers = new Headers();
    headers.set('Content-Type', upstreamHeaders['content-type'] || 'audio/mpeg');
    const contentLength = upstreamHeaders['content-length'];
    if (contentLength) headers.set('Content-Length', contentLength);

    const safeFilename = q.filename
      ? encodeURIComponent(q.filename).replace(/%20/g, '+')
      : `music-${target.id}.mp3`;
    headers.set(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`
    );

    return new Response(stream, { status: 200, headers });
  } catch (e) {
    console.error('Download error:', e);
    return fail(c, 500, 500, 'Download failed');
  }
});
