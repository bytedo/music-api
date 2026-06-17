import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT) || 3000;
// 用 HOST 而非 HOSTNAME，避免继承容器主机名导致绑定失败
const hostname = process.env.HOST || '0.0.0.0';

serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  console.log(`music-api listening on http://${info.address}:${info.port}`);
});
