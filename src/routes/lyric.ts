import { Hono } from 'hono';
import { getProvider } from '../lib/providers';
import { parseExtra } from '../lib/http';

type LyricData = {
  songid: string;
  provider: string;
  lines: Array<{ time: number; text: string }>;
  lrc: string;
};

// getLyric 不在 MusicProvider 接口上，仅部分 provider 实现，故用结构化可选类型探测。
type LyricCapableProvider = {
  getLyric?: (id: string, extra?: unknown) => Promise<LyricData>;
};

export const lyricRoute = new Hono();

// GET /api/lyric?id=&provider=&extra=
lyricRoute.get('/', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.json({ error: 'Missing id' }, 400);
  }

  const providerName = c.req.query('provider') || 'netease';
  const extra = parseExtra(c.req.query('extra'));

  try {
    const provider = getProvider(providerName) as unknown as LyricCapableProvider;
    if (!provider.getLyric) {
      return c.json({ songid: id, provider: providerName, lines: [], lrc: '' });
    }

    const lyric = await provider.getLyric(id, extra);
    return c.json(lyric);
  } catch (error) {
    console.error('Lyric error:', error);
    return c.json({ error: 'Failed to get lyric' }, 500);
  }
});
