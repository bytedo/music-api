import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIHono } from '../lib/openapi';
import { getProvider } from '../lib/providers';
import { encodeToken } from '../lib/token';
import { envelope, ok, fail } from '../lib/response';
import { MusicItemSchema, SearchQuerySchema } from '../schemas';
import type { MusicItem } from '../types/music';

export const searchRoute = createOpenAPIHono();

// provider 省略或 'all' 时聚合的默认音源集合（主流、较稳定）
const DEFAULT_AGGREGATE = ['netease', 'qq', 'kugou', 'migu'];

function withToken(item: MusicItem) {
  return {
    ...item,
    token: encodeToken({ provider: item.provider, id: item.id, extra: item.extra }),
  };
}

/** 多源并发搜索，失败的源贡献空结果。 */
async function aggregateSearch(q: string, limit: number, offset: number) {
  const per = Math.max(5, Math.ceil(limit / DEFAULT_AGGREGATE.length));
  const settled = await Promise.allSettled(
    DEFAULT_AGGREGATE.map((name) => getProvider(name).search(q, per, offset))
  );
  const merged: MusicItem[] = [];
  for (const r of settled) if (r.status === 'fulfilled') merged.push(...r.value);
  return merged;
}

const route = createRoute({
  method: 'get',
  path: '/',
  tags: ['search'],
  summary: '搜索歌曲（省略或 provider=all 时多源聚合）',
  security: [{ ApiKeyAuth: [] }],
  request: { query: SearchQuerySchema },
  responses: {
    200: {
      description: '搜索结果',
      content: {
        'application/json': { schema: envelope(z.array(MusicItemSchema)) },
      },
    },
  },
});

searchRoute.openapi(route, async (c) => {
  const { q, provider, limit, offset } = c.req.valid('query');
  try {
    const single = provider && provider !== 'all';
    const items = single
      ? await getProvider(provider).search(q, limit, offset)
      : await aggregateSearch(q, limit, offset);
    return ok(c, items.map(withToken));
  } catch (e) {
    console.error('Search error:', e);
    return fail(c, 500, 500, 'Search failed');
  }
});
