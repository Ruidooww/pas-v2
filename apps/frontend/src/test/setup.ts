import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    }) as unknown as MediaQueryList;
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  };
}

if (typeof window !== "undefined") {
  window.scrollTo = () => undefined;
}
