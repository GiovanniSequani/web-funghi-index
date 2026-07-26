export const MAP_LONG_PRESS_DURATION_MS = 600;
export const MAP_LONG_PRESS_MOVE_TOLERANCE_PX = 12;

export type LongPressClientPoint = {
  clientX: number;
  clientY: number;
};

type LongPressOptions = {
  durationMs?: number;
  moveTolerancePx?: number;
};

export function installTouchLongPress(
  target: HTMLElement,
  onLongPress: (point: LongPressClientPoint) => void,
  options: LongPressOptions = {},
): () => void {
  const durationMs = options.durationMs ?? MAP_LONG_PRESS_DURATION_MS;
  const moveTolerancePx = options.moveTolerancePx ?? MAP_LONG_PRESS_MOVE_TOLERANCE_PX;
  let activePointerId: number | null = null;
  let startPoint: LongPressClientPoint | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearGesture = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    activePointerId = null;
    startPoint = null;
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !event.isPrimary || activePointerId !== null) return;

    activePointerId = event.pointerId;
    startPoint = { clientX: event.clientX, clientY: event.clientY };
    timer = setTimeout(() => {
      timer = null;
      if (startPoint) onLongPress(startPoint);
    }, durationMs);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId || !startPoint) return;
    const distance = Math.hypot(
      event.clientX - startPoint.clientX,
      event.clientY - startPoint.clientY,
    );
    if (distance > moveTolerancePx) clearGesture();
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (event.pointerId === activePointerId) clearGesture();
  };

  target.addEventListener('pointerdown', handlePointerDown);
  target.addEventListener('pointermove', handlePointerMove);
  target.addEventListener('pointerup', handlePointerEnd);
  target.addEventListener('pointercancel', handlePointerEnd);

  return () => {
    clearGesture();
    target.removeEventListener('pointerdown', handlePointerDown);
    target.removeEventListener('pointermove', handlePointerMove);
    target.removeEventListener('pointerup', handlePointerEnd);
    target.removeEventListener('pointercancel', handlePointerEnd);
  };
}
