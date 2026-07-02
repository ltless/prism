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

function clipAestheticScore(imageLogits: number[][], textLogits: number[][]): number {
  const WEIGHTS = [0.5, 0.3, 0.2];
  const TEMP = 0.15;

  let totalScore = 0;
  for (let i = 0; i < WEIGHTS.length; i++) {
    const goodSim = cosineSimilarity(imageLogits[0], textLogits[i * 2]);
    const badSim = cosineSimilarity(imageLogits[0], textLogits[i * 2 + 1]);
    const expGood = Math.exp(goodSim / TEMP);
    const expBad = Math.exp(badSim / TEMP);
    const probGood = expGood / (expGood + expBad);
    totalScore += probGood * WEIGHTS[i];
  }
  return totalScore;
}

function sigmoidAestheticScore(logit: number): number {
  const sigmoid = 1 / (1 + Math.exp(-logit));
  return sigmoid * 5.5;
}

describe('CLIP aesthetic score', () => {
  it('high similarity to good prompts gives score near 1', () => {
    const imgEmb = [1, 0, 0];
    const txtEmbs = [
      [0.9, 0.1, 0], [0.1, 0.9, 0],
      [0.85, 0.15, 0], [0.15, 0.85, 0],
      [0.8, 0.2, 0], [0.2, 0.8, 0],
    ];
    const score = clipAestheticScore([imgEmb], txtEmbs);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('low similarity to good prompts gives score near 0', () => {
    const imgEmb = [0, 1, 0];
    const txtEmbs = [
      [0.9, 0.1, 0], [0.1, 0.9, 0],
      [0.85, 0.15, 0], [0.15, 0.85, 0],
      [0.8, 0.2, 0], [0.2, 0.8, 0],
    ];
    const score = clipAestheticScore([imgEmb], txtEmbs);
    expect(score).toBeLessThan(0.5);
  });

  it('works with empty/zero embeddings', () => {
    const score = clipAestheticScore([[0, 0, 0]], [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('SigLIP aesthetic score', () => {
  it('sigmoid centered around 5.5', () => {
    const score = sigmoidAestheticScore(0);
    expect(score).toBeCloseTo(2.75, 1);
  });

  it('high logit gives near max score', () => {
    const score = sigmoidAestheticScore(10);
    expect(score).toBeGreaterThan(5);
  });

  it('low logit gives near min score', () => {
    const score = sigmoidAestheticScore(-10);
    expect(score).toBeLessThan(0.5);
  });
});
