import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { searchRoute } from './routes/search';
import { urlRoute } from './routes/url';
import { lyricRoute } from './routes/lyric';
import { downloadRoute } from './routes/download';
import { providersRoute } from './routes/providers';

export function createApp() {
  const app = new Hono();

  // CORS：默认全开，可用 CORS_ORIGIN（逗号分隔）收紧
  const origin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : '*';
  app.use('*', cors({ origin }));

  app.get('/', (c) =>
    c.json({ name: 'music-api', status: 'ok', version: '0.2.0' })
  );
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // 数据接口统一挂在 /api/* 下，保持原有契约不变
  app.route('/api/search', searchRoute);
  app.route('/api/url', urlRoute);
  app.route('/api/lyric', lyricRoute);
  app.route('/api/download', downloadRoute);
  app.route('/api/providers', providersRoute);

  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
