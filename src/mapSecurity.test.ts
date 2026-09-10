import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SATELLITE_STYLE } from './mapStyle';

describe('MapLibre security regression', () => {
  it('blocca la prima versione corretta indicata dall audit', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies['maplibre-gl']).toBe('6.4.1');
  });

  it('mantiene attribution statiche senza markup attivo', () => {
    for (const source of Object.values(SATELLITE_STYLE.sources ?? {})) {
      if (!('attribution' in source) || typeof source.attribution !== 'string') continue;
      expect(source.attribution).not.toMatch(/<script|\son\w+\s*=|javascript:/i);
    }
  });

  it('crea il popup applicativo tramite DOM React e non HTML interpolato', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('.setDOMContent(container)');
    expect(app).not.toContain('.setHTML(');
  });
});
