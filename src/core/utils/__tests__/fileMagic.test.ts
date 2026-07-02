import { describe, it, expect } from "vitest";
import { detectImageMime, extensionForMime } from "../fileMagic";

function buf(bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

describe("detectImageMime", () => {
  it("detects jpeg", () => {
    expect(detectImageMime(buf([0xff, 0xd8, 0xff, 0xe0, 0x10, 0x00]))).toBe("image/jpeg");
  });

  it("detects png", () => {
    expect(
      detectImageMime(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]))
    ).toBe("image/png");
  });

  it("detects gif87a", () => {
    expect(detectImageMime(buf([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00]))).toBe("image/gif");
  });

  it("detects gif89a", () => {
    expect(detectImageMime(buf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00]))).toBe("image/gif");
  });

  it("detects webp", () => {
    expect(
      detectImageMime(buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]))
    ).toBe("image/webp");
  });

  it("rejects non-image bytes", () => {
    expect(detectImageMime(buf([0x3c, 0x21, 0x44, 0x4f]))).toBeNull(); // "<!DO"
    expect(detectImageMime(buf([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it("rejects a too-short buffer", () => {
    expect(detectImageMime(buf([0xff, 0xd8]))).toBeNull();
  });
});

describe("extensionForMime", () => {
  it("maps known image mimes to extensions", () => {
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/gif")).toBe("gif");
    expect(extensionForMime("image/webp")).toBe("webp");
  });

  it("returns null for unknown mime", () => {
    expect(extensionForMime("application/pdf")).toBeNull();
  });
});
