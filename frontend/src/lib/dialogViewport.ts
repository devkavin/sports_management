/** Keep fixed dialog layers within the visible area, including mobile keyboards. */
export function mountDialogViewport(layer: HTMLElement, host: Window = window): () => void {
  const viewport = host.visualViewport;
  const update = () => {
    const width = viewport?.width || host.innerWidth;
    const height = viewport?.height || host.innerHeight;
    layer.style.setProperty('--dialog-viewport-width', `${width}px`);
    layer.style.setProperty('--dialog-viewport-height', `${height}px`);
    layer.style.setProperty('--dialog-viewport-top', `${viewport?.offsetTop || 0}px`);
    layer.style.setProperty('--dialog-viewport-left', `${viewport?.offsetLeft || 0}px`);
  };
  update();
  host.addEventListener('resize', update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  return () => {
    host.removeEventListener('resize', update);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
  };
}
