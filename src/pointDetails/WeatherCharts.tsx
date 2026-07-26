import React from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDecimal, formatLongDate, formatShortDate } from './formatters';
import { indexFromClientX, moveSelectedIndex } from './geo';
import type { WeatherDay } from './types';

const COLORS = {
  minimum: '#5ba8ff',
  maximum: '#ff826f',
  precipitation: '#4c9ee8',
  humidity: '#36b6a0',
  gust: '#e7a93d',
  grid: 'rgba(204, 221, 196, 0.14)',
  selection: '#edf4e5',
};

type ChartDatum = WeatherDay & {
  temperatureRange: [number, number] | null;
};

type TooltipPayloadItem = {
  name?: string;
  value?: number | string | Array<number>;
  color?: string;
  unit?: string;
};

function AccessibleTooltip(props: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
}) {
  const { active, label, payload } = props;
  if (!active || !label || !payload?.length) return null;

  const values = payload.filter((item) => !Array.isArray(item.value) && item.value !== null);
  if (values.length === 0) return null;

  return (
    <div className="weather-tooltip" role="tooltip">
      <strong>{formatLongDate(label)}</strong>
      {values.map((item) => (
        <span key={item.name} style={{ color: item.color }}>
          {item.name}: {typeof item.value === 'number' ? item.value.toLocaleString('it-IT') : item.value}
          {item.unit ? ` ${item.unit}` : ''}
        </span>
      ))}
    </div>
  );
}

type ChartFrameProps = {
  title: string;
  description: string;
  days: WeatherDay[];
  selectedDateIndex: number;
  onSelectDateIndex: (index: number) => void;
  children: React.ReactNode;
};

function ChartFrame(props: ChartFrameProps) {
  const {
    title,
    description,
    days,
    selectedDateIndex,
    onSelectDateIndex,
    children,
  } = props;
  const frameRef = React.useRef<HTMLDivElement | null>(null);

  const selectFromClientX = (clientX: number) => {
    const bounds = frameRef.current?.getBoundingClientRect();
    if (!bounds) return;
    onSelectDateIndex(indexFromClientX(clientX, bounds.left, bounds.width, days.length));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = moveSelectedIndex(selectedDateIndex, event.key, days.length);
    if (next === selectedDateIndex) return;
    event.preventDefault();
    onSelectDateIndex(next);
  };

  return (
    <section className="weather-chart-section" aria-labelledby={`chart-${title}`}>
      <div className="weather-chart-heading">
        <h3 id={`chart-${title}`}>{title}</h3>
        <span>{description}</span>
      </div>
      <div
        ref={frameRef}
        className="weather-chart-frame"
        tabIndex={0}
        role="group"
        aria-label={`${title}. Usa freccia sinistra e destra per cambiare giorno.`}
        onKeyDown={onKeyDown}
        onTouchStart={(event) => selectFromClientX(event.touches[0].clientX)}
        onTouchMove={(event) => selectFromClientX(event.touches[0].clientX)}
      >
        {children}
      </div>
    </section>
  );
}

function interactionIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object' || !('activeTooltipIndex' in state)) return null;
  const raw = (state as { activeTooltipIndex?: number | string }).activeTooltipIndex;
  const index = typeof raw === 'string' ? Number(raw) : raw;
  return typeof index === 'number' && Number.isInteger(index) ? index : null;
}

function sharedChartProps(onSelectDateIndex: (index: number) => void) {
  const select = (state: unknown) => {
    const index = interactionIndex(state);
    if (index !== null) onSelectDateIndex(index);
  };
  return {
    syncId: 'point-weather',
    syncMethod: 'index' as const,
    margin: { top: 10, right: 12, bottom: 0, left: -12 },
    onMouseMove: select,
    onClick: select,
    accessibilityLayer: true,
  };
}

function CommonChartElements(props: {
  days: WeatherDay[];
  selectedDateIndex: number;
}) {
  const { days, selectedDateIndex } = props;
  const tickDates = days.filter((_, index) => index % 4 === 0 || index === days.length - 1).map((day) => day.date);

  return (
    <>
      <CartesianGrid stroke={COLORS.grid} vertical={false} />
      <XAxis
        dataKey="date"
        ticks={tickDates}
        tickFormatter={formatShortDate}
        axisLine={false}
        tickLine={false}
        minTickGap={18}
        tick={{ fill: '#82917d', fontSize: 10 }}
      />
      <ReferenceLine
        x={days[selectedDateIndex]?.date}
        stroke={COLORS.selection}
        strokeWidth={1}
        strokeDasharray="3 3"
        ifOverflow="extendDomain"
      />
      <Tooltip
        content={<AccessibleTooltip />}
        cursor={{ stroke: 'rgba(237, 244, 229, 0.45)', strokeWidth: 1 }}
        isAnimationActive={false}
      />
    </>
  );
}

