import { describe, it, expect } from 'vitest';
import { TAG_TAXONOMY, TAG_CANDIDATES, TAG_TO_CATEGORY } from '../tag-candidates.mts';

describe('TAG_TAXONOMY', () => {
  it('has 18 categories', () => {
    const categories = Object.keys(TAG_TAXONOMY);
    expect(categories.length).toBe(18);
  });

  it('all category names are non-empty', () => {
    for (const cat of Object.keys(TAG_TAXONOMY)) {
      expect(cat.length).toBeGreaterThan(0);
    }
  });

  it('all tags are non-empty strings', () => {
    for (const tags of Object.values(TAG_TAXONOMY)) {
      tags.forEach(t => expect(t.length).toBeGreaterThan(0));
    }
  });
});

describe('TAG_CANDIDATES', () => {
  it('flat array contains all tags from taxonomy', () => {
    const allTags = Object.values(TAG_TAXONOMY).flat();
    expect(TAG_CANDIDATES.sort()).toEqual(allTags.sort());
  });

  it('has no duplicates', () => {
    expect(new Set(TAG_CANDIDATES).size).toBe(TAG_CANDIDATES.length);
  });
});

describe('TAG_TO_CATEGORY', () => {
  it('maps every tag back to its category', () => {
    for (const [cat, tags] of Object.entries(TAG_TAXONOMY)) {
      tags.forEach(t => {
        expect(TAG_TO_CATEGORY[t]).toBe(cat);
      });
    }
  });
});
