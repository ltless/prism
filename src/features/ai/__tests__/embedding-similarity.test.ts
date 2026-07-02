import { describe, it, expect } from 'vitest';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

describe('Embedding similarity', () => {
  it('identical embeddings have similarity 1', () => {
    const emb = [0.5, 0.3, 0.2, 0.1];
    expect(cosineSimilarity(emb, emb)).toBeCloseTo(1, 5);
  });

  it('orthogonal embeddings have similarity 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('similar images score above near-duplicate threshold (0.95)', () => {
    const a = [0.5, 0.3, 0.2];
    const b = [0.51, 0.29, 0.2];
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.95);
  });

  it('different images score below 0.5', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeLessThan(0.5);
  });

  it('zero vector returns 0 (no division by zero crash)', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
