import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom in this env doesn't ship a localStorage; zustand's persist middleware
// (used by the AI store) needs it. Provide a minimal in-memory polyfill.
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  class MemoryStorage {
    private store = new Map<string, string>();
    getItem(key: string): string | null {
      return this.store.has(key) ? (this.store.get(key) as string) : null;
    }
    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }
    removeItem(key: string): void {
      this.store.delete(key);
    }
    clear(): void {
      this.store.clear();
    }
    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }
    get length(): number {
      return this.store.size;
    }
  }
  const storage = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
}

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
