import type { MusicProvider } from '../../types/music';
import { GequbaoProvider } from './impl/gequbao';
import { GequhaiProvider } from './impl/gequhai';
import { BuguProvider } from './impl/bugu';
import { BodianProvider } from './impl/bodian';
import { QQProvider } from './impl/qq';
import { KugouProvider } from './impl/kugou';
import { QQMp3Provider } from './impl/qqmp3';
import { MiguProvider } from './impl/migu';
import { LivepooProvider } from './impl/livepoo';
import { JianbinProvider } from './impl/jianbin';
import { AitingProvider } from './impl/aiting';
import { JooxProvider } from './impl/joox';
import { NeteaseOfficialProvider } from './impl/netease';

const providers: Record<string, MusicProvider> = {
  'netease': new NeteaseOfficialProvider(),
  qq: new QQProvider(),
  kugou: new KugouProvider(),
  gequbao: new GequbaoProvider(),
  gequhai: new GequhaiProvider(),
  bugu: new BuguProvider(),
  bodian: new BodianProvider(),
  qqmp3: new QQMp3Provider(),
  mitu: new QQMp3Provider('mitu'),
  joox: new JooxProvider(),
  migu: new MiguProvider(),
  livepoo: new LivepooProvider(),
  aiting: new AitingProvider(),
  'jianbin-netease': new JianbinProvider('jianbin-netease', 'netease'),
  'jianbin-qq': new JianbinProvider('jianbin-qq', 'qq'),
  'jianbin-kugou': new JianbinProvider('jianbin-kugou', 'kugou'),
  'jianbin-kuwo': new JianbinProvider('jianbin-kuwo', 'kuwo'),
};

export function getProvider(name: string = 'netease'): MusicProvider {
  return providers[name] || providers['netease'];
}

export function getAllProviders(): MusicProvider[] {
  return Object.values(providers);
}

export function listProviders(): string[] {
  return Object.keys(providers);
}
