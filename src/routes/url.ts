import { Hono } from 'hono';
import { getProvider } from '../lib/providers';
import { parseExtra } from '../lib/http';

export const urlRoute = new Hono();

// GET /api/url?id=&provider=&extra=
urlRoute.get('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ error: 'Missing id' }, 400);
  }

  const providerName = c.req.query('provider') || 'netease';
  const extra = parseExtra(c.req.query('extra'));

  try {
    const info = await getProvider(providerName).getPlayInfo(id, extra);
    return c.json(info);
  } catch (error) {
    console.error('Url error:', error);
    return c.json({ error: 'Failed to get url' }, 500);
  }
});
