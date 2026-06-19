import { createRoute } from '@hono/zod-openapi';
import { createOpenAPIHono } from '../lib/openapi';
import { getProvider } from '../lib/providers';
import { resolveTarget } from '../lib/token';
import { envelope, ok, fail } from '../lib/response';
import { LyricSchema, TargetQuerySchema } from '../schemas';

type LyricData = {
  songid: string;
  provider: string;
  lines: Array<{ time: number; text: string }>;
  lrc: string;
};

// getLyric 不在 MusicProvider 接口上，仅部分 provider 实现，故用结构化可选类型探测。
type LyricCapableProvider = {
  getLyric?: (id: string, extra?: unknown) => Promise<LyricData>;
};

export const lyricRoute = createOpenAPIHono();

const route = createRoute({
  method: 'get',
  path: '/',
  tags: ['lyric'],
  summary: '获取歌词（token 或 id+provider）',
  security: [{ ApiKeyAuth: [] }],
  request: { query: TargetQuerySchema },
  responses: {
    200: {
      description: '歌词（无歌词时 lines 为空）',
      content: { 'application/json': { schema: envelope(LyricSchema) } },
    },
  },
});

lyricRoute.openapi(route, async (c) => {
  const q = c.req.valid('query');
  const target = resolveTarget(q);
  if (!target) return fail(c, 400, 400, 'Invalid token');

  try {
    const provider = getProvider(target.provider) as unknown as LyricCapableProvider;
    if (!provider.getLyric) {
      return ok(c, {
        songid: target.id,
        provider: target.provider,
        lines: [],
        lrc: '',
      });
    }
    const lyric = await provider.getLyric(target.id, target.extra);
    return ok(c, lyric);
  } catch (e) {
    console.error('Lyric error:', e);
    return fail(c, 500, 500, 'Failed to get lyric');
  }
});
