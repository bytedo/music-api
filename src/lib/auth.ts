import { createMiddleware } from 'hono/factory';
import { fail } from './response';

/**
 * 若设置了 process.env.API_KEY，则要求请求头 `X-API-Key: <key>` 或
 * `Authorization: Bearer <key>` 与之匹配；未设置则放行。仅挂在 /api/* 上，
 * /、/health、/doc、/docs 保持公开。
 */
export const apiKeyAuth = createMiddleware(async (c, next) => {
  const expected = process.env.API_KEY;
  if (!expected) return next(); // 未配置则不鉴权

  const headerKey = c.req.header('X-API-Key');
  const bearer = c.req.header('Authorization');
  const fromBearer = bearer?.startsWith('Bearer ')
    ? bearer.slice('Bearer '.length).trim()
    : undefined;

  if (headerKey === expected || fromBearer === expected) return next();
  return fail(c, 401, 401, 'Unauthorized');
});
