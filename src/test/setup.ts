import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
});

class TestResizeObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: TestResizeObserver
});

HTMLCanvasElement.prototype.getContext = (() => ({
  clearRect: () => undefined,
  fillRect: () => undefined,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: () => undefined,
  createImageData: () => [],
  setTransform: () => undefined,
  drawImage: () => undefined,
  save: () => undefined,
  fillText: () => undefined,
  restore: () => undefined,
  beginPath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  closePath: () => undefined,
  stroke: () => undefined,
  translate: () => undefined,
  scale: () => undefined,
  rotate: () => undefined,
  arc: () => undefined,
  fill: () => undefined,
  measureText: () => ({ width: 0 }),
  transform: () => undefined,
  rect: () => undefined,
  clip: () => undefined
})) as unknown as HTMLCanvasElement["getContext"];
