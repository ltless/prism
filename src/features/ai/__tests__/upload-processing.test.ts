import { describe, it, expect } from 'vitest';

function shouldAutoChain(jobType: string, aestheticModel: string | undefined, aestheticEnabled: boolean | undefined): boolean {
  return (
    (jobType === 'upload-processing' || jobType === 'batch-tag') &&
    aestheticModel === 'laion' &&
    aestheticEnabled === true
  );
}

describe('upload-processing auto-chain', () => {
  it('chains SigLIP score after upload when laion enabled', () => {
    expect(shouldAutoChain('upload-processing', 'laion', true)).toBe(true);
  });

  it('does not chain when model is clip', () => {
    expect(shouldAutoChain('upload-processing', 'clip', true)).toBe(false);
  });

  it('does not chain when aesthetic disabled', () => {
    expect(shouldAutoChain('upload-processing', 'laion', false)).toBe(false);
  });

  it('does not chain for embed-image job type', () => {
    expect(shouldAutoChain('embed-image', 'laion', true)).toBe(false);
  });

  it('chains for batch-tag when laion enabled', () => {
    expect(shouldAutoChain('batch-tag', 'laion', true)).toBe(true);
  });
});
