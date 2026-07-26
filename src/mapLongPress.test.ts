import { afterEach, describe, expect, it, vi } from 'vitest';
import { installTouchLongPress, MAP_LONG_PRESS_DURATION_MS } from './mapLongPress';

function dispatchPointer(
  target: HTMLElement,
  type: string,
  values: Partial<PointerEvent> = {},
): void {
  const event = new Event(type);
  const defaults: Partial<PointerEvent> = {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX: 100,
    clientY: 120,
  };

  Object.entries({ ...defaults, ...values }).forEach(([key, value]) => {
    Object.defineProperty(event, key, { configurable: true, value });
  });
  target.dispatchEvent(event);
}

describe('installTouchLongPress', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('attiva il punto dopo una pressione touch prolungata', () => {
    vi.useFakeTimers();
    const target = document.createElement('div');
    const onLongPress = vi.fn();
    const cleanup = installTouchLongPress(target, onLongPress);

    dispatchPointer(target, 'pointerdown');
    vi.advanceTimersByTime(MAP_LONG_PRESS_DURATION_MS);

    expect(onLongPress).toHaveBeenCalledWith({ clientX: 100, clientY: 120 });
    cleanup();
  });

  it('annulla la pressione quando il dito si sposta per consentire il pan', () => {
    vi.useFakeTimers();
    const target = document.createElement('div');
    const onLongPress = vi.fn();
    const cleanup = installTouchLongPress(target, onLongPress);

    dispatchPointer(target, 'pointerdown');
    dispatchPointer(target, 'pointermove', { clientX: 130 });
    vi.advanceTimersByTime(MAP_LONG_PRESS_DURATION_MS);

    expect(onLongPress).not.toHaveBeenCalled();
    cleanup();
  });

  it('ignora mouse, pressioni brevi e tocchi secondari', () => {
    vi.useFakeTimers();
    const target = document.createElement('div');
    const onLongPress = vi.fn();
    const cleanup = installTouchLongPress(target, onLongPress);

    dispatchPointer(target, 'pointerdown', { pointerType: 'mouse' });
    vi.advanceTimersByTime(MAP_LONG_PRESS_DURATION_MS);
    dispatchPointer(target, 'pointerdown');
    dispatchPointer(target, 'pointerup');
    dispatchPointer(target, 'pointerdown', { pointerId: 2, isPrimary: false });
    vi.advanceTimersByTime(MAP_LONG_PRESS_DURATION_MS);

    expect(onLongPress).not.toHaveBeenCalled();
    cleanup();
  });
});