export function WeatherCharts(props: {
  days: WeatherDay[];
  selectedDateIndex: number;
  onSelectDateIndex: (index: number) => void;
}) {
  const { days, selectedDateIndex, onSelectDateIndex } = props;
  const data = React.useMemo<ChartDatum[]>(
    () =>
      days.map((day) => ({
        ...day,
        temperatureRange:
          day.temperatureMin === null || day.temperatureMax === null
            ? null
            : [day.temperatureMin, day.temperatureMax],
      })),
    [days],
  );
  const selectedDay = days[selectedDateIndex];
  const chartProps = sharedChartProps(onSelectDateIndex);

  return (
    <div className="weather-charts">
      <ChartFrame
        title="Temperature"
        description="Minima e massima · °C"
        days={days}
        selectedDateIndex={selectedDateIndex}
        onSelectDateIndex={onSelectDateIndex}
      >
        <ResponsiveContainer width="100%" height={184}>
          <ComposedChart data={data} {...chartProps}>
            <CommonChartElements days={days} selectedDateIndex={selectedDateIndex} />
            <YAxis
              width={42}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#82917d', fontSize: 10 }}
              tickFormatter={(value: number) => `${value}°`}
            />
            <Area
              dataKey="temperatureRange"
              name="Intervallo"
              stroke="none"
              fill="rgba(174, 151, 184, 0.22)"
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="temperatureMin"
              name="Minima"
              unit="°C"
              stroke={COLORS.minimum}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="temperatureMax"
              name="Massima"
              unit="°C"
              stroke={COLORS.maximum}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <span className="chart-selection-readout" aria-live="polite">
          {formatLongDate(selectedDay.date)}: min {formatDecimal(selectedDay.temperatureMin, '°C')}, max{' '}
          {formatDecimal(selectedDay.temperatureMax, '°C')}
        </span>
      </ChartFrame>

      <ChartFrame
        title="Precipitazioni"
        description="Somma giornaliera · mm"
        days={days}
        selectedDateIndex={selectedDateIndex}
        onSelectDateIndex={onSelectDateIndex}
      >
        <ResponsiveContainer width="100%" height={174}>
          <ComposedChart data={data} {...chartProps}>
            <CommonChartElements days={days} selectedDateIndex={selectedDateIndex} />
            <YAxis
              width={42}
              domain={[0, 'auto']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#82917d', fontSize: 10 }}
            />
            <Bar
              dataKey="precipitation"
              name="Pioggia"
              unit="mm"
              fill={COLORS.precipitation}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <span className="chart-selection-readout" aria-live="polite">
          {formatLongDate(selectedDay.date)}: {formatDecimal(selectedDay.precipitation, 'mm')}
        </span>
      </ChartFrame>

      <ChartFrame
        title="Umidità"
        description="Media giornaliera · %"
        days={days}
        selectedDateIndex={selectedDateIndex}
        onSelectDateIndex={onSelectDateIndex}
      >
        <ResponsiveContainer width="100%" height={174}>
          <ComposedChart data={data} {...chartProps}>
            <CommonChartElements days={days} selectedDateIndex={selectedDateIndex} />
            <YAxis
              width={42}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#82917d', fontSize: 10 }}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Line
              dataKey="humidity"
              name="Umidità"
              unit="%"
              stroke={COLORS.humidity}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <span className="chart-selection-readout" aria-live="polite">
          {formatLongDate(selectedDay.date)}: {formatDecimal(selectedDay.humidity, '%')}
        </span>
      </ChartFrame>

      <ChartFrame
        title="Raffiche"
        description="Massima giornaliera · km/h"
        days={days}
        selectedDateIndex={selectedDateIndex}
        onSelectDateIndex={onSelectDateIndex}
      >
        <ResponsiveContainer width="100%" height={174}>
          <ComposedChart data={data} {...chartProps}>
            <CommonChartElements days={days} selectedDateIndex={selectedDateIndex} />
            <YAxis
              width={42}
              domain={[0, 'auto']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#82917d', fontSize: 10 }}
            />
            <Line
              dataKey="gust"
              name="Raffiche"
              unit="km/h"
              stroke={COLORS.gust}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <span className="chart-selection-readout" aria-live="polite">
          {formatLongDate(selectedDay.date)}: {formatDecimal(selectedDay.gust, 'km/h')}
        </span>
      </ChartFrame>
    </div>
  );
}
