import { describe, expect, it } from 'vitest';
import { videoFromSearch } from './video-list.ts';

describe('videoFromSearch', () => {
  it('opens the video a link names, counted from 1', () => {
    expect(videoFromSearch('?video=3', 7)).toBe(2);
    expect(videoFromSearch('?video=1', 7)).toBe(0);
    expect(videoFromSearch('?x=1&video=7', 7)).toBe(6);
  });

  it('opens none without a valid number', () => {
    for (const search of ['', '?video=', '?video=0', '?video=8', '?video=-1', '?video=2.5', '?video=abc', '?video=3x'])
      expect(videoFromSearch(search, 7)).toBeUndefined();
  });
});
