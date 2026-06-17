// 共享的 HTTP 查询参数辅助函数

/** 解析 `extra` 查询参数：渠道特有的原始数据以 JSON 字符串传入，解析失败返回 undefined。 */
export function parseExtra(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** 将查询参数解析为整数并夹在 [min, max]，无效时取 fallback。 */
export function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(raw) || fallback;
  return Math.min(Math.max(n, min), max);
}
