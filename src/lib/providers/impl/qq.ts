import axios from 'axios';
import type { MusicItem, MusicProvider, PlayInfo } from '../../../types/music';

const SEARCH_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/131.0.0.0',
};

type VKeysGetUrlResponse = {
  code?: number;
  data?: {
    url?: string;
    quality?: string;
    kbps?: string;
    cover?: string;
  };
};

type QQOfficialSearchSong = {
  id?: string | number;
  mid?: string;
  name?: string;
  singer?: Array<{ name?: string }>;
  album?: { name?: string; mid?: string };
  interval?: number;
};

type QQOfficialSearchResponse = {
  code?: number;
  message?: string;
  req_1?: {
    data?: {
      body?: {
        song?: {
          list?: QQOfficialSearchSong[];
        };
      };
    };
  };
};

type QQExtra = {
  selectedParser?: 'xcvts' | 'cyapi';
  selectedFormat?: string;
  cover?: string;
};

export type QQLyricData = {
  songid: string;
  provider: 'qq';
  lines: Array<{ time: number; text: string }>;
  lrc: string;
};

const QUALITY_PRIORITY = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const XCVTS_QUALITIES = ['臻品母带', '臻品全景声', '臻品2.0', 'SQ无损', 'HQ高品质', '中品质', '普通', '低品质', '试听'];
const XCVTS_KEYS = [
  'Nzg5OTMzNDRiOWJmMTEwNTY1NTU5OTAwOWNkYmEzZDI=',
  'Y2U3NzhlYjBkMTg1OGVkZmI0YjIwNzFhMTE1ZjFlZGY=',
];
const CYAPI_KEYS = [
  '1ffdf5733f5d538760e63d7e46ba17438d9f7b9dfc18c51be1109386fd74c3a1',
  '2baf39266d8ef0580aba937245d5bb569fe376f230ff508f1faa0922dc320fe4',
];
const QQ_DOWNLOAD_OPTIONS = [
  { value: 'xcvts', label: 'XCVTS 高品质', quality: 'flac', format: 'flac' },
  { value: 'cyapi', label: 'CYAPI 备用', quality: 'mp3', format: 'mp3' },
];

function extractExt(url: string) {
  const clean = url.split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : 'mp3';
}

function normalizeLimit(value?: number) {
  return Math.min(Math.max(Math.floor(Number(value) || 20), 1), 30);
}

function normalizeOffset(value?: number) {
  return Math.max(Math.floor(Number(value) || 0), 0);
}

function formatDuration(seconds?: number) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return undefined;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function decodeBase64(value: string) {
  return Buffer.from(value, 'base64').toString('utf8');
}

function pickRandom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function parseLyricLines(lyric: string) {
  const lines: Array<{ time: number; text: string }> = [];
  const timePattern = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of lyric.split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(timePattern)];
    if (matches.length === 0) continue;

    const text = rawLine.replace(timePattern, '').trim();
    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) / 1000 : 0;
      lines.push({ time: minutes * 60 + seconds + fraction, text });
    }
  }

  return lines
    .filter((line) => line.text)
    .sort((a, b) => a.time - b.time);
}

export class QQProvider implements MusicProvider {
  name = 'qq';

  async search(query: string, limit = 20, offset = 0): Promise<MusicItem[]> {
    try {
      const normalizedLimit = normalizeLimit(limit);
      const pageNum = Math.floor(normalizeOffset(offset) / normalizedLimit) + 1;
      const { data } = await axios.post<QQOfficialSearchResponse>('http://u6.y.qq.com/cgi-bin/musicu.fcg', {
        comm: {
          ct: '19',
          cv: '1859',
          uin: '0',
        },
        req_1: {
          method: 'DoSearchForQQMusicDesktop',
          module: 'music.search.SearchCgiService',
          param: {
            grp: 1,
            num_per_page: normalizedLimit,
            page_num: pageNum,
            query: query.trim(),
            search_type: 0,
          },
        },
      }, {
        headers: SEARCH_HEADERS,
        timeout: 15000,
      });
      if (data?.code !== 0) {
        throw new Error(data?.message || 'QQ official search failed');
      }
      const list = data?.req_1?.data?.body?.song?.list || [];
      return list
        .map((item) => {
          const albumMid = item.album?.mid || '';
          const cover = albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : undefined;
          return {
            id: item.mid || '',
            title: item.name || '未知歌曲',
            artist: (item.singer || []).map((singer) => singer.name).filter(Boolean).join(', ') || '未知歌手',
            album: item.album?.name || undefined,
            cover,
            duration: formatDuration(item.interval),
            provider: this.name,
            extra: {
              cover,
              selectedParser: 'xcvts',
              selectedFormat: 'flac',
              qualityOptions: QQ_DOWNLOAD_OPTIONS,
            },
          };
        })
        .filter((item) => item.id);
    } catch (error) {
      console.error('QQ search error:', error);
      return [];
    }
  }

