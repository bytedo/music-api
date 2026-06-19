import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** 统一响应结构的 zod 工厂：{ code, message, data }，code 0 表示成功。 */
export function envelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    code: z.number().openapi({ example: 0 }),
    message: z.string().openapi({ example: 'ok' }),
    data: data.nullable(),
  });
}

/**
 * 成功响应：HTTP 200，code 0。
 * 返回标注为 any：@hono/zod-openapi 会按路由 responses schema 强校验 handler 返回类型，
 * 而 handler 同时混用 ok/fail（不同状态码）会产生不匹配的联合类型；用 any 规避该编译期摩擦，
 * 文档仍由路由 schema 驱动、运行时不受影响、handler 内 c.req.valid 等类型保持完整。
 */
export function ok<T>(c: Context, data: T): any {
  return c.json({ code: 0, message: 'ok', data }, 200);
}

/** 失败响应：HTTP 状态承载失败语义，响应体仍为统一结构。 */
export function fail(
  c: Context,
  status: ContentfulStatusCode,
  code: number,
  message: string,
  data: unknown = null
): any {
  return c.json({ code, message, data }, status);
}
