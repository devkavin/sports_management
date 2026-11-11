interface Viewport { width: number; height: number; top: number; left: number; }
interface Target { top: number; bottom: number; left: number; right: number; }
export function tourPlacement(viewport: Viewport, target: Target | null, placement: string, measuredHeight = 260) {
  const gap = 8;
  const width = Math.max(0, Math.min(360, viewport.width - gap * 2));
  const height = Math.max(0, Math.min(measuredHeight, viewport.height - gap * 2));
  const minX = viewport.left + gap, minY = viewport.top + gap;
  const maxX = viewport.left + viewport.width - width - gap;
  const maxY = viewport.top + viewport.height - height - gap;
  let left = viewport.left + (viewport.width - width) / 2;
  let top = viewport.top + (viewport.height - height) / 2;
  if (viewport.width < 768) top = maxY;
  else if (target) {
    left = target.left;
    if (placement === 'bottom') top = target.bottom + 12;
    else if (placement === 'top') top = target.top - height - 12;
    else { top = target.top; left = placement === 'left' ? target.left - width - 12 : target.right + 12; }
  }
  return { left: Math.max(minX, Math.min(maxX, left)), top: Math.max(minY, Math.min(maxY, top)), width, maxHeight: height };
}
