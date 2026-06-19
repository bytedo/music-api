import { createRoute } from '@hono/zod-openapi';
import { createOpenAPIHono } from '../lib/openapi';
import { listProviders } from '../lib/providers';
import { envelope, ok } from '../lib/response';
import { ProvidersSchema } from '../schemas';

export const providersRoute = createOpenAPIHono();

const route = createRoute({
  method: 'get',
  path: '/',
  tags: ['providers'],
  summary: '列出所有可用音源名',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: '音源列表',
      content: { 'application/json': { schema: envelope(ProvidersSchema) } },
    },
  },
});

providersRoute.openapi(route, (c) => ok(c, { providers: listProviders() }));
