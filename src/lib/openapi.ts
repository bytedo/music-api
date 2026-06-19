import { OpenAPIHono } from '@hono/zod-openapi';

/**
 * 统一构造 OpenAPIHono，并挂上 defaultHook：参数校验失败时返回统一的 {code,message,data} 结构。
 * 注意：路由定义在各自的子 OpenAPIHono 上，校验发生在子实例，因此每个子实例都必须带 defaultHook，
 * 只在父 app 上设置不会生效——故统一用此工厂创建。
 */
export function createOpenAPIHono() {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            code: 400,
            message:
              result.error.issues.map((i) => i.message).join('; ') ||
              'Validation failed',
            data: null,
          },
          400
        );
      }
    },
  });
}
