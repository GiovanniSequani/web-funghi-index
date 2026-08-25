import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { formatLongDate, formatShortDate } from '../pointDetails/formatters';
import { indexFromClientX, moveSelectedIndex } from '../pointDetails/geo';
import type { ResourceState } from '../pointDetails/types';
import type { IndexHistoryDay, IndexHistoryPointData } from './historyTypes';

const COLORS = {
  porcini: '#d69b52',
  finferli: '#55bfc2',
  current: '#edf4e5',
  selection: 'rgba(237, 244, 229, .48)',
  grid: 'rgba(204, 221, 196, .13)',
};

export type IndexHistoryChartDatum = IndexHistoryDay & {
  porciniForecast?: number | null;
  finferliForecast?: number | null;
};

type TooltipItem = {
  name?: string;
  value?: number | string;
  color?: string;
};

function HistoryTooltip(props: {
  active?: boolean;
  label?: string;
  payload?: TooltipItem[];
}) {
  if (!props.active || !props.label) return null;
  const values = (props.payload ?? []).filter((item) => typeof item.value === 'number');
  return (
    <div className="weather-tooltip index-history-tooltip" role="tooltip">
      <strong>{formatLongDate(props.label)}</strong>
      {values.length === 0 ? (
        <span>Nessun dato disponibile</span>
      ) : values.map((item) => (
        <span key={item.name} style={{ color: item.color }}>
          {item.name}: {Number(item.value).toLocaleString('it-IT', { maximumFractionDigits: 1 })}/100
        </span>
      ))}
    </div>
  );
}

export function currentHistoryIndex(data: IndexHistoryPointData): number {
  const current = data.days.findIndex((day) => day.date === data.indexDate);
  return current >= 0 ? current : Math.max(0, data.days.length - 1);
}

function scoreLabel(value: number | null): string {
  return value === null
    ? 'n/d'
    : value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '/100';
}

export function IndexHistoryChart(props: {
  state: ResourceState<IndexHistoryPointData>;
  onRetry: () => void;
}) {
  const { state, onRetry } = props;
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const data = state.status === 'success' ? state.data : null;

  React.useEffect(() => {
    if (data) setSelectedIndex(currentHistoryIndex(data));
  }, [data?.version, data?.row, data?.col]);

  const selectFromClientX = (clientX: number) => {
    const bounds = frameRef.current?.getBoundingClientRect();
    if (!bounds || !data?.days.length) return;
    setSelectedIndex(indexFromClientX(clientX, bounds.left, bounds.width, data.days.length));
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!data?.days.length) return;
    const next = moveSelectedIndex(selectedIndex, event.key, data.days.length);
    if (next === selectedIndex) return;
    event.preventDefault();
    setSelectedIndex(next);
  };
  const selectFromChart = (chartState: unknown) => {
    if (!chartState || typeof chartState !== 'object' || !('activeTooltipIndex' in chartState)) return;
    const raw = (chartState as { activeTooltipIndex?: number | string }).activeTooltipIndex;
    const index = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof index === 'number' && Number.isInteger(index)) setSelectedIndex(index);
  };

  return (
    <section className="index-history-section" aria-labelledby="index-history-title">
      <div className="index-history-heading">
        <div>
          <h2 id="index-history-title">Andamento recente</h2>
          <span>Ultimi 28 giorni · score 0–100</span>
        </div>
        <div className="index-history-legend" aria-label="Legenda">
          <span data-species="porcini">Porcini</span>
          <span data-species="finferli">Finferli</span>
        </div>
      </div>

      {(state.status === 'loading' || state.status === 'idle') && (
        <div className="index-history-state" data-status="loading" role="status">
          <span className="details-spinner" aria-hidden="true" />
          Caricamento storico…
        </div>
      )}

      {!['idle', 'loading', 'success'].includes(state.status) && (
        <div className="index-history-state" data-status={state.status}>
          <span>{state.message ?? 'Storico non disponibile.'}</span>
          {(state.status === 'error' || state.status === 'unavailable') && (
            <button type="button" onClick={onRetry}>
              <RefreshCw size={13} aria-hidden="true" />
              Riprova
            </button>
          )}
        </div>
      )}

      {data && data.days.length > 0 && (
        <>
          <div
            ref={frameRef}
            className="index-history-chart"
            tabIndex={0}
            role="group"
            aria-label="Storico indice. Usa freccia sinistra e destra per cambiare giorno."
            onKeyDown={onKeyDown}
            onTouchStart={(event) => selectFromClientX(event.touches[0].clientX)}
            onTouchMove={(event) => selectFromClientX(event.touches[0].clientX)}
          >
            <ResponsiveContainer width="100%" height={190}>
              <LineChart
                data={data.days as IndexHistoryChartDatum[]}
                margin={{ top: 12, right: 10, bottom: 0, left: -18 }}
                onMouseMove={selectFromChart}
                onClick={selectFromChart}
                accessibilityLayer
              >
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  ticks={data.days.filter((_, index) => index % 5 === 0 || index === data.days.length - 1).map((day) => day.date)}
                  tickFormatter={formatShortDate}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={14}
                  tick={{ fill: '#82917d', fontSize: 9 }}
                />
                <YAxis
                  width={38}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#82917d', fontSize: 9 }}
                />
                <ReferenceLine
                  x={data.indexDate}
                  stroke={COLORS.current}
                  strokeWidth={1.5}
                  label={{ value: 'oggi', position: 'insideTopRight', fill: '#b9c7b4', fontSize: 9 }}
                  ifOverflow="extendDomain"
                />
                {data.days[selectedIndex]?.date !== data.indexDate && (
                  <ReferenceLine
                    x={data.days[selectedIndex]?.date}
                    stroke={COLORS.selection}
                    strokeDasharray="3 3"
                    ifOverflow="extendDomain"
                  />
                )}
                <Tooltip
                  content={<HistoryTooltip />}
                  cursor={{ stroke: COLORS.selection, strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="porciniScore"
                  name="Porcini"
                  stroke={COLORS.porcini}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3.5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="finferliScore"
                  name="Finferli"
                  stroke={COLORS.finferli}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3.5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="index-history-readout" aria-live="polite">
            <strong>{formatLongDate(data.days[selectedIndex]?.date ?? data.indexDate)}</strong>
            <span>Porcini {scoreLabel(data.days[selectedIndex]?.porciniScore ?? null)}</span>
            <span>Finferli {scoreLabel(data.days[selectedIndex]?.finferliScore ?? null)}</span>
          </p>
        </>
      )}
    </section>
  );
}