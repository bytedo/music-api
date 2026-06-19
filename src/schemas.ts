import { z } from '@hono/zod-openapi';

// ---- 领域输出 schema（对应 src/types/music.ts）----
export const MusicItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    artist: z.string(),
    album: z.string().optional(),
    cover: z.string().optional(),
    duration: z.string().optional(),
    provider: z.string(),
    extra: z.unknown().optional(),
    token: z
      .string()
      .openapi({ description: '调用 /url /lyric /download 用的不透明句柄' }),
  })
  .openapi('MusicItem');

export const PlayInfoSchema = z
  .object({
    url: z.string(),
    type: z.string(),
    bitrate: z.string().optional(),
    cover: z.string().optional(),
  })
  .openapi('PlayInfo');

export const LyricSchema = z
  .object({
    songid: z.string(),
    provider: z.string(),
    lines: z.array(z.object({ time: z.number(), text: z.string() })),
    lrc: z.string(),
  })
  .openapi('Lyric');

export const ProvidersSchema = z
  .object({ providers: z.array(z.string()) })
  .openapi('Providers');

// ---- query schema ----
export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1)
    .openapi({ param: { name: 'q', in: 'query' }, example: '周杰伦' }),
  provider: z.string().optional().openapi({
    param: { name: 'provider', in: 'query' },
    description: "音源名；省略或 'all' = 多源聚合",
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .openapi({ param: { name: 'limit', in: 'query' } }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({ param: { name: 'offset', in: 'query' } }),
});

/** token 或 id(+provider+extra)；refine 保证二选一。 */
export const TargetQuerySchema = z
  .object({
    token: z.string().optional().openapi({ param: { name: 'token', in: 'query' } }),
    id: z.string().optional().openapi({ param: { name: 'id', in: 'query' } }),
    provider: z
      .string()
      .optional()
      .openapi({ param: { name: 'provider', in: 'query' } }),
    extra: z.string().optional().openapi({
      param: { name: 'extra', in: 'query' },
      description: 'JSON 字符串，provider 特有',
    }),
  })
  .refine((v) => !!v.token !== !!v.id, {
    message: 'Provide exactly one of `token` or `id`',
  });

/** url/download：目标 + quality（+ 下载用 filename/mode）。refined schema 不能 .extend，故扁平声明。 */
export const TargetWithQualitySchema = z
  .object({
    token: z.string().optional().openapi({ param: { name: 'token', in: 'query' } }),
    id: z.string().optional().openapi({ param: { name: 'id', in: 'query' } }),
    provider: z
      .string()
      .optional()
      .openapi({ param: { name: 'provider', in: 'query' } }),
    extra: z.string().optional().openapi({ param: { name: 'extra', in: 'query' } }),
    quality: z.string().optional().openapi({
      param: { name: 'quality', in: 'query' },
      description: 'standard|exhigh|lossless|hires|...（依音源而定）',
    }),
    filename: z
      .string()
      .optional()
      .openapi({ param: { name: 'filename', in: 'query' } }),
    mode: z
      .enum(['proxy', 'redirect'])
      .optional()
      .openapi({ param: { name: 'mode', in: 'query' } }),
  })
  .refine((v) => !!v.token !== !!v.id, {
    message: 'Provide exactly one of `token` or `id`',
  });
