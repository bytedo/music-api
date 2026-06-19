import { parseExtra } from './http';

export interface Target {
  provider: string;
  id: string;
  extra?: unknown;
}

/** base64url(JSON)，仅打包搜索结果（非加密）。 */
export function encodeToken(t: Target): string {
  const json = JSON.stringify({ p: t.provider, i: t.id, e: t.extra ?? null });
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeToken(token: string): Target | null {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const o = JSON.parse(json) as { p?: unknown; i?: unknown; e?: unknown };
    if (typeof o.p !== 'string' || typeof o.i !== 'string') return null;
    return { provider: o.p, id: o.i, extra: o.e ?? undefined };
  } catch {
    return null;
  }
}

/**
 * 从已校验的 query 解析目标：优先 `token`，否则 `id`(+provider+extra)。
 * schema 已保证 token 与 id 二选一。token 非法时返回 null（调用方 → 400）。
 */
export function resolveTarget(q: {
  token?: string;
  id?: string;
  provider?: string;
  extra?: string;
}): Target | null {
  if (q.token) return decodeToken(q.token);
  return {
    provider: q.provider || 'netease',
    id: q.id as string, // token 缺省时 schema 保证 id 存在
    extra: parseExtra(q.extra),
  };
}

/**
 * 通用音质注入：不同 provider 读不同字段，统一写入这几个键，
 * netease（level/selectedLevel）、joox（selectedQuality）各取所需，其余忽略；保留原 extra。
 */
export function mergeQuality(extra: unknown, quality?: string): unknown {
  if (!quality) return extra;
  const base =
    extra && typeof extra === 'object' ? (extra as Record<string, unknown>) : {};
  return { ...base, level: quality, selectedLevel: quality, selectedQuality: quality };
}
