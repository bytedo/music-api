import { createRoute } from '@hono/zod-openapi';
import { createOpenAPIHono } from '../lib/openapi';
import { getProvider } from '../lib/providers';
import { resolveTarget, mergeQuality } from '../lib/token';
import { envelope, ok, fail } from '../lib/response';
import { PlayInfoSchema, TargetWithQualitySchema } from '../schemas';

export const urlRoute = createOpenAPIHono();

const route = createRoute({
  method: 'get',
  path: '/',
  tags: ['url'],
  summary: '获取播放直链（token 或 id+provider，可选 quality）',
  security: [{ ApiKeyAuth: [] }],
  request: { query: TargetWithQualitySchema },
  responses: {
    200: {
      description: '播放直链信息',
      content: { 'application/json': { schema: envelope(PlayInfoSchema) } },
    },
  },
});

urlRoute.openapi(route, async (c) => {
  const q = c.req.valid('query');
  const target = resolveTarget(q);
  if (!target) return fail(c, 400, 400, 'Invalid token');

  const extra = mergeQuality(target.extra, q.quality);
  try {
    const info = await getProvider(target.provider).getPlayInfo(target.id, extra);
    return ok(c, info);
  } catch (e) {
    console.error('Url error:', e);
    return fail(c, 500, 500, 'Failed to get url');
  }
});