  async getPlayInfo(id: string, extra?: unknown): Promise<PlayInfo> {
    const payload = extra as QQExtra | undefined;
    const selectedParser = payload?.selectedParser;
    try {
      if (selectedParser === 'xcvts') {
        return await this.getByXcvts(id);
      }
      if (selectedParser === 'cyapi') {
        return await this.getByCyapi(id);
      }

      try {
        return await this.getByXcvts(id);
      } catch (error) {
        console.warn('QQ xcvts fallback:', error);
      }
      try {
        return await this.getByCyapi(id);
      } catch (error) {
        console.warn('QQ cyapi fallback:', error);
      }
      return await this.getByVkeys(id);
    } catch (error) {
      console.error('QQ getPlayInfo error:', error);
      throw error;
    }
  }

  async getLyric(id: string): Promise<QQLyricData> {
    const { data } = await axios.get('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
      headers: {
        'Referer': 'https://y.qq.com/portal/player.html',
        'User-Agent': SEARCH_HEADERS['User-Agent'],
      },
      params: {
        songmid: id,
        g_tk: '5381',
        loginUin: '0',
        hostUin: '0',
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        platform: 'yqq',
      },
      timeout: 15000,
    });
    const encoded = typeof data?.lyric === 'string' ? data.lyric : '';
    const lrc = encoded ? decodeBase64(encoded) : '';
    return {
      songid: id,
      provider: 'qq',
      lines: parseLyricLines(lrc),
      lrc,
    };
  }

  private async getByVkeys(id: string): Promise<PlayInfo> {
    for (const quality of QUALITY_PRIORITY) {
      const { data } = await axios.get<VKeysGetUrlResponse>('https://api.vkeys.cn/v2/music/tencent/geturl', {
        headers: SEARCH_HEADERS,
        params: { mid: id, quality },
        timeout: 15000,
      });
      if (data?.code !== 200) {
        continue;
      }
      const url = data?.data?.url;
      if (typeof url === 'string' && url.startsWith('http')) {
        return {
          url,
          type: extractExt(url),
          bitrate: data?.data?.kbps || data?.data?.quality,
          cover: data?.data?.cover || undefined,
        };
      }
    }
    throw new Error('Failed to get play url');
  }

  private async getByXcvts(id: string): Promise<PlayInfo> {
    const apiKey = decodeBase64(pickRandom(XCVTS_KEYS));
    for (const quality of XCVTS_QUALITIES) {
      const { data } = await axios.get('https://api.xcvts.cn/api/music/qq', {
        headers: { 'User-Agent': SEARCH_HEADERS['User-Agent'] },
        params: { apiKey, mid: id, type: quality },
        timeout: 15000,
      });
      const payload = data?.data || {};
      const url = String(payload.music || '').trim();
      if (url.startsWith('http')) {
        return {
          url,
          type: extractExt(url),
          bitrate: quality,
          cover: typeof payload.cover === 'string' ? payload.cover : undefined,
        };
      }
    }
    throw new Error('Failed to get xcvts url');
  }

  private async getByCyapi(id: string): Promise<PlayInfo> {
    const { data } = await axios.get('https://cyapi.top/API/qq_music.php', {
      headers: { 'User-Agent': SEARCH_HEADERS['User-Agent'] },
      params: {
        apikey: pickRandom(CYAPI_KEYS),
        type: 'json',
        mid: id,
        quality: 'lossless',
      },
      timeout: 15000,
    });
    const url = String(data?.url || '').trim();
    if (!url.startsWith('http')) {
      throw new Error('Failed to get cyapi url');
    }
    return {
      url,
      type: extractExt(url),
      bitrate: 'lossless',
      cover: data?.cover?.large || data?.cover || undefined,
    };
  }
}
