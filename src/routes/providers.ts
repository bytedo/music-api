import { Hono } from 'hono';
import { listProviders } from '../lib/providers';

export const providersRoute = new Hono();

// GET /api/providers —— 列出所有可用的音源注册名（即 ?provider= 的取值）
providersRoute.get('/', (c) => {
  return c.json({ providers: listProviders() });
});
