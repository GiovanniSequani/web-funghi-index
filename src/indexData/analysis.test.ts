import { describe, expect, it } from 'vitest';
import { buildPorciniAnalysis } from './analysis';
import { INDEX_DIAGNOSTIC_NAMES, type IndexPointData } from './types';

function pointData(overrides: Partial<IndexPointData['diagnostics']> = {}): IndexPointData {
  const diagnostics = Object.fromEntries(
    INDEX_DIAGNOSTIC_NAMES.map((name) => [name, null]),
  ) as IndexPointData['diagnostics'];
  Object.assign(diagnostics, {
    habitat: 0.9,
    potential: 0.8,
    trigger: 0.85,
    incubation: 0.65,
    moisture: 0.25,
    stress: 0.3,
    drying_total: 0.75,
    temp_score: 0.8,
    humidity_score: 0.35,
    post_rain_score: 0.7,
    drying_exposure_static: 0.8,
    retention_static: 0.4,
    rain_need_factor: 1.2,
    low_humidity_days: 3,
    presence_carryover: 5,
    rain_recovery_seed: 0,
    ...overrides,
  });

  return {
    version: 'v1',
    indexDate: '2026-07-26',
    row: 10,
    col: 20,
    porciniScore: 72,
    finferliScore: 40,
    porciniBaseScore: 67,
    diagnostics,
    diagnosticLabels: {
      temporal_phase: 'fase_favorevole',
      temperature_band: 'ottimale',
    },
    context: {
      configuredLagsDays: [7, 8, 9, 10],
      dynamicWeights: {
        habitat: 0.28,
        trigger: 0.3,
        incubation: 0.22,
        moisture: 0.16,
        stress: 0.04,
      },
      formulas: {},
      thresholds: {},
      incubationNote: null,
      temporalPhaseNote: null,
    },
  };
}

describe('analisi porcini semplificata', () => {
  it('raggruppa i diagnostici in poche categorie senza ripeterli', () => {
    const analysis = buildPorciniAnalysis(pointData());
    const factors = [...analysis.favorable, ...analysis.unfavorable];

    expect(factors).toHaveLength(6);
    expect(factors.map((factor) => factor.id).sort()).toEqual([
      'drying',
      'habitat',
      'rain',
      'temperature',
      'temporal',
      'water',
    ]);

    const sourceIds = factors.flatMap((factor) => factor.sourceIds);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
  });

  it('usa giudizi qualitativi e rende espliciti significato e unità', () => {
    const analysis = buildPorciniAnalysis(pointData());
    const factors = [...analysis.favorable, ...analysis.unfavorable];
    const rain = factors.find((factor) => factor.id === 'rain');
    const water = factors.find((factor) => factor.id === 'water');
    const drying = factors.find((factor) => factor.id === 'drying');

    expect(rain?.evidence).toBe('Molto favorevole');
    expect(rain?.details.join(' ')).toMatch(/85 su 100/i);
    expect(rain?.help).toMatch(/pioggia cumulata.*7 e 16 giorni/i);
    expect(water?.details.join(' ')).toMatch(/3.*giorni con umidità minima sotto il 42%/i);
    expect(drying?.evidence).toBe('Sfavorevole');
    expect(drying?.details.join(' ')).toMatch(/più basso è meglio/i);
  });

  it('non espone nomi di diagnostici interni negli help', () => {
    const analysis = buildPorciniAnalysis(pointData());
    const helpText = [...analysis.favorable, ...analysis.unfavorable]
      .map((factor) => factor.help)
      .join(' ');

    expect(helpText).not.toMatch(
      /drying_total|drying_exposure_static|low_humidity_days|trigger|post_rain_score|rain_need_factor|temp_score|humidity_score|retention_static|temporal_phase|presence_carryover/i,
    );
    expect(helpText).toMatch(/pioggia|temperatur|umidità|quota|copertura forestale/i);
  });

  it('ordina le categorie per importanza pratica dichiarata', () => {
    const analysis = buildPorciniAnalysis(pointData());
    expect(analysis.favorable[0].importance).toBeGreaterThanOrEqual(
      analysis.favorable.at(-1)?.importance ?? 0,
    );
    expect(analysis.unfavorable[0].importance).toBeGreaterThanOrEqual(
      analysis.unfavorable.at(-1)?.importance ?? 0,
    );
  });

  it('tratta temporal_phase con cautela e non la ricava da incubation', () => {
    const data = pointData({ incubation: 0.99, temporal_phase: 0 });
    data.diagnosticLabels.temporal_phase = 'non_determinabile';
    const analysis = buildPorciniAnalysis(data);

    expect(
      [...analysis.favorable, ...analysis.unfavorable].find(
        (factor) => factor.id === 'temporal',
      ),
    ).toBeUndefined();
  });
});
