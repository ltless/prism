// Sniff the real image format from a file's leading bytes so we never trust a
// client-supplied mime type or filename extension. Anything that doesn't match
// a known image signature is rejected.

const SIGNATURES: { mime: string; ext: string; match: (b: Buffer) => boolean }[] = [
  {
    mime: "image/jpeg",
    ext: "jpg",
    match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    match: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/gif",
    ext: "gif",
    match: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61,
  },
  {
    mime: "image/webp",
    ext: "webp",
    match: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

const EXT_BY_MIME: Record<string, string> = Object.fromEntries(
  SIGNATURES.map((s) => [s.mime, s.ext])
);

export function detectImageMime(buf: Buffer): string | null {
  for (const sig of SIGNATURES) {
    if (sig.match(buf)) return sig.mime;
  }
  return null;
}

export function extensionForMime(mime: string): string | null {
  return EXT_BY_MIME[mime] ?? null;
}
