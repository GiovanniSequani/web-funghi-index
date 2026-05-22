export type ActiveLayer = 'off' | 'porcini' | 'finferli';

export type Species = Exclude<ActiveLayer, 'off'>;

export type TileSet = {
  date: string;
  version: string;
};

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error' | 'unsupported';
