import { Hono } from 'hono';
import axios from 'axios';
import { Readable } from 'node:stream';
import { getProvider } from '../lib/providers';
import { parseExtra } from '../lib/http';

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

export const downloadRoute = new Hono();

// GET /api/download?id=&filename=&provider=&extra=
downloadRoute.get('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ error: 'Missing id' }, 400);
  }

  const filename = c.req.query('filename');
  const providerName = c.req.query('provider') || 'netease';
  const extra = parseExtra(c.req.query('extra'));

  try {
    // 1. 获取真实播放地址
    const playInfo = await getProvider(providerName).getPlayInfo(id, extra);
    if (!playInfo || !playInfo.url) {
      return c.json({ error: 'Failed to get url' }, 404);
    }

    const downloadEnabled = process.env.ENABLE_DOWNLOAD !== '0';
    if (!downloadEnabled) {
      return c.json({ error: 'Download disabled', url: playInfo.url }, 503);
    }

    // 2. 请求音频流（带超时重试）
    const { stream, headers: upstreamHeaders } = await requestAudioStream(playInfo.url);

    // 3. 构建响应头
    const headers = new Headers();
    headers.set('Content-Type', upstreamHeaders['content-type'] || 'audio/mpeg');

    const contentLength = upstreamHeaders['content-length'];
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    const safeFilename = filename
      ? encodeURIComponent(filename).replace(/%20/g, '+')
      : `music-${id}.mp3`;
    headers.set(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`
    );

    // 4. 返回流（@hono/node-server 原生支持 Web ReadableStream 响应体）
    return new Response(stream, { status: 200, headers });
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ error: 'Download failed' }, 500);
  }
});
