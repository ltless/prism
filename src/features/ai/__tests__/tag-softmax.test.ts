import { describe, it, expect } from 'vitest';

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

function filterTags(probs: number[], labels: string[], threshold: number, topN: number) {
  return probs
    .map((p, i) => ({ tag: labels[i], score: p }))
    .filter(x => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

describe('softmax', () => {
  it('normalizes logits to probabilities summing to 1', () => {
    const logits = [2.0, 1.0, 0.5, 0.0, -1.0];
    const probs = softmax(logits);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it('all values positive', () => {
    const probs = softmax([-10, -5, 0, 5, 10]);
    probs.forEach(p => expect(p).toBeGreaterThan(0));
  });
});

describe('filterTags', () => {
  const LABELS = ['sunset', 'dog', 'car', 'tree', 'ocean'];

  it('returns only tags above threshold', () => {
    const logits = [3.0, 1.0, 0.1, 0.05, 0.01];
    const probs = softmax(logits);
    const result = filterTags(probs, LABELS, 0.1, 10);
    result.forEach(r => expect(r.score).toBeGreaterThanOrEqual(0.1));
  });

  it('caps at topN', () => {
    const logits = [5.0, 4.0, 3.0, 2.0, 1.0];
    const probs = softmax(logits);
    const result = filterTags(probs, LABELS, 0.001, 3);
    expect(result.length).toBe(3);
  });

  it('empty logits returns empty array', () => {
    expect(filterTags([], [], 0.1, 10)).toEqual([]);
  });
});
