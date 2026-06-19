import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { createOpenAPIHono } from './lib/openapi';
import { apiKeyAuth } from './lib/auth';
import { searchRoute } from './routes/search';
import { urlRoute } from './routes/url';
import { lyricRoute } from './routes/lyric';
import { downloadRoute } from './routes/download';
import { providersRoute } from './routes/providers';

export function createApp() {
  // 统一通过工厂创建（带 defaultHook：校验失败也返回统一结构）
  const app = createOpenAPIHono();

  // CORS：默认全开，可用 CORS_ORIGIN（逗号分隔）收紧
  const origin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : '*';
  app.use('*', cors({ origin }));

  // 鉴权仅作用于数据接口
  app.use('/api/*', apiKeyAuth);

  app.get('/', (c) =>
    c.json({ name: 'music-api', status: 'ok', version: '0.3.0' })
  );
  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.route('/api/search', searchRoute);
  app.route('/api/url', urlRoute);
  app.route('/api/lyric', lyricRoute);
  app.route('/api/download', downloadRoute);
  app.route('/api/providers', providersRoute);

  // OpenAPI JSON 与 Swagger UI（公开，不被 /api/* 鉴权拦截）
  app.doc('/doc', {
    openapi: '3.1.0',
    info: { title: 'music-api', version: '0.3.0' },
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKeyAuth', {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
  });
  app.get('/docs', swaggerUI({ url: '/doc' }));

  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ code: 500, message: 'Internal server error', data: null }, 500);
  });

  return app;
}
