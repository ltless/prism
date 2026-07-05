import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom doesn't ship matchMedia — provide a minimal mock for hooks like
// useReducedMotion that read prefers-reduced-motion on mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom doesn't ship ImageData — provide minimal polyfill for adjustment
// engine tests that operate on raw RGBA pixel buffers.
if (typeof ImageData === 'undefined') {
  (globalThis as unknown as { ImageData?: typeof ImageData }).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace?: string;
    constructor(dataOrW: Uint8ClampedArray | number, wOrH?: number, h?: number) {
      if (dataOrW instanceof Uint8ClampedArray) {
        this.data = dataOrW;
        this.width = wOrH ?? 0;
        this.height = h ?? 0;
      } else {
        const w = dataOrW;
        const height = wOrH ?? 0;
        this.width = w;
        this.height = height;
        this.data = new Uint8ClampedArray(w * height * 4);
      }
    }
  } as unknown as typeof ImageData;
}

// Mock Next.js navigation
const mockRouter = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({
 useRouter: () => mockRouter,
 useSearchParams: () => ({
 get: vi.fn(),
 }),
 usePathname: () => '',
}));

// Mock Next.js cache
vi.mock('next/cache', () => ({
 revalidatePath: vi.fn(),
 revalidateTag: vi.fn(),
}));

vi.mock('@/auth', () => ({
 auth: vi.fn(() => Promise.resolve({ user: { id: 'test-user-id', role: 'admin' } })),
}));
