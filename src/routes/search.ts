import { Hono } from 'hono';
import { getProvider } from '../lib/providers';
import { clampInt } from '../lib/http';

export const searchRoute = new Hono();

// GET /api/search?q=&provider=&limit=&offset=
searchRoute.get('/', async (c) => {
  const q = c.req.query('q');
  if (!q) {
    return c.json({ error: 'Missing query' }, 400);
  }

  const providerName = c.req.query('provider');
  const limit = clampInt(c.req.query('limit'), 20, 1, 50);
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0);

  const resolvedProviderName =
    providerName && providerName !== 'all' ? providerName : 'netease';

  try {
    const items = await getProvider(resolvedProviderName).search(q, limit, offset);
    return c.json({ items });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});
